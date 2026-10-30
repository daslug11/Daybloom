import { Check } from 'lucide-react';
import { calendarColor } from '../../lib/calendars';
import type { CalendarGroup, CalendarLink } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Modal } from '../ui/Modal';

/** The touch and keyboard way to move a calendar between groups (drag does the same with a mouse). */
export function MoveToGroupDialog({ calendar, groups, current, onMove, onClose }: { calendar: CalendarLink; groups: CalendarGroup[]; current: string | null; onMove: (groupId: string | null) => void; onClose: () => void }) {
  const options = [...groups.map((g) => ({ id: g.id as string | null, name: g.name, color: calendarColor(g.color) })), { id: null, name: 'Ungrouped', color: 'rgb(var(--faint))' }];
  return (
    <Modal open onClose={onClose} title="Move to group" description={`${calendar.emoji} ${calendar.name}`}>
      <ul className="-mx-2 space-y-0.5">
        {options.map((o) => {
          const here = o.id === current;
          return (
            <li key={o.id ?? 'ungrouped'}>
              <button
                className={cn('flex min-h-11 w-full items-center gap-3 rounded-control px-2 text-left text-sm hover:bg-raised disabled:cursor-default disabled:hover:bg-transparent', here && 'font-semibold')}
                disabled={here}
                autoFocus={!here && o === options.find((x) => x.id !== current)}
                onClick={() => onMove(o.id)}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: o.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                {here && (
                  <span className="muted flex items-center gap-1 text-xs">
                    <Check size={14} aria-hidden /> Here now
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
