export interface Tag {
  label: string;
  emoji: string;
  className: string;
  keywords: string[];
}

export const TAGS: Tag[] = [
  { label: 'Shopping', emoji: '🛒', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', keywords: ['buy', 'shop', 'order', 'groceries', 'grocery', 'amazon'] },
  { label: 'People', emoji: '📞', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30', keywords: ['call', 'text', 'email', 'meet', 'mom', 'dad', 'friend', 'birthday'] },
  { label: 'Ideas', emoji: '💡', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', keywords: ['idea', 'maybe', 'what if', 'startup', 'app', 'build'] },
  { label: 'Work', emoji: '💼', className: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30', keywords: ['meeting', 'deck', 'client', 'deadline', 'report', 'boss', 'pr ', 'deploy'] },
  { label: 'Health', emoji: '💪', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', keywords: ['gym', 'run', 'doctor', 'dentist', 'workout', 'sleep', 'yoga', 'water'] },
  { label: 'Money', emoji: '💸', className: 'bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/30', keywords: ['pay', 'bill', 'rent', 'budget', 'invoice', 'tax', 'bank'] },
  { label: 'Learning', emoji: '📚', className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30', keywords: ['read', 'learn', 'course', 'book', 'study', 'podcast'] },
  { label: 'Travel', emoji: '✈️', className: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30', keywords: ['trip', 'flight', 'travel', 'hotel', 'vacation', 'book a'] },
];

export const FALLBACK_TAG: Tag = {
  label: 'Thought',
  emoji: '💭',
  className: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  keywords: [],
};

export function tagsFor(text: string): Tag[] {
  const lower = ` ${text.toLowerCase()} `;
  const found = TAGS.filter((t) => t.keywords.some((k) => lower.includes(k)));
  return found.length ? found : [FALLBACK_TAG];
}
