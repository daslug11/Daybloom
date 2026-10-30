import { Fragment, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Minimal, safe Markdown for notes: # headings, **bold**, *italic*, `code`,
 * [links](https://…), - / 1. lists and - [ ] checklists. Builds React nodes
 * (never innerHTML), so note text can't inject markup.
 */

const CHECK = /^(\s*)[-*] \[( |x|X)\] (.*)$/;
const BULLET = /^(\s*)[-*] (.*)$/;
const NUMBERED = /^(\s*)\d+[.)] (.*)$/;
const HEADING = /^(#{1,3}) (.*)$/;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Order matters: code first so its contents aren't formatted.
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\((https?:\/\/[^)\s]+)\))|(#[\p{L}\p{N}_-]+)|(https?:\/\/[^\s)]+)/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<code key={k}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{m[2].slice(2, -2)}</strong>);
    else if (m[3]) out.push(<em key={k}>{m[3].slice(1, -1)}</em>);
    else if (m[4]) {
      const label = m[4].slice(1, m[4].indexOf(']('));
      out.push(
        <a key={k} href={m[5]} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()}>
          {label}
        </a>,
      );
    } else if (m[6]) out.push(<span key={k} className="font-medium text-muted">{m[6]}</span>);
    else if (m[7]) {
      out.push(
        <a key={k} href={m[7]} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()}>
          {m[7].replace(/^https?:\/\//, '').slice(0, 40)}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface Props {
  text: string;
  className?: string;
  /** Called with the line index when a checklist box is toggled. Omit for read-only. */
  onToggleCheck?: (lineIndex: number) => void;
  /** Truncate long notes in list views. */
  maxLines?: number;
}

export function Markdown({ text, className, onToggleCheck, maxLines }: Props) {
  const lines = text.split('\n');
  const shown = maxLines ? lines.slice(0, maxLines) : lines;
  const blocks: ReactNode[] = [];
  let list: { type: 'ul' | 'ol'; items: ReactNode[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.type;
    blocks.push(<Tag key={`list-${blocks.length}`}>{list.items}</Tag>);
    list = null;
  };

  shown.forEach((line, idx) => {
    let m: RegExpMatchArray | null;
    if ((m = line.match(CHECK))) {
      const done = m[2].toLowerCase() === 'x';
      if (list?.type !== 'ul') {
        flush();
        list = { type: 'ul', items: [] };
      }
      list!.items.push(
        <li key={idx} className="-ml-5 list-none">
          <label className="flex cursor-pointer items-start gap-2 py-0.5 [@media(pointer:coarse)]:py-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={done}
            disabled={!onToggleCheck}
            onChange={() => onToggleCheck?.(idx)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-3.5 w-3.5 shrink-0 accent-ink"
            aria-label={m[3]}
          />
          <span className={cn(done && 'faint line-through')}>{inline(m[3], `l${idx}`)}</span>
          </label>
        </li>,
      );
    } else if ((m = line.match(BULLET)) || (m = line.match(NUMBERED))) {
      const type = BULLET.test(line) ? 'ul' : 'ol';
      if (list?.type !== type) {
        flush();
        list = { type, items: [] };
      }
      list!.items.push(<li key={idx}>{inline(m[2], `l${idx}`)}</li>);
    } else if ((m = line.match(HEADING))) {
      flush();
      const level = m[1].length;
      const content = inline(m[2], `h${idx}`);
      blocks.push(level === 1 ? <h1 key={idx}>{content}</h1> : level === 2 ? <h2 key={idx}>{content}</h2> : <h3 key={idx}>{content}</h3>);
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      blocks.push(<p key={idx}>{inline(line, `p${idx}`)}</p>);
    }
  });
  flush();
  const truncated = maxLines != null && lines.length > maxLines;
  return (
    <div className={cn('prose-note whitespace-pre-wrap break-words', className)}>
      {blocks.map((b, i) => (
        <Fragment key={i}>{b}</Fragment>
      ))}
      {truncated && <p className="faint text-xs">…</p>}
    </div>
  );
}

/** Flips the checkbox on one line of a note. */
export function toggleCheckLine(text: string, lineIndex: number) {
  const lines = text.split('\n');
  const m = lines[lineIndex]?.match(CHECK);
  if (!m) return text;
  lines[lineIndex] = `${m[1]}- [${m[2].trim() ? ' ' : 'x'}] ${m[3]}`;
  return lines.join('\n');
}

/** Counts checklist progress in a note (for the badge on note cards). */
export function checklistProgress(text: string) {
  let total = 0;
  let done = 0;
  for (const line of text.split('\n')) {
    const m = line.match(CHECK);
    if (m) {
      total++;
      if (m[2].trim()) done++;
    }
  }
  return { total, done };
}
