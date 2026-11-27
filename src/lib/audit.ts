/**
 * Audit trail. Events carry only non-sensitive metadata —
 * raw PII is never written to the audit log.
 */

export interface AuditEvent {
  id: string;
  timestamp: string;
  event: string;
  status: 'success' | 'info' | 'warning';
  detail: string;
}

let counter = 0;

export function makeEvent(event: string, status: AuditEvent['status'], detail: string): AuditEvent {
  counter += 1;
  return {
    id: `evt-${Date.now()}-${counter}`,
    timestamp: new Date().toISOString(),
    event,
    status,
    detail,
  };
}

export function exportAudit(events: AuditEvent[], format: 'txt' | 'json'): { content: string; filename: string; mime: string } {
  if (format === 'json') {
    return {
      content: JSON.stringify({ product: 'Redacta', exportedAt: new Date().toISOString(), events }, null, 2),
      filename: 'redacta-audit-report.json',
      mime: 'application/json',
    };
  }
  const lines = events.map((e) => `${e.timestamp} | ${e.event} | ${e.status.toUpperCase()} | ${e.detail}`);
  return {
    content: ['REDACTA — AUDIT REPORT', `Exported: ${new Date().toISOString()}`, '', ...lines].join('\n'),
    filename: 'redacta-audit-report.txt',
    mime: 'text/plain',
  };
}
