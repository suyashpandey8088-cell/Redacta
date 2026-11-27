import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import {
  CATEGORIES,
  CATEGORY_META,
  sanitizeText,
  type DetectionResult,
  type Entity,
  type RedactionMode,
} from '../lib/pii';

interface AnalyticsProps {
  result: DetectionResult | null;
  docText: string;
  entities: Entity[];
  pseudonymMap: Map<string, string>;
}

const MODE_ROWS: { mode: RedactionMode; label: string }[] = [
  { mode: 'FULL', label: 'Full Mask' },
  { mode: 'PARTIAL', label: 'Partial Mask' },
  { mode: 'PSEUDONYM', label: 'Pseudonymization' },
];

export default function Analytics({ result, docText, entities, pseudonymMap }: AnalyticsProps) {
  if (!result) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-veil-panel">
          <BarChart3 className="h-5 w-5 text-veil-accent" />
        </div>
        <p className="text-sm font-medium text-veil-text">No analytics yet</p>
        <p className="max-w-xs text-xs text-veil-muted">
          Load a document and run a scan — every metric here reflects the real detection run.
        </p>
      </div>
    );
  }

  const total = result.entities.length;
  const rejected = result.rejected.length;
  const validationRate = total + rejected > 0 ? Math.round((total / (total + rejected)) * 100) : 100;

  const counts = CATEGORIES.map((c) => ({
    category: c,
    count: entities.filter((e) => e.category === c).length,
  }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  /* Donut geometry */
  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const validFrac = total + rejected > 0 ? total / (total + rejected) : 1;

  const modeOutputs = MODE_ROWS.map((row) => ({
    ...row,
    chars: sanitizeText(docText, entities, row.mode, pseudonymMap).length,
  }));

  const cards = [
    { label: 'Total detected', value: total },
    { label: 'Validated candidates', value: total },
    { label: 'Rejected candidates', value: rejected },
    { label: 'Characters sanitized', value: result.charsSanitized },
    { label: 'Processing duration', value: `${result.durationMs.toFixed(1)} ms` },
    { label: 'Validation rate', value: `${validationRate}%` },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-veil-text">Detection analytics</h2>
        <p className="mt-0.5 text-xs text-veil-muted">Computed from the most recent scan — nothing is hardcoded.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/[0.08] bg-veil-panel px-4 py-3">
            <p className="font-mono text-xl font-semibold tabular-nums text-veil-text">{c.value}</p>
            <p className="mt-0.5 text-[11px] text-veil-muted">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category breakdown */}
        <div className="rounded-xl border border-white/[0.08] bg-veil-panel p-5">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-veil-muted">
            Detection breakdown
          </h3>
          <div className="mt-4 space-y-3">
            {counts.map(({ category, count }) => {
              const meta = CATEGORY_META[category];
              return (
                <div key={category} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs text-veil-text">{meta.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: meta.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / maxCount) * 100}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-veil-text">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Validation donut */}
        <div className="flex items-center gap-6 rounded-xl border border-white/[0.08] bg-veil-panel p-5">
          <div className="relative h-28 w-28 shrink-0">
            <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
              <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <motion.circle
                cx="42"
                cy="42"
                r={R}
                fill="none"
                stroke="#5CE1B2"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                initial={{ strokeDashoffset: CIRC }}
                animate={{ strokeDashoffset: CIRC * (1 - validFrac) }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-lg font-semibold text-veil-text">{validationRate}%</span>
              <span className="text-[10px] text-veil-muted">validated</span>
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <p className="flex items-center gap-2 text-veil-text">
              <span className="h-2 w-2 rounded-full bg-veil-accent" /> {total} validated entities
            </p>
            <p className="flex items-center gap-2 text-veil-text">
              <span className="h-2 w-2 rounded-full bg-white/25" /> {rejected} rejected candidates
            </p>
            <p className="text-veil-muted">Rejected candidates failed validation (e.g. Luhn) and were left untouched.</p>
          </div>
        </div>
      </div>

      {/* Redaction distribution */}
      <div className="rounded-xl border border-white/[0.08] bg-veil-panel p-5">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-veil-muted">
          Redaction output by mode
        </h3>
        <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.07]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-veil-bg/50 font-mono text-[10px] uppercase tracking-[0.16em] text-veil-muted">
                <th className="px-4 py-2.5 font-medium">Mode</th>
                <th className="px-4 py-2.5 font-medium">Entities redacted</th>
                <th className="px-4 py-2.5 font-medium">Output length</th>
              </tr>
            </thead>
            <tbody>
              {modeOutputs.map((row) => (
                <tr key={row.mode} className="border-t border-white/[0.05]">
                  <td className="px-4 py-2.5 text-veil-text">{row.label}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-veil-text">{total}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-veil-muted">{row.chars.toLocaleString()} chars</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
