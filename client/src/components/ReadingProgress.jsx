import { useEffect, useRef } from 'react';
import './ReadingProgress.css';

// Decorative reading-progress bar. Updates a CSS variable directly, so scrolling never triggers React renders.
export default function ReadingProgress({ targetId }) {
  const bar = useRef(null);
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || !bar.current) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = target.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      const done = Math.min(1, Math.max(0, -r.top / Math.max(total, 1)));
      bar.current.style.setProperty('--p', String(done));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [targetId]);
  return <div className="progress" ref={bar} aria-hidden="true" />;
}
