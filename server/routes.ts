import { handleAccountRequest } from './account.js';
import { handleAdminRequest } from './admin.js';
import { handleAtlasRequest } from './ai/atlas/handler.js';
import { handleAiRequest } from './ai/handler.js';
import { handleSyncRequest } from './calendar/sync.js';

/** Every API route; used by the Vite dev/preview server. Vercel uses the files in /api. */
export const API_ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  '/api/ai': handleAiRequest,
  '/api/atlas': handleAtlasRequest,
  '/api/account': handleAccountRequest,
  '/api/admin': handleAdminRequest,
  '/api/calendar-sync': handleSyncRequest,
};
