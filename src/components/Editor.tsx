import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { CATEGORY_META, aliasFor, replacementFor, type Entity, type RedactionMode } from '../lib/pii';
import { MODE_LABEL, Swatch } from './ui';

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

const LINE_HEIGHT = 22;
const PAD = 16;
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
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const lineCount = useMemo(() => text.split('\n').length, [text]);
  const wordCount = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

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
  }, [selected]);

  const highlighted = useMemo(() => {
    if (entities.length === 0) return text;
    const sorted = [...entities].sort((a, b) => a.start - b.start);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    sorted.forEach((e, i) => {
      if (e.start > cursor) nodes.push(<span key={`p-${i}`}>{text.slice(cursor, e.start)}</span>);
      const meta = CATEGORY_META[e.category];
      const isSelected = selected?.id === e.id;
      nodes.push(
        <span
          key={e.id}
          style={
            isSelected
              ? { background: '#16150F', color: '#F3F0E8', borderRadius: 1, boxShadow: '0 0 0 2px #16150F' }
              : { background: meta.softBg, borderRadius: 1, boxShadow: `inset 0 -1.5px 0 ${meta.color}` }
          }
        >
          {text.slice(e.start, e.end)}
        </span>,
      );
      cursor = e.end;
    });
    if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);
    return nodes;
  }, [text, entities, selected]);

  /* Clicking inside a highlighted value opens it in the inspector. */
  const handleClick = () => {
    const ta = textareaRef.current;
    if (!ta || entities.length === 0) return;
    if (ta.selectionStart !== ta.selectionEnd) return;
    const pos = ta.selectionStart;
    const hit = entities.find((e) => pos >= e.start && pos <= e.end);
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
        <div
          ref={gutterRef}
          className="w-12 shrink-0 select-none overflow-hidden border-r border-rule/70 bg-paper/50 text-right"
          style={{ paddingTop: PAD, paddingBottom: PAD }}
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className={`pr-3 font-mono text-[11px] ${selected && selected.line === i + 1 ? 'text-ink' : 'text-rule-2'}`}
              style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Highlight layer + transparent textarea */}
        <div className="relative min-w-0 flex-1">
          <pre
            ref={preRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre font-mono text-[13px] text-ink"
            style={{ lineHeight: `${LINE_HEIGHT}px`, padding: PAD }}
          >
            {highlighted}
            {'\n'}
          </pre>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
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
