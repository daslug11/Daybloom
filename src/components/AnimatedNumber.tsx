import { animate, useMotionValue, useTransform, motion } from 'framer-motion';
import { useEffect } from 'react';

export function AnimatedNumber({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className={className}>{text}</motion.span>;
}
