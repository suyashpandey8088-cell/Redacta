import { FileJson, FileText, Trash2 } from 'lucide-react';
import type { AuditEvent } from '../lib/audit';
import { EmptyState, ViewHeader } from './ui';

interface AuditCenterProps {
  events: AuditEvent[];
  onExport: (format: 'txt' | 'json') => void;
  onClearSession: () => void;
  onGoSanitize: () => void;
}

const STATUS: Record<AuditEvent['status'], { label: string; cls: string }> = {
  success: { label: 'OK', cls: 'bg-ink text-paper' },
  info: { label: 'INFO', cls: 'border border-rule-2 text-ink-2' },
  warning: { label: 'WARN', cls: 'bg-signal text-paper' },
};

export default function AuditCenter({ events, onExport, onClearSession, onGoSanitize }: AuditCenterProps) {
  const ordered = [...events].reverse();
  return (
    <div className="flex flex-col gap-6">
      <ViewHeader
        index="05 — Session log"
        title="Session log"
        desc="Every action in this session, newest first. Entries hold counts, modes and timings — never the values themselves."
        actions={
          <>
            <button onClick={() => onExport('txt')} disabled={events.length === 0} className="btn-line py-2">
              <FileText className="h-3.5 w-3.5" /> Export .txt
            </button>
            <button onClick={() => onExport('json')} disabled={events.length === 0} className="btn-line py-2">
              <FileJson className="h-3.5 w-3.5" /> Export .json
            </button>
            <button
              onClick={onClearSession}
              className="btn border border-signal px-4 py-2 text-signal-ink hover:bg-signal-ink hover:text-paper"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear session
            </button>
          </>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          desc="Open or paste a document and run a scan. Each step will be recorded here."
          actionLabel="Go to Sanitize"
          onAction={onGoSanitize}
        />
      ) : (
        <div className="overflow-x-auto rounded-[4px] border border-rule bg-sheet">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-rule">
                {['Time', 'Status', 'Event', 'Detail'].map((h) => (
                  <th key={h} className="label px-5 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map((e) => (
                <tr key={e.id} className="border-b border-rule/70 last:border-b-0">
                  <td className="tabular whitespace-nowrap px-5 py-3 font-mono text-[12px] text-ink-3">
                    {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block rounded-[2px] px-1.5 py-[1px] font-mono text-[10px] font-medium tracking-[0.08em] ${STATUS[e.status].cls}`}>
                      {STATUS[e.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[13px] font-medium text-ink">{e.event}</td>
                  <td className="px-5 py-3 font-mono text-[12px] text-ink-3">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
