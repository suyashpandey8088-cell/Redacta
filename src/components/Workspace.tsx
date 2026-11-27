import { useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  Eraser,
  FileUp,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  Play,
  ScanLine,
  ScrollText,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import Editor from './Editor';
import IntelligencePanel from './IntelligencePanel';
import CompareStudio from './CompareStudio';
import PseudonymStudio from './PseudonymStudio';
import Analytics from './Analytics';
import AuditCenter from './AuditCenter';
import PrivacyCenter from './PrivacyCenter';
import {
  type Category,
  type DetectionResult,
  type Entity,
  type RedactionMode,
  type Segment,
} from '../lib/pii';
import type { AuditEvent } from '../lib/audit';

export type WorkspaceTab = 'overview' | 'sanitizer' | 'compare' | 'pseudonym' | 'analytics' | 'audit' | 'privacy';

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
  scanning: boolean;
  onScan: () => void;
  selected: Entity | null;
  onSelectEntity: (id: string) => void;
  onCloseDetail: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  pseudonymMap: Map<string, string>;
  sanitized: string;
  segments: Segment[];
  onTextChange: (t: string) => void;
  onFile: (file: File) => void;
  onLoadDemo: () => void;
  onLoadCsvDemo: () => void;
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

const NAV: { id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'sanitizer', label: 'Sanitizer', icon: ScanLine },
  { id: 'compare', label: 'Compare', icon: Columns2 },
  { id: 'pseudonym', label: 'Pseudonym Map', icon: KeyRound },
  { id: 'analytics', label: 'Detection', icon: BarChart3 },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText },
  { id: 'privacy', label: 'Privacy Center', icon: Lock },
];

const MODE_OPTIONS: { mode: RedactionMode; label: string; desc: string }[] = [
  { mode: 'FULL', label: 'Full Mask', desc: 'Complete removal' },
  { mode: 'PARTIAL', label: 'Partial Mask', desc: 'Preserve verification context' },
  { mode: 'PSEUDONYM', label: 'Pseudonymization', desc: 'Consistent replacement identities' },
];

