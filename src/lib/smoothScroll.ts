import Lenis from 'lenis';
import { MotionGlobalConfig, cancelFrame, frame } from 'framer-motion';

/**
 * Inertial smooth scrolling for the landing page.
 *
 * Mouse wheels (notably on Windows) scroll in ~100px steps, which makes every
 * scroll-linked animation jump. Lenis turns those steps into a continuous glide.
 * It runs on Framer Motion's frame loop so scroll position and scroll-driven
 * transforms update in the same frame. Touch input keeps native scrolling, and
 * nothing starts when the user prefers reduced motion.
 */
let lenis: Lenis | null = null;
let stopActive: (() => void) | null = null;

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function startSmoothScroll(): () => void {
  if (lenis || prefersReducedMotion()) return () => {};
  const instance = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
  lenis = instance;
  const update = ({ timestamp }: { timestamp: number }) => instance.raf(timestamp);
  frame.update(update, true);
  const stop = () => {
    cancelFrame(update);
    instance.destroy();
    if (lenis === instance) {
      lenis = null;
      stopActive = null;
    }
  };
  stopActive = stop;
  return stop;
}

/** Scroll to a position or element, gliding when smooth scrolling is active. */
export function scrollToTarget(target: number | HTMLElement, opts: { immediate?: boolean; offset?: number } = {}) {
  const offset = opts.offset ?? 0;
  if (lenis) {
    /* Lenis already honours CSS scroll-margin-top on element targets. */
    lenis.scrollTo(target, { offset, immediate: opts.immediate, force: true, duration: opts.immediate ? undefined : 1.1 });
    return;
  }
  /* Respect CSS scroll-margin-top (used to clear the fixed nav) when jumping to an element. */
  const top =
    typeof target === 'number'
      ? target
      : target.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
  window.scrollTo({ top: top + offset, behavior: opts.immediate || prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * With reduced motion, finish every timed Framer animation instantly so entrance
 * reveals, typing and stamps never hold content back. Scroll-linked styles still
 * follow the scroll position. Kept in sync if the OS setting changes.
 */
export function syncReducedMotion(): () => void {
  if (typeof window === 'undefined') return () => {};
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => {
    MotionGlobalConfig.skipAnimations = query.matches;
    if (query.matches) stopActive?.();
  };
  apply();
  query.addEventListener('change', apply);
  return () => query.removeEventListener('change', apply);
}
