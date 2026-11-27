import { useMemo, useRef, type CSSProperties } from 'react';
import { Copy, Download, FileText, Loader2, ScanLine } from 'lucide-react';
import { CATEGORIES, CATEGORY_META, MODE_LABEL, type Category, type DetectionResult, type Entity, type RedactionMode, type Segment } from '../lib/pii';
import { exportFileName } from '../lib/files';
import { Swatch } from './ui';
import { DocumentTextarea } from './DocumentTextarea';
import { LINE_HEIGHT, PAD, VirtualGutter, VirtualOverlay, VirtualScrollText, type GutterTone, type Mark, type ScrollSync } from './VirtualText';
import { useTextLayout } from '../hooks/useTextLayout';

interface AuditExportProps {
  docText: string;
  fileName: string;
  fileKind: 'txt' | 'csv';
  mode: RedactionMode;
  result: DetectionResult | null;
  entities: Entity[];
  segments: Segment[];
  enabledCats: Category[];
  onToggleCategory: (c: Category) => void;
  onTextChange: (text: string) => void;
  onScan: () => void;
  scanning: boolean;
  stale: boolean;
  liveLimit: number;
  onExport: () => void;
  onCopy: () => void;
}

/* Diff colours: removed text (original) and inserted text (sanitized). */
const REMOVED = { line: 'rgba(217,56,30,0.07)', span: 'rgba(217,56,30,0.2)', mark: '#952A16' };
const ADDED = { line: 'rgba(31,122,77,0.08)', span: 'rgba(31,122,77,0.2)', mark: '#185E3B' };
const markStyles = (background: string, extra: CSSProperties = {}) =>
  Object.fromEntries(
    CATEGORIES.map((c) => [c, { background, boxShadow: `inset 0 -1.5px 0 ${CATEGORY_META[c].color}`, borderRadius: 1, ...extra }]),
  ) as Record<Category, CSSProperties>;
/* Shared style objects: the virtual text layer skips lines whose marks are unchanged by identity. */
const REMOVED_STYLE = markStyles(REMOVED.span);
const ADDED_STYLE = markStyles(ADDED.span, { fontWeight: 500 });
const REMOVED_TONE: GutterTone = { line: REMOVED.line, mark: REMOVED.mark, symbol: '−' };
const ADDED_TONE: GutterTone = { line: ADDED.line, mark: ADDED.mark, symbol: '+' };

function PanelHead({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[38px] items-center justify-between gap-3 border-b border-rule px-4 py-2">
      <span className="truncate text-[12.5px] font-semibold text-ink">{title}</span>
      <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-muted">{children}</div>
    </div>
  );
}