export default function Workspace(props: WorkspaceProps) {
  const [collapsed, setCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    tab, onTabChange, docText, fileName, fileKind, mode, onModeChange,
    result, scanning, onScan, selected, onSelectEntity, onCloseDetail,
    onPrev, onNext, hasPrev, hasNext, pseudonymMap, sanitized, segments,
    onTextChange, onFile, onLoadDemo, onLoadCsvDemo, onClearDoc, onExport,
    onCopySanitized, onCopyAlias, onResetMapping, onExportAudit, onClearSession,
    compareLayout, onCompareLayoutChange, audit, onBackHome, onPaste,
    enabledCats, onToggleCategory,
  } = props;

  const entities = result?.entities ?? [];

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-veil-bg text-veil-text">
      {/* Left rail — desktop */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-white/[0.07] bg-veil-secondary transition-all lg:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/[0.07] px-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-veil-accent/15">
            <Shield className="h-4 w-4 text-veil-accent" />
          </span>
          {!collapsed && <span className="text-sm font-bold tracking-[0.18em]">VEIL</span>}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? 'bg-veil-accent/12 font-medium text-veil-accent'
                    : 'text-veil-muted hover:bg-white/[0.04] hover:text-veil-text'
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-white/[0.07] p-3">
          {!collapsed && (
            <p className="flex items-center gap-2 px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-veil-accent">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-veil-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-veil-accent" />
              </span>
              Local processing
            </p>
          )}
          <button
            onClick={onBackHome}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-veil-muted transition hover:bg-white/[0.04] hover:text-veil-text"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {!collapsed && 'Back to home'}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-veil-muted transition hover:bg-white/[0.04] hover:text-veil-text"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronLeft className="h-4 w-4 shrink-0" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile nav */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-white/[0.07] bg-veil-secondary px-3 py-2 lg:hidden">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-veil-accent/15">
            <Shield className="h-4 w-4 text-veil-accent" />
          </span>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition ${
                tab === item.id ? 'bg-veil-accent/12 text-veil-accent' : 'text-veil-muted hover:text-veil-text'
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
          <button
            onClick={onBackHome}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-veil-muted hover:text-veil-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </button>
        </div>

        {/* Content */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'overview' && (
            <div className="mx-auto max-w-5xl space-y-6 p-5 sm:p-8">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
                <p className="mt-1 text-sm text-veil-muted">
                  {docText ? `Working on ${fileName}` : 'No document loaded yet.'} All processing is local to this browser tab.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'Document status', value: docText ? 'Loaded' : 'Empty' },
                  { label: 'Entities found', value: entities.length },
                  { label: 'Redaction mode', value: mode === 'FULL' ? 'Full Mask' : mode === 'PARTIAL' ? 'Partial Mask' : 'Pseudonym' },
                  { label: 'Session events', value: audit.length },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-white/[0.08] bg-veil-panel px-4 py-4">
                    <p className="font-mono text-xl font-semibold text-veil-text">{c.value}</p>
                    <p className="mt-0.5 text-[11px] text-veil-muted">{c.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onLoadDemo}
                  className="flex items-center gap-2 rounded-lg bg-veil-accent px-4 py-2.5 text-sm font-semibold text-veil-bg transition hover:brightness-110"
                >
                  <Play className="h-4 w-4" /> Load interactive demo
                </button>
                <button
                  onClick={() => onTabChange('sanitizer')}
                  className="flex items-center gap-2 rounded-lg border border-white/12 bg-veil-panel px-4 py-2.5 text-sm font-medium text-veil-text transition hover:border-veil-accent/40"
                >
                  <ScanLine className="h-4 w-4" /> Open sanitizer
                </button>
                <button
                  onClick={() => onTabChange('privacy')}
                  className="flex items-center gap-2 rounded-lg border border-white/12 bg-veil-panel px-4 py-2.5 text-sm font-medium text-veil-text transition hover:border-veil-accent/40"
                >
                  <ShieldCheck className="h-4 w-4" /> Verify privacy
                </button>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-veil-panel p-5">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-veil-muted">
                  Recent session events
                </h3>
                {audit.length === 0 ? (
                  <p className="mt-3 text-sm text-veil-muted">No events yet — load a document to begin.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {[...audit].reverse().slice(0, 5).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-veil-text">{e.event}</span>
                        <span className="font-mono text-[11px] text-veil-muted">
                          {new Date(e.timestamp).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'sanitizer' && (
            <div className="flex min-h-full flex-col gap-4 p-4 sm:p-5 lg:h-full lg:min-h-0">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold tracking-tight">Document Sanitizer</h1>
                  <p className="flex items-center gap-2 text-xs text-veil-muted">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-veil-accent opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-veil-accent" />
                    </span>
                    Local processing environment active
                    {fileName && (
                      <span className="font-mono text-[11px] text-veil-muted/80">
                        · {fileName} · {fileKind.toUpperCase()}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-veil-panel px-3 py-2 text-xs font-medium text-veil-text transition hover:border-veil-accent/40"
                  >
                    <FileUp className="h-3.5 w-3.5" /> Upload
                  </button>
                  <button
                    onClick={onPaste}
                    className="rounded-lg border border-white/10 bg-veil-panel px-3 py-2 text-xs font-medium text-veil-text transition hover:border-veil-accent/40"
                  >
                    Paste
                  </button>
                  <button
                    onClick={onLoadDemo}
                    className="flex items-center gap-1.5 rounded-lg border border-veil-accent/40 bg-veil-accent/10 px-3 py-2 text-xs font-semibold text-veil-accent transition hover:bg-veil-accent/20"
                  >
                    <Play className="h-3.5 w-3.5" /> Demo
                  </button>
                  <button
                    onClick={onLoadCsvDemo}
                    className="rounded-lg border border-white/10 bg-veil-panel px-3 py-2 text-xs font-medium text-veil-text transition hover:border-veil-accent/40"
                  >
                    CSV demo
                  </button>
                  <button
                    onClick={onClearDoc}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-veil-panel px-3 py-2 text-xs font-medium text-veil-text transition hover:border-red-400/40 hover:text-red-300"
                  >
                    <Eraser className="h-3.5 w-3.5" /> Clear
                  </button>
                </div>
              </div>

              {/* Detection toolbar */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-veil-panel p-3">
                <button
                  onClick={onScan}
                  disabled={scanning || docText.trim().length === 0}
                  className="flex items-center gap-2 rounded-lg bg-veil-accent px-4 py-2.5 text-sm font-semibold text-veil-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                  {scanning ? 'Scanning…' : 'Scan Document'}
                </button>

                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Redaction mode">
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.mode}
                      role="radio"
                      aria-checked={mode === opt.mode}
                      onClick={() => onModeChange(opt.mode)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        mode === opt.mode
                          ? 'border-veil-accent/60 bg-veil-accent/12'
                          : 'border-white/10 hover:border-white/25'
                      }`}
                    >
                      <span className={`block text-xs font-semibold ${mode === opt.mode ? 'text-veil-accent' : 'text-veil-text'}`}>
                        {opt.label}
                      </span>
                      <span className="block text-[10px] text-veil-muted">{opt.desc}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={onExport}
                  disabled={!result}
                  className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-veil-panel px-4 py-2.5 text-sm font-medium text-veil-text transition hover:border-veil-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" /> Export Sanitized File
                </button>
              </div>

              {/* Editor + intelligence */}
              <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
                <div className="flex min-h-[420px] min-w-0 flex-1 flex-col lg:min-h-0">
                  <Editor
                    text={docText}
                    onChange={onTextChange}
                    entities={entities}
                    selected={selected}
                    onCloseDetail={onCloseDetail}
                    onPrev={onPrev}
                    onNext={onNext}
                    hasPrev={hasPrev}
                    hasNext={hasNext}
                    pseudonymMap={pseudonymMap}
                    mode={mode}
                    onFileDrop={onFile}
                  />
                </div>
                <aside className="flex min-h-0 w-full shrink-0 flex-col rounded-xl border border-white/[0.08] bg-veil-secondary lg:w-80">
                  <IntelligencePanel
                    result={result}
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
            <div className="flex min-h-full flex-col p-4 sm:p-5 lg:h-full lg:min-h-0">
              {result ? (
                <CompareStudio
                  original={docText}
                  segments={segments}
                  entities={entities}
                  mode={mode}
                  layout={compareLayout}
                  onLayoutChange={onCompareLayoutChange}
                  onCopy={onCopySanitized}
                  onDownload={onExport}
                />
              ) : (
                <EmptyState
                  title="Nothing to compare yet"
                  desc="Load a document and run a scan — the before/after studio will show exactly what changed."
                  actionLabel="Open sanitizer"
                  onAction={() => onTabChange('sanitizer')}
                />
              )}
            </div>
          )}

          {tab === 'pseudonym' && (
            <div className="flex min-h-full flex-col p-4 sm:p-5 lg:h-full lg:min-h-0">
              <PseudonymStudio
                entities={entities}
                pseudonymMap={pseudonymMap}
                onCopyAlias={onCopyAlias}
                onReset={onResetMapping}
              />
            </div>
          )}

          {tab === 'analytics' && (
            <div className="p-4 sm:p-5">
              <Analytics result={result} docText={docText} entities={entities} pseudonymMap={pseudonymMap} />
            </div>
          )}

          {tab === 'audit' && (
            <div className="flex min-h-full flex-col p-4 sm:p-5 lg:h-full lg:min-h-0">
              <AuditCenter events={audit} onExport={onExportAudit} onClearSession={onClearSession} />
            </div>
          )}

          {tab === 'privacy' && (
            <div className="p-4 sm:p-5">
              <PrivacyCenter events={audit} />
            </div>
          )}
        </main>
      </div>

    </div>
  );
}

function EmptyState({
  title,
  desc,
  actionLabel,
  onAction,
}: {
  title: string;
  desc: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-veil-panel">
        <Columns2 className="h-5 w-5 text-veil-accent" />
      </div>
      <p className="text-sm font-medium text-veil-text">{title}</p>
      <p className="max-w-xs text-xs text-veil-muted">{desc}</p>
      <button
        onClick={onAction}
        className="mt-1 rounded-lg bg-veil-accent px-4 py-2 text-xs font-semibold text-veil-bg transition hover:brightness-110"
      >
        {actionLabel}
      </button>
    </div>
  );
}
