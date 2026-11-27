import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { CATEGORIES, CATEGORY_META, MODE_LABEL, aliasFor, replacementFor, type Category, type Entity, type RedactionMode } from '../lib/pii';
import { Swatch } from './ui';
import { DocumentTextarea } from './DocumentTextarea';
import { LINE_HEIGHT, PAD, VirtualGutter, VirtualOverlay, type Mark, type ScrollSync } from './VirtualText';
import { useTextLayout } from '../hooks/useTextLayout';

interface EditorProps {
  text: string;
  fileName: string;
  onChange: (text: string) => void;
  entities: Entity[];
  selected: Entity | null;
  selectedIndex: number;
  onSelectEntity: (id: string) => void;
  onCloseDetail: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  pseudonymMap: Map<string, string>;
  mode: RedactionMode;
  scanning: boolean;
  onFileDrop: (file: File) => void;
  onOpenFile: () => void;
  onPaste: () => void;
  onLoadSample: () => void;
}

/* Shared style objects: the virtual text layer skips lines whose marks are unchanged by identity. */
const SELECTED_STYLE: CSSProperties = { background: '#16150F', color: '#F3F0E8', borderRadius: 1, boxShadow: '0 0 0 2px #16150F' };
const CATEGORY_STYLE = Object.fromEntries(
  CATEGORIES.map((c) => [
    c,
    { background: CATEGORY_META[c].softBg, borderRadius: 1, boxShadow: `inset 0 -1.5px 0 ${CATEGORY_META[c].color}` },
  ]),
) as Record<Category, CSSProperties>;

const CHAR_WIDTH = 7.8; /* IBM Plex Mono at 13px */

