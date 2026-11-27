import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Landing from './components/Landing';
import type { WorkspaceTab } from './components/Workspace';
import {
  buildPseudonymMap,
  detectPII,
  sanitizeCSV,
  sanitizeWithSegments,
  CATEGORIES,
  MODE_LABEL,
  type Category,
  type DetectionResult,
  type RedactionMode,
  type Segment,
} from './lib/pii';
import { SAMPLE_CSV, SAMPLE_CSV_FILENAME, SAMPLE_DOCUMENT, SAMPLE_FILENAME } from './lib/sample';
import { exportAudit, makeEvent, type AuditEvent } from './lib/audit';
import { useToast } from './hooks/useToast';
import { useScanner } from './hooks/useScanner';
import { MAX_DOCUMENT_BYTES, copyText, downloadText, exportFileName, formatBytes, readTextFile, type FileKind } from './lib/files';

/* The workspace ships as its own chunk so the landing page loads less JavaScript. */
const loadWorkspace = () => import('./components/Workspace');
const Workspace = lazy(loadWorkspace);

/** Documents up to this size are re-scanned on every edit after the first scan. */
const LIVE_SCAN_LIMIT = 60_000;

const foundMessage = (count: number, where = '') => `${count.toLocaleString()} value${count === 1 ? '' : 's'} found${where}`;

