import { handleSyncRequest } from '../server/sync.js';

// Vercel Node.js function using Web-standard Request/Response handlers.
export function POST(request: Request) {
  return handleSyncRequest(request);
}

export function GET(request: Request) {
  return handleSyncRequest(request); // answers 405 with a helpful message
}