export default function Editor({
  text,
  fileName,
  onChange,
  entities,
  selected,
  selectedIndex,
  onSelectEntity,
  onCloseDetail,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  pseudonymMap,
  mode,
  scanning,
  onFileDrop,
  onOpenFile,
  onPaste,
  onLoadSample,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<ScrollSync>(null);
  const gutterRef = useRef<ScrollSync>(null);
  const [dragging, setDragging] = useState(false);

  const layout = useTextLayout(text);
  const lineCount = layout.starts.length;
  /* Header stats can trail typing by a frame; deferring them keeps keystrokes on large files cheap. */
  const deferredText = useDeferredValue(text);
  const wordCount = useMemo(() => countWords(deferredText), [deferredText]);

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    overlayRef.current?.sync(ta.scrollTop, ta.scrollLeft);
    gutterRef.current?.sync(ta.scrollTop, 0);
  }, []);

  /* Replacing the text can clamp the textarea's scroll offset without a scroll event. */
  useLayoutEffect(syncScroll, [layout, syncScroll]);

  /* Bring the selected finding into view. */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !selected) return;
    const top = PAD + (selected.line - 1) * LINE_HEIGHT;
    if (top < ta.scrollTop + LINE_HEIGHT || top > ta.scrollTop + ta.clientHeight - LINE_HEIGHT * 3) {
      ta.scrollTop = Math.max(0, top - ta.clientHeight / 3);
    }
    const left = PAD + (selected.column - 1) * CHAR_WIDTH;
    const width = (selected.end - selected.start) * CHAR_WIDTH;
    if (left < ta.scrollLeft || left + width > ta.scrollLeft + ta.clientWidth - PAD) {
      ta.scrollLeft = Math.max(0, left - 48);
    }
    syncScroll();
  }, [selected, syncScroll]);

  /* Entities arrive sorted by start; only their styles depend on the selection. */
  const marks = useMemo<Mark[]>(
    () =>
      entities.map((e) => ({
        start: e.start,
        end: e.end,
        style: selected?.id === e.id ? SELECTED_STYLE : CATEGORY_STYLE[e.category],
      })),
    [entities, selected],
  );

  /* Clicking inside a highlighted value opens it in the inspector. */
  const handleClick = () => {
    const ta = textareaRef.current;
    if (!ta || entities.length === 0) return;
    if (ta.selectionStart !== ta.selectionEnd) return;
    const hit = entityAt(entities, ta.selectionStart);
    if (hit) onSelectEntity(hit.id);
  };

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[4px] border bg-sheet shadow-sheet transition-colors ${
        dragging ? 'border-ink' : 'border-rule'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFileDrop(file);
      }}
    >
      {/* Sheet header */}
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2">
        <span className="truncate font-mono text-[12px] text-ink-2">{fileName || 'untitled.txt'}</span>
        <span className="tabular hidden shrink-0 font-mono text-[11px] text-muted sm:block">
          {text.length.toLocaleString()} chars · {wordCount.toLocaleString()} words · {lineCount.toLocaleString()} lines
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Line numbers */}
        <VirtualGutter ref={gutterRef} lineCount={lineCount} activeLine={selected?.line} className="w-12" />

        {/* Highlight layer + transparent textarea */}
        <div className="relative min-w-0 flex-1">
          <VirtualOverlay ref={overlayRef} layout={layout} marks={marks} />
          <DocumentTextarea
            ref={textareaRef}
            value={text}
            onValueChange={onChange}
            onScroll={syncScroll}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && selected) {
                onCloseDetail();
                return;
              }
              if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                const ta = e.currentTarget;
                const { selectionStart, selectionEnd } = ta;
                onChange(text.slice(0, selectionStart) + '  ' + text.slice(selectionEnd));
                requestAnimationFrame(() => {
                  ta.selectionStart = ta.selectionEnd = selectionStart + 2;
                });
              }
            }}
            wrap="off"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="Document text"
            className="editor-textarea scroll-quiet absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent font-mono text-[13px] outline-none"
            style={{ lineHeight: `${LINE_HEIGHT}px`, padding: PAD }}
          />

          {/* Scan sweep */}
          <AnimatePresence>
            {scanning && (
              <motion.div
                key="sweep"
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-10"
                initial={{ top: '0%', opacity: 0 }}
                animate={{ top: '100%', opacity: [0, 1, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="h-px w-full bg-signal" />
                <div className="h-10 w-full -translate-y-full bg-gradient-to-t from-signal/10 to-transparent" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {text.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="w-full max-w-sm">
                <p className="label">New document</p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">Start with some text</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
                  Click here and type, or choose a source. Files are read inside this tab and never uploaded.
                </p>
                <div className="mt-5 border-t border-rule">
                  {[
                    { label: 'Open a file', hint: '.txt · .csv', action: onOpenFile },
                    { label: 'Paste from clipboard', hint: 'Ctrl V', action: onPaste },
                    { label: 'Use the sample record', hint: 'synthetic', action: onLoadSample },
                  ].map((o) => (
                    <button
                      key={o.label}
                      onClick={o.action}
                      className="group pointer-events-auto flex w-full items-center justify-between gap-3 border-b border-rule px-1 py-3 text-left text-[13.5px] font-medium text-ink transition-colors hover:bg-paper"
                    >
                      {o.label}
                      <span className="flex items-center gap-2 font-mono text-[11px] font-normal text-muted">
                        {o.hint}
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-4 font-mono text-[11px] text-muted">or drop a file onto this sheet</p>
              </div>
            </div>
          )}

          {dragging && (
            <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center border-2 border-dashed border-ink bg-sheet/90">
              <span className="font-mono text-[12px] uppercase tracking-label text-ink">Drop to open · .txt or .csv</span>
            </div>
          )}
        </div>
      </div>

      {/* Inspector */}
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            key="inspector"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-ink bg-sheet"
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Swatch category={selected.category} size={9} />
                {CATEGORY_META[selected.category].label}
              </span>
              <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11.5px]">
                <div className="flex gap-2">
                  <dt className="text-muted">Position</dt>
                  <dd className="text-ink">
                    Ln {selected.line}, Col {selected.column}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted">Check</dt>
                  <dd className="text-ink">Passed</dd>
                </div>
                <div className="flex min-w-0 gap-2">
                  <dt className="shrink-0 text-muted">{MODE_LABEL[mode]}</dt>
                  <dd className="truncate text-ink">{replacementFor(selected, mode, pseudonymMap)}</dd>
                </div>
                {mode !== 'PSEUDONYM' && (
                  <div className="flex gap-2">
                    <dt className="text-muted">Alias</dt>
                    <dd className="text-ink">{aliasFor(selected, pseudonymMap)}</dd>
                  </div>
                )}
              </dl>
              <div className="ml-auto flex items-center gap-1">
                <span className="tabular mr-2 font-mono text-[11px] text-muted">
                  {selectedIndex + 1} / {entities.length}
                </span>
                <button onClick={onPrev} disabled={!hasPrev} className="btn-quiet px-1.5" aria-label="Previous finding">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={onNext} disabled={!hasNext} className="btn-quiet px-1.5" aria-label="Next finding">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button onClick={onCloseDetail} className="btn-quiet px-1.5" aria-label="Close inspector">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Same set as the regex `\s`. */
function isSpace(c: number): boolean {
  return (
    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff
  );
}

/** Word count without allocating an array of every word. */
function countWords(text: string): number {
  let count = 0;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const space = isSpace(c);
    if (!space && !inWord) count++;
    inWord = !space;
  }
  return count;
}

/** The entity containing `pos` (inclusive of its end), found by binary search over start-sorted entities. */
function entityAt(entities: Entity[], pos: number): Entity | undefined {
  let lo = 0;
  let hi = entities.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const e = entities[mid];
    if (pos < e.start) hi = mid - 1;
    else if (pos > e.end) lo = mid + 1;
    else return e;
  }
  return undefined;
}