export default function App() {
  const [view, setView] = useState<'home' | 'app'>('home');
  const [tab, setTab] = useState<WorkspaceTab>('sanitize');

  const [docText, setDocText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileKind, setFileKind] = useState<FileKind>('txt');

  const [mode, setMode] = useState<RedactionMode>('PARTIAL');
  const [enabledCats, setEnabledCats] = useState<Category[]>([...CATEGORIES]);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [stale, setStale] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const { toast, showToast } = useToast();
  const scanner = useScanner();
  /** True once the current document has been scanned; enables live re-scanning on edit. */
  const live = useRef(false);

  /* Fetch the workspace chunk once the landing page is idle, so opening it is instant. */
  useEffect(() => {
    const prefetch = () => void loadWorkspace();
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 1500);
    return () => clearTimeout(id);
  }, []);

  /* Each view starts at the top of the page. */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const logAudit = useCallback((event: string, status: AuditEvent['status'], detail: string) => {
    setAudit((prev) => [...prev, makeEvent(event, status, detail)]);
  }, []);

  const entities = useMemo(() => result?.entities ?? [], [result]);
  const pseudonymMap = useMemo(() => buildPseudonymMap(entities), [entities]);

  const { sanitized, segments } = useMemo((): { sanitized: string; segments: Segment[] } => {
    if (!result) return { sanitized: '', segments: [] };
    const r = sanitizeWithSegments(docText, entities, mode, pseudonymMap);
    return { sanitized: r.output, segments: r.segments };
  }, [result, docText, entities, mode, pseudonymMap]);

  const selected = useMemo(() => entities.find((e) => e.id === selectedId) ?? null, [entities, selectedId]);
  const selectedIndex = selected ? entities.findIndex((e) => e.id === selected.id) : -1;

  /**
   * Scans `text` (large documents in a worker) and applies the result.
   * Resolves to `null` when a newer scan or an edit superseded this one.
   */
  const applyScan = useCallback(
    async (text: string, cats: Category[], kind: FileKind): Promise<DetectionResult | null> => {
      logAudit('Scan started', 'info', `${kind.toUpperCase()} · ${text.length} chars · ${cats.length} categories`);
      setScanning(true);
      let res: DetectionResult | null;
      try {
        res = await scanner.scan(text, cats);
      } catch {
        setScanning(false);
        logAudit('Scan failed', 'warning', 'Detection stopped before finishing');
        showToast('The scan could not finish. Try again.');
        return null;
      }
      /* A superseded scan leaves state to whichever scan or edit replaced it. */
      if (!res) return null;
      setScanning(false);
      setResult(res);
      setStale(false);
      setSelectedId(null);
      live.current = true;
      logAudit('Detection completed', 'success', `${res.entities.length} entities · ${res.durationMs.toFixed(1)} ms`);
      logAudit('Validation completed', 'success', `${res.rejected.length} candidates rejected`);
      return res;
    },
    [logAudit, scanner, showToast],
  );

  /* Import a document from any source and scan it immediately. */
  const importAndScan = useCallback(
    (text: string, name: string, kind: FileKind, source: string) => {
      setDocText(text);
      setFileName(name);
      setFileKind(kind);
      setView('app');
      setTab('sanitize');
      setResult(null);
      setStale(false);
      setSelectedId(null);
      live.current = false;
      logAudit('Document imported', 'info', `${kind.toUpperCase()} · ${text.length} chars · ${source}`);
      void applyScan(text, enabledCats, kind).then((res) => res && showToast(foundMessage(res.entities.length, ` in ${name}`)));
    },
    [applyScan, enabledCats, logAudit, showToast],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const read = await readTextFile(file);
      if (!read.ok) {
        showToast(read.message);
        return;
      }
      importAndScan(read.text, file.name, read.kind, 'file');
    },
    [importAndScan, showToast],
  );

  const loadSample = useCallback(() => {
    importAndScan(SAMPLE_DOCUMENT, SAMPLE_FILENAME, 'txt', 'sample record');
  }, [importAndScan]);

  const loadCsvSample = useCallback(() => {
    importAndScan(SAMPLE_CSV, SAMPLE_CSV_FILENAME, 'csv', 'sample CSV');
  }, [importAndScan]);

  const runScan = useCallback(() => {
    if (!docText.trim()) {
      showToast('Add some text first');
      return;
    }
    if (scanning) return;
    void applyScan(docText, enabledCats, fileKind).then((res) => res && showToast(foundMessage(res.entities.length)));
  }, [applyScan, docText, enabledCats, fileKind, scanning, showToast]);

  const handleTextChange = useCallback(
    (text: string) => {
      /* Results of a scan still running were computed for the previous text. */
      scanner.cancel();
      setScanning(false);
      setDocText(text);
      setSelectedId(null);
      if (!text) {
        setResult(null);
        setStale(false);
        live.current = false;
        return;
      }
      if (live.current && text.length <= LIVE_SCAN_LIMIT) {
        /* Live re-scan: offsets are recomputed for the edited text. Not logged per keystroke. */
        setResult(detectPII(text, enabledCats));
        setStale(false);
      } else {
        /* Offsets from an earlier scan no longer apply to this text. */
        setResult(null);
        setStale(live.current);
      }
    },
    [enabledCats, scanner],
  );

  const handleModeChange = useCallback(
    (m: RedactionMode) => {
      if (m === mode) return;
      setMode(m);
      logAudit('Redaction mode changed', 'info', MODE_LABEL[m]);
    },
    [logAudit, mode],
  );

  const handleToggleCategory = useCallback(
    (c: Category) => {
      const next = enabledCats.includes(c) ? enabledCats.filter((x) => x !== c) : [...enabledCats, c];
      setEnabledCats(next);
      if (result) {
        void scanner.scan(docText, next).then(
          (res) => {
            if (!res) return;
            setResult(res);
            setSelectedId(null);
          },
          () => showToast('The scan could not finish. Try again.'),
        );
      }
      logAudit('Category filter updated', 'info', `${c} ${next.includes(c) ? 'enabled' : 'disabled'}`);
    },
    [docText, enabledCats, logAudit, result, scanner, showToast],
  );

  const exportSanitized = useCallback(() => {
    if (!result) {
      showToast('Run a scan before exporting');
      return;
    }
    const name = exportFileName(fileName, fileKind);
    if (fileKind === 'csv') {
      const { output } = sanitizeCSV(docText, enabledCats, mode, pseudonymMap);
      downloadText(output, name, 'text/csv');
      logAudit('Export generated', 'success', `CSV · ${MODE_LABEL[mode]}`);
    } else {
      downloadText(sanitized, name, 'text/plain');
      logAudit('Export generated', 'success', `TXT · ${MODE_LABEL[mode]}`);
    }
    showToast(`Saved ${name}`);
  }, [result, fileName, fileKind, docText, enabledCats, mode, pseudonymMap, sanitized, logAudit, showToast]);

  const copySanitized = useCallback(async () => {
    if (!result) {
      showToast('Run a scan first');
      return;
    }
    const ok = await copyText(sanitized);
    showToast(ok ? 'Sanitized text copied' : 'Clipboard is not available in this browser');
  }, [result, sanitized, showToast]);

  const copyAlias = useCallback(
    async (alias: string) => {
      const ok = await copyText(alias);
      showToast(ok ? `${alias} copied` : 'Clipboard is not available in this browser');
    },
    [showToast],
  );

  const rebuildAliases = useCallback(() => {
    if (!docText.trim()) {
      showToast('No document loaded');
      return;
    }
    void scanner.scan(docText, enabledCats).then(
      (res) => {
        if (!res) return;
        setResult(res);
        setSelectedId(null);
        logAudit('Pseudonym mapping rebuilt', 'info', `${buildPseudonymMap(res.entities).size} aliases`);
        showToast('Aliases rebuilt from the current text');
      },
      () => showToast('The scan could not finish. Try again.'),
    );
  }, [docText, enabledCats, logAudit, scanner, showToast]);

  const exportAuditReport = useCallback(
    (format: 'txt' | 'json') => {
      const { content, filename, mime } = exportAudit(audit, format);
      downloadText(content, filename, mime);
      logAudit('Export generated', 'success', `Audit report · ${format.toUpperCase()}`);
      showToast(`Saved ${filename}`);
    },
    [audit, logAudit, showToast],
  );

  const resetDocument = useCallback(() => {
    scanner.cancel();
    setScanning(false);
    setDocText('');
    setFileName('');
    setFileKind('txt');
    setResult(null);
    setStale(false);
    setSelectedId(null);
    live.current = false;
  }, [scanner]);

  const clearSession = useCallback(() => {
    resetDocument();
    logAudit('Session cleared', 'warning', 'Document and alias map removed from memory');
    showToast('Session cleared');
  }, [logAudit, resetDocument, showToast]);

  const clearDoc = useCallback(() => {
    resetDocument();
    logAudit('Document cleared', 'info', 'Editor emptied');
    showToast('Document cleared');
  }, [logAudit, resetDocument, showToast]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showToast('The clipboard is empty');
      } else if (text.length > MAX_DOCUMENT_BYTES) {
        showToast(`Pasted text is over the ${formatBytes(MAX_DOCUMENT_BYTES)} limit`);
      } else {
        importAndScan(text, 'pasted-text.txt', 'txt', 'clipboard');
      }
    } catch {
      showToast('Clipboard access was blocked — click the sheet and press Ctrl+V');
    }
  }, [importAndScan, showToast]);

  const stepEntity = useCallback(
    (dir: 1 | -1) => {
      if (entities.length === 0) return;
      const idx = selectedIndex === -1 ? (dir === 1 ? 0 : entities.length - 1) : selectedIndex + dir;
      const clamped = Math.max(0, Math.min(entities.length - 1, idx));
      setSelectedId(entities[clamped].id);
    },
    [entities, selectedIndex],
  );

  /* Ctrl/Cmd + Enter scans from anywhere in the workspace. */
  useEffect(() => {
    if (view !== 'app') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        /* The Audit & Export view has its own editor; everywhere else, scanning happens in Sanitize. */
        setTab((t) => (t === 'export' ? t : 'sanitize'));
        runScan();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, runScan]);

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      {view === 'home' ? (
        <Landing
          onLaunch={() => {
            setView('app');
            setTab('sanitize');
          }}
          onLoadSample={loadSample}
        />
      ) : (
        <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
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
            stale={stale}
            scanning={scanning}
            onScan={runScan}
            selected={selected}
            selectedIndex={selectedIndex}
            onSelectEntity={setSelectedId}
            onCloseDetail={() => setSelectedId(null)}
            onPrev={() => stepEntity(-1)}
            onNext={() => stepEntity(1)}
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex >= 0 && selectedIndex < entities.length - 1}
            pseudonymMap={pseudonymMap}
            segments={segments}
            onTextChange={handleTextChange}
            onFile={handleFile}
            onLoadSample={loadSample}
            onLoadCsvSample={loadCsvSample}
            onClearDoc={clearDoc}
            onExport={exportSanitized}
            onCopySanitized={copySanitized}
            onCopyAlias={copyAlias}
            onResetMapping={rebuildAliases}
            onExportAudit={exportAuditReport}
            onClearSession={clearSession}
            liveLimit={LIVE_SCAN_LIMIT}
            audit={audit}
            onBackHome={() => setView('home')}
            onPaste={pasteFromClipboard}
          />
        </Suspense>
      )}

      {/* Centering lives on a wrapper so Framer Motion's transform doesn't override it. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex max-w-full items-center gap-3 rounded-[3px] bg-ink px-4 py-2.5 text-[13px] text-paper shadow-lift"
              role="status"
              aria-live="polite"
            >
              <span className="h-[7px] w-[7px] shrink-0 bg-signal" aria-hidden="true" />
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
