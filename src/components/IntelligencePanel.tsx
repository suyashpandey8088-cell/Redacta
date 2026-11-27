import { CreditCard, FileText, Globe, Hash, Mail, Phone } from 'lucide-react';
import {
  CATEGORIES,
  CATEGORY_META,
  maskedPreview,
  type Category,
  type DetectionResult,
} from '../lib/pii';

const CATEGORY_ICONS: Record<Category, React.ComponentType<{ className?: string }>> = {
  EMAIL: Mail,
  PHONE: Phone,
  IP: Globe,
  PAN: FileText,
  AADHAAR: Hash,
  CARD: CreditCard,
};

interface IntelligencePanelProps {
  result: DetectionResult | null;
  enabledCats: Category[];
  onToggleCategory: (c: Category) => void;
  selectedId: string | null;
  onSelectEntity: (id: string) => void;
}

export default function IntelligencePanel({
  result,
  enabledCats,
  onToggleCategory,
  selectedId,
  onSelectEntity,
}: IntelligencePanelProps) {
  const entities = result?.entities ?? [];
  const total = entities.length;
  const rejected = result?.rejected.length ?? 0;
  const chars = result?.charsSanitized ?? 0;

  const counts = CATEGORIES.map((c) => ({
    category: c,
    count: entities.filter((e) => e.category === c).length,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 lg:max-h-none">
      <div>
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-veil-muted">
          Detection Intelligence
        </h3>
        <p className="mt-1 text-xs text-veil-muted/80">Live results from the local engine.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total entities', value: total },
          { label: 'Validated', value: total },
          { label: 'Rejected candidates', value: rejected },
          { label: 'Chars sanitized', value: chars },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/[0.08] bg-veil-panel px-3 py-2.5">
            <p className="font-mono text-lg font-semibold tabular-nums text-veil-text">{s.value}</p>
            <p className="text-[11px] text-veil-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Distribution bar */}
      {total > 0 && (
        <div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            {counts
              .filter((c) => c.count > 0)
              .map((c) => (
                <div
                  key={c.category}
                  style={{ width: `${(c.count / total) * 100}%`, background: CATEGORY_META[c.category].color }}
                />
              ))}
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-veil-muted">Category distribution</p>
        </div>
      )}

      {/* Category toggles */}
      <div className="space-y-1.5">
        {counts.map(({ category, count }) => {
          const meta = CATEGORY_META[category];
          const Icon = CATEGORY_ICONS[category];
          const enabled = enabledCats.includes(category);
          return (
            <div
              key={category}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                enabled ? 'border-white/[0.08] bg-veil-panel' : 'border-white/[0.05] bg-transparent opacity-55'
              }`}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{ background: meta.softBg, color: meta.color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-veil-text">{meta.label}</span>
                <span className="block font-mono text-[10px] text-veil-muted">{category}</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-veil-text">{count}</span>
              <button
                onClick={() => onToggleCategory(category)}
                role="switch"
                aria-checked={enabled}
                aria-label={`Toggle ${meta.label} detection`}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  enabled ? 'bg-veil-accent/80' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                    enabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Recent findings */}
      <div className="min-h-0">
        <h4 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-veil-muted">
          Recent Findings
        </h4>
        {entities.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-veil-muted">
            No findings yet — run a scan to detect sensitive data.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {entities.slice(0, 12).map((e) => {
              const meta = CATEGORY_META[e.category];
              const isSelected = selectedId === e.id;
              return (
                <li key={e.id}>
                  <button
                    onClick={() => onSelectEntity(e.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                      isSelected
                        ? 'border-veil-accent/50 bg-veil-accent/10'
                        : 'border-white/[0.08] bg-veil-panel hover:border-white/20'
                    }`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[11px] text-veil-text">
                        {maskedPreview(e.value, e.category)}
                      </span>
                      <span className="block text-[10px] text-veil-muted">
                        {meta.label} · Line {e.line}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
