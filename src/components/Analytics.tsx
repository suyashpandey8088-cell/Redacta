import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CATEGORIES,
  CATEGORY_META,
  MODE_LABEL,
  sanitizeText,
  type DetectionResult,
  type Entity,
  type RedactionMode,
} from '../lib/pii';
import { EmptyState, Swatch, ViewHeader } from './ui';

interface AnalyticsProps {
  result: DetectionResult | null;
  docText: string;
  entities: Entity[];
  pseudonymMap: Map<string, string>;
  mode: RedactionMode;
  onGoSanitize: () => void;
}

const MODES: RedactionMode[] = ['FULL', 'PARTIAL', 'PSEUDONYM'];
const MAX_MAP_CELLS = 240;

export default function Analytics({ result, docText, entities, pseudonymMap, mode, onGoSanitize }: AnalyticsProps) {
  const lineCount = useMemo(() => docText.split('\n').length, [docText]);

  const lineMap = useMemo(() => {
    const cells = Math.min(lineCount, MAX_MAP_CELLS);
    const perCell = lineCount / cells;
    const out: { count: number; category: Entity['category'] | null; from: number; to: number }[] = Array.from({ length: cells }, (_, i) => ({
      count: 0,
      category: null,
      from: Math.floor(i * perCell) + 1,
      to: Math.max(Math.floor(i * perCell) + 1, Math.floor((i + 1) * perCell)),
    }));
    for (const e of entities) {
      const idx = Math.min(cells - 1, Math.floor((e.line - 1) / perCell));
      out[idx].count += 1;
      if (!out[idx].category) out[idx].category = e.category;
    }
    return out;
  }, [entities, lineCount]);

  const modeOutputs = useMemo(
    () => MODES.map((m) => ({ mode: m, chars: sanitizeText(docText, entities, m, pseudonymMap).length })),
    [docText, entities, pseudonymMap],
  );

  if (!result) {
    return (
      <div className="flex flex-col gap-6">
        <ViewHeader index="04 — Analysis" title="Scan analysis" desc="Numbers from your most recent scan. Nothing on this page is estimated or hardcoded." />
        <EmptyState
          title="No scan to analyse"
          desc="Run a scan on any document and its measurements will appear here."
          actionLabel="Go to Sanitize"
          onAction={onGoSanitize}
        />
      </div>
    );
  }

  const total = entities.length;
  const rejected = result.rejected.length;
  const considered = total + rejected;
  const passRate = considered > 0 ? Math.round((total / considered) * 100) : 100;
  const linesWith = new Set(entities.map((e) => e.line)).size;
  const coverage = docText.length > 0 ? (result.charsSanitized / docText.length) * 100 : 0;

  const counts = CATEGORIES.map((c) => ({ category: c, count: entities.filter((e) => e.category === c).length }));
  const maxCount = Math.max(1, ...counts.map((c) => c.count));

  const metrics = [
    { label: 'Values found', value: String(total) },
    { label: 'Rejected', value: String(rejected) },
    { label: 'Pass rate', value: `${passRate}%` },
    { label: 'Chars hidden', value: result.charsSanitized.toLocaleString() },
    { label: 'Of document', value: `${coverage.toFixed(coverage < 10 ? 1 : 0)}%` },
    { label: 'Scan time', value: `${result.durationMs.toFixed(1)} ms` },
  ];

  return (
    <div className="flex flex-col gap-8">
      <ViewHeader index="04 — Analysis" title="Scan analysis" desc="Numbers from your most recent scan. Nothing on this page is estimated or hardcoded." />

      <dl className="grid grid-cols-2 border-l border-t border-rule sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m) => (
          <div key={m.label} className="border-b border-r border-rule bg-sheet px-5 py-5">
            <dt className="label">{m.label}</dt>
            <dd className="tabular mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-ink">{m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <h2 className="label">By type</h2>
          <ul className="mt-4 space-y-3">
            {counts.map(({ category, count }, i) => (
              <li key={category} className="grid grid-cols-[110px_1fr_36px] items-center gap-4">
                <span className="flex items-center gap-2 text-[13px] text-ink">
                  <Swatch category={category} />
                  {CATEGORY_META[category].label}
                </span>
                <span className="h-[10px] bg-paper-3">
                  <motion.span
                    className="block h-full"
                    style={{ background: CATEGORY_META[category].color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxCount) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
                <span className="tabular text-right font-mono text-[13px] text-ink">{count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="label">Validation</h2>
          <div className="mt-4 flex items-center gap-6">
            <div className="relative h-[120px] w-[120px] shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E1DCCF" strokeWidth="10" />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#16150F"
                  strokeWidth="10"
                  pathLength={1}
                  strokeDasharray="1 1"
                  initial={{ strokeDashoffset: 1 }}
                  animate={{ strokeDashoffset: 1 - (considered > 0 ? total / considered : 1) }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <span className="tabular absolute inset-0 flex items-center justify-center text-[22px] font-semibold tracking-[-0.02em] text-ink">
                {passRate}%
              </span>
            </div>
            <div className="space-y-2 text-[13px]">
              <p className="flex items-center gap-2 text-ink">
                <span className="h-2.5 w-2.5 bg-ink" /> {total} passed validation
              </p>
              <p className="flex items-center gap-2 text-ink">
                <span className="h-2.5 w-2.5 bg-paper-3" /> {rejected} rejected
              </p>
              <p className="max-w-[16rem] text-[12.5px] leading-relaxed text-ink-3">
                Rejected candidates matched a pattern but failed a check such as Luhn, and were left unchanged.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="label">Where values appear</h2>
          <span className="font-mono text-[11px] text-muted">
            {linesWith} of {lineCount} lines contain a value
          </span>
        </div>
        <div className="mt-4 flex h-12 w-full gap-px border border-rule bg-sheet p-1" role="img" aria-label={`Values appear on ${linesWith} of ${lineCount} lines`}>
          {lineMap.map((cell, i) => (
            <span
              key={i}
              className="flex-1"
              title={`Line${cell.from === cell.to ? ` ${cell.from}` : `s ${cell.from}–${cell.to}`}: ${cell.count} value${cell.count === 1 ? '' : 's'}`}
              style={{ background: cell.category ? CATEGORY_META[cell.category].color : '#EAE6DC', opacity: cell.count > 1 ? 1 : cell.count === 1 ? 0.75 : 1 }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-muted">
          <span>Line 1</span>
          <span>Line {lineCount}</span>
        </div>
      </section>

      <section>
        <h2 className="label">Output by mode</h2>
        <div className="mt-4 overflow-x-auto rounded-[4px] border border-rule bg-sheet">
          <table className="w-full min-w-[480px] text-left">
            <thead>
              <tr className="border-b border-rule">
                {['Mode', 'Values replaced', 'Output length', 'Change'].map((h) => (
                  <th key={h} className="label px-5 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-rule/70">
                <td className="px-5 py-3 text-[13px] text-ink-3">Original</td>
                <td className="px-5 py-3 font-mono text-[12.5px] text-ink-3">—</td>
                <td className="tabular px-5 py-3 font-mono text-[12.5px] text-ink-3">{docText.length.toLocaleString()} chars</td>
                <td className="px-5 py-3 font-mono text-[12.5px] text-ink-3">—</td>
              </tr>
              {modeOutputs.map((row) => {
                const diff = row.chars - docText.length;
                return (
                  <tr key={row.mode} className="border-b border-rule/70 last:border-b-0">
                    <td className="px-5 py-3 text-[13px] font-medium text-ink">
                      {MODE_LABEL[row.mode]}
                      {row.mode === mode && <span className="ml-2 font-mono text-[10.5px] font-normal uppercase tracking-label text-signal">active</span>}
                    </td>
                    <td className="tabular px-5 py-3 font-mono text-[12.5px] text-ink">{total}</td>
                    <td className="tabular px-5 py-3 font-mono text-[12.5px] text-ink">{row.chars.toLocaleString()} chars</td>
                    <td className="tabular px-5 py-3 font-mono text-[12.5px] text-ink-3">
                      {diff > 0 ? '+' : ''}
                      {diff.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
