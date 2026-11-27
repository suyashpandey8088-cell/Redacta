import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Play,
  Repeat,
  ServerOff,
  Shield,
} from 'lucide-react';
import HeroVisual from './HeroVisual';
import {
  CATEGORIES,
  CATEGORY_META,
  buildPseudonymMap,
  detectPII,
  sanitizeWithSegments,
  type RedactionMode,
} from '../lib/pii';

const PROBLEM_TEXT = `Customer onboarding record
Email: aarav.sharma@example.com
Phone: +91 98765 43210
Server: 192.168.1.45
PAN: ABCDE1234F
Aadhaar: 2345 6789 0123
Card: 4111 1111 1111 1111`;

const TRANSFORM_TEXT = `Contact Aarav at aarav.sharma@example.com or +91 98765 43210.
PAN ABCDE1234F · Card 4111 1111 1111 1111 · Server 192.168.1.45.
Aadhaar 2345 6789 0123. Order 12345 stays untouched.`;

const MODES: { mode: RedactionMode; label: string; desc: string }[] = [
  { mode: 'FULL', label: 'Full Mask', desc: 'Complete removal' },
  { mode: 'PARTIAL', label: 'Partial Mask', desc: 'Preserve verification context' },
  { mode: 'PSEUDONYM', label: 'Pseudonymization', desc: 'Consistent replacement identities' },
];

const FLOW = [
  'User Document',
  'Browser Memory',
  'Local Detection Engine',
  'Local Validation',
  'Redaction Engine',
  'Sanitized Export',
];

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-veil-accent/15">
        <Shield className="h-4 w-4 text-veil-accent" strokeWidth={2} />
      </span>
      <span className="text-sm font-bold tracking-[0.18em] text-veil-text">VEIL</span>
    </span>
  );
}

function HighlightedText({ text }: { text: string }) {
  const { entities } = useMemo(() => detectPII(text, CATEGORIES), [text]);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const sorted = [...entities].sort((a, b) => a.start - b.start);
  sorted.forEach((e, i) => {
    if (e.start > cursor) nodes.push(<span key={`p-${i}`}>{text.slice(cursor, e.start)}</span>);
    const meta = CATEGORY_META[e.category];
    nodes.push(
      <span
        key={e.id}
        style={{ background: meta.softBg, borderBottom: `1px solid ${meta.underline}`, borderRadius: 3, padding: '0 2px' }}
      >
        {text.slice(e.start, e.end)}
      </span>,
    );
    cursor = e.end;
  });
  if (cursor < text.length) nodes.push(<span key="tail">{text.slice(cursor)}</span>);
  return <>{nodes}</>;
}

