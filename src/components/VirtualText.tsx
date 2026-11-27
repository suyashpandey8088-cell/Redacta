import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { TextLayout } from '../hooks/useTextLayout';

/**
 * Line-virtualized text rendering for the editor and the diff.
 *
 * Every line has a fixed height and wrapping is off, so line `i` always sits at
 * `PAD + i * LINE_HEIGHT`. Only the lines in view (plus overscan) are rendered,
 * which keeps a 5 MB document with 100k+ findings at a few hundred DOM nodes.
 * Scroll offsets are applied straight to the DOM in the same frame; React only
 * re-renders when the view crosses into a new chunk of lines.
 */

export const LINE_HEIGHT = 22;
export const PAD = 16;
const CHUNK = 20;
const OVERSCAN = 40;

export interface Mark {
  start: number;
  end: number;
  style: CSSProperties;
  title?: string;
}

/** Which lines to render, given the scroll position and viewport height. */
function useLineWindow(lineCount: number) {
  const [view, setView] = useState({ chunk: 0, rows: 60 });
  const report = useCallback((top: number, height: number) => {
    const chunk = Math.max(0, Math.floor((top - PAD) / LINE_HEIGHT / CHUNK));
    const rows = Math.ceil(height / LINE_HEIGHT) + 1;
    setView((v) => (v.chunk === chunk && v.rows >= rows ? v : { chunk, rows: Math.max(rows, v.rows) }));
  }, []);
  const first = Math.min(Math.max(0, view.chunk * CHUNK - OVERSCAN), Math.max(0, lineCount - 1));
  const last = Math.min(lineCount - 1, view.chunk * CHUNK + CHUNK + view.rows + OVERSCAN);
  return { first, last, report };
}

/** Index of the first mark that ends after `offset` (marks are sorted and non-overlapping). */
function firstMarkAfter(marks: Mark[], offset: number) {
  let lo = 0;
  let hi = marks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (marks[mid].end <= offset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

interface LineMark {
  start: number;
  end: number;
  style: CSSProperties;
  title?: string;
}

function sameMarks(a: LineMark[], b: LineMark[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].start !== b[i].start || a[i].end !== b[i].end || a[i].style !== b[i].style || a[i].title !== b[i].title) return false;
  }
  return true;
}

/**
 * One line of text with its marks (offsets relative to the line). Memoized on
 * content, so typing re-renders only the edited line, not every line after it.
 * Mark styles must be shared constants for the comparison to hold.
 */
const Line = memo(
  function Line({ text, marks }: { text: string; marks: LineMark[] }) {
    if (marks.length === 0) return <>{text + '\n'}</>;
    const nodes: ReactNode[] = [];
    let cursor = 0;
    marks.forEach((m, i) => {
      if (m.start > cursor) nodes.push(text.slice(cursor, m.start));
      nodes.push(
        <span key={i} style={m.style} title={m.title}>
          {text.slice(m.start, m.end)}
        </span>,
      );
      cursor = m.end;
    });
    nodes.push(text.slice(cursor) + '\n');
    return <>{nodes}</>;
  },
  (a, b) => a.text === b.text && sameMarks(a.marks, b.marks),
);

/** Lines [first, last] as memoized rows, with marks clipped to each line. */
function renderLines(layout: TextLayout, first: number, last: number, marks: Mark[]): ReactNode[] {
  const { text, starts } = layout;
  const rows: ReactNode[] = [];
  let m = firstMarkAfter(marks, starts[first] ?? text.length);
  for (let line = first; line <= last; line++) {
    const from = starts[line];
    const to = line + 1 < starts.length ? starts[line + 1] - 1 : text.length;
    const lineMarks: LineMark[] = [];
    /* A mark can span lines only if a detector matched across "\n"; clip it to each line it touches. */
    while (m < marks.length && marks[m].end <= from) m++;
    for (let j = m; j < marks.length && marks[j].start < to; j++) {
      const mk = marks[j];
      lineMarks.push({ start: Math.max(mk.start, from) - from, end: Math.min(mk.end, to) - from, style: mk.style, title: mk.title });
    }
    rows.push(<Line key={line} text={text.slice(from, to)} marks={lineMarks} />);
  }
  return rows;
}

function Bands({ first, last, bands, color }: { first: number; last: number; bands?: ReadonlySet<number>; color?: string }) {
  if (!bands || bands.size === 0 || !color) return null;
  const out: ReactNode[] = [];
  for (let i = first; i <= last; i++) {
    if (bands.has(i + 1)) {
      out.push(
        <div
          key={i}
          className="absolute inset-x-0"
          style={{ top: PAD + i * LINE_HEIGHT, height: LINE_HEIGHT, background: color }}
        />,
      );
    }
  }
  return <>{out}</>;
}

export interface ScrollSync {
  /** Align this layer with a scroll container's offsets. */
  sync: (top: number, left: number) => void;
}

