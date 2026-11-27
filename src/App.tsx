import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import Landing from './components/Landing';
import Workspace, { type WorkspaceTab } from './components/Workspace';
import {
  buildPseudonymMap,
  detectPII,
  sanitizeCSV,
  sanitizeWithSegments,
  CATEGORIES,
  type Category,
  type DetectionResult,
  type RedactionMode,
} from './lib/pii';
import { SAMPLE_CSV, SAMPLE_CSV_FILENAME, SAMPLE_DOCUMENT, SAMPLE_FILENAME } from './lib/sample';
import { exportAudit, makeEvent, type AuditEvent } from './lib/audit';

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export default function App() {
  const [view, setView] = useState<'home' | 'app'>('home');
  const [tab, setTab] = useState<WorkspaceTab>('sanitizer');

  const [docText, setDocText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileKind, setFileKind] = useState<'txt' | 'csv'>('txt');

  const [mode, setMode] = useState<RedactionMode>('PARTIAL');
  const [enabledCats, setEnabledCats] = useState<Category[]>([...CATEGORIES]);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [compareLayout, setCompareLayout] = useState<'side' | 'stacked'>('side');
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const logAudit = useCallback((event: string, status: AuditEvent['status'], detail: string) => {
    setAudit((prev) => [...prev, makeEvent(event, status, detail)]);
  }, []);

  const entities = result?.entities ?? [];

  const pseudonymMap = useMemo(() => buildPseudonymMap(entities), [entities]);

  const { sanitized, segments } = useMemo(() => {
    if (!result) return { sanitized: '', segments: [] as ReturnType<typeof sanitizeWithSegments>['segments'] };
    const r = sanitizeWithSegments(docText, entities, mode, pseudonymMap);
    return { sanitized: r.output, segments: r.segments };
  }, [result, docText, entities, mode, pseudonymMap]);

  const selected = useMemo(
    () => entities.find((e) => e.id === selectedId) ?? null,
    [entities, selectedId],
  );

  const selectedIndex = selected ? entities.findIndex((e) => e.id === selected.id) : -1;

  /* Import a document (file, demo) and scan it immediately. */
  const importAndScan = useCallback(
    (text: string, name: string, kind: 'txt' | 'csv', source: string) => {
      setDocText(text);
      setFileName(name);
      setFileKind(kind);
      setView('app');
      setTab('sanitizer');
      logAudit('Document imported', 'info', `${kind.toUpperCase()} · ${text.length} chars · ${source}`);
      const res = detectPII(text, enabledCats);
      setResult(res);
      setSelectedId(null);
      logAudit('Scan started', 'info', `${kind.toUpperCase()} · ${enabledCats.length} categories enabled`);
      logAudit('Detection completed', 'success', `${res.entities.length} entities · ${res.durationMs.toFixed(1)} ms`);
      logAudit('Validation completed', 'success', `${res.rejected.length} candidates rejected`);
      showToast(`Scan complete — ${res.entities.length} entities found`);
    },
    [enabledCats, logAudit, showToast],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const kind: 'txt' | 'csv' = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'txt';
      try {
        const text = await file.text();
        importAndScan(text, file.name, kind, 'file upload');
      } catch {
        showToast('Could not read that file');
      }
    },
    [importAndScan, showToast],
  );

  const loadDemo = useCallback(() => {
    importAndScan(SAMPLE_DOCUMENT, SAMPLE_FILENAME, 'txt', 'interactive demo');
  }, [importAndScan]);

  const loadCsvDemo = useCallback(() => {
    importAndScan(SAMPLE_CSV, SAMPLE_CSV_FILENAME, 'csv', 'CSV demo');
  }, [importAndScan]);

  const runScan = useCallback(() => {
    if (!docText.trim()) {
      showToast('Load a document first');
      return;
    }
    setScanning(true);
    logAudit('Scan started', 'info', `${fileKind.toUpperCase()} · ${docText.length} chars`);
    window.setTimeout(() => {
      const res = detectPII(docText, enabledCats);
      setResult(res);
      setSelectedId(null);
      logAudit('Detection completed', 'success', `${res.entities.length} entities · ${res.durationMs.toFixed(1)} ms`);
      logAudit('Validation completed', 'success', `${res.rejected.length} candidates rejected`);
      setScanning(false);
      showToast(`Scan complete — ${res.entities.length} entities found`);
    }, 420);
  }, [docText, enabledCats, fileKind, logAudit, showToast]);

  const handleTextChange = useCallback((text: string) => {
    setDocText(text);
    /* Offsets from a previous scan no longer apply. */
    setResult(null);
    setSelectedId(null);
  }, []);

  const handleModeChange = useCallback(
    (m: RedactionMode) => {
      setMode(m);
      logAudit('Redaction mode changed', 'info', m === 'FULL' ? 'Full Mask' : m === 'PARTIAL' ? 'Partial Mask' : 'Pseudonymization');
    },
    [logAudit],
  );

  const handleToggleCategory = useCallback(
    (c: Category) => {
      setEnabledCats((prev) => {
        const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
        if (result) {
          const res = detectPII(docText, next);
          setResult(res);
          setSelectedId(null);
        }
        return next;
      });
      logAudit('Category filter updated', 'info', `${c} toggled`);
    },
    [docText, logAudit, result],
  );

  const exportSanitized = useCallback(() => {
    if (!result) {
      showToast('Run a scan before exporting');
      return;
    }
    if (fileKind === 'csv') {
      const { output } = sanitizeCSV(docText, enabledCats, mode);
      downloadText(output, 'veil-sanitized.csv', 'text/csv');
      logAudit('Export generated', 'success', `CSV · ${mode} mode`);
    } else {
      downloadText(sanitized, 'veil-sanitized.txt', 'text/plain');
      logAudit('Export generated', 'success', `TXT · ${mode} mode`);
    }
    showToast('Sanitized file downloaded');
  }, [result, fileKind, docText, enabledCats, mode, sanitized, logAudit, showToast]);

  const copySanitized = useCallback(async () => {
    if (!result) {
      showToast('Run a scan first');
      return;
    }
    const ok = await copyText(sanitized);
    showToast(ok ? 'Sanitized output copied' : 'Clipboard unavailable in this browser');
  }, [result, sanitized, showToast]);

  const copyAlias = useCallback(
    async (alias: string) => {
      const ok = await copyText(alias);
      showToast(ok ? `${alias} copied` : 'Clipboard unavailable in this browser');
    },
    [showToast],
  );

  const resetMapping = useCallback(() => {
    if (!docText.trim()) {
      showToast('No document loaded');
      return;
    }
    const res = detectPII(docText, enabledCats);
    setResult(res);
    setSelectedId(null);
    logAudit('Pseudonym mapping reset', 'info', `${res.entities.length} entities re-mapped`);
    showToast('Pseudonym mapping regenerated');
  }, [docText, enabledCats, logAudit, showToast]);

  const exportAuditReport = useCallback(
    (format: 'txt' | 'json') => {
      const { content, filename, mime } = exportAudit(audit, format);
      downloadText(content, filename, mime);
      logAudit('Export generated', 'success', `Audit report · ${format.toUpperCase()}`);
      showToast('Audit report downloaded');
    },
    [audit, logAudit, showToast],
  );

  const clearSession = useCallback(() => {
    setDocText('');
    setFileName('');
    setResult(null);
    setSelectedId(null);
    logAudit('Session cleared', 'warning', 'Document and mappings removed from memory');
    showToast('Session cleared');
  }, [logAudit, showToast]);

  const clearDoc = useCallback(() => {
    setDocText('');
    setFileName('');
    setResult(null);
    setSelectedId(null);
    showToast('Document cleared');
  }, [showToast]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDocText(text);
        setFileName('pasted-text.txt');
        setFileKind('txt');
        setResult(null);
        setSelectedId(null);
        logAudit('Document imported', 'info', `TXT · ${text.length} chars · clipboard`);
        showToast('Text pasted — run a scan');
      } else {
        showToast('Clipboard is empty');
      }
    } catch {
      showToast('Clipboard access denied — click the editor and press Ctrl+V');
    }
  }, [logAudit, showToast]);

  const stepEntity = useCallback(
    (dir: 1 | -1) => {
      if (entities.length === 0) return;
      const idx = selectedIndex === -1 ? (dir === 1 ? 0 : entities.length - 1) : selectedIndex + dir;
      const clamped = Math.max(0, Math.min(entities.length - 1, idx));
      setSelectedId(entities[clamped].id);
    },
    [entities, selectedIndex],
  );

  return (
    <div className="min-h-screen bg-veil-bg font-sans text-veil-text">
      {/* Film grain overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 opacity-[0.035]"
        style={{ backgroundImage: GRAIN }}
      />

      {view === 'home' ? (
        <Landing
          onLaunch={() => {
            setView('app');
            setTab('sanitizer');
          }}
          onLoadDemo={loadDemo}
        />
      ) : (
        <Workspace
          tab={tab}
          onTabChange={setTab}
          docText={docText}
          fileName={fileName}
          fileKind={fileKind}
          mode={mode}
          onModeChange={handleModeChange}
          enabledCats={enabledCats}
          onToggleCategory={handleToggleCategory}
          result={result}
          scanning={scanning}
          onScan={runScan}
          selected={selected}
          onSelectEntity={setSelectedId}
          onCloseDetail={() => setSelectedId(null)}
          onPrev={() => stepEntity(-1)}
          onNext={() => stepEntity(1)}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex >= 0 && selectedIndex < entities.length - 1}
          pseudonymMap={pseudonymMap}
          sanitized={sanitized}
          segments={segments}
          onTextChange={handleTextChange}
          onFile={handleFile}
          onLoadDemo={loadDemo}
          onLoadCsvDemo={loadCsvDemo}
          onClearDoc={clearDoc}
          onExport={exportSanitized}
          onCopySanitized={copySanitized}
          onCopyAlias={copyAlias}
          onResetMapping={resetMapping}
          onExportAudit={exportAuditReport}
          onClearSession={clearSession}
          compareLayout={compareLayout}
          onCompareLayoutChange={setCompareLayout}
          audit={audit}
          onBackHome={() => setView('home')}
          onPaste={pasteFromClipboard}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-veil-accent/30 bg-veil-elevated px-4 py-2.5 text-sm text-veil-text shadow-2xl"
            role="status"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-veil-accent" />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
