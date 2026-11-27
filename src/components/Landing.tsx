import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import {
  MotionConfig,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from 'framer-motion';
import 'lenis/dist/lenis.css';
import { ArrowDown, ArrowRight, Check, Minus } from 'lucide-react';
import {
  CATEGORIES,
  CATEGORY_META,
  buildPseudonymMap,
  detectPII,
  partialMask,
  sanitizeWithSegments,
  type Category,
  type RedactionMode,
} from '../lib/pii';
import { HERO_RECORD, MODES_SNIPPET } from '../lib/sample';
import { Logo, Swatch } from './ui';
import { INTRO_TEXT_DELAY, IntroCurtain, Scramble, SectionWipeProvider, SplitReveal, useSectionWipe } from './fx';
import { scrollToTarget, startSmoothScroll } from '../lib/smoothScroll';

interface LandingProps {
  onLaunch: () => void;
  onLoadSample: () => void;
}

export default function Landing({ onLaunch, onLoadSample }: LandingProps) {
  useEffect(() => startSmoothScroll(), []);
  return (
    <MotionConfig reducedMotion="user">
      <SectionWipeProvider>
        <div className="bg-paper text-ink">
          <IntroCurtain />
          <Nav onLaunch={onLaunch} />
          <main>
            <Hero onLaunch={onLaunch} onLoadSample={onLoadSample} />
            <Ticker />
            <Detection />
            <Modes />
            <Architecture />
            <Closing onLaunch={onLaunch} onLoadSample={onLoadSample} />
          </main>
          <Footer />
        </div>
      </SectionWipeProvider>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation + reading progress                                       */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { id: 'detection', label: 'Detection' },
  { id: 'modes', label: 'Modes' },
  { id: 'architecture', label: 'Architecture' },
];

const SECTIONS = [
  { id: 'top', label: 'Intro' },
  { id: 'detection', label: 'Detection' },
  { id: 'modes', label: 'Modes' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'start', label: 'Start' },
];

/** Index of the section crossing the middle of the viewport. */
function useCurrentSection() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const els = SECTIONS.slice(1)
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        let idx = 0;
        SECTIONS.forEach((s, i) => {
          if (visible.has(s.id)) idx = i;
        });
        setCurrent(idx);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return current;
}

function Nav({ onLaunch }: { onLaunch: () => void }) {
  const wipe = useSectionWipe();
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 220, damping: 40, restDelta: 0.001 });
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  useMotionValueEvent(scrollY, 'change', (v) => {
    const next = v > 12;
    if (next !== scrolledRef.current) {
      scrolledRef.current = next;
      setScrolled(next);
    }
  });
  const section = useCurrentSection();

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,border-color] duration-300 ${
        scrolled ? 'border-b border-rule bg-paper' : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-5">
          <Logo onClick={() => wipe('top')} />
          <span className="tabular hidden items-center gap-2 font-mono text-[10.5px] uppercase tracking-label text-muted lg:flex" aria-hidden="true">
            <span className="h-3 w-px bg-rule-2" />
            <Scramble text={`${String(section).padStart(2, '0')} / ${String(SECTIONS.length - 1).padStart(2, '0')}`} animateOnMount={false} duration={380} />
            <Scramble text={SECTIONS[section].label} animateOnMount={false} duration={420} className="text-ink-2" />
          </span>
        </div>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
          {NAV_LINKS.map((l) => (
            <button key={l.id} onClick={() => wipe(l.id)} className="btn-quiet">
              {l.label}
            </button>
          ))}
        </nav>
        <button onClick={onLaunch} className="btn-ink py-2">
          Open workspace <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <motion.div
        aria-hidden="true"
        className="absolute bottom-[-1px] left-0 h-[2px] w-full origin-left bg-signal"
        style={{ scaleX: progress }}
      />
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero — scroll-driven redaction of a real engine result              */
/* ------------------------------------------------------------------ */

/** A span that gets covered by an ink bar as `p` moves from `from` to `to`. */
function RedactBar({
  p,
  from,
  to,
  highlight,
  children,
  inset = '1px',
  insetBottom,
}: {
  p: MotionValue<number>;
  from: number;
  to: number;
  highlight?: string;
  children: ReactNode;
  inset?: string;
  insetBottom?: string;
}) {
  const scaleX = useTransform(p, [from, to], [0, 1]);
  const tint = useTransform(p, [0, 0.06], [0, 1]);
  return (
    <span className="relative inline-block">
      {highlight && (
        <motion.span
          aria-hidden="true"
          className="absolute -inset-x-[2px] rounded-[1px]"
          style={{ opacity: tint, background: highlight, top: inset, bottom: inset }}
        />
      )}
      <span className="relative">{children}</span>
      <motion.span
        aria-hidden="true"
        className="absolute -inset-x-[3px] origin-left bg-ink"
        style={{ scaleX, top: inset, bottom: insetBottom ?? inset }}
      />
    </span>
  );
}

const HERO_START = 0.08;
const HERO_SPAN = 0.7;

function HeroCopy({
  onLaunch,
  onLoadSample,
  p,
}: {
  onLaunch: () => void;
  onLoadSample: () => void;
  p?: MotionValue<number>;
}) {
  const D = INTRO_TEXT_DELAY;
  return (
    <div>
      <motion.p
        className="label flex items-center gap-2"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: D - 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="h-[7px] w-[7px] bg-signal" aria-hidden="true" />
        Client-side PII redaction
      </motion.p>
      <h1
        aria-label="Share the document. Not the person in it."
        className="mt-6 text-[clamp(2.6rem,5.6vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.04em]"
      >
        <SplitReveal text="Share the" delay={D} />
        <br />
        <SplitReveal text="document." delay={D + 0.24} />
        <br />
        <span className="text-ink-3">
          <SplitReveal text="Not the" delay={D + 0.5} />{' '}
          {p ? (
            <RedactBar p={p} from={0.83} to={0.9} inset="0.16em" insetBottom="-0.1em">
              <SplitReveal text="person" delay={D + 0.7} />
            </RedactBar>
          ) : (
            <SplitReveal text="person" delay={D + 0.7} />
          )}
          <br />
          <SplitReveal text="in it." delay={D + 0.88} />
          <motion.span
            aria-hidden="true"
            className="ml-[0.08em] inline-block h-[0.78em] w-[0.09em] translate-y-[0.06em] bg-signal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: D + 1.05, duration: 0.01 }}
          >
            <span className="caret-blink block h-full w-full bg-signal" />
          </motion.span>
        </span>
      </h1>
      <motion.p
        className="mt-7 max-w-[30rem] text-[16px] leading-relaxed text-ink-2 sm:text-[17px]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: D + 0.95, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        Redacta finds emails, phone numbers, IP addresses, PAN, Aadhaar and card numbers in your text, then masks or
        pseudonymizes them — entirely inside this browser tab. Nothing is uploaded.
      </motion.p>
      <motion.div
        className="mt-9 flex flex-wrap items-center gap-3"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: D + 1.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <button onClick={onLaunch} className="btn-ink px-5 py-3 text-[14px]">
          Open workspace <ArrowRight className="h-4 w-4" />
        </button>
        <button onClick={onLoadSample} className="btn-line px-5 py-3 text-[14px]">
          Try the sample record
        </button>
      </motion.div>
    </div>
  );
}

const SHEET_PRE =
  'overflow-hidden whitespace-pre pr-4 font-mono text-[10.5px] leading-[24px] text-ink sm:leading-[26px] min-[400px]:text-[11.5px] sm:text-[13px]';

const LENS = 62;

/** Mouse-only lens that shows the unredacted text under the bars. Nothing leaves the page — it is the same sample. */
function PeekLens({ enabled, reveal, children }: { enabled: boolean; reveal: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(-999);
  const y = useMotionValue(-999);
  const radius = useSpring(0, { stiffness: 340, damping: 30 });
  const clip = useMotionTemplate`circle(${radius}px at ${x}px ${y}px)`;
  const ringScale = useTransform(radius, (v) => v / LENS);
  const tagOpacity = useTransform(radius, [LENS * 0.6, LENS], [0, 1]);
  const [fine, setFine] = useState(false);
  useEffect(() => {
    setFine(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, []);
  const active = fine && enabled;
  useEffect(() => {
    if (!active) radius.set(0);
  }, [active, radius]);

  const track = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || e.pointerType !== 'mouse' || !ref.current) return;
    const b = ref.current.getBoundingClientRect();
    x.set(e.clientX - b.left);
    y.set(e.clientY - b.top);
    radius.set(LENS);
  };

  return (
    <div
      ref={ref}
      className={`relative min-w-0 flex-1 ${active ? 'cursor-none' : ''}`}
      onPointerMove={track}
      onPointerEnter={track}
      onPointerLeave={() => radius.set(0)}
    >
      {children}
      {active && (
        <>
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-sheet" style={{ clipPath: clip }}>
            {reveal}
          </motion.div>
          <motion.div aria-hidden="true" className="pointer-events-none absolute left-0 top-0" style={{ x, y }}>
            <motion.div
              className="rounded-full border-[1.5px] border-signal"
              style={{ width: LENS * 2, height: LENS * 2, marginLeft: -LENS, marginTop: -LENS, scale: ringScale }}
            />
            <motion.span
              style={{ opacity: tagOpacity }}
              className="absolute left-[40px] top-[-74px] whitespace-nowrap bg-signal px-1.5 py-[2px] font-mono text-[9.5px] tracking-[0.14em] text-paper"
            >
              PEEK · STAYS IN THIS TAB
            </motion.span>
          </motion.div>
        </>
      )}
    </div>
  );
}

function HeroSheet({ p }: { p: MotionValue<number> }) {
  const entities = useMemo(() => detectPII(HERO_RECORD, CATEGORIES).entities, []);
  const n = entities.length;
  const windowFor = (i: number) => {
    const step = HERO_SPAN / n;
    const from = HERO_START + i * step;
    return { from, to: from + step * 0.85 };
  };

  const [redacted, setRedacted] = useState(0);
  const [phase, setPhase] = useState<'detect' | 'redact' | 'done'>('detect');
  const last = useRef({ count: 0, phase: 'detect' as 'detect' | 'redact' | 'done' });
  useMotionValueEvent(p, 'change', (v) => {
    let count = 0;
    for (let i = 0; i < n; i++) if (v >= windowFor(i).to) count++;
    const next = v < HERO_START ? 'detect' : count < n ? 'redact' : 'done';
    /* Only re-render when the visible counter actually changes. */
    if (count !== last.current.count) setRedacted(count);
    if (next !== last.current.phase) setPhase(next);
    last.current = { count, phase: next };
  });

  const stampOpacity = useTransform(p, [0.8, 0.86], [0, 1]);
  const stampScale = useTransform(p, [0.8, 0.86], [1.35, 1]);

  const nodes = useMemo(() => {
    const out: ReactNode[] = [];
    let cursor = 0;
    entities.forEach((e, i) => {
      if (e.start > cursor) out.push(<span key={`t-${i}`}>{HERO_RECORD.slice(cursor, e.start)}</span>);
      const w = windowFor(i);
      out.push(
        <RedactBar key={e.id} p={p} from={w.from} to={w.to} highlight={CATEGORY_META[e.category].softBg}>
          {HERO_RECORD.slice(e.start, e.end)}
        </RedactBar>,
      );
      cursor = e.end;
    });
    if (cursor < HERO_RECORD.length) out.push(<span key="tail">{HERO_RECORD.slice(cursor)}</span>);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, p]);

  /* The same record without bars, shown inside the cursor lens. */
  const peekNodes = useMemo(() => {
    const out: ReactNode[] = [];
    let cursor = 0;
    entities.forEach((e, i) => {
      if (e.start > cursor) out.push(<span key={`t-${i}`}>{HERO_RECORD.slice(cursor, e.start)}</span>);
      const meta = CATEGORY_META[e.category];
      out.push(
        <span key={e.id} style={{ background: meta.softBg, boxShadow: `inset 0 -1.5px 0 ${meta.color}` }}>
          {HERO_RECORD.slice(e.start, e.end)}
        </span>,
      );
      cursor = e.end;
    });
    if (cursor < HERO_RECORD.length) out.push(<span key="tail">{HERO_RECORD.slice(cursor)}</span>);
    return out;
  }, [entities]);

  const lineCount = HERO_RECORD.split('\n').length;
  const status =
    phase === 'detect' ? `${n} fields detected` : phase === 'redact' ? `Redacting ${redacted} of ${n}` : `${n} of ${n} redacted`;

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="relative rounded-[4px] border border-rule bg-sheet shadow-lift">
        <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
          <span className="font-mono text-[11.5px] text-ink-2">customer_record.txt</span>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-label text-muted">
            <span className="h-[6px] w-[6px] bg-signal" aria-hidden="true" /> In this tab
          </span>
        </div>
        <div className="flex overflow-hidden py-4">
          <div className="w-9 shrink-0 select-none pr-3 text-right font-mono text-[10.5px] leading-[24px] text-rule-2 sm:w-11 sm:text-[11px] sm:leading-[26px]" aria-hidden="true">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <PeekLens enabled={redacted > 0} reveal={<pre className={SHEET_PRE}>{peekNodes}</pre>}>
            <pre className={SHEET_PRE}>{nodes}</pre>
          </PeekLens>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2.5 font-mono text-[11px]">
          <span className="text-ink-2" aria-live="polite">
            {status}
          </span>
          <span className="tabular text-muted">
            {String(redacted).padStart(2, '0')} / {String(n).padStart(2, '0')}
          </span>
        </div>

        <motion.div
          aria-hidden="true"
          style={{ opacity: stampOpacity, scale: stampScale, rotate: -7 }}
          className="pointer-events-none absolute right-4 top-[118px] border-[2.5px] border-signal bg-sheet/90 px-3 py-1.5 text-signal sm:right-7 sm:top-[128px]"
        >
          <span className="block font-mono text-[15px] font-medium tracking-[0.18em] sm:text-[17px]">SANITIZED</span>
          <span className="block font-mono text-[9.5px] tracking-[0.16em]">PROCESSED LOCALLY</span>
        </motion.div>
      </div>
      {/* Paper stack behind the sheet */}
      <div aria-hidden="true" className="absolute inset-x-3 -bottom-2 -z-10 h-6 rounded-[4px] border border-rule bg-paper-2" />
    </div>
  );
}

function HeroRail({ p }: { p: MotionValue<number> }) {
  const fill = useTransform(p, [0, 0.88], [0, 1]);
  return (
    <div className="mt-12 max-w-[30rem]">
      <div className="relative h-px w-full bg-rule-2">
        <motion.div className="absolute inset-0 origin-left bg-ink" style={{ scaleX: fill }} />
      </div>
      <div className="mt-3 flex justify-between font-mono text-[11px] uppercase tracking-label text-muted">
        <span>01 Detect</span>
        <span>02 Validate</span>
        <span>03 Redact</span>
      </div>
    </div>
  );
}

function Hero({ onLaunch, onLoadSample }: LandingProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const hintOpacity = useTransform(scrollYProgress, [0, 0.06], [1, 0]);

  return (
    <>
      {/* Small screens: copy flows normally above the pinned document. */}
      <div className="px-5 pb-2 pt-28 sm:px-8 lg:hidden">
        <HeroCopy onLaunch={onLaunch} onLoadSample={onLoadSample} />
      </div>

      <section ref={ref} className="relative h-[230vh] lg:h-[260vh]" aria-label="Scroll to watch a record get redacted">
        <div className="sticky top-0 flex h-[100dvh] items-start overflow-hidden lg:items-center">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pt-[72px] sm:px-8 lg:grid-cols-[1.08fr_1fr] lg:gap-16 lg:pt-14">
            <div className="hidden lg:block">
              <HeroCopy onLaunch={onLaunch} onLoadSample={onLoadSample} p={scrollYProgress} />
              <HeroRail p={scrollYProgress} />
            </div>
            <div>
              <p className="label mb-4 text-center lg:hidden">Scroll to redact</p>
              <HeroSheet p={scrollYProgress} />
            </div>
          </div>
          <motion.div
            style={{ opacity: hintOpacity }}
            className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 font-mono text-[11px] uppercase tracking-label text-muted lg:flex"
          >
            Scroll to redact <ArrowDown className="h-3.5 w-3.5" />
          </motion.div>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Ticker — rows that travel with scroll                               */
/* ------------------------------------------------------------------ */

const TICKER_SAMPLES: { cat: Category; value: string }[] = [
  { cat: 'EMAIL', value: 'aarav.sharma@example.com' },
  { cat: 'PHONE', value: '+91 98765 43210' },
  { cat: 'IP', value: '192.168.1.45' },
  { cat: 'PAN', value: 'ABCDE1234F' },
  { cat: 'AADHAAR', value: '2345 6789 0123' },
  { cat: 'CARD', value: '4111 1111 1111 1111' },
];

function Ticker() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x1 = useTransform(scrollYProgress, [0, 1], ['0%', '-22%']);
  const x2 = useTransform(scrollYProgress, [0, 1], ['-22%', '0%']);
  const x3 = useTransform(scrollYProgress, [0, 1], ['-4%', '-38%']);
  /* Scroll speed bends the type: it leans while moving, then settles. */
  const { scrollY } = useScroll();
  const visible = useInView(ref, { margin: '20% 0px 20% 0px' });
  const rawSpeed = useVelocity(scrollY);
  /* Off screen the input is held at zero, so the springs come to rest and stop writing styles. */
  const gated = useTransform(rawSpeed, (v) => (visible ? v : 0));
  const speed = useSpring(gated, { stiffness: 380, damping: 50, restDelta: 0.5 });
  const skew = useTransform(speed, [-2600, 0, 2600], [12, 0, -12], { clamp: true });
  const skewBack = useTransform(skew, (v) => -v * 0.7);
  const rows = [0, 1, 2];

  return (
    <section ref={ref} aria-hidden="true" className="overflow-hidden border-y border-rule bg-paper py-10 sm:py-14">
      <motion.div
        style={{ x: x1, skewX: skew }}
        className="flex w-max items-center gap-8 whitespace-nowrap will-change-transform sm:gap-10"
      >
        {rows.flatMap((r) =>
          CATEGORIES.map((c) => (
            <span key={`${r}-${c}`} className="flex items-center gap-8 sm:gap-10">
              <span className="text-[clamp(2.2rem,6.4vw,5.5rem)] font-semibold leading-none tracking-[-0.04em] text-ink">
                {CATEGORY_META[c].label}
              </span>
              <span className="inline-block h-[0.55em] w-[2.4em] bg-ink text-[clamp(2.2rem,6.4vw,5.5rem)]" />
            </span>
          )),
        )}
      </motion.div>
      <motion.div style={{ x: x2, skewX: skewBack }} className="mt-6 flex w-max items-center gap-10 whitespace-nowrap will-change-transform sm:mt-8">
        {rows.flatMap((r) =>
          TICKER_SAMPLES.map((s) => (
            <span key={`${r}-${s.cat}`} className="flex items-center gap-3 font-mono text-[15px] text-ink-3 sm:text-[18px]">
              <Swatch category={s.cat} size={9} />
              {partialMask(s.value, s.cat)}
            </span>
          )),
        )}
      </motion.div>
      <motion.div
        style={{ x: x3, skewX: skew }}
        className="mt-7 flex w-max items-center gap-6 whitespace-nowrap will-change-transform sm:mt-10"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="flex items-center gap-6">
            <span
              className="text-[clamp(2.6rem,8vw,7rem)] font-semibold uppercase leading-none tracking-[-0.03em] text-transparent"
              style={{ WebkitTextStroke: '1.5px #D9381E' }}
            >
              Redacted
            </span>
            <span className="h-3 w-3 rotate-45 bg-signal" />
          </span>
        ))}
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Detection — editorial index of the six detectors                    */
/* ------------------------------------------------------------------ */

const DETECTORS: { cat: Category; sample: string; rule: string; check: string }[] = [
  { cat: 'EMAIL', sample: 'aarav.sharma@example.com', rule: 'Local part and domain validated; top-level domain of two or more letters.', check: 'Structure' },
  { cat: 'PHONE', sample: '+91 98765 43210', rule: 'Indian 10-digit mobiles and international +country numbers of 10–15 digits.', check: 'Length & prefix' },
  { cat: 'IP', sample: '192.168.1.45', rule: 'IPv4 with every octet bounded 0–255, plus full and compressed IPv6.', check: 'Range' },
  { cat: 'PAN', sample: 'ABCDE1234F', rule: 'Five letters, four digits, one letter — the AAAAA9999A layout.', check: 'Format' },
  { cat: 'AADHAAR', sample: '2345 6789 0123', rule: 'Twelve digits in 4-4-4 groups, never matched inside a longer card number.', check: 'Format & context' },
  { cat: 'CARD', sample: '4111 1111 1111 1111', rule: '13–19 digits that must pass the Luhn checksum before they count.', check: 'Luhn checksum' },
];

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** A redaction bar sweeps across, and the title is revealed behind it. */
function BarReveal({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  return (
    <div ref={ref} className="relative w-fit max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : undefined} transition={{ delay: 0.34, duration: 0.01 }}>
        {children}
      </motion.div>
      <motion.span
        aria-hidden="true"
        className={`absolute inset-0 ${dark ? 'bg-paper' : 'bg-ink'}`}
        initial={{ x: '-101%' }}
        animate={inView ? { x: ['-101%', '0%', '0%', '101%'] } : undefined}
        transition={{ duration: 0.95, times: [0, 0.36, 0.5, 1], ease: [0.76, 0, 0.24, 1] }}
      />
    </div>
  );
}

function SectionHead({ index, name, title, children, dark = false }: { index: string; name: string; title: ReactNode; children?: ReactNode; dark?: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-10">
      <Reveal>
        <p className={`font-mono text-[11px] font-medium uppercase tracking-label ${dark ? 'text-[#A39F94]' : 'text-muted'}`}>
          {index} — {name}
        </p>
      </Reveal>
      <Reveal delay={0.05}>
        <BarReveal dark={dark}>
          <h2 className="max-w-3xl pb-[0.06em] text-[clamp(2rem,4.2vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.035em]">{title}</h2>
        </BarReveal>
        {children && (
          <p className={`mt-5 max-w-2xl text-[16px] leading-relaxed ${dark ? 'text-[#C9C5BA]' : 'text-ink-2'}`}>{children}</p>
        )}
      </Reveal>
    </div>
  );
}

function DetectorRow({ d, i }: { d: (typeof DETECTORS)[number]; i: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' });
  return (
    <motion.li
      ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="group relative grid grid-cols-[44px_1fr] gap-x-4 gap-y-3 border-b border-rule py-7 transition-colors hover:bg-sheet md:grid-cols-[56px_minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1.1fr)] md:items-baseline md:gap-x-8 md:px-3"
    >
      <span
        aria-hidden="true"
        className="absolute bottom-[-1px] left-0 h-[2px] w-full origin-left scale-x-0 bg-signal transition-transform duration-500 ease-out group-hover:scale-x-100"
      />
      <span className="tabular font-mono text-[12px] text-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-signal">
        {String(i + 1).padStart(2, '0')}
      </span>
      <span className="flex items-center gap-3">
        <span className="transition-transform duration-300 group-hover:rotate-45 group-hover:scale-125">
          <Swatch category={d.cat} size={10} />
        </span>
        <span className="text-[24px] font-semibold tracking-[-0.02em] transition-transform duration-300 group-hover:translate-x-1 sm:text-[28px]">
          {CATEGORY_META[d.cat].label}
        </span>
      </span>
      <span className="col-start-2 text-[14.5px] leading-relaxed text-ink-2 md:col-start-auto">
        {d.rule}
        <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-label text-muted">Check · {d.check}</span>
      </span>
      <span className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12.5px] md:col-start-auto">
        <span className="relative text-ink-3">
          {d.sample}
          <span
            aria-hidden="true"
            className="absolute -inset-x-[3px] inset-y-[1px] origin-left scale-x-0 bg-ink transition-transform duration-300 ease-out group-hover:scale-x-100"
          />
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        <span className="font-medium" style={{ color: CATEGORY_META[d.cat].color }}>
          <Scramble text={partialMask(d.sample, d.cat)} active={inView} duration={900} />
        </span>
      </span>
    </motion.li>
  );
}

function RejectedProbe({ reason, count }: { reason: string; count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  return (
    <div ref={ref} className="grid gap-6 border border-ink bg-sheet p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="label">Rejected, not redacted</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[15px] sm:text-[17px]">
          <span className="relative text-ink">
            4111 1111 1111 1112
            <motion.span
              aria-hidden="true"
              className="absolute inset-x-[-4px] top-1/2 h-[2px] origin-left bg-signal"
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : undefined}
              transition={{ delay: 0.35, duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
            />
          </span>
          <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
          <span className="text-signal">
            <Scramble text={reason} active={inView} duration={1000} />
          </span>
        </p>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-3">
          This result comes from running the engine on that number just now. Candidates that fail validation are left
          untouched in your document and listed as rejected, so you can see what was considered.
        </p>
      </div>
      <div className="md:border-l md:border-rule md:pl-8 md:text-right">
        <span className="tabular block font-mono text-[56px] font-medium leading-none tracking-[-0.04em] text-ink md:text-[72px]">
          <Scramble text={String(count)} active={inView} duration={1100} />
        </span>
        <span className="mt-2 block font-mono text-[11px] uppercase tracking-label text-muted">values redacted</span>
      </div>
    </div>
  );
}

function Detection() {
  const rejectedProbe = useMemo(() => detectPII('4111 1111 1111 1112', CATEGORIES), []);
  const reason = rejectedProbe.rejected[0]?.reason ?? 'Validation failed';

  return (
    <section id="detection" className="scroll-mt-14 px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHead index="01" name="Detection" title={<>Six identifiers. Validated, not just pattern-matched.</>}>
          A number that merely looks like a card is not a card. Every candidate is checked before it is redacted, so ordinary
          order IDs, years and amounts stay exactly as you wrote them.
        </SectionHead>

        <ol className="mt-16 border-t border-ink">
          {DETECTORS.map((d, i) => (
            <DetectorRow key={d.cat} d={d} i={i} />
          ))}
        </ol>

        <Reveal className="mt-12">
          <RejectedProbe reason={reason} count={rejectedProbe.entities.length} />
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Modes — pinned section that steps through the three modes on scroll  */
/* ------------------------------------------------------------------ */

const MODES: { mode: RedactionMode; title: string; desc: string; use: string }[] = [
  {
    mode: 'FULL',
    title: 'Full mask',
    desc: 'Every finding becomes [REDACTED]. Nothing about the original survives.',
    use: 'For documents leaving your organisation.',
  },
  {
    mode: 'PARTIAL',
    title: 'Partial mask',
    desc: 'Keeps just enough to verify — the last four digits, the email domain — and hides the rest.',
    use: 'For support tickets and internal review.',
  },
  {
    mode: 'PSEUDONYM',
    title: 'Pseudonymize',
    desc: 'Each distinct value gets a stable alias. The same email is USER_01 every time it appears.',
    use: 'For analytics and AI prompts that need structure.',
  },
];

function ModeRail({ p, index }: { p: MotionValue<number>; index: number }) {
  const fill = useTransform(p, [index / 3, (index + 1) / 3], [0, 1]);
  return (
    <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[2px] bg-rule">
      <motion.span className="absolute inset-0 origin-top bg-ink" style={{ scaleY: fill }} />
    </span>
  );
}

function ModeRailH({ p, index }: { p: MotionValue<number>; index: number }) {
  const fill = useTransform(p, [index / 3, (index + 1) / 3], [0, 1]);
  return (
    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] bg-rule">
      <motion.span className="absolute inset-0 origin-left bg-ink" style={{ scaleX: fill }} />
    </span>
  );
}

function Modes() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [active, setActive] = useState(0);
  const [switches, setSwitches] = useState(0);
  const activeRef = useRef(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.max(0, Math.min(2, Math.floor(v * 3)));
    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
      setSwitches((n) => n + 1);
    }
  });

  const { entities, outputs } = useMemo(() => {
    const ents = detectPII(MODES_SNIPPET, CATEGORIES).entities;
    const map = buildPseudonymMap(ents);
    return {
      entities: ents,
      outputs: MODES.map((m) => sanitizeWithSegments(MODES_SNIPPET, ents, m.mode, map)),
    };
  }, []);

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const distance = el.offsetHeight - window.innerHeight;
    scrollToTarget(top + distance * (i / 3 + 0.04));
  };

  const current = outputs[active];
  const mode = MODES[active].mode;

  return (
    <section id="modes" ref={ref} className="relative h-[300vh] scroll-mt-0 border-t border-rule bg-paper-2">
      <div className="sticky top-0 flex h-[100dvh] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 pt-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <div>
            <p className="label">02 — Modes</p>
            <div className="mt-3 lg:mt-5">
              <BarReveal>
                <h2 className="pb-[0.06em] text-[clamp(1.75rem,3.8vw,3.3rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
                  One document.
                  <br />
                  Three ways to hide it.
                </h2>
              </BarReveal>
            </div>

            {/* Desktop: vertical list with scroll-linked rails */}
            <ol className="mt-10 hidden space-y-1 lg:block">
              {MODES.map((m, i) => (
                <li key={m.mode}>
                  <button
                    onClick={() => jump(i)}
                    aria-current={active === i ? 'step' : undefined}
                    className="relative block w-full py-4 pl-6 pr-2 text-left"
                  >
                    <ModeRail p={scrollYProgress} index={i} />
                    <span className={`flex items-baseline gap-3 transition-colors duration-300 ${active === i ? 'text-ink' : 'text-muted'}`}>
                      <span className="tabular font-mono text-[12px]">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-[22px] font-semibold tracking-[-0.02em]">{m.title}</span>
                    </span>
                    <span
                      className={`mt-1.5 block pl-[34px] text-[14.5px] leading-relaxed transition-colors duration-300 ${
                        active === i ? 'text-ink-2' : 'text-muted/70'
                      }`}
                    >
                      {m.desc}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            {/* Small screens: compact tabs with horizontal rails */}
            <div className="mt-5 lg:hidden">
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((m, i) => (
                  <button
                    key={m.mode}
                    onClick={() => jump(i)}
                    aria-current={active === i ? 'step' : undefined}
                    className={`relative pb-2.5 text-left text-[13px] font-semibold transition-colors ${active === i ? 'text-ink' : 'text-muted'}`}
                  >
                    <span className="tabular block font-mono text-[10.5px] font-normal">{String(i + 1).padStart(2, '0')}</span>
                    {m.title}
                    <ModeRailH p={scrollYProgress} index={i} />
                  </button>
                ))}
              </div>
              <p className="mt-3 min-h-[3.2em] text-[13.5px] leading-snug text-ink-2">{MODES[active].desc}</p>
            </div>
          </div>

          <div className="relative rounded-[4px] border border-rule bg-sheet shadow-sheet">
            <div className="flex items-center justify-between border-b border-rule px-4 py-2.5">
              <span className="font-mono text-[11.5px] text-ink-2">refund_request.eml</span>
              <span className="font-mono text-[10.5px] uppercase tracking-label text-muted">{MODES[active].title}</span>
            </div>
            <div className="relative min-h-[236px] overflow-hidden px-4 py-4 sm:min-h-[272px] sm:px-5 sm:py-5">
              <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-[1.9] text-ink sm:text-[13px]">
                {current.segments.map((s, i) => {
                  if (!s.isReplacement || !s.category) return <span key={i}>{s.text}</span>;
                  const meta = CATEGORY_META[s.category];
                  const full = mode === 'FULL';
                  return (
                    <span
                      key={i}
                      className="rounded-[1px] px-[3px] font-medium transition-[background-color,color,box-shadow] duration-300"
                      style={
                        full
                          ? { background: '#16150F', color: '#F3F0E8', boxShadow: 'inset 0 -1.5px 0 #16150F' }
                          : { background: meta.softBg, color: meta.color, boxShadow: `inset 0 -1.5px 0 ${meta.color}` }
                      }
                    >
                      <Scramble text={s.text} animateOnMount={false} duration={520} />
                    </span>
                  );
                })}
              </pre>
              {/* A scan line passes over the message each time the mode changes. */}
              {switches > 0 && (
                <motion.div
                  key={switches}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0"
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: 300, opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className="h-10 w-full -translate-y-full bg-gradient-to-b from-transparent to-signal/15" />
                  <div className="h-[2px] w-full bg-signal" />
                </motion.div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-4 py-2.5 font-mono text-[11px] text-muted">
              <span>
                {entities.length} replacements · {current.output.length} chars
              </span>
              <span className="hidden sm:inline">{MODES[active].use}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Architecture — dark band, pipeline drawn by scroll                  */
/* ------------------------------------------------------------------ */

const PIPELINE = [
  { title: 'Your file', desc: 'A .txt, .csv or pasted text is read by the page.' },
  { title: 'Tab memory', desc: 'Content lives only in this tab’s JavaScript memory.' },
  { title: 'Detect', desc: 'Six detectors scan the text on your device.' },
  { title: 'Validate', desc: 'Luhn, range and format checks drop false positives.' },
  { title: 'Redact', desc: 'Mask, partially mask or alias every finding.' },
  { title: 'Download', desc: 'The clean file is saved straight to your device.' },
];

function PipelineNode({ p, index, total, title, desc }: { p: MotionValue<number>; index: number; total: number; title: string; desc: string }) {
  const at = index / (total - 1);
  const opacity = useTransform(p, [Math.max(0, at - 0.12), at], [0.32, 1]);
  /* Opacity and scale only — animating colours repaints on every frame. */
  const fill = useTransform(p, [Math.max(0, at - 0.02), at], [0, 1]);
  const ping = useTransform(p, [at - 0.01, at + 0.02, at + 0.09], [0, 0.9, 0]);
  const pingScale = useTransform(p, [at - 0.01, at + 0.09], [1, 3.2]);
  const [reached, setReached] = useState(false);
  const reachedRef = useRef(false);
  useMotionValueEvent(p, 'change', (v) => {
    const next = v >= at - 0.005;
    if (next !== reachedRef.current) {
      reachedRef.current = next;
      setReached(next);
    }
  });
  return (
    <motion.li style={{ opacity }} className="relative pl-8 lg:pl-0 lg:pt-9">
      <span aria-hidden="true" className="absolute left-0 top-1 h-3 w-3 border border-[#F3F0E8]/60 bg-night-3 lg:top-0">
        <motion.span className="absolute inset-0 bg-paper" style={{ opacity: fill }} />
        <motion.span className="absolute -inset-px border border-signal" style={{ opacity: ping, scale: pingScale }} />
      </span>
      <span className="tabular block font-mono text-[11px] text-[#A39F94]">
        <Scramble text={String(index + 1).padStart(2, '0')} active={reached} duration={420} />
      </span>
      <span className="mt-1 block text-[19px] font-semibold tracking-[-0.01em] text-paper">{title}</span>
      <span className="mt-1.5 block max-w-[17rem] text-[13.5px] leading-relaxed text-[#B9B5AA]">{desc}</span>
    </motion.li>
  );
}

/** Glowing pulse riding the leading edge of the pipeline line. */
function Pulse({ p, vertical }: { p: MotionValue<number>; vertical?: boolean }) {
  const pos = useTransform(p, (v) => `${Math.max(0, Math.min(1, v)) * 100}%`);
  const glow = useTransform(p, [0, 0.02, 0.97, 1], [0, 1, 1, 0]);
  return (
    <motion.div className="absolute inset-0" style={vertical ? { y: pos, opacity: glow } : { x: pos, opacity: glow }}>
      {vertical ? (
        <span className="absolute bottom-full left-0 h-28 w-px bg-gradient-to-b from-transparent to-signal" />
      ) : (
        <span className="absolute right-full top-0 h-px w-48 bg-gradient-to-r from-transparent to-signal" />
      )}
      <span
        className="absolute left-0 top-0 -ml-[5px] -mt-[5px] h-[11px] w-[11px] rounded-full bg-signal shadow-[0_0_0_4px_rgba(217,56,30,0.22),0_0_26px_6px_rgba(217,56,30,0.55)]"
      />
    </motion.div>
  );
}

const HAPPENS = [
  'Detection runs in JavaScript inside this tab.',
  'Exports are generated as local Blob downloads; the object URL is revoked right after.',
  'Original text and sanitized output are held separately, and every mode is regenerated from the original.',
  'Closing or clearing the session discards the document and its alias map.',
];

const NEVER = [
  'Uploading your document to a processing server.',
  'Sending content to an external AI service.',
  'Writing documents to localStorage, cookies or IndexedDB.',
  'Recording raw values in the audit trail — it stores counts and modes only.',
];

function Architecture() {
  const lineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: lineRef, offset: ['start 0.85', 'end 0.5'] });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  return (
    <section id="architecture" className="scroll-mt-14 bg-night px-5 py-24 text-paper sm:px-8 sm:py-32">
      <div className="mx-auto max-w-7xl">
        <SectionHead index="03" name="Architecture" title="There is no server to trust." dark>
          Redacta is a static web page. Your document moves through six steps, and every one of them happens on your machine.
          Don’t take our word for it — open your browser’s network panel while you scan.
        </SectionHead>

        <div ref={lineRef} className="relative mt-20">
          {/* Desktop: horizontal line */}
          <div aria-hidden="true" className="absolute left-0 right-0 top-[5px] hidden h-px bg-night-3 lg:block">
            <motion.div className="absolute inset-0 origin-left bg-paper" style={{ scaleX: p }} />
            <Pulse p={p} />
          </div>
          {/* Small screens: vertical line */}
          <div aria-hidden="true" className="absolute bottom-2 left-[5px] top-2 w-px bg-night-3 lg:hidden">
            <motion.div className="absolute inset-0 origin-top bg-paper" style={{ scaleY: p }} />
            <Pulse p={p} vertical />
          </div>
          <ol className="relative grid gap-10 lg:grid-cols-6 lg:gap-6">
            {PIPELINE.map((s, i) => (
              <PipelineNode key={s.title} p={p} index={i} total={PIPELINE.length} title={s.title} desc={s.desc} />
            ))}
          </ol>
        </div>

        <div className="mt-24 grid gap-px overflow-hidden border border-night-3 bg-night-3 md:grid-cols-2">
          <Reveal className="bg-night p-7 sm:p-9">
            <p className="font-mono text-[11px] uppercase tracking-label text-[#A39F94]">What happens</p>
            <ul className="mt-6 space-y-4">
              {HAPPENS.map((t) => (
                <li key={t} className="flex gap-3 text-[14.5px] leading-relaxed text-[#E4E0D6]">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-paper" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="bg-night p-7 sm:p-9" delay={0.08}>
            <p className="font-mono text-[11px] uppercase tracking-label text-[#A39F94]">What never happens</p>
            <ul className="mt-6 space-y-4">
              {NEVER.map((t) => (
                <li key={t} className="flex gap-3 text-[14.5px] leading-relaxed text-[#E4E0D6]">
                  <Minus className="mt-1 h-4 w-4 shrink-0 text-signal" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Closing call to action + footer                                     */
/* ------------------------------------------------------------------ */

function Closing({ onLaunch, onLoadSample }: LandingProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const y = useTransform(scrollYProgress, [0, 1], ['38%', '0%']);

  return (
    <section id="start" ref={ref} className="scroll-mt-14 overflow-hidden px-5 pt-24 sm:px-8 sm:pt-32">
      <div className="mx-auto max-w-7xl">
        <SectionHead index="04" name="Start" title="Clean the next file before it leaves your desk.">
          Open a .txt or .csv file, paste text, or start with the sample record. Findings appear as you type once the first
          scan has run.
        </SectionHead>
        <Reveal className="mt-10 lg:ml-[260px]" delay={0.1}>
          <div className="flex flex-wrap gap-3">
            <button onClick={onLaunch} className="btn-ink px-5 py-3 text-[14px]">
              Open workspace <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={onLoadSample} className="btn-line px-5 py-3 text-[14px]">
              Try the sample record
            </button>
          </div>
        </Reveal>
      </div>
      <motion.div aria-hidden="true" style={{ y }} className="mx-auto mt-20 max-w-7xl will-change-transform">
        <StampedWordmark />
      </motion.div>
    </section>
  );
}

const WORD = 'REDACTA';
const TILT = [-14, 9, -6, 12, -10, 7, -12];

/** Letters slam down one by one like rubber stamps; the word shudders when the last one lands, then a red bar scans across. */
function StampedWordmark() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const step = 0.085;
  const landed = WORD.length * step + 0.12;
  return (
    <div ref={ref} className="relative select-none">
      <motion.div
        className="flex justify-center font-mono text-[clamp(3rem,18vw,17rem)] font-medium leading-[0.8] tracking-[0.04em] text-ink"
        animate={inView ? { x: [0, -9, 8, -5, 3, 0] } : undefined}
        transition={{ delay: landed, duration: 0.42, ease: 'easeOut' }}
      >
        {[...WORD].map((ch, i) => (
          <motion.span
            key={i}
            className="inline-block"
            initial={{ opacity: 0, scale: 1.9, y: '-28%', rotate: TILT[i] }}
            animate={inView ? { opacity: 1, scale: 1, y: '0%', rotate: 0 } : undefined}
            transition={{ delay: i * step, type: 'spring', stiffness: 560, damping: 24, mass: 0.9 }}
          >
            {ch}
          </motion.span>
        ))}
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-[42%] h-[0.9vw] min-h-[5px] bg-signal"
        style={{ originX: 0 }}
        initial={{ scaleX: 0, opacity: 1 }}
        animate={inView ? { scaleX: [0, 1, 1], opacity: [1, 1, 0] } : undefined}
        transition={{ delay: landed + 0.3, duration: 0.9, times: [0, 0.55, 1], ease: [0.76, 0, 0.24, 1] }}
      />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink bg-paper px-5 py-6 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 font-mono text-[11.5px] text-muted">
        <span>Redacta — client-side PII redaction</span>
        <span>Runs in your browser · Sample data is synthetic</span>
      </div>
    </footer>
  );
}
