/** Shapes shared by the sync backend and the browser app. */

export interface SyncFeed {
  /** Client-side calendar id, echoed back so results can be matched. */
  id: string;
  url: string;
}

export interface SyncRequestBody {
  feeds: SyncFeed[];
  /** ISO timestamps bounding which event instances to return. */
  from?: string;
  to?: string;
  /** IANA time zone of the browser; only used by the built-in demo feed. */
  tz?: string;
}

export interface SyncedEvent {
  id: string;
  calendarId: string;
  title: string;
  /** ISO instant, or "YYYY-MM-DD" when allDay. */
  start: string;
  /** ISO instant, or "YYYY-MM-DD" (exclusive) when allDay. */
  end: string;
  allDay: boolean;
  location?: string;
}

export interface FeedResult {
  id: string;
  ok: boolean;
  events: SyncedEvent[];
  error?: string;
  /** When the feed body was fetched (may be earlier than now if served from cache). */
  fetchedAt: string;
  cached: boolean;
}

export interface SyncResponseBody {
  results: FeedResult[];
}
