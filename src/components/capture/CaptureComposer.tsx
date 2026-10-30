import { Inbox, ListChecks, Mic, MicOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAddNote } from '../../hooks/data/notes';
import { useAddTasks } from '../../hooks/data/tasks';
import { useAi } from '../../hooks/useAi';
import type { CaptureMode } from '../../hooks/useAppActions';
import { useToast } from '../../hooks/useToast';
import { parseQuickAdd, taskFromParsed, type ParsedTask } from '../../lib/quickAdd';
import { createRecognizer, speechInputSupported, type Recognizer } from '../../lib/speech';
import { cn } from '../../lib/utils';
import { AiButton } from '../ui/Ai';
import { Modal } from '../ui/Modal';
import { TaskChips } from '../tasks/TaskChips';

interface AiParsed {
  title: string;
  due_date: string | null;
  due_time: string | null;
  priority: 'high' | 'medium' | 'low' | null;
  tags: string[];
  estimate_min: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialMode?: CaptureMode;
  initialText?: string;
  startVoice?: boolean;
}

/** One place to capture anything: a brain-dump note (default) or a task in plain language. */
export function CaptureComposer({ open, onClose, initialMode = 'note', initialText = '', startVoice }: Props) {
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [text, setText] = useState(initialText);
  const [aiParsed, setAiParsed] = useState<AiParsed | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const recognizer = useRef<Recognizer | null>(null);
  const baseText = useRef('');
  const addNote = useAddNote();
  const addTasks = useAddTasks();
  const parseAi = useAi<AiParsed>('parse_task');
  const toast = useToast();
  const navigate = useNavigate();
  const parsed = useMemo(() => parseQuickAdd(text), [text]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setText(initialText);
    setAiParsed(null);
    setVoiceError('');
    if (startVoice) setTimeout(toggleVoice, 150);
    return () => recognizer.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setAiParsed(null), [text]);

  function toggleVoice() {
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    setVoiceError('');
    baseText.current = text ? text.replace(/\s*$/, ' ') : '';
    recognizer.current = createRecognizer({
      continuous: true,
      onText: (t, isFinal) => {
        setText(baseText.current + t);
        if (isFinal) baseText.current = baseText.current + t + ' ';
      },
      onEnd: () => setListening(false),
      onError: (msg) => setVoiceError(msg),
    });
    if (!recognizer.current) {
      setVoiceError("Voice input isn't supported in this browser. Try Chrome, Edge or Safari.");
      return;
    }
    setListening(true);
    recognizer.current.start();
  }

  const close = () => {
    recognizer.current?.abort();
    setListening(false);
    onClose();
  };

  const save = () => {
    const value = text.trim();
    if (!value) return;
    recognizer.current?.stop();
    if (mode === 'note') {
      addNote.mutate({ body: value }, { onSuccess: () => toast('Saved to your Brain Dump inbox 📥', { label: 'View', onClick: () => navigate('/app/brain-dump') }) });
    } else {
      const p: ParsedTask = aiParsed
        ? {
            title: aiParsed.title,
            due: aiParsed.due_date ?? undefined,
            time: aiParsed.due_time ?? undefined,
            priority: aiParsed.priority ?? undefined,
            tags: aiParsed.tags,
            duration: aiParsed.estimate_min ?? undefined,
          }
        : parsed;
      const task = taskFromParsed(p, value);
      addTasks.mutate([task], {
        onSuccess: () =>
          toast(task.sched_date ? `Added “${task.title}” and blocked time in the Planner` : `Added “${task.title}”`, {
            label: 'View',
            onClick: () => navigate(task.sched_date ? '/app/planner' : '/app/tasks'),
          }),
      });
    }
    close();
  };

  const shown = aiParsed
    ? { title: aiParsed.title, due: aiParsed.due_date ?? undefined, time: aiParsed.due_time ?? undefined, priority: aiParsed.priority ?? undefined, tags: aiParsed.tags, duration: aiParsed.estimate_min ?? undefined }
    : parsed;

  return (
    <Modal open={open} onClose={close} instant title="Capture" description="Get it out of your head. Notes land in your Brain Dump inbox to sort later.">
      <div className="mb-3 flex rounded-xl border border-line p-0.5" role="tablist" aria-label="What are you capturing?">
        {(
          [
            ['note', 'Brain dump note', Inbox],
            ['task', 'Task', ListChecks],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors duration-fast', mode === m ? 'bg-accent text-accent-ink' : 'muted')}
          >
            <Icon size={15} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <label htmlFor="capture-text" className="sr-only">
          {mode === 'note' ? 'Note' : 'Task'}
        </label>
        <textarea
          id="capture-text"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (mode === 'task' && !e.shiftKey))) {
              e.preventDefault();
              save();
            }
          }}
          rows={mode === 'note' ? 6 : 2}
          maxLength={mode === 'note' ? 20000 : 300}
          placeholder={mode === 'note' ? 'Anything on your mind… ideas, worries, things to buy, notes from a call.' : 'e.g. “dentist next tue 3pm #health !high” or “write report fri for 2h”'}
          className="input resize-none pr-12 text-base"
        />
        <button
          type="button"
          onClick={toggleVoice}
          disabled={!speechInputSupported()}
          className={cn('icon-btn absolute right-2 top-2', listening && '!bg-danger/15 !text-danger')}
          aria-label={listening ? 'Stop voice input' : 'Speak instead of typing'}
          aria-pressed={listening}
          title={speechInputSupported() ? (listening ? 'Stop listening' : 'Dictate') : "Voice input isn't supported in this browser"}
        >
          {listening ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
      </div>
      {listening && <p className="mt-1.5 text-xs font-medium text-danger" role="status">● Listening… speak naturally, tap the mic to stop.</p>}
      {voiceError && <p className="mt-1.5 text-xs text-danger" role="alert">{voiceError}</p>}

      {mode === 'task' ? (
        <div className="mt-3 min-h-[64px] rounded-xl border border-dashed border-line-strong p-3" aria-live="polite">
          {text.trim() ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="faint text-xs font-medium">{aiParsed ? '✨ AI read it as' : 'Will be saved as'}</span>
              </div>
              <p className="mt-1 font-semibold">{shown.title || <span className="faint italic">untitled</span>}</p>
              <TaskChips className="mt-1.5" due={shown.due} time={shown.time} tags={shown.tags} priority={shown.priority} duration={shown.duration} />
              {shown.due && shown.time && <p className="muted mt-1.5 text-xs">Has a date and time, so it'll also be time-blocked on the Planner.</p>}
              {!aiParsed && (
                <div className="mt-2 flex items-center gap-2">
                  <AiButton size="sm" loading={parseAi.isPending} onClick={() => parseAi.mutate({ text }, { onSuccess: (r) => setAiParsed(r.result) })} hint="Let AI read a tricky sentence">
                    Read it with AI
                  </AiButton>
                  <span className="faint text-xs">if the chips look wrong</span>
                </div>
              )}
            </>
          ) : (
            <p className="muted text-xs">Dates (“tomorrow”, “fri 3pm”), #tags, !high / !med / !low and “for 45m” are picked up as you type.</p>
          )}
        </div>
      ) : (
        <p className="faint mt-2 text-xs">Markdown, - [ ] checklists and #tags work. Press Ctrl/⌘ + Enter to save.</p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn-primary" onClick={save} disabled={!text.trim()}>
          {mode === 'note' ? 'Save to inbox' : 'Add task'}
        </button>
      </div>
    </Modal>
  );
}
