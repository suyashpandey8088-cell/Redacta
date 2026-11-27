import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSearch, X } from 'lucide-react';
import {
  CATEGORY_META,
  aliasFor,
  replacementFor,
  type Entity,
  type RedactionMode,
} from '../lib/pii';

interface EditorProps {
  text: string;
  onChange: (text: string) => void;
  entities: Entity[];
  selected: Entity | null;
  onCloseDetail: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  pseudonymMap: Map<string, string>;
  mode: RedactionMode;
  onFileDrop: (file: File) => void;
}

const LINE_HEIGHT = 21.45;

export default function Editor({
  text,
  onChange,
  entities,
  selected,
  onCloseDetail,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  pseudonymMap,
  mode,
  onFileDrop,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const lineCount = useMemo(() => text.split('\n').length, [text]);
  const wordCount = useMemo(() => (text.trim() ? text.trim().split(/\s+/).length : 0), [text]);

  const handleScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  /* Render highlighted overlay content. */
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
          style={{
            background: isSelected ? meta.color : meta.softBg,
            color: isSelected ? '#080B0F' : undefined,
            borderBottom: `1px solid ${meta.underline}`,
            borderRadius: 3,
            padding: '0 1px',
          }}
        >
          {text.slice(e.start, e.end)}
        </span>,
      );
      cursor = e.end;
    });
    if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);
    return nodes;
  }, [text, entities, selected]);

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-veil-secondary transition-colors ${
        dragging ? 'border-veil-accent/60' : 'border-white/10'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFileDrop(file);
      }}
    >
      <div className="flex min-h-0 flex-1">
        {/* Line-number gutter */}
        <div
          ref={gutterRef}
          className="w-12 shrink-0 overflow-hidden border-r border-white/[0.07] bg-veil-bg/40 py-4 text-right"
          aria-hidden="true"
        >
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

        {/* Editor surface */}
        <div className="relative min-w-0 flex-1">
          <pre
            ref={preRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-4 font-mono text-[13px] text-veil-text"
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
          >
            {highlighted}
            {'\n'}
          </pre>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const ta = e.currentTarget;
                const { selectionStart, selectionEnd } = ta;
                const next = text.slice(0, selectionStart) + '  ' + text.slice(selectionEnd);
                onChange(next);
                requestAnimationFrame(() => {
                  ta.selectionStart = ta.selectionEnd = selectionStart + 2;
                });
              }
            }}
            wrap="off"
            spellCheck={false}
            placeholder=""
            aria-label="Document editor"
            className="editor-textarea absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-4 font-mono text-[13px] outline-none"
            style={{ lineHeight: `${LINE_HEIGHT}px` }}
          />

          {/* Empty state */}
          {text.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-veil-panel">
                <FileSearch className="h-5 w-5 text-veil-accent" />
              </div>
              <p className="text-sm font-medium text-veil-text">No document loaded</p>
              <p className="max-w-xs text-xs leading-relaxed text-veil-muted">
                Paste text, drop a .txt or .csv file, or load the interactive demo to begin.
              </p>
            </div>
          )}

          {/* Floating entity detail panel */}
          {selected && (
            <div className="absolute right-3 top-3 z-20 w-72 rounded-xl border border-white/12 bg-veil-elevated/95 p-4 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <span
                  className="rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: CATEGORY_META[selected.category].softBg, color: CATEGORY_META[selected.category].color }}
                >
                  {CATEGORY_META[selected.category].label}
                </span>
                <button
                  onClick={onCloseDetail}
                  className="rounded p-1 text-veil-muted transition hover:bg-white/10 hover:text-veil-text"
                  aria-label="Close finding detail"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-veil-muted">Validation</dt>
                  <dd className="font-medium text-veil-accent">Validated</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-veil-muted">Position</dt>
                  <dd className="font-mono text-veil-text">
                    Line {selected.line}, Col {selected.column}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="shrink-0 text-veil-muted">Redaction</dt>
                  <dd className="truncate font-mono text-veil-text">{replacementFor(selected, mode, pseudonymMap)}</dd>
                </div>
                {mode === 'PSEUDONYM' && (
                  <div className="flex justify-between">
                    <dt className="text-veil-muted">Alias</dt>
                    <dd className="font-mono text-veil-accent">{aliasFor(selected, pseudonymMap)}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                <button
                  onClick={onPrev}
                  disabled={!hasPrev}
                  className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-veil-muted transition hover:border-veil-accent/40 hover:text-veil-text disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <button
                  onClick={onNext}
                  disabled={!hasNext}
                  className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-veil-muted transition hover:border-veil-accent/40 hover:text-veil-text disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status footer */}
      <div className="flex items-center justify-between border-t border-white/[0.07] bg-veil-bg/40 px-4 py-2 font-mono text-[11px] text-veil-muted">
        <span>
          {text.length.toLocaleString()} chars · {wordCount.toLocaleString()} words · {lineCount} lines
        </span>
        <span className="hidden sm:block">
          {entities.length > 0 ? `${entities.length} entities highlighted` : 'No entities highlighted'}
        </span>
      </div>
    </div>
  );
}
