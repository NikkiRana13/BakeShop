/**
 * BakeShop vendor-search server. The phone app never holds API keys; it asks
 * this server, which asks Claude and Google. If this server is off or an
 * endpoint fails, the app falls back to sample data.
 */
import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { extractQuote } from './extractQuote.js';
import { HttpError } from './http.js';
import { findVendors } from './places.js';
import { researchIngredient } from './research.js';

const app = express();

// The Pantry website (Vite dev server) runs on another port, so browsers need
// CORS headers. Only listed origins may call the server; it spends API credit.
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403);
    return;
  }
  next();
});

app.use(express.json({ limit: '100kb' }));

const ResearchBody = z.object({
  query: z.string().trim().min(1).max(100),
  reason: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
});
const VendorsBody = z.object({
  query: z.string().trim().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const ExtractBody = z.object({
  emailText: z.string().trim().min(1).max(20000),
  ingredientName: z.string().trim().min(1).max(100),
  unit: z.enum(['g', 'mL', 'unit']),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) {
    throw new HttpError(400, `Bad request: ${r.error.issues.map(i => i.message).join('; ')}`);
  }
  return r.data;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    research: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    vendors: !!process.env.GOOGLE_MAPS_API_KEY,
  });
});

app.post('/research', async (req, res) => {
  const body = parse(ResearchBody, req.body);
  res.json({ types: await researchIngredient(body) });
});

app.post('/vendors', async (req, res) => {
  const body = parse(VendorsBody, req.body);
  res.json({ vendors: await findVendors(body) });
});

app.post('/extract-quote', async (req, res) => {
  const body = parse(ExtractBody, req.body);
  res.json(await extractQuote(body));
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 502;
  const message = err instanceof Error ? err.message : 'Something went wrong.';
  console.error(`[${status}]`, message);
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';
app.listen(port, host, () => {
  console.log(`Vendor server on http://${host}:${port}`);
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.log('  GOOGLE_MAPS_API_KEY not set: /vendors will fail and the app will use sample stores.');
  }
});
