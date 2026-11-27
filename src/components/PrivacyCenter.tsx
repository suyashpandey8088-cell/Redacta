import {
  ArrowDown,
  Database,
  Download,
  FileSearch,
  Lock,
  MemoryStick,
  ScanSearch,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import type { AuditEvent } from '../lib/audit';

const STEPS = [
  { icon: FileSearch, title: 'Document', desc: 'Your file or pasted text enters the page.' },
  { icon: MemoryStick, title: 'Local Browser Memory', desc: 'Content lives only in this tab’s memory.' },
  { icon: ScanSearch, title: 'PII Detection', desc: 'Six categories scanned on-device.' },
  { icon: ShieldCheck, title: 'Validation', desc: 'Luhn, format and range checks reject false positives.' },
  { icon: Wand2, title: 'Redaction', desc: 'Mask, partial-mask or pseudonymize in place.' },
  { icon: Download, title: 'Local Export', desc: 'Sanitized file downloads directly to your device.' },
];

const INDICATORS = [
  'No document uploads to a processing server',
  'No external AI processing',
  'No persistent storage of raw documents',
  'No sensitive values in audit logs',
  'Local file export only',
];

interface PrivacyCenterProps {
  events: AuditEvent[];
}

export default function PrivacyCenter({ events }: PrivacyCenterProps) {
  const scans = events.filter((e) => e.event === 'Detection completed').length;
  const exportsCount = events.filter((e) => e.event === 'Export generated').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-veil-text">Privacy center</h2>
        <p className="mt-0.5 text-xs text-veil-muted">
          Verification of the local-only architecture — inspect it, don’t take our word for it.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Architecture flow */}
        <div className="rounded-xl border border-white/[0.08] bg-veil-panel p-5">
          <h3 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-veil-muted">
            <Database className="h-3.5 w-3.5 text-veil-accent" /> Processing architecture
          </h3>
          <ol className="mt-4 space-y-0">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <div className="flex items-center gap-3 rounded-lg border border-white/[0.07] bg-veil-secondary px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-veil-accent/12 text-veil-accent">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-veil-text">{step.title}</span>
                    <span className="block text-[11px] text-veil-muted">{step.desc}</span>
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="h-3.5 w-3.5 text-veil-accent/60" />
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-lg border border-veil-accent/25 bg-veil-accent/10 px-3 py-2.5 text-xs text-veil-accent">
            There is no external document-processing server in this flow. Nothing to breach, nothing to subpoena.
          </p>
        </div>

        {/* Indicators + session stats */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-white/[0.08] bg-veil-panel p-5">
            <h3 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-veil-muted">
              <Lock className="h-3.5 w-3.5 text-veil-accent" /> Security indicators
            </h3>
            <ul className="mt-4 space-y-2.5">
              {INDICATORS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-veil-text">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-veil-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-veil-panel p-5">
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-veil-muted">
              This session
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-veil-secondary px-3 py-2.5 text-center">
                <p className="font-mono text-lg font-semibold text-veil-text">{scans}</p>
                <p className="text-[10px] text-veil-muted">Scans run</p>
              </div>
              <div className="rounded-lg bg-veil-secondary px-3 py-2.5 text-center">
                <p className="font-mono text-lg font-semibold text-veil-text">{exportsCount}</p>
                <p className="text-[10px] text-veil-muted">Exports</p>
              </div>
              <div className="rounded-lg bg-veil-secondary px-3 py-2.5 text-center">
                <p className="font-mono text-lg font-semibold text-veil-text">{events.length}</p>
                <p className="text-[10px] text-veil-muted">Audit events</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-veil-muted">
              Network note: VEIL loads no document data over the network. The only requests this page makes are for
              its own interface assets. VEIL makes no third-party certification or external security-audit claims.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
