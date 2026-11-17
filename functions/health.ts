// GET /health — ported from server.ts in bryancaden/DictMaster.
import { jsonResponse } from './api/gemini/_shared';

export async function onRequest(): Promise<Response> {
  return jsonResponse({ status: 'ok', timestamp: Date.now() });
}