export default function Landing({ onLaunch, onLoadDemo }: { onLaunch: () => void; onLoadDemo: () => void }) {
  const [mode, setMode] = useState<RedactionMode>('PARTIAL');

  const transform = useMemo(() => {
    const result = detectPII(TRANSFORM_TEXT, CATEGORIES);
    const map = buildPseudonymMap(result.entities);
    return sanitizeWithSegments(TRANSFORM_TEXT, result.entities, mode, map);
  }, [mode]);

  return (
    <div className="min-h-screen bg-veil-bg text-veil-text">
      {/* Navigation */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/[0.06] bg-veil-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-veil-muted md:flex">
            <a href="#problem" className="transition hover:text-veil-text">Product</a>
            <a href="#transformation" className="transition hover:text-veil-text">How It Works</a>
            <a href="#privacy" className="transition hover:text-veil-text">Security</a>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-veil-accent/30 bg-veil-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-veil-accent sm:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-veil-accent opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-veil-accent" />
              </span>
              Local Processing
            </span>
            <button
              onClick={onLaunch}
              className="rounded-lg bg-veil-accent px-4 py-2 text-sm font-semibold text-veil-bg transition hover:brightness-110"
            >
              Launch Workspace
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-grid relative overflow-hidden pt-16">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-veil-accent/[0.07] blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-2 lg:items-center lg:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-veil-accent">
              Privacy Intelligence / Version 1.0
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl xl:text-7xl">
              Sensitive data.
              <br />
              <span className="bg-gradient-to-r from-veil-accent via-emerald-300 to-veil-accent2 bg-clip-text text-transparent">
                Not exposed.
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-veil-muted">
              An intelligent data sanitization environment that detects and protects sensitive information directly
              inside your browser.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={onLaunch}
                className="group flex items-center gap-2 rounded-lg bg-veil-accent px-5 py-3 text-sm font-semibold text-veil-bg transition hover:brightness-110"
              >
                Open Workspace
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#transformation"
                className="rounded-lg border border-white/15 px-5 py-3 text-sm font-medium text-veil-text transition hover:border-veil-accent/50"
              >
                Explore the technology
              </a>
              <button
                onClick={onLoadDemo}
                className="flex items-center gap-2 rounded-lg border border-veil-accent/40 bg-veil-accent/10 px-5 py-3 text-sm font-semibold text-veil-accent transition hover:bg-veil-accent/20"
              >
                <Play className="h-4 w-4" /> Load interactive demo
              </button>
            </div>
            <p className="mt-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-veil-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-veil-accent" />
              100% client-side processing
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
          >
            <HeroVisual />
          </motion.div>
        </div>

        {/* Information strip */}
        <div className="relative border-y border-white/[0.07] bg-veil-secondary/60">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/[0.06] px-5 sm:px-8 lg:grid-cols-4">
            {[
              { icon: ServerOff, label: 'Zero server uploads' },
              { icon: CheckCircle2, label: 'Local validation' },
              { icon: Repeat, label: 'Consistent anonymization' },
              { icon: Download, label: 'Instant export' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 px-4 py-4">
                <item.icon className="h-4 w-4 shrink-0 text-veil-accent" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-veil-text sm:text-[11px]">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 01 — The Problem */}
      <section id="problem" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-veil-accent">01 — The Problem</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Your documents contain more than just information.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-veil-muted">
              Emails, phone numbers, IP addresses, government identifiers and payment data hide inside everyday
              files. Every one of them is a liability the moment it leaves your machine.
            </p>
            <ul className="mt-6 space-y-2.5">
              {CATEGORIES.map((c) => (
                <li key={c} className="flex items-center gap-2.5 text-sm text-veil-text">
                  <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_META[c].color }} />
                  {CATEGORY_META[c].label}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-veil-muted">{c}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="overflow-hidden rounded-xl border border-white/10 bg-veil-secondary shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-white/[0.07] bg-veil-bg/50 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-veil-accent/70" />
              <span className="ml-2 font-mono text-[11px] text-veil-muted">customer-record.txt</span>
            </div>
            <pre className="whitespace-pre-wrap p-5 font-mono text-[13px] leading-[1.8] text-veil-text">
              <HighlightedText text={PROBLEM_TEXT} />
            </pre>
            <p className="border-t border-white/[0.07] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-veil-muted">
              Live detection — every highlight above is engine output
            </p>
          </motion.div>
        </div>
      </section>

      {/* Section 02 — The Transformation */}
      <section id="transformation" className="scroll-mt-20 border-y border-white/[0.06] bg-veil-secondary/40">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-veil-accent">02 — The Transformation</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">From exposed to protected.</h2>
            <p className="mt-4 leading-relaxed text-veil-muted">
              Three redaction modes, one engine. Switch modes below — the output is regenerated from the original
              text by the same code that powers the workspace.
            </p>
          </motion.div>

          <div className="mt-8 flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.mode}
                onClick={() => setMode(m.mode)}
                className={`rounded-lg border px-4 py-2.5 text-left transition ${
                  mode === m.mode
                    ? 'border-veil-accent/60 bg-veil-accent/12'
                    : 'border-white/10 bg-veil-panel hover:border-white/25'
                }`}
              >
                <span className={`block text-sm font-semibold ${mode === m.mode ? 'text-veil-accent' : 'text-veil-text'}`}>
                  {m.label}
                </span>
                <span className="block text-[11px] text-veil-muted">{m.desc}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-veil-secondary">
              <div className="border-b border-white/[0.07] bg-veil-bg/50 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-veil-text">
                Original
              </div>
              <pre className="whitespace-pre-wrap p-5 font-mono text-[13px] leading-[1.8] text-veil-text">
                <HighlightedText text={TRANSFORM_TEXT} />
              </pre>
            </div>
            <div className="overflow-hidden rounded-xl border border-veil-accent/25 bg-veil-secondary">
              <div className="flex items-center justify-between border-b border-white/[0.07] bg-veil-bg/50 px-4 py-2.5">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-veil-text">
                  Sanitized
                </span>
                <span className="rounded bg-veil-accent/15 px-2 py-0.5 font-mono text-[10px] text-veil-accent">
                  {MODES.find((m) => m.mode === mode)?.label}
                </span>
              </div>
              <pre className="whitespace-pre-wrap p-5 font-mono text-[13px] leading-[1.8] text-veil-text">
                {transform.segments.map((s, i) =>
                  s.isReplacement ? (
                    <span
                      key={i}
                      style={{
                        background: 'rgba(92,225,178,0.16)',
                        borderBottom: '1px solid #5CE1B2',
                        borderRadius: 3,
                        padding: '0 2px',
                        color: '#A7F3D0',
                      }}
                    >
                      {s.text}
                    </span>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </pre>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={onLaunch}
              className="group flex items-center gap-2 rounded-lg bg-veil-accent px-5 py-3 text-sm font-semibold text-veil-bg transition hover:brightness-110"
            >
              Try it on your own document
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Section 03 — Privacy by Design */}
      <section id="privacy" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-veil-accent">03 — Privacy by Design</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Your data never needs to leave.</h2>
          <p className="mt-4 leading-relaxed text-veil-muted">
            Every stage runs inside your browser tab. There is no upload endpoint, no processing server, and no
            persistent copy of your document anywhere.
          </p>
        </motion.div>

        <div className="mt-10 flex flex-col gap-2 lg:flex-row lg:items-stretch">
          {FLOW.map((step, i) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative flex-1 rounded-xl border border-white/[0.08] bg-veil-panel px-4 py-5 text-center"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-veil-accent">Step {i + 1}</p>
              <p className="mt-2 text-sm font-semibold text-veil-text">{step}</p>
              {i < FLOW.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-veil-accent lg:block" />
              )}
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 rounded-xl border border-veil-accent/25 bg-veil-accent/[0.08] px-5 py-4 text-sm text-veil-accent"
        >
          Explicitly: there is no external document-processing server in this architecture.
        </motion.p>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] bg-veil-secondary/50">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-veil-muted">“Privacy isn’t a feature. It’s the architecture.”</p>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-veil-muted">
            All processing happens locally in your browser
          </p>
        </div>
      </footer>
    </div>
  );
}