export default function AuditExport({
  docText,
  fileName,
  fileKind,
  mode,
  result,
  entities,
  segments,
  enabledCats,
  onToggleCategory,
  onTextChange,
  onScan,
  scanning,
  stale,
  liveLimit,
  onExport,
  onCopy,
}: AuditExportProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const leftOverlayRef = useRef<ScrollSync>(null);
  const leftGutterRef = useRef<ScrollSync>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const rightGutterRef = useRef<ScrollSync>(null);
  /** Which side started the current scroll, so the mirrored scroll event is ignored. */
  const scrollLead = useRef<'left' | 'right' | null>(null);

  const originalLayout = useTextLayout(docText);
  const lineCount = originalLayout.starts.length;
  const changed = useMemo(() => new Set(entities.map((e) => e.line)), [entities]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(CATEGORIES.map((k) => [k, 0])) as Record<Category, number>;
    for (const e of entities) c[e.category] += 1;
    return c;
  }, [entities]);

  const removedChars = useMemo(() => entities.reduce((n, e) => n + (e.end - e.start), 0), [entities]);
  const addedChars = useMemo(() => segments.reduce((n, s) => n + (s.isReplacement ? s.text.length : 0), 0), [segments]);
  const sanitizedLength = useMemo(() => segments.reduce((n, s) => n + s.text.length, 0), [segments]);

  const isLive = !!result && docText.length <= liveLimit;
  const outName = exportFileName(fileName, fileKind);

  const originalMarks = useMemo<Mark[]>(
    () =>
      entities.map((e) => ({
        start: e.start,
        end: e.end,
        style: REMOVED_STYLE[e.category],
      })),
    [entities],
  );

  /* Sanitized text and replacement marks in output coordinates. Output is line-for-line with the original. */
  const { sanitizedText, sanitizedMarks } = useMemo(() => {
    const marks: Mark[] = [];
    let offset = 0;
    for (const seg of segments) {
      if (seg.isReplacement && seg.category) {
        marks.push({
          start: offset,
          end: offset + seg.text.length,
          title: CATEGORY_META[seg.category].label,
          style: ADDED_STYLE[seg.category],
        });
      }
      offset += seg.text.length;
    }
    return { sanitizedText: segments.map((seg) => seg.text).join(''), sanitizedMarks: marks };
  }, [segments]);
  const sanitizedLayout = useTextLayout(sanitizedText);

  const handleScroll = (side: 'left' | 'right') => {
    const src = side === 'left' ? textareaRef.current : rightScrollRef.current;
    if (!src) return;
    /* Keep this side's own layers aligned. */
    if (side === 'left') {
      leftOverlayRef.current?.sync(src.scrollTop, src.scrollLeft);
      leftGutterRef.current?.sync(src.scrollTop, 0);
    } else {
      rightGutterRef.current?.sync(src.scrollTop, 0);
    }
    /* Mirror to the other side, unless this event is itself the mirror. */
    if (scrollLead.current && scrollLead.current !== side) return;
    scrollLead.current = side;
    const dst = side === 'left' ? rightScrollRef.current : textareaRef.current;
    if (dst) {
      dst.scrollTop = src.scrollTop;
      dst.scrollLeft = src.scrollLeft;
    }
    requestAnimationFrame(() => {
      scrollLead.current = null;
    });
  };

  const textStyle = { lineHeight: `${LINE_HEIGHT}px`, padding: PAD };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Counts + export */}
      <section className="grid gap-px overflow-hidden rounded-[4px] border border-rule bg-rule lg:grid-cols-[200px_minmax(0,1fr)_minmax(320px,380px)]">
        <div className="flex flex-col justify-between gap-2 bg-sheet px-5 py-4">
          <p className="label">Detected</p>
          <div className="flex items-baseline gap-2">
            <span className="tabular font-mono text-[34px] font-medium leading-none text-ink">{result ? entities.length : '—'}</span>
            <span className="text-[12.5px] text-ink-3">{result ? (entities.length === 1 ? 'value' : 'values') : 'not scanned'}</span>
          </div>
          <p className="tabular flex flex-col font-mono text-[11px] leading-[17px] text-muted">
            {result ? (
              <>
                <span>{result.rejected.length} rejected by checks</span>
                <span>
                  {changed.size} of {lineCount} lines changed
                </span>
              </>
            ) : (
              <span>Scan to see counts</span>
            )}
          </p>
        </div>

        <div className="bg-sheet px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="label">By type</p>
            <p className="hidden text-[11.5px] text-muted sm:block">Click a type to include or exclude it</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {CATEGORIES.map((c) => {
              const on = enabledCats.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => onToggleCategory(c)}
                  aria-pressed={on}
                  title={on ? `Exclude ${CATEGORY_META[c].label}` : `Include ${CATEGORY_META[c].label}`}
                  className={`flex flex-col items-start gap-1 rounded-[3px] border px-2.5 py-2 text-left transition-colors ${
                    on ? 'border-rule-2 bg-sheet hover:border-ink' : 'border-dashed border-rule-2 bg-paper/60 hover:border-ink-3'
                  }`}
                >
                  <span className={`flex items-center gap-1.5 text-[11.5px] font-medium ${on ? 'text-ink-2' : 'text-muted line-through'}`}>
                    <Swatch category={c} size={7} />
                    {CATEGORY_META[c].label}
                  </span>
                  <span className={`tabular font-mono text-[18px] font-medium leading-none ${on ? 'text-ink' : 'text-rule-2'}`}>
                    {!on ? 'off' : result ? counts[c] : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 bg-sheet px-5 py-4">
          <div className="min-w-0">
            <p className="label">Export</p>
            <p className="mt-2 flex items-center gap-1.5 truncate font-mono text-[12.5px] text-ink" title={outName}>
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />
              <span className="truncate">{outName}</span>
            </p>
            <p className="tabular mt-1 font-mono text-[11px] text-muted">
              {result ? `${MODE_LABEL[mode]} · ${sanitizedLength.toLocaleString()} chars · ${fileKind.toUpperCase()}` : 'Available after a scan'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onCopy} disabled={!result} className="btn-line py-2">
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
            <button onClick={onExport} disabled={!result} className="btn-ink flex-1 py-2">
              <Download className="h-3.5 w-3.5" /> Download sanitized .{fileKind}
            </button>
          </div>
        </div>
      </section>

      {/* Side-by-side diff */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Original — editable */}
        <div className="flex h-[60vh] min-h-[360px] flex-col overflow-hidden rounded-[4px] border border-rule bg-sheet shadow-sheet lg:h-auto lg:min-h-0">
          <PanelHead title="Original">
            {isLive ? (
              <span className="flex items-center gap-1.5 uppercase tracking-label text-ink-2">
                <span className="relative flex h-[6px] w-[6px]" aria-hidden="true">
                  <span className="absolute inset-0 animate-ping bg-signal opacity-60 motion-reduce:hidden" />
                  <span className="relative h-[6px] w-[6px] bg-signal" />
                </span>
                Live
              </span>
            ) : (
              <span>{docText.length.toLocaleString()} chars</span>
            )}
            {result && (
              <span style={{ color: REMOVED.mark }}>
                − {entities.length} value{entities.length === 1 ? '' : 's'}
              </span>
            )}
          </PanelHead>
          <div className="relative flex min-h-0 flex-1">
            <VirtualGutter ref={leftGutterRef} lineCount={lineCount} changed={changed} tone={REMOVED_TONE} className="w-14" />
            <div className="relative min-w-0 flex-1">
              <VirtualOverlay ref={leftOverlayRef} layout={originalLayout} marks={originalMarks} bands={changed} bandColor={REMOVED.line} />
              <DocumentTextarea
                ref={textareaRef}
                value={docText}
                onValueChange={onTextChange}
                onScroll={() => handleScroll('left')}
                wrap="off"
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-label="Original document text"
                className="editor-textarea scroll-quiet absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent font-mono text-[13px] outline-none"
                style={textStyle}
              />
            </div>
          </div>
        </div>

        {/* Sanitized — read-only */}
        <div className="flex h-[60vh] min-h-[360px] flex-col overflow-hidden rounded-[4px] border border-rule bg-sheet shadow-sheet lg:h-auto lg:min-h-0">
          <PanelHead title={`Sanitized · ${MODE_LABEL[mode]}`}>
            {result && (
              <>
                <span className="hidden sm:inline">
                  −{removedChars.toLocaleString()} +{addedChars.toLocaleString()} chars
                </span>
                <span style={{ color: ADDED.mark }}>
                  + {entities.length} replacement{entities.length === 1 ? '' : 's'}
                </span>
              </>
            )}
          </PanelHead>
          {result ? (
            <div className="relative flex min-h-0 flex-1">
              <VirtualGutter ref={rightGutterRef} lineCount={sanitizedLayout.starts.length} changed={changed} tone={ADDED_TONE} className="w-14" />
              <VirtualScrollText
                ref={rightScrollRef}
                layout={sanitizedLayout}
                marks={sanitizedMarks}
                bands={changed}
                bandColor={ADDED.line}
                onScroll={() => handleScroll('right')}
                label="Sanitized output"
                className="scroll-quiet min-w-0 flex-1"
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-start justify-center gap-3 px-6 py-10 sm:px-10">
              <div className="flex flex-col gap-1.5" aria-hidden="true">
                <span className="block h-2 w-28 bg-ink" />
                <span className="block h-2 w-16 bg-rule-2" />
              </div>
              <p className="mt-2 text-[15px] font-semibold text-ink">
                {scanning ? 'Scanning…' : stale ? 'Live updates paused' : 'Not scanned yet'}
              </p>
              <p className="max-w-sm text-[13px] leading-relaxed text-ink-3">
                {stale
                  ? `This document is over ${liveLimit.toLocaleString()} characters, so it is not re-scanned on every edit. Rescan to update the diff.`
                  : 'Scan the document to see the sanitized version here. After that, it updates as you type on the left.'}
              </p>
              <button onClick={onScan} disabled={scanning || !docText.trim()} className="btn-ink mt-1 py-2">
                {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                {stale ? 'Rescan' : 'Scan'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
