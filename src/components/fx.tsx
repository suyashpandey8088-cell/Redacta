import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  stagger,
  useAnimate,
} from 'framer-motion';
import { prefersReducedMotion, scrollToTarget } from '../lib/smoothScroll';

const GLYPHS = '*•X#@%&0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/* ------------------------------------------------------------------ */
/* Scramble — characters shuffle, then settle left to right             */
/* ------------------------------------------------------------------ */

/**
 * Shows `text`, scrambling into it when `active` first becomes true and again
 * whenever `text` changes afterwards. Spaces and punctuation stay put so the
 * shape of the value is readable while it settles. Screen readers get the final
 * text only.
 */
export function Scramble({
  text,
  active = true,
  animateOnMount = true,
  duration = 650,
  className,
}: {
  text: string;
  active?: boolean;
  animateOnMount?: boolean;
  duration?: number;
  className?: string;
}) {
  const [out, setOut] = useState(text);
  const played = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    if (!active) {
      setOut(text);
      return;
    }
    const shouldAnimate = !prefersReducedMotion() && (played.current || animateOnMount || !first);
    played.current = true;
    if (!shouldAnimate) {
      setOut(text);
      return;
    }
    let raf = 0;
    let lastPaint = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      /* ~30 updates a second is plenty for a scramble and halves text re-layout. */
      if (t < 1 && now - lastPaint < 32) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastPaint = now;
      const settled = Math.floor(t * t * (3 - 2 * t) * text.length);
      let s = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        s += i < settled || /[\s.,:@\-–—()[\]]/.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      setOut(s);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, active]);

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{out}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Letter-by-letter reveal for headlines                               */
/* ------------------------------------------------------------------ */

/** Per-character rise-in. Words never break internally. Hidden from screen readers; label the parent instead. */
export function SplitReveal({ text, delay = 0, step = 0.028 }: { text: string; delay?: number; step?: number }) {
  const words = text.split(' ');
  let index = 0;
  return (
    <span aria-hidden="true">
      {words.map((word, w) => (
        <span key={w}>
          <span className="inline-block whitespace-nowrap">
            {[...word].map((ch) => {
              const i = index++;
              return (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ opacity: 0, y: '0.55em', rotate: 6 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ delay: delay + i * step, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                >
                  {ch}
                </motion.span>
              );
            })}
          </span>
          {w < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Intro curtain — ink bars retract to reveal the page (once per load)  */
/* ------------------------------------------------------------------ */

let introPlayed = false;
export const INTRO_TEXT_DELAY = 0.5;

export function IntroCurtain() {
  const [show] = useState(() => !introPlayed && !prefersReducedMotion());
  const [done, setDone] = useState(false);
  useEffect(() => {
    introPlayed = true;
  }, []);
  if (!show || done) return null;
  const bars = 7;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] flex flex-col">
      {Array.from({ length: bars }, (_, i) => (
        <motion.div
          key={i}
          className="w-full flex-1 bg-ink"
          style={{ originX: i % 2 === 0 ? 1 : 0, marginTop: -1 }}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ delay: 0.22 + i * 0.05, duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          onAnimationComplete={i === bars - 1 ? () => setDone(true) : undefined}
        />
      ))}
      <motion.div
        className="absolute inset-x-0 top-1/2 h-[3px] bg-signal"
        style={{ originX: 0 }}
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }}
        transition={{ duration: 0.75, times: [0, 0.45, 1], ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section wipe — ink bars cover the screen while jumping to a section  */
/* ------------------------------------------------------------------ */

type WipeFn = (target: string | 'top') => void;
const WipeContext = createContext<WipeFn>((target) => {
  if (target === 'top') scrollToTarget(0);
  else {
    const el = document.getElementById(target);
    if (el) scrollToTarget(el);
  }
});

export const useSectionWipe = () => useContext(WipeContext);

export function SectionWipeProvider({ children }: { children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const busy = useRef(false);

  const wipe = useCallback<WipeFn>(
    async (target) => {
      const el = target === 'top' ? null : document.getElementById(target);
      if (target !== 'top' && !el) return;
      const jump = (immediate: boolean) => (el ? scrollToTarget(el, { immediate }) : scrollToTarget(0, { immediate }));
      if (prefersReducedMotion() || busy.current || !scope.current) {
        jump(false);
        return;
      }
      busy.current = true;
      const ease = [0.76, 0, 0.24, 1] as const;
      const origin = (o: string) =>
        scope.current?.querySelectorAll<HTMLElement>('[data-wipe]').forEach((bar) => {
          bar.style.transformOrigin = o;
        });
      try {
        origin('left center');
        await animate('[data-wipe]', { scaleX: [0, 1] }, { duration: 0.34, ease, delay: stagger(0.035) });
        jump(true);
        origin('right center');
        await animate('[data-wipe]', { scaleX: [1, 0] }, { duration: 0.42, ease, delay: stagger(0.035) });
      } finally {
        busy.current = false;
      }
    },
    [animate, scope],
  );

  return (
    <WipeContext.Provider value={wipe}>
      {children}
      <div ref={scope} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[65] flex flex-col">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} data-wipe className="-mt-px w-full flex-1 bg-ink" style={{ transform: 'scaleX(0)' }} />
        ))}
      </div>
    </WipeContext.Provider>
  );
}