interface LayerProps {
  layout: TextLayout;
  marks: Mark[];
  /** 1-based line numbers to tint across the full width. */
  bands?: ReadonlySet<number>;
  bandColor?: string;
  className?: string;
}

const textClass = 'whitespace-pre font-mono text-[13px] text-ink';

/** Read-only text drawn behind a transparent textarea; the parent forwards the textarea's scroll offsets. */
export const VirtualOverlay = forwardRef<ScrollSync, LayerProps>(function VirtualOverlay(
  { layout, marks, bands, bandColor, className = '' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bandsRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const offset = useRef({ top: 0, left: 0 });
  const { first, last, report } = useLineWindow(layout.starts.length);

  const sync = useCallback(
    (top: number, left: number) => {
      offset.current = { top, left };
      if (bandsRef.current) bandsRef.current.style.transform = `translate3d(0, ${-top}px, 0)`;
      if (textRef.current) textRef.current.style.transform = `translate3d(${-left}px, ${-top}px, 0)`;
      report(top, containerRef.current?.clientHeight ?? 0);
    },
    [report],
  );
  useImperativeHandle(ref, () => ({ sync }), [sync]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => report(offset.current.top, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [report]);

  return (
    <div ref={containerRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div ref={bandsRef} className="absolute inset-0 will-change-transform">
        <Bands first={first} last={last} bands={bands} color={bandColor} />
      </div>
      <div ref={textRef} className="absolute left-0 top-0 will-change-transform">
        <pre className={`absolute m-0 ${textClass}`} style={{ top: PAD + first * LINE_HEIGHT, left: PAD, lineHeight: `${LINE_HEIGHT}px` }}>
          {renderLines(layout, first, last, marks)}
        </pre>
      </div>
    </div>
  );
});

/** Scrollable read-only text panel. Native scrolling, so the visible text stays selectable. */
export const VirtualScrollText = forwardRef<HTMLDivElement, LayerProps & { onScroll?: () => void; label: string }>(function VirtualScrollText(
  { layout, marks, bands, bandColor, className = '', onScroll, label },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement, []);
  const { first, last, report } = useLineWindow(layout.starts.length);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => report(el.scrollTop, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [report]);

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        report(e.currentTarget.scrollTop, e.currentTarget.clientHeight);
        onScroll?.();
      }}
      className={`relative overflow-auto ${className}`}
      /* Keyboard users can focus the panel and scroll it with the arrow keys. */
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <div
        className="relative min-w-full"
        style={{
          height: PAD * 2 + layout.starts.length * LINE_HEIGHT,
          width: `calc(${layout.maxColumns}ch + ${PAD * 2}px)`,
        }}
      >
        <Bands first={first} last={last} bands={bands} color={bandColor} />
        <pre className={`absolute m-0 ${textClass}`} style={{ top: PAD + first * LINE_HEIGHT, left: PAD, lineHeight: `${LINE_HEIGHT}px` }}>
          {renderLines(layout, first, last, marks)}
        </pre>
      </div>
    </div>
  );
});

export interface GutterTone {
  line: string;
  mark: string;
  symbol: string;
}

/** Line numbers that follow a scroll container vertically. */
export const VirtualGutter = forwardRef<
  ScrollSync,
  { lineCount: number; changed?: ReadonlySet<number>; tone?: GutterTone; activeLine?: number; className?: string }
>(function VirtualGutter({ lineCount, changed, tone, activeLine, className = '' }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const { first, last, report } = useLineWindow(lineCount);

  const sync = useCallback(
    (top: number) => {
      offset.current = top;
      if (innerRef.current) innerRef.current.style.transform = `translate3d(0, ${-top}px, 0)`;
      report(top, containerRef.current?.clientHeight ?? 0);
    },
    [report],
  );
  useImperativeHandle(ref, () => ({ sync }), [sync]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => report(offset.current, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [report]);

  const rows: ReactNode[] = [];
  for (let i = first; i <= last; i++) {
    const n = i + 1;
    const isChanged = !!tone && !!changed?.has(n);
    rows.push(
      <div
        key={n}
        className={`absolute inset-x-0 flex items-center pr-3 font-mono text-[11px] ${tone ? 'justify-between pl-2' : 'justify-end'}`}
        style={{
          top: PAD + i * LINE_HEIGHT,
          height: LINE_HEIGHT,
          background: isChanged ? tone.line : undefined,
          color: isChanged ? tone.mark : n === activeLine ? '#16150F' : '#69655A',
        }}
      >
        {tone && <span className="font-medium">{isChanged ? tone.symbol : ''}</span>}
        <span>{n}</span>
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`relative shrink-0 select-none overflow-hidden border-r border-rule/70 bg-paper/50 ${className}`}
    >
      <div ref={innerRef} className="absolute inset-0 will-change-transform">
        {rows}
      </div>
    </div>
  );
});
