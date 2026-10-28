import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

/** Glass card with the obligatory fade/slide-in. */
export function Card({ children, className, delay = 0, hover = true }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('glass relative p-5', hover && 'glass-hover', className)}
    >
      {children}
    </motion.div>
  );
}

export function CardTitle({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200">
        {icon}
        {children}
      </h3>
      {action}
    </div>
  );
}
