import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { CATEGORIES, CATEGORY_META, maskedPreview, type Category, type DetectionResult } from '../lib/pii';
import { Swatch } from './ui';

interface FindingsPanelProps {
  result: DetectionResult | null;
  docText: string;
  enabledCats: Category[];
  onToggleCategory: (c: Category) => void;
  selectedId: string | null;
  onSelectEntity: (id: string) => void;
}

export default function FindingsPanel({
  result,
  docText,
  enabledCats,
  onToggleCategory,
  selectedId,
  onSelectEntity,
}: FindingsPanelProps) {
  const entities = result?.entities ?? [];
  const rejected = result?.rejected ?? [];
  const total = entities.length;

  const counts = useMemo(
    () => CATEGORIES.map((c) => ({ category: c, count: entities.filter((e) => e.category === c).length })),
    [entities],
  );

  const rejectedRows = useMemo(
    () =>
      rejected.map((r) => ({
        ...r,
        line: docText.slice(0, r.start).split('\n').length,
      })),
    [rejected, docText],
  );

  return (
    <div className="flex flex-col">
      {/* Summary */}
      <section className="border-b border-rule px-5 py-5">
        <p className="label">Findings</p>
        <div className="mt-2 flex items-end gap-3">
          <span className="tabular text-[52px] font-semibold leading-none tracking-[-0.04em] text-ink">
            {result ? total : '—'}
          </span>
          <span className="pb-1.5 text-[13px] text-ink-3">
            {result ? (total === 1 ? 'value found' : 'values found') : 'Not scanned yet'}
          </span>
        </div>
        {result && (
          <dl className="tabular mt-4 grid grid-cols-3 border-t border-rule pt-3 font-mono text-[11px]">
            <div>
              <dt className="text-muted">Rejected</dt>
              <dd className="mt-0.5 text-[13px] text-ink">{rejected.length}</dd>
            </div>
            <div>
              <dt className="text-muted">Chars hidden</dt>
              <dd className="mt-0.5 text-[13px] text-ink">{result.charsSanitized.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted">Scan time</dt>
              <dd className="mt-0.5 text-[13px] text-ink">{result.durationMs.toFixed(1)} ms</dd>
            </div>
          </dl>
        )}
        {total > 0 && (
          <div className="mt-4 flex h-[6px] w-full gap-px overflow-hidden" aria-hidden="true">
            {counts
              .filter((c) => c.count > 0)
              .map((c) => (
                <div
                  key={c.category}
                  style={{ flexGrow: c.count, background: CATEGORY_META[c.category].color }}
                  title={`${CATEGORY_META[c.category].label}: ${c.count}`}
                />
              ))}
          </div>
        )}
      </section>

      {/* Category filters */}
      <section className="border-b border-rule px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="label">Detect</p>
          <span className="font-mono text-[11px] text-muted">
            {enabledCats.length}/{CATEGORIES.length} on
          </span>
        </div>
        <ul className="mt-2">
          {counts.map(({ category, count }) => {
            const enabled = enabledCats.includes(category);
            return (
              <li key={category}>
                <button
                  role="checkbox"
                  aria-checked={enabled}
                  onClick={() => onToggleCategory(category)}
                  className="group flex w-full items-center gap-3 rounded-[2px] px-1 py-[7px] text-left transition-colors hover:bg-ink/[0.04]"
                >
                  <span
                    className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[2px] border transition-colors ${
                      enabled ? 'border-ink bg-ink text-paper' : 'border-rule-2 bg-sheet'
                    }`}
                  >
                    {enabled && <Check className="h-[11px] w-[11px]" strokeWidth={3} />}
                  </span>
                  <Swatch category={category} />
                  <span className={`flex-1 text-[13px] ${enabled ? 'text-ink' : 'text-muted line-through decoration-rule-2'}`}>
                    {CATEGORY_META[category].label}
                  </span>
                  <span className="tabular font-mono text-[12px] text-ink-3">{result && enabled ? count : '–'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Findings list */}
      <section className="px-5 py-4">
        <p className="label">Values</p>
        {entities.length === 0 ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
            {result ? 'Nothing sensitive was found with the current categories.' : 'Run a scan to list every value found, in document order.'}
          </p>
        ) : (
          <ol className="mt-2">
            {entities.map((e, i) => {
              const active = selectedId === e.id;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => onSelectEntity(e.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`relative flex w-full items-center gap-3 py-2 pl-3 pr-1 text-left transition-colors ${
                      active ? 'bg-ink text-paper' : 'hover:bg-ink/[0.04]'
                    }`}
                  >
                    <span className={`tabular w-5 shrink-0 font-mono text-[10.5px] ${active ? 'text-paper/60' : 'text-muted'}`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-mono text-[12px] ${active ? 'text-paper' : 'text-ink'}`}>
                        {maskedPreview(e.value, e.category)}
                      </span>
                      <span className={`mt-0.5 flex items-center gap-1.5 text-[11px] ${active ? 'text-paper/70' : 'text-muted'}`}>
                        <Swatch category={e.category} size={6} />
                        {CATEGORY_META[e.category].label} · Ln {e.line}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {rejectedRows.length > 0 && (
          <div className="mt-6">
            <p className="label">Rejected</p>
            <ul className="mt-2 space-y-1.5">
              {rejectedRows.map((r, i) => (
                <li key={`${r.start}-${i}`} className="flex items-start gap-3 border-l-2 border-signal py-1 pl-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-ink">
                      {CATEGORY_META[r.category].label} · Ln {r.line}
                    </span>
                    <span className="block font-mono text-[11px] text-signal">{r.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">Rejected values failed validation and stay unchanged.</p>
          </div>
        )}
      </section>
    </div>
  );
}
