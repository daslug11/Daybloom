import { useState } from 'react';
import { cn } from '../../lib/utils';

const GUIDES: { id: string; label: string; steps: React.ReactNode[]; example?: string }[] = [
  {
    id: 'google',
    label: '🟦 Google',
    steps: [
      <>Open <strong>calendar.google.com</strong> on a computer (not the app).</>,
      <>Hover the calendar under <em>My calendars</em> → <strong>⋮ → Settings and sharing</strong>.</>,
      <>Scroll to <strong>Integrate calendar</strong> and copy <strong>Secret address in iCal format</strong>.</>,
      <>The <em>Public address</em> only works if the calendar is public; the <em>embed</em> link is for previews, not syncing.</>,
    ],
    example: 'https://calendar.google.com/calendar/ical/…/private-…/basic.ics',
  },
  {
    id: 'outlook',
    label: '📨 Outlook',
    steps: [
      <>In Outlook on the web, open <strong>Settings → Calendar → Shared calendars</strong>.</>,
      <>Under <strong>Publish a calendar</strong>, pick the calendar and “Can view all details”, then <strong>Publish</strong>.</>,
      <>Copy the <strong>ICS</strong> link (not the HTML one).</>,
    ],
    example: 'https://outlook.office365.com/owa/calendar/…/reachcalendar.ics',
  },
  {
    id: 'apple',
    label: '🍎 iCloud',
    steps: [
      <>On <strong>icloud.com/calendar</strong> (or the Calendar app), click the share icon next to a calendar.</>,
      <>Turn on <strong>Public Calendar</strong> and copy the link.</>,
      <>It starts with <code>webcal://</code> — that's fine, paste it as-is.</>,
    ],
    example: 'webcal://p42-caldav.icloud.com/published/2/…',
  },
  {
    id: 'other',
    label: '🔗 Others',
    steps: [
      <>Look for <strong>“Subscribe”, “Export”, “iCal”, “ICS”</strong> or <strong>“webcal”</strong> in the calendar's sharing settings.</>,
      <><strong>Notion Calendar</strong> shows your Google/Outlook calendars — sync those accounts' ICS addresses instead.</>,
      <><strong>Calendly</strong> booking pages aren't feeds; keep them as quick-launch links (sync off).</>,
    ],
  },
];

/** Explains how to find each provider's secret ICS address. */
export function IcsHelp() {
  const [tab, setTab] = useState(GUIDES[0].id);
  const guide = GUIDES.find((g) => g.id === tab)!;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
        {GUIDES.map((g) => (
          <button key={g.id} role="tab" aria-selected={tab === g.id} className={tab === g.id ? 'chip-on' : 'chip-off'} onClick={() => setTab(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <ol className="space-y-1.5 text-sm">
        {guide.steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[11px] font-bold text-violet-600 dark:text-violet-300">{i + 1}</span>
            <span className="leading-snug">{s}</span>
          </li>
        ))}
      </ol>
      {guide.example && (
        <p className={cn('muted mt-2 truncate rounded-lg bg-slate-900/5 px-2 py-1 font-mono text-[11px] dark:bg-white/5')}>{guide.example}</p>
      )}
      <p className="muted mt-3 text-xs">
        🔐 Secret addresses work like passwords — anyone with the link can read your calendar. Daybloom keeps them in this browser; the sync
        server only fetches them (caching results in memory for 10 minutes) and never stores them.
      </p>
    </div>
  );
}
