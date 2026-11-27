import { useMemo, useRef } from 'react';
import { CATEGORY_META, type Entity, type RedactionMode, type Segment } from '../lib/pii';
import { MODE_LABEL } from './ui';

interface CompareStudioProps {
  original: string;
  segments: Segment[];
  entities: Entity[];
  mode: RedactionMode;
  layout: 'side' | 'stacked';
}

const LINE_HEIGHT = 22;

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
        <span key={e.id} style={{ background: meta.softBg, boxShadow: `inset 0 -1.5px 0 ${meta.color}`, borderRadius: 1 }}>
          {original.slice(e.start, e.end)}
        </span>,
      );
      cursor = e.end;
    });
    if (cursor < original.length) nodes.push(<span key="tail">{original.slice(cursor)}</span>);
    return nodes;
  }, [original, entities]);

  return (
    <pre className="whitespace-pre p-4 font-mono text-[13px] text-ink" style={{ lineHeight: `${LINE_HEIGHT}px` }}>
      {content}
      {'\n'}
    </pre>
  );
}

function SanitizedBody({ segments, mode }: { segments: Segment[]; mode: RedactionMode }) {
  return (
    <pre className="whitespace-pre p-4 font-mono text-[13px] text-ink" style={{ lineHeight: `${LINE_HEIGHT}px` }}>
      {segments.map((s, i) => {
        if (!s.isReplacement || !s.category) return <span key={i}>{s.text}</span>;
        if (mode === 'FULL') {
          return (
            <span key={i} style={{ background: '#16150F', color: '#F3F0E8', borderRadius: 1 }}>
              {s.text}
            </span>
          );
        }
        const meta = CATEGORY_META[s.category];
        return (
          <span
            key={i}
            style={{ background: meta.softBg, color: meta.color, boxShadow: `inset 0 -1.5px 0 ${meta.color}`, borderRadius: 1, fontWeight: 500 }}
          >
            {s.text}
          </span>
        );
      })}
      {'\n'}
    </pre>
  );
}

function Panel({
  title,
  meta,
  scrollRef,
  gutterRef,
  onScroll,
  lineCount,
  children,
}: {
  title: string;
  meta: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  gutterRef: React.RefObject<HTMLDivElement>;
  onScroll: () => void;
  lineCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[320px] flex-col overflow-hidden rounded-[4px] border border-rule bg-sheet shadow-sheet lg:min-h-0">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2">
        <span className="text-[12.5px] font-semibold text-ink">{title}</span>
        <span className="font-mono text-[11px] text-muted">{meta}</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          ref={gutterRef}
          className="w-12 shrink-0 select-none overflow-hidden border-r border-rule/70 bg-paper/50 py-4 text-right"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="pr-3 font-mono text-[11px] text-rule-2" style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}>
              {i + 1}
            </div>
          ))}
        </div>
        <div ref={scrollRef} onScroll={onScroll} className="scroll-quiet min-w-0 flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function CompareStudio({ original, segments, entities, mode, layout }: CompareStudioProps) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftGutterRef = useRef<HTMLDivElement>(null);
  const rightGutterRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const lineCount = useMemo(() => original.split('\n').length, [original]);
  const sanitizedLength = useMemo(() => segments.reduce((n, s) => n + s.text.length, 0), [segments]);
  const sanitizedLines = useMemo(() => segments.reduce((n, s) => n + (s.text.match(/\n/g)?.length ?? 0), 1), [segments]);

  const syncScroll = (from: 'left' | 'right') => {
    const src = from === 'left' ? leftRef.current : rightRef.current;
    const dst = from === 'left' ? rightRef.current : leftRef.current;
    if (!src) return;
    if (leftGutterRef.current && from === 'left') leftGutterRef.current.scrollTop = src.scrollTop;
    if (rightGutterRef.current && from === 'right') rightGutterRef.current.scrollTop = src.scrollTop;
    if (syncing.current) return;
    syncing.current = true;
    if (dst) {
      dst.scrollTop = src.scrollTop;
      dst.scrollLeft = src.scrollLeft;
    }
    const dstGutter = from === 'left' ? rightGutterRef.current : leftGutterRef.current;
    if (dstGutter) dstGutter.scrollTop = src.scrollTop;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  return (
    <div className={`grid min-h-0 flex-1 gap-4 ${layout === 'side' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-rows-2'}`}>
      <Panel
        title="Original"
        meta={`${original.length.toLocaleString()} chars · ${entities.length} marked`}
        scrollRef={leftRef}
        gutterRef={leftGutterRef}
        onScroll={() => syncScroll('left')}
        lineCount={lineCount}
      >
        <OriginalBody original={original} entities={entities} />
      </Panel>
      <Panel
        title={`Sanitized · ${MODE_LABEL[mode]}`}
        meta={`${sanitizedLength.toLocaleString()} chars`}
        scrollRef={rightRef}
        gutterRef={rightGutterRef}
        onScroll={() => syncScroll('right')}
        lineCount={sanitizedLines}
      >
        <SanitizedBody segments={segments} mode={mode} />
      </Panel>
    </div>
  );
}
