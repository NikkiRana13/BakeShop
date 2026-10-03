/**
 * Reads the price, unit, delivery terms and any seasonal note out of a
 * vendor's reply. Replies are messy ("depends on the season, call me"), so
 * the model is told to say found: false rather than guess.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { HttpError } from './http.js';

const client = new Anthropic();

const QuoteSchema = z.object({
  found: z.boolean(),
  priceCents: z.number().int().nullable(),
  packageSize: z.number().nullable(),
  packageUnit: z.enum(['g', 'kg', 'mL', 'L', 'unit']).nullable(),
  deliveryFeeCents: z.number().int().nullable(),
  deliveryNote: z.string().nullable(),
  minOrderQty: z.number().nullable(),
  seasonalNote: z.string().nullable(),
  note: z.string().nullable(),
});

/** Same shape as ExtractedQuote in the app, with missing values left out. */
export interface ExtractedQuote {
  found: boolean;
  priceCents?: number;
  packageSize?: number;
  packageUnit?: 'g' | 'kg' | 'mL' | 'L' | 'unit';
  deliveryFeeCents?: number;
  deliveryNote?: string;
  minOrderQty?: number;
  seasonalNote?: string;
  note?: string;
}

const SYSTEM = `You read replies from food vendors to a small bakery's price inquiry and pull out the quote.

Rules:
- Only use what the email explicitly says. Never estimate, convert currencies or fill gaps.
- priceCents is the quoted price in cents for one package; packageSize and packageUnit describe that package. "$3.80/kg" means priceCents 380, packageSize 1, packageUnit "kg".
- If there is no single clear price (a range, "depends", "call me", only a question back), set found to false, leave the price fields null, and put a one-sentence summary of what they said in note.
- deliveryFeeCents is the fee per delivery; use 0 only if they say delivery is free.
- deliveryNote is a few words like "Delivers Thursdays".
- minOrderQty is the minimum order converted to the base unit given below (grams, millilitres or units), or null.
- seasonalNote is what they said about prices changing by season, in their words, or null.
- When found is true, use note for anything the baker should double-check, or null.`;

export async function extractQuote(input: {
  emailText: string;
  ingredientName: string;
  unit: 'g' | 'mL' | 'unit';
}): Promise<ExtractedQuote> {
  const response = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'low', format: zodOutputFormat(QuoteSchema) },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Ingredient: ${input.ingredientName} (base unit: ${input.unit})\n\nVendor's reply:\n<email>\n${input.emailText}\n</email>`,
      },
    ],
  });
  if (response.stop_reason === 'refusal') {
    throw new HttpError(422, 'Reading this reply was declined.');
  }
  const q = response.parsed_output;
  if (!q) {
    throw new HttpError(502, 'The reply could not be read.');
  }
  // Treat a "found" quote without a usable price as not found.
  const found = q.found && !!q.priceCents && q.priceCents > 0 && !!q.packageSize && !!q.packageUnit;
  const out: ExtractedQuote = { found };
  for (const [key, value] of Object.entries(q)) {
    if (key !== 'found' && value !== null) {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  }
  if (!found) {
    delete out.priceCents;
    out.note ??= 'No clear price in this reply.';
  }
  return out;
}
