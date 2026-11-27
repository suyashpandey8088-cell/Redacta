import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ClipboardPaste, Copy, Download, Eraser, FileText, FileUp, Loader2, ScanLine, Table2 } from 'lucide-react';
import Editor from './Editor';
import FindingsPanel from './FindingsPanel';
import CompareStudio from './CompareStudio';
import PseudonymStudio from './PseudonymStudio';
import Analytics from './Analytics';
import AuditCenter from './AuditCenter';
import PrivacyCenter from './PrivacyCenter';
import { EmptyState, Logo, MODE_LABEL, Segmented, ViewHeader } from './ui';
import type { Category, DetectionResult, Entity, RedactionMode, Segment } from '../lib/pii';
import type { AuditEvent } from '../lib/audit';

export type WorkspaceTab = 'sanitize' | 'compare' | 'aliases' | 'analysis' | 'audit' | 'privacy';

interface WorkspaceProps {
  tab: WorkspaceTab;
  onTabChange: (t: WorkspaceTab) => void;
  docText: string;
  fileName: string;
  fileKind: 'txt' | 'csv';
  mode: RedactionMode;
  onModeChange: (m: RedactionMode) => void;
  enabledCats: Category[];
  onToggleCategory: (c: Category) => void;
  result: DetectionResult | null;
  stale: boolean;
  scanning: boolean;
  onScan: () => void;
  selected: Entity | null;
  selectedIndex: number;
  onSelectEntity: (id: string) => void;
  onCloseDetail: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  pseudonymMap: Map<string, string>;
  segments: Segment[];
  onTextChange: (t: string) => void;
  onFile: (file: File) => void;
  onLoadSample: () => void;
  onLoadCsvSample: () => void;
  onClearDoc: () => void;
  onExport: () => void;
  onCopySanitized: () => void;
  onCopyAlias: (alias: string) => void;
  onResetMapping: () => void;
  onExportAudit: (format: 'txt' | 'json') => void;
  onClearSession: () => void;
  compareLayout: 'side' | 'stacked';
  onCompareLayoutChange: (l: 'side' | 'stacked') => void;
  audit: AuditEvent[];
  onBackHome: () => void;
  onPaste: () => void;
}

const MODE_OPTIONS: { value: RedactionMode; label: string; title: string }[] = [
  { value: 'FULL', label: 'Full', title: 'Replace every value with [REDACTED]' },
  { value: 'PARTIAL', label: 'Partial', title: 'Keep a verification hint such as the last four digits' },
  { value: 'PSEUDONYM', label: 'Alias', title: 'Replace each distinct value with a stable alias' },
];

