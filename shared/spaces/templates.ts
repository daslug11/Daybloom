/**
 * Starter templates: ready-made Space designs that need no AI. Each one is run
 * through normalizeDesign like any other design, and has a few sample items
 * that only appear in the preview.
 */
import type { ItemValues, SpaceDesign } from './blocks.js';
import { normalizeDesign } from './design.js';

export interface SpaceTemplate {
  id: string;
  name: string;
  emoji: string;
  /** SPACE_COLORS index */
  color: number;
  description: string;
  design: SpaceDesign;
  samples: (today: string) => ItemValues[];
}

const day = (today: string, n: number) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const thisYear = (today: string, md: string) => {
  const y = Number(today.slice(0, 4));
  return `${`${y}-${md}` < today ? y + 1 : y}-${md}`;
};

type RawTemplate = Omit<SpaceTemplate, 'design'> & { design: Record<string, unknown> };

const TEMPLATES_RAW: RawTemplate[] = [
  {
    id: 'christmas',
    name: 'Christmas list',
    emoji: '🎄',
    color: 7,
    description: 'Gifts by person, with a budget. Prices and what you’ve bought stay hidden if you share it.',
    design: {
      primary: 'gift',
      check: 'bought',
      fields: [
        { key: 'gift', name: 'Gift', type: 'text' },
        { key: 'for', name: 'For', type: 'person' },
        { key: 'price', name: 'Price', type: 'money', currency: 'USD', private: true },
        { key: 'link', name: 'Link', type: 'link' },
        { key: 'bought', name: 'Bought', type: 'checkbox', private: true },
        { key: 'notes', name: 'Notes', type: 'long_text' },
      ],
      views: [
        { type: 'grouped', name: 'By person', field: 'for' },
        { type: 'checklist', name: 'To buy' },
        { type: 'gallery', name: 'Gallery', field: 'link' },
      ],
      summaries: [
        { kind: 'budget', label: 'Budget', field: 'price', target: 500, group: 'for' },
        { kind: 'count', label: 'Bought', filter: { field: 'bought', value: true } },
      ],
    },
    samples: () => [
      { gift: 'AirPods', for: 'Mom', price: 130, link: 'https://www.apple.com/airpods/' },
      { gift: 'Running socks', for: 'Dad', price: 18, bought: true },
      { gift: 'Lego botanical set', for: 'Sam', price: 50 },
    ],
  },
  {
    id: 'birthdays',
    name: 'Birthday gifts',
    emoji: '🎁',
    color: 2,
    description: 'Birthdays coming up, gift ideas and what each one costs.',
    design: {
      primary: 'gift',
      check: 'bought',
      fields: [
        { key: 'gift', name: 'Gift idea', type: 'text' },
        { key: 'for', name: 'For', type: 'person' },
        { key: 'birthday', name: 'Birthday', type: 'date' },
        { key: 'days_left', name: 'Days left', type: 'computed', compute: { kind: 'days_until', fields: ['birthday'] } },
        { key: 'price', name: 'Price', type: 'money', currency: 'USD', private: true },
        { key: 'link', name: 'Link', type: 'link' },
        { key: 'bought', name: 'Bought', type: 'checkbox', private: true },
      ],
      views: [
        { type: 'grouped', name: 'By person', field: 'for' },
        { type: 'calendar', name: 'Calendar', field: 'birthday' },
        { type: 'checklist', name: 'To buy' },
      ],
      summaries: [
        { kind: 'total', label: 'Total', field: 'price' },
        { kind: 'count', label: 'Bought', filter: { field: 'bought', value: true } },
      ],
    },
    samples: (t) => [
      { gift: 'Concert tickets', for: 'Alex', birthday: day(t, 12), price: 80 },
      { gift: 'Plant + pot', for: 'Priya', birthday: day(t, 40), price: 35 },
    ],
  },
  {
    id: 'workouts',
    name: 'Workout log',
    emoji: '🏋️',
    color: 3,
    description: 'Exercises, sets, reps and weight, with your streak and best lift.',
    design: {
      primary: 'exercise',
      fields: [
        { key: 'exercise', name: 'Exercise', type: 'text' },
        { key: 'date', name: 'Date', type: 'date', default_today: true },
        { key: 'type', name: 'Type', type: 'status', options: [{ label: 'Strength', color: 'orange' }, { label: 'Cardio', color: 'red' }, { label: 'Mobility', color: 'green' }] },
        { key: 'sets', name: 'Sets', type: 'number', unit: 'sets' },
        { key: 'reps', name: 'Reps', type: 'number', unit: 'reps' },
        { key: 'weight', name: 'Weight', type: 'number', unit: 'kg' },
        { key: 'time', name: 'Time', type: 'duration' },
        { key: 'notes', name: 'Notes', type: 'long_text' },
      ],
      views: [
        { type: 'table', name: 'Log' },
        { type: 'chart', name: 'Weight', field: 'date', y: 'weight', chart: 'line', agg: 'max' },
        { type: 'calendar', name: 'Calendar', field: 'date' },
      ],
      summaries: [
        { kind: 'streak', label: 'Streak', field: 'date' },
        { kind: 'count', label: 'Sessions' },
        { kind: 'best', label: 'Heaviest lift', field: 'weight', best: 'max' },
      ],
    },
    samples: (t) => [
      { exercise: 'Squat', date: day(t, -2), type: 'strength', sets: 3, reps: 8, weight: 60 },
      { exercise: 'Bench press', date: day(t, -1), type: 'strength', sets: 3, reps: 10, weight: 45 },
      { exercise: 'Bike', date: t, type: 'cardio', time: 1800 },
    ],
  },
  {
    id: 'running',
    name: 'Running log',
    emoji: '🏃',
    color: 4,
    description: 'Distance, time and pace for every run, with your longest and fastest.',
    design: {
      primary: 'notes',
      fields: [
        { key: 'date', name: 'Date', type: 'date', default_today: true },
        { key: 'distance', name: 'Distance', type: 'number', unit: 'km' },
        { key: 'time', name: 'Time', type: 'duration' },
        { key: 'pace', name: 'Pace', type: 'computed', compute: { kind: 'pace', fields: ['time', 'distance'] } },
        { key: 'feel', name: 'Feel', type: 'rating' },
        { key: 'notes', name: 'Notes', type: 'long_text' },
      ],
      views: [
        { type: 'table', name: 'Runs' },
        { type: 'chart', name: 'Distance', field: 'date', y: 'distance', chart: 'bar', agg: 'sum' },
        { type: 'calendar', name: 'Calendar', field: 'date' },
      ],
      summaries: [
        { kind: 'total', label: 'Total distance', field: 'distance' },
        { kind: 'best', label: 'Longest run', field: 'distance', best: 'max' },
        { kind: 'best', label: 'Fastest pace', field: 'pace', best: 'min' },
        { kind: 'streak', label: 'Streak', field: 'date' },
      ],
    },
    samples: (t) => [
      { date: day(t, -3), distance: 5, time: 1710, feel: 4, notes: 'Easy loop' },
      { date: day(t, -1), distance: 8, time: 2880, feel: 3, notes: 'Long run, windy' },
    ],
  },
  {
    id: 'reading',
    name: 'Reading list',
    emoji: '📚',
    color: 1,
    description: 'Books to read, reading now and finished, with a yearly goal.',
    design: {
      primary: 'title',
      fields: [
        { key: 'title', name: 'Title', type: 'text' },
        { key: 'author', name: 'Author', type: 'text' },
        { key: 'status', name: 'Status', type: 'status', options: [{ id: 'want', label: 'Want to read', color: 'gray' }, { id: 'reading', label: 'Reading', color: 'blue' }, { id: 'finished', label: 'Finished', color: 'green' }] },
        { key: 'rating', name: 'Rating', type: 'rating' },
        { key: 'pages', name: 'Pages', type: 'number', unit: 'pages' },
        { key: 'finished_on', name: 'Finished on', type: 'date' },
        { key: 'cover', name: 'Cover', type: 'image' },
        { key: 'tags', name: 'Tags', type: 'tags' },
        { key: 'notes', name: 'Notes', type: 'long_text' },
      ],
      views: [
        { type: 'board', name: 'Board', field: 'status' },
        { type: 'gallery', name: 'Shelf', field: 'cover' },
        { type: 'table', name: 'Table' },
      ],
      summaries: [
        { kind: 'progress', label: 'Books this year', target: 12, filter: { field: 'status', value: 'finished' } },
        { kind: 'total', label: 'Pages read', field: 'pages', filter: { field: 'status', value: 'finished' } },
        { kind: 'average', label: 'Average rating', field: 'rating' },
      ],
    },
    samples: () => [
      { title: 'Project Hail Mary', author: 'Andy Weir', status: 'finished', rating: 5, pages: 476 },
      { title: 'The Midnight Library', author: 'Matt Haig', status: 'reading', pages: 288 },
      { title: 'Atomic Habits', author: 'James Clear', status: 'want' },
    ],
  },
  {
    id: 'watchlist',
    name: 'Watchlist',
    emoji: '🎬',
    color: 5,
    description: 'Films and shows to watch, where they’re streaming, and what you thought.',
    design: {
      primary: 'title',
      fields: [
        { key: 'title', name: 'Title', type: 'text' },
        { key: 'status', name: 'Status', type: 'status', options: [{ id: 'to_watch', label: 'To watch', color: 'gray' }, { id: 'watching', label: 'Watching', color: 'blue' }, { id: 'watched', label: 'Watched', color: 'green' }] },
        { key: 'where', name: 'Where', type: 'text' },
        { key: 'genre', name: 'Genre', type: 'tags' },
        { key: 'rating', name: 'Rating', type: 'rating' },
        { key: 'link', name: 'Link', type: 'link' },
      ],
      views: [
        { type: 'board', name: 'Board', field: 'status' },
        { type: 'gallery', name: 'Gallery', field: 'link' },
        { type: 'table', name: 'Table' },
      ],
      summaries: [
        { kind: 'count', label: 'Watched', filter: { field: 'status', value: 'watched' } },
        { kind: 'average', label: 'Average rating', field: 'rating' },
      ],
    },
    samples: () => [
      { title: 'Severance', status: 'watching', where: 'Apple TV', genre: ['thriller'] },
      { title: 'Past Lives', status: 'to_watch', genre: ['drama'] },
    ],
  },
  {
    id: 'packing',
    name: 'Packing list',
    emoji: '🧳',
    color: 1,
    description: 'Tick things off as you pack, then reset it for the next trip.',
    design: {
      primary: 'item',
      check: 'packed',
      fields: [
        { key: 'item', name: 'Item', type: 'text' },
        { key: 'packed', name: 'Packed', type: 'checkbox' },
        { key: 'category', name: 'Category', type: 'status', options: [{ label: 'Clothes', color: 'blue' }, { label: 'Toiletries', color: 'pink' }, { label: 'Tech', color: 'purple' }, { label: 'Documents', color: 'yellow' }, { label: 'Other', color: 'gray' }] },
        { key: 'qty', name: 'Qty', type: 'number' },
      ],
      views: [
        { type: 'checklist', name: 'Checklist' },
        { type: 'grouped', name: 'By category', field: 'category' },
      ],
      summaries: [{ kind: 'count', label: 'Packed', filter: { field: 'packed', value: true } }],
    },
    samples: () => [
      { item: 'Passport', category: 'documents', packed: true },
      { item: 'Phone charger', category: 'tech' },
      { item: 'T-shirts', category: 'clothes', qty: 4 },
    ],
  },
  {
    id: 'budget',
    name: 'Budget tracker',
    emoji: '💰',
    color: 4,
    description: 'What you spend by category against a monthly budget.',
    design: {
      primary: 'item',
      fields: [
        { key: 'item', name: 'Item', type: 'text' },
        { key: 'amount', name: 'Amount', type: 'money', currency: 'USD' },
        { key: 'date', name: 'Date', type: 'date', default_today: true },
        { key: 'category', name: 'Category', type: 'status', options: [{ label: 'Food', color: 'orange' }, { label: 'Transport', color: 'blue' }, { label: 'Fun', color: 'pink' }, { label: 'Bills', color: 'red' }, { label: 'Shopping', color: 'purple' }, { label: 'Other', color: 'gray' }] },
        { key: 'notes', name: 'Notes', type: 'long_text' },
      ],
      views: [
        { type: 'table', name: 'Spending' },
        { type: 'chart', name: 'By day', field: 'date', y: 'amount', chart: 'bar', agg: 'sum' },
        { type: 'grouped', name: 'By category', field: 'category' },
      ],
      summaries: [
        { kind: 'budget', label: 'Budget', field: 'amount', target: 1000, group: 'category' },
        { kind: 'average', label: 'Average spend', field: 'amount' },
      ],
    },
    samples: (t) => [
      { item: 'Groceries', amount: 42.5, date: day(t, -1), category: 'food' },
      { item: 'Bus pass', amount: 30, date: day(t, -4), category: 'transport' },
    ],
  },
  {
    id: 'assignments',
    name: 'Assignments tracker',
    emoji: '📝',
    color: 0,
    description: 'Every assignment by class and due date, with days left and grades.',
    design: {
      primary: 'assignment',
      check: 'submitted',
      fields: [
        { key: 'assignment', name: 'Assignment', type: 'text' },
        { key: 'class', name: 'Class', type: 'person' },
        { key: 'due', name: 'Due', type: 'date' },
        { key: 'days_left', name: 'Days left', type: 'computed', compute: { kind: 'days_until', fields: ['due'] } },
        { key: 'status', name: 'Status', type: 'status', options: [{ label: 'Not started', color: 'gray' }, { label: 'In progress', color: 'yellow' }, { label: 'Done', color: 'green' }] },
        { key: 'submitted', name: 'Submitted', type: 'checkbox' },
        { key: 'grade', name: 'Grade', type: 'number', unit: '%' },
      ],
      views: [
        { type: 'checklist', name: 'To do' },
        { type: 'calendar', name: 'Calendar', field: 'due' },
        { type: 'grouped', name: 'By class', field: 'class' },
      ],
      summaries: [
        { kind: 'count', label: 'Submitted', filter: { field: 'submitted', value: true } },
        { kind: 'average', label: 'Average grade', field: 'grade' },
      ],
    },
    samples: (t) => [
      { assignment: 'Lab report 3', class: 'Biology', due: day(t, 3), status: 'in_progress' },
      { assignment: 'Essay draft', class: 'English', due: day(t, 8), status: 'not_started' },
    ],
  },
  {
    id: 'college',
    name: 'College applications',
    emoji: '🎓',
    color: 1,
    description: 'Each school’s deadline, fee and where your application stands.',
    design: {
      primary: 'school',
      fields: [
        { key: 'school', name: 'School', type: 'text' },
        { key: 'status', name: 'Status', type: 'status', options: [{ label: 'Researching', color: 'gray' }, { label: 'Applying', color: 'yellow' }, { label: 'Submitted', color: 'blue' }, { label: 'Accepted', color: 'green' }, { label: 'Waitlisted', color: 'orange' }, { label: 'Rejected', color: 'red' }] },
        { key: 'deadline', name: 'Deadline', type: 'date' },
        { key: 'days_left', name: 'Days left', type: 'computed', compute: { kind: 'days_until', fields: ['deadline'] } },
        { key: 'fee', name: 'Fee', type: 'money', currency: 'USD' },
        { key: 'essays', name: 'Essays done', type: 'checkbox' },
        { key: 'link', name: 'Portal', type: 'link' },
        { key: 'notes', name: 'Notes', type: 'long_text' },
      ],
      views: [
        { type: 'board', name: 'Board', field: 'status' },
        { type: 'table', name: 'Table' },
        { type: 'calendar', name: 'Deadlines', field: 'deadline' },
      ],
      summaries: [
        { kind: 'count', label: 'Submitted', filter: { field: 'status', value: 'submitted' } },
        { kind: 'total', label: 'Fees', field: 'fee' },
      ],
    },
    samples: (t) => [
      { school: 'State University', status: 'applying', deadline: day(t, 21), fee: 60 },
      { school: 'City College', status: 'researching', deadline: day(t, 45), fee: 45 },
    ],
  },
  {
    id: 'jobs',
    name: 'Job applications',
    emoji: '💼',
    color: 6,
    description: 'Roles you’ve applied for, where each one stands and who you spoke to.',
    design: {
      primary: 'role',
      fields: [
        { key: 'role', name: 'Role', type: 'text' },
        { key: 'company', name: 'Company', type: 'person' },
        { key: 'status', name: 'Status', type: 'status', options: [{ label: 'Saved', color: 'gray' }, { label: 'Applied', color: 'blue' }, { label: 'Interview', color: 'yellow' }, { label: 'Offer', color: 'green' }, { label: 'Rejected', color: 'red' }] },
        { key: 'applied', name: 'Applied', type: 'date' },
        { key: 'salary', name: 'Salary', type: 'money', currency: 'USD' },
        { key: 'link', name: 'Posting', type: 'link' },
        { key: 'contact', name: 'Contact', type: 'text' },
        { key: 'notes', name: 'Notes', type: 'long_text' },
      ],
      views: [
        { type: 'board', name: 'Board', field: 'status' },
        { type: 'table', name: 'Table' },
      ],
      summaries: [
        { kind: 'count', label: 'Applications' },
        { kind: 'count', label: 'Interviews', filter: { field: 'status', value: 'interview' } },
      ],
    },
    samples: (t) => [
      { role: 'Barista (part-time)', company: 'Corner Café', status: 'applied', applied: day(t, -5) },
      { role: 'Summer intern', company: 'Acme Labs', status: 'interview', applied: day(t, -12) },
    ],
  },
  {
    id: 'meals',
    name: 'Meal plan',
    emoji: '🥗',
    color: 4,
    description: 'What you’re eating each day, with recipes and prep.',
    design: {
      primary: 'meal',
      check: 'prepped',
      fields: [
        { key: 'meal', name: 'Meal', type: 'text' },
        { key: 'date', name: 'Day', type: 'date', default_today: true },
        { key: 'slot', name: 'Meal time', type: 'status', options: [{ label: 'Breakfast', color: 'yellow' }, { label: 'Lunch', color: 'green' }, { label: 'Dinner', color: 'blue' }, { label: 'Snack', color: 'pink' }] },
        { key: 'recipe', name: 'Recipe', type: 'link' },
        { key: 'prepped', name: 'Prepped', type: 'checkbox' },
        { key: 'tags', name: 'Tags', type: 'tags' },
      ],
      views: [
        { type: 'calendar', name: 'Week', field: 'date' },
        { type: 'grouped', name: 'By meal time', field: 'slot' },
        { type: 'checklist', name: 'Prep' },
      ],
      summaries: [{ kind: 'count', label: 'Prepped', filter: { field: 'prepped', value: true } }],
    },
    samples: (t) => [
      { meal: 'Overnight oats', date: day(t, 1), slot: 'breakfast' },
      { meal: 'Chickpea curry', date: day(t, 1), slot: 'dinner', tags: ['batch'] },
    ],
  },
  {
    id: 'recipes',
    name: 'Recipes',
    emoji: '🍳',
    color: 3,
    description: 'Recipes worth making again, with photos, time and ratings.',
    design: {
      primary: 'recipe',
      fields: [
        { key: 'recipe', name: 'Recipe', type: 'text' },
        { key: 'photo', name: 'Photo', type: 'image' },
        { key: 'link', name: 'Link', type: 'link' },
        { key: 'time', name: 'Time', type: 'duration' },
        { key: 'servings', name: 'Servings', type: 'number', unit: 'servings' },
        { key: 'rating', name: 'Rating', type: 'rating' },
        { key: 'tags', name: 'Tags', type: 'tags' },
        { key: 'ingredients', name: 'Ingredients', type: 'long_text' },
      ],
      views: [
        { type: 'gallery', name: 'Gallery', field: 'photo' },
        { type: 'table', name: 'Table' },
      ],
      summaries: [
        { kind: 'count', label: 'Recipes' },
        { kind: 'average', label: 'Average rating', field: 'rating' },
      ],
    },
    samples: () => [
      { recipe: 'Shakshuka', time: 1800, servings: 2, rating: 5, tags: ['brunch'] },
      { recipe: 'Pesto pasta', time: 900, servings: 2, rating: 4, tags: ['quick'] },
    ],
  },
  {
    id: 'wishlist',
    name: 'Wishlist',
    emoji: '⭐',
    color: 2,
    description: 'Things you’d love, with links and prices. Share it so people know what to get you.',
    design: {
      primary: 'item',
      check: 'got',
      fields: [
        { key: 'item', name: 'Item', type: 'text' },
        { key: 'price', name: 'Price', type: 'money', currency: 'USD' },
        { key: 'link', name: 'Link', type: 'link' },
        { key: 'priority', name: 'Priority', type: 'status', options: [{ label: 'Must have', color: 'red' }, { label: 'Nice to have', color: 'yellow' }, { label: 'Someday', color: 'gray' }] },
        { key: 'got', name: 'Got it', type: 'checkbox', private: true },
        { key: 'notes', name: 'Notes', type: 'long_text' },
      ],
      views: [
        { type: 'gallery', name: 'Gallery', field: 'link' },
        { type: 'table', name: 'Table' },
        { type: 'checklist', name: 'Checklist' },
      ],
      summaries: [
        { kind: 'total', label: 'Total', field: 'price' },
        { kind: 'count', label: 'Got', filter: { field: 'got', value: true } },
      ],
    },
    samples: (t) => [
      { item: 'Noise-cancelling headphones', price: 199, priority: 'must_have' },
      { item: 'Film camera', price: 120, priority: 'someday', notes: `Ideas for ${thisYear(t, '12-25').slice(0, 4)}` },
    ],
  },
];

export const TEMPLATES: SpaceTemplate[] = TEMPLATES_RAW.map((t) => ({ ...t, design: normalizeDesign(t.design).design }));

export function templateById(id: string): SpaceTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** A blank Space: one name field, a done checkbox and a checklist. */
export function blankDesign(): SpaceDesign {
  return normalizeDesign({
    primary: 'name',
    check: 'done',
    fields: [
      { key: 'name', name: 'Name', type: 'text' },
      { key: 'done', name: 'Done', type: 'checkbox' },
      { key: 'notes', name: 'Notes', type: 'long_text' },
    ],
    views: [{ type: 'checklist', name: 'Checklist' }, { type: 'table', name: 'Table' }],
    summaries: [{ kind: 'count', label: 'Done', filter: { field: 'done', value: true } }],
  }).design;
}
