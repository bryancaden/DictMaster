// GET /api/health — ported from server.ts in bryancaden/DictMaster.
import { jsonResponse } from './gemini/_shared';

export async function onRequest(): Promise<Response> {
  return jsonResponse({ status: 'ok', timestamp: Date.now() });
}
