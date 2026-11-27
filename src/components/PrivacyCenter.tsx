import { Check, Minus } from 'lucide-react';
import type { AuditEvent } from '../lib/audit';
import { ViewHeader } from './ui';

interface PrivacyCenterProps {
  events: AuditEvent[];
  docLength: number;
  aliasCount: number;
}

const STEPS = [
  { title: 'Your file', desc: 'A .txt or .csv file, or pasted text, is read by this page with the File API.' },
  { title: 'Tab memory', desc: 'The text is held in this tab’s JavaScript memory and nowhere else.' },
  { title: 'Detect', desc: 'Six detectors scan the text on your device.' },
  { title: 'Validate', desc: 'Luhn, range and format checks remove false positives.' },
  { title: 'Redact', desc: 'Each mode is regenerated from the untouched original.' },
  { title: 'Download', desc: 'A Blob is saved to your device; its object URL is revoked as soon as the download starts.' },
];

const NEVER = [
  'Uploading your document to a processing server',
  'Sending content to an external AI service',
  'Writing documents to localStorage, cookies or IndexedDB',
  'Recording raw values in the audit log',
];

export default function PrivacyCenter({ events, docLength, aliasCount }: PrivacyCenterProps) {
  const scans = events.filter((e) => e.event === 'Detection completed').length;
  const exportsCount = events.filter((e) => e.event === 'Export generated').length;

  const session = [
    { label: 'Document in memory', value: docLength > 0 ? `${docLength.toLocaleString()} chars` : 'None' },
    { label: 'Alias map entries', value: String(aliasCount) },
    { label: 'Scans run', value: String(scans) },
    { label: 'Exports created', value: String(exportsCount) },
    { label: 'Audit entries', value: String(events.length) },
    { label: 'Browser storage used', value: 'None' },
  ];

  return (
    <div className="flex flex-col gap-10">
      <ViewHeader
        index="06 — Privacy"
        title="How your data moves"
        desc="Redacta is a static page. Below is the full path a document takes, and the state this session currently holds."
      />

      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
        <section>
          <h2 className="label">Processing path</h2>
          <ol className="relative mt-5">
            <span aria-hidden="true" className="absolute bottom-3 left-[5px] top-3 w-px bg-rule-2" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-5 pb-6 last:pb-0">
                <span aria-hidden="true" className="relative mt-[5px] h-[11px] w-[11px] shrink-0 border border-ink bg-sheet" />
                <div>
                  <p className="flex items-baseline gap-2">
                    <span className="tabular font-mono text-[11px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-[15px] font-semibold text-ink">{s.title}</span>
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-8">
          <section>
            <h2 className="label">This session</h2>
            <dl className="mt-4 border-t border-ink">
              {session.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                  <dt className="text-[13px] text-ink-2">{row.label}</dt>
                  <dd className="tabular font-mono text-[13px] text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="label">Never happens</h2>
            <ul className="mt-4 space-y-2.5">
              {NEVER.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[13px] leading-relaxed text-ink-2">
                  <Minus className="mt-[3px] h-3.5 w-3.5 shrink-0 text-signal" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="border border-ink bg-sheet p-6 sm:p-8">
        <h2 className="label">Check it yourself</h2>
        <ol className="mt-4 grid gap-5 sm:grid-cols-3">
          {[
            'Open your browser’s developer tools and switch to the Network panel.',
            'Scan a document, change modes and export the result.',
            'No request carries your text. Scans and exports run without touching the network.',
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="tabular font-mono text-[12px] text-muted">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 text-[13.5px] leading-relaxed text-ink-2">
                {t}
                {i === 2 && <Check className="ml-1.5 inline h-3.5 w-3.5 text-ink" aria-hidden="true" />}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 border-t border-rule pt-4 text-[12px] leading-relaxed text-muted">
          Redacta makes no claims of third-party certification or external security audits.
        </p>
      </section>
    </div>
  );
}
