import { FileJson, FileText, ScrollText, Trash2 } from 'lucide-react';
import type { AuditEvent } from '../lib/audit';

interface AuditCenterProps {
  events: AuditEvent[];
  onExport: (format: 'txt' | 'json') => void;
  onClearSession: () => void;
}

const STATUS_STYLES: Record<AuditEvent['status'], string> = {
  success: 'bg-veil-accent/15 text-veil-accent',
  info: 'bg-veil-accent2/15 text-veil-accent2',
  warning: 'bg-amber-400/15 text-amber-300',
};

const STATUS_DOT: Record<AuditEvent['status'], string> = {
  success: 'bg-veil-accent',
  info: 'bg-veil-accent2',
  warning: 'bg-amber-300',
};

export default function AuditCenter({ events, onExport, onClearSession }: AuditCenterProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-veil-text">Audit center</h2>
          <p className="mt-0.5 text-xs text-veil-muted">
            Chronological session events · metadata only — raw PII is never logged.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExport('txt')}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-veil-panel px-3 py-2 text-xs font-medium text-veil-text transition hover:border-veil-accent/40"
          >
            <FileText className="h-3.5 w-3.5" /> Export TXT
          </button>
          <button
            onClick={() => onExport('json')}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-veil-panel px-3 py-2 text-xs font-medium text-veil-text transition hover:border-veil-accent/40"
          >
            <FileJson className="h-3.5 w-3.5" /> Export JSON
          </button>
          <button
            onClick={onClearSession}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-400/20"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear session
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-veil-secondary p-5">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-veil-panel">
              <ScrollText className="h-5 w-5 text-veil-accent" />
            </div>
            <p className="text-sm font-medium text-veil-text">No audit events yet</p>
            <p className="max-w-xs text-xs text-veil-muted">
              Import a document or run a scan to start the session trail.
            </p>
          </div>
        ) : (
          <ol className="relative space-y-5 border-l border-white/10 pl-6">
            {[...events].reverse().map((e) => (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full ${STATUS_DOT[e.status]}`} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-veil-text">{e.event}</span>
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STATUS_STYLES[e.status]}`}>
                    {e.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-veil-muted">{e.detail}</p>
                <p className="mt-0.5 font-mono text-[10px] text-veil-muted/70">
                  {new Date(e.timestamp).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
