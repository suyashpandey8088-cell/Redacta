import { useMemo, useRef } from 'react';
import { Columns2, Copy, Download, Rows2 } from 'lucide-react';
import { CATEGORY_META, type Entity, type RedactionMode, type Segment } from '../lib/pii';

interface CompareStudioProps {
  original: string;
  segments: Segment[];
  entities: Entity[];
  mode: RedactionMode;
  layout: 'side' | 'stacked';
  onLayoutChange: (l: 'side' | 'stacked') => void;
  onCopy: () => void;
  onDownload: () => void;
}

const LINE_HEIGHT = 21.45;

function OriginalBody({ original, entities }: { original: string; entities: Entity[] }) {
  const content = useMemo(() => {
    if (entities.length === 0) return original;
    const sorted = [...entities].sort((a, b) => a.start - b.start);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    sorted.forEach((e, i) => {
      if (e.start > cursor) nodes.push(<span key={`p-${i}`}>{original.slice(cursor, e.start)}</span>);
      const meta = CATEGORY_META[e.category];
      nodes.push(
        <span
          key={e.id}
          style={{ background: meta.softBg, borderBottom: `1px solid ${meta.underline}`, borderRadius: 3, padding: '0 1px' }}
        >
          {original.slice(e.start, e.end)}
        </span>,
      );
      cursor = e.end;
    });
    if (cursor < original.length) nodes.push(<span key="tail">{original.slice(cursor)}</span>);
    return nodes;
  }, [original, entities]);

  return (
    <pre className="whitespace-pre p-4 font-mono text-[13px] text-veil-text" style={{ lineHeight: `${LINE_HEIGHT}px` }}>
      {content}
      {'\n'}
    </pre>
  );
}

function SanitizedBody({ segments }: { segments: Segment[] }) {
  return (
    <pre className="whitespace-pre p-4 font-mono text-[13px] text-veil-text" style={{ lineHeight: `${LINE_HEIGHT}px` }}>
      {segments.map((s, i) =>
        s.isReplacement ? (
          <span
            key={i}
            style={{
              background: 'rgba(92,225,178,0.16)',
              borderBottom: '1px solid #5CE1B2',
              borderRadius: 3,
              padding: '0 1px',
              color: '#A7F3D0',
            }}
          >
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
      {'\n'}
    </pre>
  );
}

function Panel({
  title,
  badge,
  scrollRef,
  gutterRef,
  onScroll,
  children,
  lineCount,
}: {
  title: string;
  badge?: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  gutterRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  children: React.ReactNode;
  lineCount: number;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-veil-secondary">
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-veil-bg/40 px-4 py-2.5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-veil-text">{title}</span>
        {badge && (
          <span className="rounded bg-veil-accent/15 px-2 py-0.5 font-mono text-[10px] font-medium text-veil-accent">
            {badge}
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        <div ref={gutterRef} className="w-12 shrink-0 overflow-hidden border-r border-white/[0.07] bg-veil-bg/40 py-4 text-right" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className="pr-3 font-mono text-[11px] text-veil-muted/70"
              style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <div ref={scrollRef} onScroll={onScroll} className="min-w-0 flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function CompareStudio({
  original,
  segments,
  entities,
  mode,
  layout,
  onLayoutChange,
  onCopy,
  onDownload,
}: CompareStudioProps) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftGutterRef = useRef<HTMLDivElement>(null);
  const rightGutterRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const lineCount = useMemo(() => original.split('\n').length, [original]);

  const syncScroll = (from: 'left' | 'right') => {
    if (syncing.current) return;
    syncing.current = true;
    const src = from === 'left' ? leftRef.current : rightRef.current;
    const dst = from === 'left' ? rightRef.current : leftRef.current;
    const srcGutter = from === 'left' ? leftGutterRef.current : rightGutterRef.current;
    const dstGutter = from === 'left' ? rightGutterRef.current : leftGutterRef.current;
    if (src && dst) {
      dst.scrollTop = src.scrollTop;
      dst.scrollLeft = src.scrollLeft;
    }
    if (src && srcGutter) srcGutter.scrollTop = src.scrollTop;
    if (src && dstGutter) dstGutter.scrollTop = src.scrollTop;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  const modeLabel = mode === 'FULL' ? 'FULL MASK' : mode === 'PARTIAL' ? 'PARTIAL MASK' : 'PSEUDONYMIZATION';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-veil-text">See exactly what changed</h2>
          <p className="mt-0.5 text-xs text-veil-muted">
            Synchronized panels · emerald markers show every replacement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 bg-veil-panel p-0.5">
            <button
              onClick={() => onLayoutChange('side')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
                layout === 'side' ? 'bg-veil-accent/15 text-veil-accent' : 'text-veil-muted hover:text-veil-text'
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" /> Side by side
            </button>
            <button
              onClick={() => onLayoutChange('stacked')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
                layout === 'stacked' ? 'bg-veil-accent/15 text-veil-accent' : 'text-veil-muted hover:text-veil-text'
              }`}
            >
              <Rows2 className="h-3.5 w-3.5" /> Stacked
            </button>
          </div>
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-veil-panel px-3 py-2 text-xs font-medium text-veil-text transition hover:border-veil-accent/40"
          >
            <Copy className="h-3.5 w-3.5" /> Copy sanitized
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 rounded-lg bg-veil-accent px-3 py-2 text-xs font-semibold text-veil-bg transition hover:brightness-110"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </div>
      </div>

      <div className={`grid min-h-0 flex-1 gap-4 ${layout === 'side' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        <Panel title="Original Document" scrollRef={leftRef} gutterRef={leftGutterRef} onScroll={() => syncScroll('left')} lineCount={lineCount}>
          <OriginalBody original={original} entities={entities} />
        </Panel>
        <Panel title="Sanitized Document" badge={modeLabel} scrollRef={rightRef} gutterRef={rightGutterRef} onScroll={() => syncScroll('right')} lineCount={lineCount}>
          <SanitizedBody segments={segments} />
        </Panel>
      </div>
    </div>
  );
}
