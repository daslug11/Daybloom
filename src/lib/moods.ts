export const MOODS = [
  { value: 1, emoji: '😫', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '🤩', label: 'Amazing' },
];

export const moodEmoji = (v: number | null | undefined) => MOODS.find((m) => m.value === Math.round(v ?? 0))?.emoji ?? '—';
