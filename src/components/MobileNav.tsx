import { motion } from 'framer-motion';
import { useApp } from '../hooks/useApp';
import { NAV } from '../lib/nav';
import type { PageId } from '../lib/types';
import { cn } from '../lib/utils';

export function MobileNav({ page }: { page: PageId }) {
  const { navigate } = useApp();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-900/10 bg-white/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden dark:border-white/10 dark:bg-[#0b0a14]/80">
      <div className="flex px-1">
        {NAV.map(({ id, short, icon: Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium',
                active ? 'text-violet-600 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {active && (
                <motion.span layoutId="tab-active" className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500" />
              )}
              <Icon size={20} />
              <span className="max-w-full truncate">{short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
