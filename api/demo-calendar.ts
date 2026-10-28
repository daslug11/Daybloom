import { handleDemoCalendar } from '../server/sync.js';

// Served at /api/demo-calendar.ics via the rewrite in vercel.json.
export function GET(request: Request) {
  return handleDemoCalendar(request);
}
