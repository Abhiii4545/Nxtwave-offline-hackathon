/**
 * Motion — shared interaction primitives used across the app so every
 * surface shares one consistent, tactile motion vocabulary.
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  motion, useMotionValue, useMotionTemplate,
} from 'framer-motion';

/* Number that eases from 0 → value on mount and whenever the target changes.
   Uses a manual rAF tween for maximum reliability with async data. */
export function CountUp({ to = 0, suffix = '', decimals = 0, duration = 1.2, className = '' }) {
  const [val, setVal] = useState(0);
  const target = Number(to) || 0;
  useEffect(() => {
    let raf;
    const start = performance.now();
    const dur = Math.max(1, duration * 1000);
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      setVal(target * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return (
    <span className={`numeric ${className}`}>
      {decimals ? val.toFixed(decimals) : Math.round(val)}{suffix}
    </span>
  );
}

/* Glass card that lifts on hover and floats a soft spotlight under the cursor. */
export function SpotlightCard({
  children, className = '', tint = 'rgba(123,184,255,0.12)', lift = true, onClick,
}) {
  const ref = useRef(null);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const bg = useMotionTemplate`radial-gradient(240px circle at ${mx}% ${my}%, ${tint}, transparent 60%)`;

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 100);
    my.set(((e.clientY - r.top) / r.height) * 100);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onClick={onClick}
      whileHover={lift ? { y: -3 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`relative overflow-hidden ${className}`}
    >
      <motion.div style={{ background: bg }} className="absolute inset-0 pointer-events-none z-0" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

/* Reveal-on-mount/scroll wrapper for consistent entrances. */
export function Reveal({ children, delay = 0, y = 14, className = '', once = true }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

