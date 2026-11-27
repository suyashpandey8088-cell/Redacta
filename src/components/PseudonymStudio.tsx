import { useMemo, useState } from 'react';
import { Copy, RotateCcw, Search } from 'lucide-react';
import { CATEGORIES, CATEGORY_META, aliasFor, maskedPreview, type Category, type Entity } from '../lib/pii';
import { EmptyState, Swatch, ViewHeader } from './ui';

interface PseudonymStudioProps {
  entities: Entity[];
  pseudonymMap: Map<string, string>;
  hasResult: boolean;
  onCopyAlias: (alias: string) => void;
  onReset: () => void;
  onGoSanitize: () => void;
}

const PAGE_SIZE = 200;
const MAX_LINES_LISTED = 12;

/** "3, 8, 14" — or the first few plus a count for values repeated across many lines. */
function formatLines(lines: number[]): string {
  if (lines.length <= MAX_LINES_LISTED) return lines.join(', ');
  return `${lines.slice(0, MAX_LINES_LISTED).join(', ')} +${(lines.length - MAX_LINES_LISTED).toLocaleString()} more`;
}

export default function PseudonymStudio({ entities, pseudonymMap, hasResult, onCopyAlias, onReset, onGoSanitize }: PseudonymStudioProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Category | 'ALL'>('ALL');

  const rows = useMemo(() => {
    const byKey = new Map<string, { alias: string; category: Category; preview: string; count: number; lines: number[] }>();
    const sorted = [...entities].sort((a, b) => a.start - b.start);
    for (const e of sorted) {
      const key = `${e.category}:${e.normalized}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
        /* Entities are in document order, so a repeated line can only be the last one recorded. */
        if (existing.lines[existing.lines.length - 1] !== e.line) existing.lines.push(e.line);
      } else {
        byKey.set(key, {
          alias: aliasFor(e, pseudonymMap),
          category: e.category,
          preview: maskedPreview(e.value, e.category),
          count: 1,
          lines: [e.line],
        });
      }
    }
    return [...byKey.values()].sort(
      (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.alias.localeCompare(b.alias),
    );
  }, [entities, pseudonymMap]);

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filter === 'ALL' || r.category === filter) &&
          (q === '' || r.alias.toLowerCase().includes(q) || CATEGORY_META[r.category].label.toLowerCase().includes(q)),
      ),
    [rows, filter, q],
  );
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shown = visible.slice(0, limit);
  const presentCats = useMemo(() => CATEGORIES.filter((c) => rows.some((r) => r.category === c)), [rows]);
  const repeated = useMemo(() => rows.filter((r) => r.count > 1).length, [rows]);

  return (
    <div className="flex flex-col gap-6">
      <ViewHeader
        index="03 — Aliases"
        title="One value, one alias"
        desc={
          rows.length > 0 ? (
            <>
              {rows.length} distinct value{rows.length === 1 ? '' : 's'}, {repeated} repeated. A value keeps the same alias everywhere it
              appears — even when it is formatted differently.
            </>
          ) : (
            'Every distinct value found in a scan gets a stable placeholder such as USER_01 or CARD_02.'
          )
        }
        actions={
          <button onClick={onReset} disabled={!hasResult} className="btn-line py-2">
            <RotateCcw className="h-3.5 w-3.5" /> Rebuild aliases
          </button>
        }
      />

      {!hasResult ? (
        <EmptyState
          title="No aliases yet"
          desc="Scan a document first. Aliases are numbered in the order values first appear."
          actionLabel="Go to Sanitize"
          onAction={onGoSanitize}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Search aliases</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search alias or type"
                className="w-full rounded-[3px] border border-rule-2 bg-sheet py-2 pl-9 pr-3 text-[13px] text-ink outline-none placeholder:text-muted focus:border-ink"
              />
            </label>
            <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto">
              {(['ALL', ...presentCats] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`flex shrink-0 items-center gap-2 rounded-[3px] px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    filter === c ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-ink/[0.06]'
                  }`}
                >
                  {c !== 'ALL' && <Swatch category={c} size={7} />}
                  {c === 'ALL' ? `All ${rows.length}` : CATEGORY_META[c].label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-[4px] border border-rule bg-sheet">
            {visible.length === 0 ? (
              <p className="px-5 py-10 text-[13px] text-ink-3">No aliases match this filter.</p>
            ) : (
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-rule">
                    {['Alias', 'Type', 'Masked source', 'Uses', 'Lines'].map((h) => (
                      <th key={h} scope="col" className="label px-5 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.alias} className="border-b border-rule/70 last:border-b-0 hover:bg-paper/60">
                      <td className="px-5 py-3 font-mono text-[13px] font-medium text-ink">{r.alias}</td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2 text-[13px] text-ink-2">
                          <Swatch category={r.category} />
                          {CATEGORY_META[r.category].label}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-[12.5px] text-ink-3">{r.preview}</td>
                      <td className="tabular px-5 py-3 font-mono text-[12.5px] text-ink">{r.count}×</td>
                      <td className="tabular px-5 py-3 font-mono text-[12.5px] text-ink-3">{formatLines(r.lines)}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => onCopyAlias(r.alias)} className="btn-quiet" aria-label={`Copy ${r.alias}`}>
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {visible.length > shown.length && (
              <button
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="flex w-full items-center justify-center gap-2 border-t border-rule px-5 py-3 text-[13px] font-medium text-ink transition-colors hover:bg-paper/60"
              >
                Show {Math.min(PAGE_SIZE, visible.length - shown.length).toLocaleString()} more
                <span className="font-mono text-[11px] font-normal text-muted">
                  {shown.length.toLocaleString()} of {visible.length.toLocaleString()}
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
