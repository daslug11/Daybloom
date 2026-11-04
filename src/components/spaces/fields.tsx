/** How each building-block field is shown and edited. */
import { Check, ExternalLink, ImagePlus, Loader2, Star, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUserId } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  cachedImageUrl,
  formatDuration,
  formatValue,
  imageUrl,
  parseDurationText,
  spaceColor,
  STATUS_CLASSES,
  uploadImage,
  valueOf,
  type Field,
  type LinkPreview,
  type SpaceDesign,
  type SpaceItem,
} from '../../lib/spaces';
import { cn } from '../../lib/utils';

export function SpaceIcon({ emoji, color, size = 'md', className }: { emoji: string; color: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const hex = spaceColor(color);
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center leading-none',
        size === 'sm' && 'h-6 w-6 rounded-md text-sm',
        size === 'md' && 'h-9 w-9 rounded-control text-lg',
        size === 'lg' && 'h-12 w-12 rounded-card text-2xl',
        className,
      )}
      style={{ background: `${hex}26`, boxShadow: `inset 0 0 0 1px ${hex}59` }}
    >
      {emoji}
    </span>
  );
}

export function StatusPill({ field, value, className }: { field: Field; value: unknown; className?: string }) {
  const opt = field.options?.find((o) => o.id === value);
  if (!opt) return null;
  return <span className={cn('inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_CLASSES[opt.color], className)}>{opt.label}</span>;
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-px text-warning', className)} aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={12} aria-hidden className={i < value ? 'fill-current' : 'opacity-30'} />
      ))}
    </span>
  );
}

/** A stored image (private bucket) shown through a short-lived signed URL. */
export function SpaceImage({ value, alt, className }: { value: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(() => cachedImageUrl(value));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    if (!url) imageUrl(value).then((u) => live && (u ? setUrl(u) : setFailed(true)));
    return () => {
      live = false;
    };
  }, [value, url]);
  if (failed) return <div className={cn('flex items-center justify-center bg-raised text-xs text-faint', className)}>Image unavailable</div>;
  if (!url) return <div className={cn('animate-pulse bg-raised', className)} aria-hidden />;
  return <img src={url} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className={cn('object-cover', className)} onError={() => setFailed(true)} />;
}

/** Compact, read-only display of one value (used in rows, cards and the share page). */
export function FieldValue({ design, field, item, today, preview }: { design: SpaceDesign; field: Field; item: Pick<SpaceItem, 'id' | 'values'>; today: string; preview?: LinkPreview }) {
  const v = valueOf(design, field, item, today);
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return null;
  switch (field.type) {
    case 'status':
      return <StatusPill field={field} value={v} />;
    case 'rating':
      return <Stars value={Number(v)} />;
    case 'checkbox':
      return v ? <span className="inline-flex items-center gap-1 text-xs text-muted"><Check size={12} aria-hidden /> {field.name}</span> : null;
    case 'link': {
      const label = preview?.title || formatValue(design, field, v);
      return (
        <a href={String(v)} target="_blank" rel="noopener noreferrer nofollow" onClick={(e) => e.stopPropagation()} className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
          <span className="truncate">{label}</span>
          <ExternalLink size={11} className="shrink-0" aria-hidden />
        </a>
      );
    }
    case 'image':
      return <SpaceImage value={String(v)} alt={field.name} className="h-8 w-8 rounded-md" />;
    case 'tags':
      return (
        <span className="inline-flex flex-wrap gap-1">
          {(v as string[]).map((t) => (
            <span key={t} className="rounded-full bg-ink/[0.06] px-1.5 py-0.5 text-xs text-muted">#{t}</span>
          ))}
        </span>
      );
    case 'computed': {
      const text = formatValue(design, field, v);
      const late = field.compute?.kind === 'days_until' && typeof v === 'number' && v < 0;
      const soon = field.compute?.kind === 'days_until' && typeof v === 'number' && v >= 0 && v <= 3;
      return <span className={cn('text-xs tabular-nums', late ? 'font-medium text-danger' : soon ? 'font-medium text-warning' : 'text-muted')}>{text}</span>;
    }
    default:
      return <span className="truncate text-xs tabular-nums text-muted">{formatValue(design, field, v)}</span>;
  }
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------
interface InputProps {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  /** Called when a text-like field loses focus (saves without a save button). */
  onCommit?: () => void;
  id?: string;
  people?: string[];
  autoFocus?: boolean;
}

export function FieldInput({ field, value, onChange, onCommit, id, people, autoFocus }: InputProps) {
  const commitOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      onCommit?.();
    }
  };
  switch (field.type) {
    case 'long_text':
      return <textarea id={id} className="input min-h-[88px] resize-y" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} maxLength={5000} autoFocus={autoFocus} />;
    case 'number':
    case 'money':
      return (
        <div className="relative">
          {field.type === 'money' && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-faint">{currencySymbol(field.currency)}</span>}
          <input
            id={id}
            className={cn('input tabular-nums', field.type === 'money' && 'pl-8', field.unit && 'pr-14')}
            inputMode="decimal"
            value={value === undefined || value === null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, '').replace(',', '.'))}
            onBlur={onCommit}
            onKeyDown={commitOnEnter}
            autoFocus={autoFocus}
          />
          {field.unit && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-faint">{field.unit}</span>}
        </div>
      );
    case 'duration':
      return <DurationInput id={id} value={value} onChange={onChange} onCommit={onCommit} autoFocus={autoFocus} />;
    case 'date':
      return <input id={id} type="date" className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} autoFocus={autoFocus} />;
    case 'checkbox':
      return (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input id={id} type="checkbox" className="h-5 w-5 accent-[rgb(var(--ink))]" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          {field.name}
        </label>
      );
    case 'status':
      return (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={field.name}>
          {field.options?.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={value === o.id}
              onClick={() => onChange(value === o.id ? undefined : o.id)}
              className={cn('rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-[box-shadow,opacity] duration-fast hit', value === o.id ? cn(STATUS_CLASSES[o.color], 'ring-2') : 'bg-surface text-muted ring-line-strong hover:text-ink')}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    case 'rating':
      return (
        <div className="flex gap-1" role="radiogroup" aria-label={field.name}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => onChange(value === n ? undefined : n)} className="hit rounded-md p-1 text-warning transition-transform duration-press ease-out motion-safe:active:scale-90">
              <Star size={20} className={Number(value ?? 0) >= n ? 'fill-current' : 'opacity-30'} aria-hidden />
            </button>
          ))}
        </div>
      );
    case 'tags':
      return <TagsInput id={id} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} onCommit={onCommit} />;
    case 'image':
      return <ImageInput id={id} value={typeof value === 'string' ? value : undefined} onChange={(v) => { onChange(v); setTimeout(() => onCommit?.(), 0); }} label={field.name} />;
    case 'person':
      return (
        <>
          <input id={id} className="input" list={`${id}-people`} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} onKeyDown={commitOnEnter} maxLength={500} autoFocus={autoFocus} autoComplete="off" />
          {!!people?.length && (
            <datalist id={`${id}-people`}>
              {people.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          )}
        </>
      );
    case 'link':
      return <input id={id} className="input" type="url" inputMode="url" placeholder="https://" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} onKeyDown={commitOnEnter} autoFocus={autoFocus} />;
    case 'computed':
      return null;
    default:
      return <input id={id} className="input" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} onKeyDown={commitOnEnter} maxLength={500} autoFocus={autoFocus} />;
  }
}

