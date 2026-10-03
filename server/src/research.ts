/**
 * "What kinds of X are on the market, and what is each good for?" Claude
 * searches the web and summarizes, citing sources. Summaries of forum chatter
 * can sound confident while resting on one comment, so the prompt asks for
 * "people often say" wording, and any source URL that didn't actually come
 * back from a search is dropped.
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { HttpError } from './http.js';

const client = new Anthropic();

const ResearchSchema = z.object({
  types: z
    .array(
      z.object({
        name: z.string().min(1),
        goodFor: z.string().min(1),
        sources: z.array(z.object({ title: z.string(), url: z.string() })).default([]),
      }),
    )
    .min(1),
});

export type MarketType = z.infer<typeof ResearchSchema>['types'][number];

function prompt(query: string, reason: string | undefined, city: string): string {
  return `A grandmother runs a small bakery in ${city} that sells parfaits. She has decades of baking experience. She is thinking about this ingredient: "${query}".${
    reason ? ` Her reason: "${reason}".` : ''
  }

Search the web (baking forums, cooking sites, reviews) for the main kinds of this ingredient sold in stores and what bakers say each kind is good for.

Give 2 or 3 kinds. For each, write "goodFor" as one plain sentence of at most 25 words, phrased as what people often say (for example "People often say it holds layers better"), not as fact. If sources disagree or there is little evidence, say that. Only list sources whose URLs came back from your searches.

Reply with only this JSON and nothing else:
{"types":[{"name":"...","goodFor":"...","sources":[{"title":"...","url":"..."}]}]}`;
}

/** Every URL the searches actually returned or the answer actually cited. */
function urlsSeen(content: Anthropic.Beta.BetaContentBlock[]): Set<string> {
  const urls = new Set<string>();
  for (const block of content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) {
        urls.add(r.url);
      }
    }
    if (block.type === 'text') {
      for (const c of block.citations ?? []) {
        if (c.type === 'web_search_result_location') {
          urls.add(c.url);
        }
      }
    }
  }
  return urls;
}

function parseJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new HttpError(502, 'The research answer had no JSON in it.');
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function researchIngredient(input: {
  query: string;
  reason?: string;
  city: string;
}): Promise<MarketType[]> {
  const [cityName, region] = input.city.split(',').map(s => s.trim());
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user', content: prompt(input.query, input.reason, input.city) },
  ];
  const allContent: Anthropic.Beta.BetaContentBlock[] = [];
  let response: Anthropic.Beta.BetaMessage | undefined;

  // A long search turn can pause; resume it a few times at most.
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      // On a policy decline, re-run on Anthropic's recommended fallback model.
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      tools: [
        {
          type: 'web_search_20260209',
          name: 'web_search',
          max_uses: 5,
          user_location: {
            type: 'approximate',
            city: cityName,
            region: region || undefined,
            country: 'CA',
          },
        },
      ],
      messages,
    });
    allContent.push(...response.content);
    if (response.stop_reason !== 'pause_turn') {
      break;
    }
    messages.push({ role: 'assistant', content: response.content });
  }

  if (!response) {
    throw new HttpError(502, 'No research answer.');
  }
  if (response.stop_reason === 'refusal') {
    throw new HttpError(422, 'The research request was declined.');
  }
  if (response.stop_reason === 'pause_turn' || response.stop_reason === 'max_tokens') {
    throw new HttpError(504, 'The research did not finish in time.');
  }

  // The JSON comes after the searches, in the final text.
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
  const parsed = ResearchSchema.safeParse(parseJson(text));
  if (!parsed.success) {
    throw new HttpError(502, 'The research answer was not in the expected shape.');
  }
  // Without structured outputs (incompatible with citations), the model
  // could write a URL it never fetched; keep only ones the search returned.
  const seen = urlsSeen(allContent);
  return parsed.data.types.slice(0, 3).map(t => ({
    name: t.name,
    goodFor: t.goodFor,
    sources: t.sources.filter(s => seen.has(s.url)).slice(0, 2),
  }));
}
