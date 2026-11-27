# Redacta — Client-side PII Redaction

**Share the document. Not the person in it.**

Redacta finds and redacts personal data — emails, phone numbers, IP addresses, PAN, Aadhaar and credit-card numbers — **entirely inside your browser tab**. Nothing is uploaded, nothing is stored, and the audit trail never contains the values themselves.

> No processing server · No external AI service · No localStorage, cookies or IndexedDB · No raw values in logs

---

## Highlights

### Detection engine (`src/lib/pii.ts`)

| Type | Rule | Validation |
|---|---|---|
| Email | Local part + domain, TLD of two or more letters | Structure |
| Phone | Indian 10-digit mobiles, international `+CC` numbers (10–15 digits) | Length & prefix |
| IP address | IPv4 (octets 0–255), full and compressed IPv6 | Range |
| PAN | `AAAAA9999A` layout | Format |
| Aadhaar | 12 digits in 4-4-4 groups, never inside a longer card run | Format & context |
| Credit card | 13–19 digits | **Luhn checksum** |

- Candidates that match a pattern but fail validation are **rejected**: they are left unchanged and listed with the reason.
- Overlap resolution keeps one entity per span; adjacent values (an Aadhaar next to a card) are segmented correctly.
- Ordinary numbers such as order IDs, years and amounts are ignored.

### Redaction modes (always regenerated from the original text)

| Mode | Output |
|---|---|
| **Full mask** | `[REDACTED]` |
| **Partial mask** | Keeps a verification hint only — `a***@example.com`, `••••••3210`, `**** **** **** 1111` |
| **Pseudonymize** | Stable aliases per distinct value — `USER_01`, `PHONE_01`, `CARD_01`. Format variants such as `+91 98765 43210` and `9876543210` share one alias, including across CSV rows. |

---

## The interface

The design follows a "declassified document" idea: warm paper, ink-black redaction bars, one red signal colour, hairline rules and the IBM Plex type family (self-hosted, so the page makes no font requests to third parties).

### Landing page — scroll-driven

- **Pinned hero:** a customer record is scanned by the real engine, and as you scroll, ink bars redact each value one by one. A live counter tracks progress, a *Sanitized* stamp lands at the end, and the word "person" in the headline is redacted too.
- **Scroll ticker:** two rows of type move in opposite directions as you scroll — category names, then their masked forms.
- **Detection index:** the six detectors as a numbered editorial table, plus a live engine result showing a card number rejected by the Luhn check.
- **Pinned modes section:** scrolling steps through Full → Partial → Pseudonymize on the same message, with scroll-linked progress rails. Click a mode to jump to it.
- **Architecture band:** a six-step pipeline whose connecting line draws itself as you scroll, followed by *What happens* / *What never happens*.
- **Reading progress bar** in the navigation and a closing wordmark that rises with scroll.

### Workspace

| Tab | What it does |
|---|---|
| **Sanitize** | Overlay editor with line numbers and per-type highlights. Open, paste, drag and drop, sample record, sample CSV, clear. Click a highlighted value (or a row in the findings panel) to inspect it; the inspector shows position, check result, replacement and alias, with previous/next navigation. After the first scan, findings update **live as you type**. Scan with the button or **Ctrl/Cmd + Enter**. |
| **Audit & Export** | Live side-by-side diff: the editable original on the left, the sanitized output on the right, kept line-for-line and scrolled together. Changed lines are marked `−` / `+`, with removed and inserted values highlighted. Above it: detection counts (total, by type, rejected, lines changed). Click a type to include or exclude it. Switch modes, copy, or **download the sanitized file in one click**. |
| **Aliases** | Every distinct value with its alias, masked source, use count and lines. Search, filter by type, copy, rebuild. |
| **Analysis** | Values found, rejected, pass rate, characters hidden, share of document, scan time, by-type bars, validation ring, a line map of where values appear, and output length per mode. |
| **Session log** | Newest-first session log (counts, modes and timings only) with `.txt` / `.json` export and a clear-session action. |
| **Privacy** | The processing path, live session state (document size, alias count, scans, exports, storage used) and steps to verify it yourself in DevTools. |

Exports are named after the source file (`customer-record-sample-sanitized.txt`). CSV exports are sanitized cell by cell, so quoting and structure are preserved.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript (strict) |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 |
| Motion | Framer Motion (`useScroll`, `useTransform`, `whileInView`) |
| Type | IBM Plex Sans + IBM Plex Mono via `@fontsource` |
| Icons | Lucide React |
| Tests | Vitest |

---

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check with `tsc`, then build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the Vitest suite |

---

## Project structure

```
src/
├── lib/
│   ├── pii.ts            # Detection, validation, redaction, pseudonyms, CSV
│   ├── pii.test.ts       # Engine tests
│   ├── sample.ts         # Synthetic sample record, sample CSV, landing snippets
│   └── audit.ts          # Metadata-only audit events and report export
├── components/
│   ├── Landing.tsx       # Scroll-driven landing page
│   ├── Workspace.tsx     # Top bar, tabs, Sanitize toolbar and view routing
│   ├── Editor.tsx        # Highlight overlay editor + inspector
│   ├── FindingsPanel.tsx # Summary, type filters, values, rejected list
│   ├── AuditExport.tsx   # Live diff, detection counts, one-click export
│   ├── PseudonymStudio.tsx
│   ├── Analytics.tsx
│   ├── AuditCenter.tsx
│   ├── PrivacyCenter.tsx
│   └── ui.tsx            # Logo, view header, segmented control, empty state
├── App.tsx               # State, scanning, live re-scan, exports, audit, toasts
├── main.tsx
└── index.css
```

---

## Tests

```bash
npm test
```

19 tests cover the Luhn check, all six detectors, rejection of invalid candidates, IPv4 range checks, ignoring ordinary numbers, disabled types, card-versus-Aadhaar overlap, partial-mask safety, pseudonym consistency, regenerating modes from the original, CSV quoting round-trips, CSV alias consistency across rows, reuse of document-level aliases in CSV export, values never running across a line break, and the full sample record (9 values found, 1 rejected).

---

## Privacy notes

- All processing happens in the browser; documents are never transmitted or persisted.
- Original input and sanitized output are kept separately in memory, and every mode is regenerated from the original.
- Downloads are Blob URLs that are revoked immediately after use.
- Audit entries contain counts, modes and timings — never the detected values.
- Redacta makes no claims of third-party certification or external security audits.

All sample data in this repository is synthetic.
