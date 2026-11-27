import { useMemo, useState } from 'react';
import { Copy, KeyRound, RotateCcw, Search } from 'lucide-react';
import {
  CATEGORIES,
  CATEGORY_META,
  aliasFor,
  maskedPreview,
  type Category,
  type Entity,
} from '../lib/pii';

interface PseudonymStudioProps {
  entities: Entity[];
  pseudonymMap: Map<string, string>;
  onCopyAlias: (alias: string) => void;
  onReset: () => void;
}

export default function PseudonymStudio({ entities, pseudonymMap, onCopyAlias, onReset }: PseudonymStudioProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category | 'ALL'>('ALL');

  const rows = useMemo(() => {
    const byKey = new Map<string, { alias: string; category: Category; preview: string; count: number; line: number }>();
    const sorted = [...entities].sort((a, b) => a.start - b.start);
    for (const e of sorted) {
      const key = `${e.category}:${e.normalized}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(key, {
          alias: aliasFor(e, pseudonymMap),
          category: e.category,
          preview: maskedPreview(e.value, e.category),
          count: 1,
          line: e.line,
        });
      }
    }
    return [...byKey.values()].sort((a, b) => a.alias.localeCompare(b.alias));
  }, [entities, pseudonymMap]);

  const visible = rows.filter(
    (r) =>
      (filter === 'ALL' || r.category === filter) &&
      r.alias.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-veil-text">One identity. One consistent alias.</h2>
          <p className="mt-0.5 text-xs text-veil-muted">
            {rows.length} alias{rows.length === 1 ? '' : 'es'} · repeated values always map to the same placeholder.
          </p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-veil-panel px-3 py-2 text-xs font-medium text-veil-text transition hover:border-veil-accent/40"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset mapping
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-veil-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search aliases…"
            className="w-full rounded-lg border border-white/10 bg-veil-panel py-2 pl-9 pr-3 text-xs text-veil-text outline-none placeholder:text-veil-muted/70 focus:border-veil-accent/50"
          />
        </div>
        <button
          onClick={() => setFilter('ALL')}
          className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
            filter === 'ALL'
              ? 'border-veil-accent/60 bg-veil-accent/15 text-veil-accent'
              : 'border-white/10 text-veil-muted hover:text-veil-text'
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
              filter === c
                ? 'border-veil-accent/60 bg-veil-accent/15 text-veil-accent'
                : 'border-white/10 text-veil-muted hover:text-veil-text'
            }`}
          >
            {CATEGORY_META[c].label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-veil-secondary">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-veil-panel">
              <KeyRound className="h-5 w-5 text-veil-accent" />
            </div>
            <p className="text-sm font-medium text-veil-text">No aliases yet</p>
            <p className="max-w-xs text-xs text-veil-muted">
              Run a scan with pseudonymization enabled to generate consistent aliases.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-veil-bg/40 font-mono text-[10px] uppercase tracking-[0.16em] text-veil-muted">
                <th className="px-4 py-3 font-medium">Alias</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Source preview</th>
                <th className="px-4 py-3 font-medium">Occurrences</th>
                <th className="px-4 py-3 font-medium">First seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const meta = CATEGORY_META[r.category];
                return (
                  <tr key={r.alias} className="border-b border-white/[0.05] transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-[13px] font-semibold text-veil-accent">{r.alias}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider"
                        style={{ background: meta.softBg, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-veil-muted">{r.preview}</td>
                    <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-veil-text">{r.count}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-veil-muted">Line {r.line}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onCopyAlias(r.alias)}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-veil-muted transition hover:border-veil-accent/40 hover:text-veil-text"
                        aria-label={`Copy alias ${r.alias}`}
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
