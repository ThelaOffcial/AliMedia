import { enforceStoryBotRateLimit, generateAndUploadImage, jsonResponse, requireAliMediaAdmin } from '../src/server/storyBotServer.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonResponse(res, 405, { error: 'Method not allowed.' });
  }
  try {
    const { uid } = await requireAliMediaAdmin(req);
    await enforceStoryBotRateLimit(uid);
    const image = await generateAndUploadImage(req.body || {});
    return jsonResponse(res, 200, image);
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    if (status >= 500) console.error('[STORY BOT] Image endpoint failed:', err?.message || 'unknown error');
    return jsonResponse(res, status, { error: status >= 500 && status !== 503 ? 'Could not generate the illustration. Please try again.' : (err?.message || 'Request failed.') });
  }
}
