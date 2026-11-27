import type { ReactNode } from 'react';
import { CATEGORY_META, type Category } from '../lib/pii';

/** Wordmark: a solid ink tile with two redaction bars, followed by the name. */
export function Logo({ onClick, tone = 'ink' }: { onClick?: () => void; tone?: 'ink' | 'paper' }) {
  const fg = tone === 'ink' ? 'text-ink' : 'text-paper';
  const content = (
    <>
      <svg viewBox="0 0 32 32" className="h-[22px] w-[22px] shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="5" fill={tone === 'ink' ? '#16150F' : '#F3F0E8'} />
        <rect x="7" y="10" width="18" height="4" fill={tone === 'ink' ? '#F3F0E8' : '#16150F'} />
        <rect x="7" y="18" width="11" height="4" fill="#D9381E" />
      </svg>
      <span className={`font-mono text-[15px] font-medium tracking-[0.22em] ${fg}`}>VEIL</span>
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="flex items-center gap-2.5 rounded-[3px]" aria-label="VEIL home">
        {content}
      </button>
    );
  }
  return <span className="flex items-center gap-2.5">{content}</span>;
}

export function Swatch({ category, size = 8 }: { category: Category; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-[1px]"
      style={{ width: size, height: size, background: CATEGORY_META[category].color }}
    />
  );
}

export function ViewHeader({
  index,
  title,
  desc,
  actions,
}: {
  index: string;
  title: string;
  desc: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-rule pb-5">
      <div className="min-w-0">
        <p className="label">{index}</p>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">{title}</h1>
        <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-ink-3">{desc}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  desc,
  actionLabel,
  onAction,
}: {
  title: string;
  desc: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-rule-2 px-6 py-12 sm:px-10">
      <div className="flex flex-col gap-1.5" aria-hidden="true">
        <span className="block h-2 w-28 bg-ink" />
        <span className="block h-2 w-16 bg-rule-2" />
      </div>
      <p className="mt-2 text-[15px] font-semibold text-ink">{title}</p>
      <p className="max-w-md text-[13px] leading-relaxed text-ink-3">{desc}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-ink mt-2">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[3px] border border-rule-2 bg-sheet p-[2px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`rounded-[2px] font-medium transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[12.5px]'} ${
              active ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-ink/[0.06]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const MODE_LABEL = {
  FULL: 'Full mask',
  PARTIAL: 'Partial mask',
  PSEUDONYM: 'Pseudonymize',
} as const;
