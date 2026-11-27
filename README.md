# VEIL — Privacy Intelligence Platform

**"Privacy isn't a feature. It's the architecture."**

VEIL is a privacy-first PII detection and sanitization platform that runs **entirely in your browser**. Identify, protect, and anonymize sensitive data — emails, phone numbers, IP addresses, PAN, Aadhaar, and credit cards — without your documents ever leaving your device.

> **100% client-side processing.** No uploads. No processing server. No persistent storage of raw documents. No sensitive values in audit logs.

---

## Features

### Detection Engine

- **6 PII categories**: Email, Phone (Indian + international), IPv4/IPv6, PAN, Aadhaar, Credit Card
- **Luhn validation** for credit cards — invalid candidates are rejected, never redacted
- IPv4 octet range checks, IPv6 group validation, and format validation for every category
- **Overlap resolution** — e.g. a 16-digit card run never surfaces as Aadhaar; adjacent values (Aadhaar + card) are segmented correctly
- Ordinary numbers (order IDs, years, amounts) are ignored
- Category enable/disable filters with live re-scan

### Redaction Modes (regenerated from the original input)

| Mode | Behavior |
|---|---|
| **Full Mask** | `[REDACTED]` — complete removal |
| **Partial Mask** | Category-specific masking that preserves verification context (`a***@example.com`, `**** **** **** 1111`) — never exposes a complete identifier |
| **Pseudonymization** | Stable aliases per normalized value (`USER_01`, `PHONE_01`, `PAN_01`, `IP_01`, `CARD_01`, `AADHAAR_01`). Repeated values — including format variants like `+91 98765 43210` vs `9876543210` — share one alias |

### Workspace

- **Document editor**: monospaced overlay editor with line numbers, per-category PII highlighting, char/word/line counts, Tab support, drag-and-drop, paste, TXT/CSV upload, sample loaders, clear
- **Detection Intelligence panel**: total/validated/rejected/sanitized-char stats, category distribution, per-category toggles, recent findings (masked previews only)
- **Finding details**: floating panel with entity type, validation result, line/column position, redaction status, assigned alias, prev/next navigation
- **Compare Studio**: synchronized before/after panels with emerald replacement markers, side-by-side & stacked layouts, copy/download
- **Pseudonym Studio**: alias table with category filter, search, copy, reset, occurrence counts
- **Analytics**: real scan metrics only — detection breakdown, validation-rate donut, processing duration, per-mode output lengths
- **Audit Center**: chronological, PII-free event timeline with TXT/JSON report export and session clearing
- **Privacy Center**: local-only architecture flow, security indicators, live session stats

### Landing Experience

- Editorial hero with animated privacy visualization (shield, floating masked fragments, flow lines)
- Scroll storytelling: *The Problem* → *The Transformation* (interactive mode switcher powered by the real engine) → *Privacy by Design*

### Interactive Demo

**Load interactive demo** injects a synthetic document containing all six categories, repeated entities, an invalid Luhn card (rejected), and ordinary numbers — then auto-scans it.

---

## Privacy Architecture

```
User Document
    ↓
Local Browser Memory
    ↓
PII Detection (on-device)
    ↓
Local Validation (Luhn, ranges, formats)
    ↓
Redaction Engine
    ↓
Sanitized Export (Blob download)
```

There is **no external document-processing server** in this flow. The only network requests the page makes are for its own interface assets.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 |
| Motion | Framer Motion |
| Icons | Lucide React |
| Tests | Vitest |

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev        # start dev server → http://localhost:5173
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc`) + production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm test` | Run the Vitest suite (15 tests) |

---

## Project Structure

```
src/
├── lib/
│   ├── pii.ts          # Detection, validation, redaction, CSV engine
│   ├── pii.test.ts     # Engine test suite (15 tests)
│   ├── sample.ts       # Synthetic demo documents (TXT + CSV)
│   └── audit.ts        # PII-free audit trail + report export
├── components/
│   ├── Landing.tsx         # Marketing/landing experience
│   ├── HeroVisual.tsx      # Animated privacy visualization
│   ├── Workspace.tsx       # Three-zone app shell + toolbar
│   ├── Editor.tsx          # Overlay editor with PII highlighting
│   ├── IntelligencePanel.tsx
│   ├── CompareStudio.tsx
│   ├── PseudonymStudio.tsx
│   ├── Analytics.tsx
│   ├── AuditCenter.tsx
│   └── PrivacyCenter.tsx
├── App.tsx             # State orchestration, audit logging, exports
├── main.tsx
└── index.css
```

---

## Testing

```bash
npm test
```

The suite covers Luhn validation, all six detection categories, invalid-candidate rejection, overlap resolution (card vs Aadhaar), partial-mask safety, pseudonym consistency, mode switching from original input, disabled-category isolation, CSV quoting round-trips, and the full demo document (9 entities, 1 rejection).

---

## Security Notes

- All document processing is client-side; nothing is transmitted or persisted
- Original input and transformed output are kept separate in memory; downloads use Blob URLs that are revoked after use
- Audit events record only non-sensitive metadata (counts, modes, durations) — never raw PII
- VEIL makes no third-party certification or external security-audit claims

## License

Hackathon project — built for demonstration purposes. All demo data is synthetic.