function currencySymbol(code = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

function DurationInput({ id, value, onChange, onCommit, autoFocus }: { id?: string; value: unknown; onChange: (v: unknown) => void; onCommit?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState(typeof value === 'number' ? formatDuration(value) : '');
  useEffect(() => setText(typeof value === 'number' ? formatDuration(value) : ''), [value]);
  return (
    <input
      id={id}
      className="input tabular-nums"
      placeholder="mm:ss or 45 min"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = text.trim() ? parseDurationText(text) : null;
        onChange(n ?? undefined);
        setTimeout(() => onCommit?.(), 0);
      }}
      autoFocus={autoFocus}
    />
  );
}

function TagsInput({ id, value, onChange, onCommit }: { id?: string; value: string[]; onChange: (v: unknown) => void; onCommit?: () => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.replace(/^#/, '').trim().toLowerCase();
    if (t && !value.includes(t) && value.length < 10) onChange([...value, t.slice(0, 30)]);
    setDraft('');
  };
  return (
    <div className="input flex min-h-[44px] flex-wrap items-center gap-1.5 !py-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-ink/[0.07] py-0.5 pl-2 pr-1 text-xs">
          #{t}
          <button type="button" className="hit rounded-full p-0.5 text-muted hover:text-ink" onClick={() => { onChange(value.filter((x) => x !== t)); setTimeout(() => onCommit?.(), 0); }} aria-label={`Remove tag ${t}`}>
            <X size={11} aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="min-w-[80px] flex-1 bg-transparent text-base outline-none sm:text-sm"
        value={draft}
        placeholder={value.length ? '' : 'Add a tag, press Enter'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => {
          add();
          onCommit?.();
        }}
      />
    </div>
  );
}

function ImageInput({ id, value, onChange, label }: { id?: string; value?: string; onChange: (v: unknown) => void; label: string }) {
  const uid = useUserId();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(uid, file));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="flex items-center gap-3">
      {value ? <SpaceImage value={value} alt={label} className="h-16 w-16 rounded-control border border-line" /> : <div className="flex h-16 w-16 items-center justify-center rounded-control border border-dashed border-line-strong text-faint"><ImagePlus size={20} aria-hidden /></div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ImagePlus size={14} aria-hidden />}
          {value ? 'Replace' : 'Upload'}
        </button>
        {value && (
          <button type="button" className="btn-ghost !min-h-9 !px-3 !py-1.5 text-xs" onClick={() => onChange(undefined)}>
            Remove
          </button>
        )}
      </div>
      <input id={id} ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} aria-label={`Upload ${label}`} />
    </div>
  );
}
