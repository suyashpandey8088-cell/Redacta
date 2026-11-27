import { motion } from 'framer-motion';
import { Check, CreditCard, FileText, Globe, Mail, Phone, Shield } from 'lucide-react';

const CHIPS = [
  { icon: Mail, label: 'a***@example.com', className: 'left-[2%] top-[8%]', delay: 0 },
  { icon: Phone, label: '••••••3210', className: 'right-[4%] top-[14%]', delay: 0.6 },
  { icon: Globe, label: '192.***.***.***', className: 'left-[6%] bottom-[16%]', delay: 1.1 },
  { icon: FileText, label: 'ABCXXXXXXF', className: 'right-[8%] bottom-[26%]', delay: 0.3 },
  { icon: CreditCard, label: '**** **** 1111', className: 'left-[16%] top-[42%]', delay: 0.9 },
];

export default function HeroVisual() {
  return (
    <div className="relative h-[380px] w-full select-none sm:h-[440px]" aria-hidden="true">
      {/* Connection lines */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="14" y1="16" x2="50" y2="50" stroke="rgba(92,225,178,0.35)" strokeWidth="0.25" className="flow-line" />
        <line x1="86" y1="22" x2="50" y2="50" stroke="rgba(139,156,255,0.35)" strokeWidth="0.25" className="flow-line" />
        <line x1="18" y1="80" x2="50" y2="50" stroke="rgba(125,211,252,0.35)" strokeWidth="0.25" className="flow-line" />
        <line x1="82" y1="68" x2="50" y2="50" stroke="rgba(251,191,36,0.35)" strokeWidth="0.25" className="flow-line" />
        <line x1="28" y1="48" x2="50" y2="50" stroke="rgba(251,146,60,0.35)" strokeWidth="0.25" className="flow-line" />
      </svg>

      {/* Central shield */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="pulse-ring absolute inset-0 rounded-full border border-veil-accent/40" />
        <div className="pulse-ring absolute inset-0 rounded-full border border-veil-accent/25 [animation-delay:1.3s]" />
        <motion.div
          className="relative flex h-36 w-36 items-center justify-center rounded-full border border-veil-accent/30 bg-gradient-to-b from-veil-accent/15 via-veil-panel to-veil-secondary shadow-[0_0_80px_rgba(92,225,178,0.18)]"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-veil-accent/40 bg-veil-bg/70">
            <Shield className="h-12 w-12 text-veil-accent" strokeWidth={1.4} />
          </div>
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-veil-accent text-veil-bg">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        </motion.div>
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-veil-muted">
          Local engine · active
        </p>
      </div>

      {/* Floating data fragments */}
      {CHIPS.map((chip) => (
        <motion.div
          key={chip.label}
          className={`absolute ${chip.className}`}
          animate={{ y: [0, -9, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: chip.delay }}
        >
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-veil-panel/90 px-3 py-2 shadow-lg backdrop-blur">
            <chip.icon className="h-3.5 w-3.5 text-veil-accent" />
            <span className="font-mono text-[11px] text-veil-text">{chip.label}</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-veil-accent/15">
              <Check className="h-2.5 w-2.5 text-veil-accent" strokeWidth={3} />
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
