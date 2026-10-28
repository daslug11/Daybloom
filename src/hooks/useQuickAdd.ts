import { useCallback } from 'react';
import { formatDue, formatTime, parseQuickAdd, taskFromParsed } from '../lib/quickAdd';
import { useTasks } from './useData';
import { useToast } from './useToast';

/** Parses natural language and saves the task; shared by the top bar, ⌘K and the Planner. */
export function useQuickAdd() {
  const [, setTasks] = useTasks();
  const toast = useToast();
  return useCallback(
    (input: string) => {
      if (!input.trim()) return null;
      const parsed = parseQuickAdd(input);
      const task = taskFromParsed(parsed, input);
      setTasks((all) => [task, ...all]);
      const when = task.schedule
        ? ` · on the Planner ${formatDue(task.schedule.date)} ${formatTime(parsed.time!)} 🗓️`
        : task.due
          ? ` · due ${formatDue(task.due)}`
          : '';
      toast(`Added “${task.title}”${when} ✅`);
      return task;
    },
    [setTasks, toast],
  );
}
