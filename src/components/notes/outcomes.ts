import { Archive, CalendarClock, Flag, Lightbulb, ListChecks, type LucideIcon, Repeat, StickyNote, Target } from 'lucide-react';
import type { NoteState } from '../../lib/types';
import type { ConvertKind } from './ConvertDialog';

/**
 * The one answer to "what is this note?", used everywhere the question is asked —
 * the note card's Convert menu, Process inbox and ✨ Organize — with the same words,
 * icons and order, so there's one vocabulary to learn.
 */
export interface Outcome {
  id: ConvertKind | 'idea' | 'reference' | 'archive';
  label: string;
  icon: LucideIcon;
  /** One line on what happens. */
  hint: string;
  /** Converting opens a small form; the rest just move the note. */
  convert?: ConvertKind;
  state?: NoteState;
}

export const OUTCOMES: Outcome[] = [
  { id: 'task', label: 'Make task', icon: ListChecks, hint: 'A to-do on your Tasks list, linked back to this note.', convert: 'task' },
  { id: 'block', label: 'Schedule', icon: CalendarClock, hint: 'Block time for it in the Planner.', convert: 'block' },
  { id: 'goal-task', label: 'Add to goal', icon: Target, hint: 'A task under one of your goals.', convert: 'goal-task' },
  { id: 'idea', label: 'Keep as idea', icon: Lightbulb, hint: 'Something you might do one day. Lives in Ideas.', state: 'idea' },
  { id: 'reference', label: 'Keep as reference', icon: StickyNote, hint: 'Worth keeping, nothing to do. Stays in All notes, out of your inbox.', state: 'note' },
  { id: 'archive', label: 'Archive', icon: Archive, hint: 'Done with it. Still searchable in Archive.', state: 'archived' },
  { id: 'habit', label: 'Make habit', icon: Repeat, hint: 'Something to do every day.', convert: 'habit' },
  { id: 'goal', label: 'Make goal', icon: Flag, hint: 'A bigger outcome with milestones.', convert: 'goal' },
];

export const outcome = (id: Outcome['id']) => OUTCOMES.find((o) => o.id === id)!;

/** The things a note can be turned into (they open the Convert form). */
export const CONVERSIONS = OUTCOMES.filter((o) => o.convert);

/** What to call a note's state in the UI. `note` is shown as "Reference". */
export const STATE_LABEL: Record<NoteState, string> = { inbox: 'Inbox', idea: 'Idea', note: 'Reference', archived: 'Archived' };

/** The toast after a note moves, so every place says the same thing. */
export function movedLabel(to: NoteState, from: NoteState) {
  if (to === 'archived') return 'Archived';
  if (to === 'idea') return 'Kept as an idea';
  if (to === 'note') return from === 'archived' ? 'Restored to All notes' : 'Kept as reference';
  return 'Moved back to the inbox';
}