export default function Workspace(props: WorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    tab, onTabChange, docText, fileName, fileKind, mode, onModeChange, result, stale, scanning, onScan,
    selected, selectedIndex, onSelectEntity, onCloseDetail, onPrev, onNext, hasPrev, hasNext, pseudonymMap,
    segments, onTextChange, onFile, onLoadSample, onLoadCsvSample, onClearDoc, onExport, onCopySanitized,
    onCopyAlias, onResetMapping, onExportAudit, onClearSession, compareLayout, onCompareLayoutChange, audit,
    onBackHome, onPaste, enabledCats, onToggleCategory,
  } = props;

  const entities = result?.entities ?? [];
  const aliasCount = pseudonymMap.size;
  const openFile = () => fileInputRef.current?.click();
  const goSanitize = () => onTabChange('sanitize');

  const tabs: { id: WorkspaceTab; label: string; count?: number }[] = [
    { id: 'sanitize', label: 'Sanitize', count: result ? entities.length : undefined },
    { id: 'compare', label: 'Compare' },
    { id: 'aliases', label: 'Aliases', count: result ? aliasCount : undefined },
    { id: 'analysis', label: 'Analysis' },
    { id: 'audit', label: 'Audit', count: audit.length || undefined },
    { id: 'privacy', label: 'Privacy' },
  ];

  const status = !docText
    ? 'No document'
    : scanning
      ? 'Scanning…'
      : result
        ? `${entities.length} value${entities.length === 1 ? '' : 's'} found`
        : stale
          ? 'Edited — scan again'
          : 'Not scanned';

  return (
    <div className="flex h-[100dvh] flex-col bg-paper text-ink">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv,text/plain,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />

      {/* Top bar */}
      <header className="shrink-0 border-b border-rule bg-paper">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-5">
          <Logo onClick={onBackHome} />
          <span className="mx-1 hidden h-5 w-px bg-rule-2 sm:block" aria-hidden="true" />
          <div className="hidden min-w-0 items-baseline gap-3 sm:flex">
            <span className="truncate font-mono text-[12.5px] text-ink">{fileName || 'untitled.txt'}</span>
            <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-label text-muted">{docText ? fileKind : ''}</span>
            <span className={`shrink-0 text-[12.5px] ${stale && !result ? 'text-signal' : 'text-ink-3'}`}>{status}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="mr-2 hidden items-center gap-2 font-mono text-[10.5px] uppercase tracking-label text-muted xl:flex">
              <span className="h-[6px] w-[6px] bg-signal" aria-hidden="true" /> Processing in this tab
            </span>
            <button onClick={onBackHome} className="btn-quiet hidden md:inline-flex">
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </button>
            <button onClick={onExport} disabled={!result} className="btn-ink py-2" title={result ? undefined : 'Run a scan first'}>
              <Download className="h-3.5 w-3.5" /> Export .{fileKind}
            </button>
          </div>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-2 sm:px-3" aria-label="Workspace">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-1.5 text-[13px] font-medium transition-colors ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`tabular font-mono text-[10.5px] ${active ? 'text-ink-3' : 'text-muted'}`}>{t.count}</span>
                )}
                {active && <motion.span layoutId="tab-underline" className="absolute inset-x-2 bottom-0 h-[2px] bg-ink" />}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
        {tab === 'sanitize' && (
          <div className="flex flex-col lg:h-full">
            {/* Toolbar */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-rule bg-paper px-3 py-2 sm:px-4">
              <div className="flex flex-wrap items-center gap-0.5">
                <button onClick={openFile} className="btn-quiet">
                  <FileUp className="h-3.5 w-3.5" /> Open
                </button>
                <button onClick={onPaste} className="btn-quiet">
                  <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                </button>
                <button onClick={onLoadSample} className="btn-quiet">
                  <FileText className="h-3.5 w-3.5" /> Sample record
                </button>
                <button onClick={onLoadCsvSample} className="btn-quiet">
                  <Table2 className="h-3.5 w-3.5" /> Sample CSV
                </button>
                <button onClick={onClearDoc} disabled={!docText} className="btn-quiet hover:text-signal">
                  <Eraser className="h-3.5 w-3.5" /> Clear
                </button>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Segmented label="Redaction mode" value={mode} options={MODE_OPTIONS} onChange={onModeChange} />
                <button onClick={onScan} disabled={scanning || docText.trim().length === 0} className="btn-ink py-2">
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                  {scanning ? 'Scanning' : result ? 'Rescan' : 'Scan'}
                  <kbd className="ml-1 hidden rounded-[2px] border border-paper/25 px-1 font-mono text-[10px] font-normal text-paper/70 lg:inline">
                    Ctrl+Enter
                  </kbd>
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="flex h-[68vh] min-h-[420px] flex-col p-3 sm:p-4 lg:h-auto lg:min-h-0">
                <Editor
                  text={docText}
                  fileName={fileName}
                  onChange={onTextChange}
                  entities={entities}
                  selected={selected}
                  selectedIndex={selectedIndex}
                  onSelectEntity={onSelectEntity}
                  onCloseDetail={onCloseDetail}
                  onPrev={onPrev}
                  onNext={onNext}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  pseudonymMap={pseudonymMap}
                  mode={mode}
                  scanning={scanning}
                  onFileDrop={onFile}
                  onOpenFile={openFile}
                  onPaste={onPaste}
                  onLoadSample={onLoadSample}
                />
              </div>
              <aside className="scroll-quiet min-h-0 border-t border-rule bg-paper lg:overflow-y-auto lg:border-l lg:border-t-0">
                <FindingsPanel
                  result={result}
                  docText={docText}
                  enabledCats={enabledCats}
                  onToggleCategory={onToggleCategory}
                  selectedId={selected?.id ?? null}
                  onSelectEntity={onSelectEntity}
                />
              </aside>
            </div>
          </div>
        )}

        {tab === 'compare' && (
          <div className="flex flex-col gap-5 p-4 sm:p-6 lg:h-full lg:p-8">
            <ViewHeader
              index="02 — Compare"
              title="Before and after"
              desc="The original and the sanitized output, scrolled together. Switch modes here to see each version."
              actions={
                result ? (
                  <>
                    <Segmented label="Redaction mode" size="sm" value={mode} options={MODE_OPTIONS} onChange={onModeChange} />
                    <Segmented
                      label="Layout"
                      size="sm"
                      value={compareLayout}
                      options={[
                        { value: 'side', label: 'Side by side' },
                        { value: 'stacked', label: 'Stacked' },
                      ]}
                      onChange={onCompareLayoutChange}
                    />
                    <button onClick={onCopySanitized} className="btn-line py-2">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <button onClick={onExport} className="btn-ink py-2">
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                  </>
                ) : undefined
              }
            />
            {result ? (
              <CompareStudio original={docText} segments={segments} entities={entities} mode={mode} layout={compareLayout} />
            ) : (
              <EmptyState
                title="Nothing to compare yet"
                desc={`Scan a document first. You will see the original and its ${MODE_LABEL[mode].toLowerCase()} version line by line.`}
                actionLabel="Go to Sanitize"
                onAction={goSanitize}
              />
            )}
          </div>
        )}

        {tab === 'aliases' && (
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <PseudonymStudio
              entities={entities}
              pseudonymMap={pseudonymMap}
              hasResult={!!result}
              onCopyAlias={onCopyAlias}
              onReset={onResetMapping}
              onGoSanitize={goSanitize}
            />
          </div>
        )}

        {tab === 'analysis' && (
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <Analytics result={result} docText={docText} entities={entities} pseudonymMap={pseudonymMap} mode={mode} onGoSanitize={goSanitize} />
          </div>
        )}

        {tab === 'audit' && (
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <AuditCenter events={audit} onExport={onExportAudit} onClearSession={onClearSession} onGoSanitize={goSanitize} />
          </div>
        )}

        {tab === 'privacy' && (
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <PrivacyCenter events={audit} docLength={docText.length} aliasCount={aliasCount} />
          </div>
        )}
      </main>
    </div>
  );
}
