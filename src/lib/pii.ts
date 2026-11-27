/**
 * VEIL — Client-side PII detection & redaction engine.
 *
 * Everything in this module runs locally in the browser.
 * No document content ever leaves the device.
 */

export type Category = 'EMAIL' | 'PHONE' | 'IP' | 'PAN' | 'AADHAAR' | 'CARD';
export type RedactionMode = 'FULL' | 'PARTIAL' | 'PSEUDONYM';

export const CATEGORIES: Category[] = ['EMAIL', 'PHONE', 'IP', 'PAN', 'AADHAAR', 'CARD'];

export const CATEGORY_META: Record<
  Category,
  { label: string; prefix: string; color: string; softBg: string; underline: string }
> = {
  EMAIL: { label: 'Email', prefix: 'USER', color: '#2952CC', softBg: 'rgba(41,82,204,0.12)', underline: '#2952CC' },
  PHONE: { label: 'Phone', prefix: 'PHONE', color: '#6E3FC9', softBg: 'rgba(110,63,201,0.12)', underline: '#6E3FC9' },
  IP: { label: 'IP Address', prefix: 'IP', color: '#0B7A70', softBg: 'rgba(11,122,112,0.13)', underline: '#0B7A70' },
  PAN: { label: 'PAN', prefix: 'PAN', color: '#A86A12', softBg: 'rgba(168,106,18,0.14)', underline: '#A86A12' },
  AADHAAR: { label: 'Aadhaar', prefix: 'AADHAAR', color: '#B4235A', softBg: 'rgba(180,35,90,0.12)', underline: '#B4235A' },
  CARD: { label: 'Credit Card', prefix: 'CARD', color: '#C2410C', softBg: 'rgba(194,65,12,0.12)', underline: '#C2410C' },
};

export interface Entity {
  id: string;
  category: Category;
  start: number;
  end: number;
  value: string;
  normalized: string;
  line: number;
  column: number;
  validated: boolean;
}

export interface RejectedCandidate {
  category: Category;
  start: number;
  end: number;
  reason: string;
}

export interface DetectionResult {
  entities: Entity[];
  rejected: RejectedCandidate[];
  durationMs: number;
  charsSanitized: number;
}

/* ------------------------------------------------------------------ */
/* Validation helpers                                                  */
/* ------------------------------------------------------------------ */

/** Luhn checksum — required for credit-card validation. */
export function luhnCheck(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function validateEmail(value: string): boolean {
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (labels.some((l) => !l || l.startsWith('-') || l.endsWith('-'))) return false;
  if (labels[labels.length - 1].length < 2) return false;
  return true;
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function validatePhone(value: string): boolean {
  const digits = phoneDigits(value);
  if (value.trim().startsWith('+')) {
    return digits.length >= 10 && digits.length <= 15;
  }
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits[0] === '0') return /^[6-9]/.test(digits.slice(1));
  if (digits.length === 11 && digits[0] === '1') return true;
  if (digits.length === 12 && digits.startsWith('91')) return /^[6-9]/.test(digits.slice(2));
  return false;
}

/** Normalize phone numbers so the same subscriber maps to one pseudonym. */
export function normalizePhone(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && (digits[0] === '0' || digits[0] === '1')) return digits.slice(1);
  return digits;
}

function validateIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

function validateIPv6(value: string): boolean {
  const v = value.toLowerCase();
  if (!v.includes(':')) return false;
  const hasDouble = v.includes('::');
  const groups = v.split(':').filter((g) => g.length > 0);
  if (groups.length === 0 || groups.length > 8) return false;
  if (!hasDouble && groups.length !== 8) return false;
  if (hasDouble && groups.length > 7) return false;
  return groups.every((g) => /^[0-9a-f]{1,4}$/.test(g));
}

function lineColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - before.lastIndexOf('\n');
  return { line, column };
}

/* ------------------------------------------------------------------ */
/* Detection                                                           */
/* ------------------------------------------------------------------ */

interface Candidate {
  category: Category;
  start: number;
  end: number;
  value: string;
  normalized: string;
  validated: boolean;
  reason?: string;
}

const PRIORITY: Record<Category, number> = {
  CARD: 0,
  AADHAAR: 1,
  PAN: 2,
  EMAIL: 3,
  IP: 4,
  PHONE: 5,
};

export function detectPII(text: string, enabled: Category[]): DetectionResult {
  const t0 = performance.now();
  const enabledSet = new Set(enabled);
  const candidates: Candidate[] = [];

  const push = (category: Category, match: RegExpExecArray, validated: boolean, normalized: string, reason?: string) => {
    candidates.push({
      category,
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
      normalized,
      validated,
      reason,
    });
  };

  if (enabledSet.has('EMAIL')) {
    const re = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const ok = validateEmail(m[0]);
      push('EMAIL', m, ok, m[0].toLowerCase(), ok ? undefined : 'Malformed email address');
    }
  }

  if (enabledSet.has('PHONE')) {
    const patterns = [
      /\+[\d\s-]{8,16}\d/g,
      /\b[6-9]\d{4}[\s-]\d{5}\b/g,
      /\b[6-9]\d{9}\b/g,
      /\b\d{3}[- ]\d{3}[- ]\d{4}\b/g,
    ];
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const ok = validatePhone(m[0]);
        push('PHONE', m, ok, normalizePhone(m[0]), ok ? undefined : 'Invalid phone format');
      }
    }
  }

  if (enabledSet.has('IP')) {
    const v4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    let m: RegExpExecArray | null;
    while ((m = v4.exec(text)) !== null) {
      const ok = validateIPv4(m[0]);
      push('IP', m, ok, m[0], ok ? undefined : 'IPv4 octet exceeds 255');
    }
    const v6 =
      /\b(?:[0-9A-Fa-f]{1,4}:){2,7}[0-9A-Fa-f]{1,4}\b|\b(?:[0-9A-Fa-f]{1,4}:){1,7}:\b|\b::(?:[0-9A-Fa-f]{1,4}:)*[0-9A-Fa-f]{1,4}\b/g;
    while ((m = v6.exec(text)) !== null) {
      const ok = validateIPv6(m[0]);
      push('IP', m, ok, m[0].toLowerCase(), ok ? undefined : 'Invalid IPv6 group');
    }
  }

  if (enabledSet.has('PAN')) {
    const re = /\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      push('PAN', m, true, m[0].toUpperCase());
    }
  }

  if (enabledSet.has('AADHAAR')) {
    /*
     * Lookarounds prevent matching the first/last three groups of a
     * 16-digit card run (e.g. an invalid card must not surface as Aadhaar).
     */
    const re = /(?<!\d{4}[ -])\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b(?![ -]\d{4}\b)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const digits = m[0].replace(/\D/g, '');
      const ok = digits.length === 12;
      push('AADHAAR', m, ok, digits, ok ? undefined : 'Invalid Aadhaar length');
    }
  }

  if (enabledSet.has('CARD')) {
    /*
     * Card scanning: find maximal digit-group runs, then try contiguous
     * group subsequences with 13–19 digits. This correctly segments
     * adjacent values (e.g. an Aadhaar immediately before a card) instead
     * of letting a greedy regex consume across token boundaries.
     */
    const runRe = /\b\d+(?:[ -]\d+)+\b|\b\d{13,19}\b/g;
    let m: RegExpExecArray | null;
    while ((m = runRe.exec(text)) !== null) {
      const run = m[0];
      const runStart = m.index;
      const digits = run.replace(/\D/g, '');

      if (!/[ -]/.test(run)) {
        /* Continuous digit run. */
        const ok = luhnCheck(digits);
        push('CARD', m, ok, digits, ok ? undefined : 'Luhn check failed');
        continue;
      }

      /* Grouped run: locate each digit group with its offsets. */
      const groups: { value: string; start: number; end: number }[] = [];
      const gRe = /\d+/g;
      let g: RegExpExecArray | null;
      while ((g = gRe.exec(run)) !== null) {
        groups.push({ value: g[0], start: runStart + g.index, end: runStart + g.index + g[0].length });
      }

      let found: { start: number; end: number; digits: string } | null = null;
      let longestFail: { start: number; end: number; digits: string } | null = null;
      for (let i = 0; i < groups.length && !found; i++) {
        let total = 0;
        for (let j = i; j < groups.length; j++) {
          total += groups[j].value.length;
          if (total < 13) continue;
          if (total > 19) break;
          const subDigits = groups.slice(i, j + 1).map((x) => x.value).join('');
          const cand = { start: groups[i].start, end: groups[j].end, digits: subDigits };
          if (luhnCheck(subDigits)) {
            found = cand;
            break;
          }
          if (!longestFail || total > longestFail.digits.length) longestFail = cand;
        }
      }

      if (found) {
        candidates.push({
          category: 'CARD',
          start: found.start,
          end: found.end,
          value: text.slice(found.start, found.end),
          normalized: found.digits,
          validated: true,
        });
      } else if (longestFail) {
        candidates.push({
          category: 'CARD',
          start: longestFail.start,
          end: longestFail.end,
          value: text.slice(longestFail.start, longestFail.end),
          normalized: longestFail.digits,
          validated: false,
          reason: 'Luhn check failed',
        });
      }
    }
  }

  /* Rejected candidates: pattern matched but validation failed. */
  const rejected: RejectedCandidate[] = candidates
    .filter((c) => !c.validated)
    .map((c) => ({ category: c.category, start: c.start, end: c.end, reason: c.reason ?? 'Validation failed' }))
    .sort((a, b) => a.start - b.start);

  /* Overlap resolution: earliest start wins; ties broken by length, then priority. */
  const valid = candidates
    .filter((c) => c.validated)
    .sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      const lenDiff = b.end - b.start - (a.end - a.start);
      if (lenDiff !== 0) return lenDiff;
      return PRIORITY[a.category] - PRIORITY[b.category];
    });

  const kept: Candidate[] = [];
  for (const c of valid) {
    const overlaps = kept.some((k) => c.start < k.end && c.end > k.start);
    if (!overlaps) kept.push(c);
  }
  kept.sort((a, b) => a.start - b.start);

  const entities: Entity[] = kept.map((c, i) => {
    const { line, column } = lineColumn(text, c.start);
    return {
      id: `ent-${i + 1}`,
      category: c.category,
      start: c.start,
      end: c.end,
      value: c.value,
      normalized: c.normalized,
      line,
      column,
      validated: true,
    };
  });

  const durationMs = Math.max(0.1, performance.now() - t0);
  const charsSanitized = entities.reduce((sum, e) => sum + (e.end - e.start), 0);

  return { entities, rejected, durationMs, charsSanitized };
}

/* ------------------------------------------------------------------ */
/* Pseudonymization                                                    */
/* ------------------------------------------------------------------ */

/** Stable alias per normalized value, assigned in order of first appearance. */
export function buildPseudonymMap(entities: Entity[]): Map<string, string> {
  const map = new Map<string, string>();
  const counters: Partial<Record<Category, number>> = {};
  const sorted = [...entities].sort((a, b) => a.start - b.start);
  for (const e of sorted) {
    const key = `${e.category}:${e.normalized}`;
    if (!map.has(key)) {
      const n = (counters[e.category] ?? 0) + 1;
      counters[e.category] = n;
      const prefix = CATEGORY_META[e.category].prefix;
      map.set(key, `${prefix}_${String(n).padStart(2, '0')}`);
    }
  }
  return map;
}

export function aliasFor(entity: Entity, map: Map<string, string>): string {
  return map.get(`${entity.category}:${entity.normalized}`) ?? '[REDACTED]';
}

/* ------------------------------------------------------------------ */
/* Redaction                                                           */
/* ------------------------------------------------------------------ */

export function partialMask(value: string, category: Category): string {
  switch (category) {
    case 'EMAIL': {
      const [local, domain] = value.split('@');
      return `${local ? local[0] : ''}***@${domain ?? ''}`;
    }
    case 'PHONE': {
      const digits = value.replace(/\D/g, '');
      return `••••••${digits.slice(-4)}`;
    }
    case 'IP': {
      if (value.includes(':')) {
        const first = value.split(':')[0] || '';
        return `${first}:••••:••••:••••:••••:••••:••••:••••`;
      }
      const first = value.split('.')[0] || '';
      return `${first}.***.***.***`;
    }
    case 'PAN': {
      const v = value.toUpperCase();
      return `${v.slice(0, 3)}XXXXXX${v.slice(-1)}`;
    }
    case 'AADHAAR': {
      const digits = value.replace(/\D/g, '');
      return `XXXX XXXX ${digits.slice(-4)}`;
    }
    case 'CARD': {
      const digits = value.replace(/\D/g, '');
      return `**** **** **** ${digits.slice(-4)}`;
    }
  }
}

/** Safe preview for UI lists — never the complete original value. */
export function maskedPreview(value: string, category: Category): string {
  return partialMask(value, category);
}

export function replacementFor(entity: Entity, mode: RedactionMode, map: Map<string, string>): string {
  switch (mode) {
    case 'FULL':
      return '[REDACTED]';
    case 'PARTIAL':
      return partialMask(entity.value, entity.category);
    case 'PSEUDONYM':
      return aliasFor(entity, map);
  }
}

export interface Segment {
  text: string;
  isReplacement: boolean;
  category?: Category;
}

/** Sanitize while preserving every non-PII character exactly. */
export function sanitizeWithSegments(
  text: string,
  entities: Entity[],
  mode: RedactionMode,
  map: Map<string, string>,
): { output: string; segments: Segment[] } {
  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let out = '';
  let cursor = 0;
  for (const e of sorted) {
    if (e.start > cursor) {
      const plain = text.slice(cursor, e.start);
      segments.push({ text: plain, isReplacement: false });
      out += plain;
    }
    const rep = replacementFor(e, mode, map);
    segments.push({ text: rep, isReplacement: true, category: e.category });
    out += rep;
    cursor = e.end;
  }
  if (cursor < text.length) {
    const plain = text.slice(cursor);
    segments.push({ text: plain, isReplacement: false });
    out += plain;
  }
  return { output: out, segments };
}

export function sanitizeText(
  text: string,
  entities: Entity[],
  mode: RedactionMode,
  map: Map<string, string>,
): string {
  return sanitizeWithSegments(text, entities, mode, map).output;
}

/* ------------------------------------------------------------------ */
/* CSV parsing / serialization (RFC-4180 style quoting)                */
/* ------------------------------------------------------------------ */

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  /* Drop a single trailing empty row produced by a final newline. */
  if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

export function serializeCSV(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (/[",\n]/.test(cell)) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(','),
    )
    .join('\n');
}

/**
 * Sanitize CSV cell-by-cell so quoting and structure are preserved.
 * One alias map is shared across every cell, so the same value receives
 * the same alias in every row. Pass `baseMap` (built from the whole
 * document) to keep aliases identical to the on-screen preview.
 * Returns the sanitized CSV plus the total number of entities found.
 */
export function sanitizeCSV(
  text: string,
  enabled: Category[],
  mode: RedactionMode,
  baseMap?: Map<string, string>,
): { output: string; entityCount: number } {
  const rows = parseCSV(text);
  const map = new Map<string, string>(baseMap ?? []);
  const counters: Partial<Record<Category, number>> = {};
  for (const key of map.keys()) {
    const category = key.slice(0, key.indexOf(':')) as Category;
    counters[category] = (counters[category] ?? 0) + 1;
  }
  let entityCount = 0;
  const sanitized = rows.map((row) =>
    row.map((cell) => {
      const res = detectPII(cell, enabled);
      entityCount += res.entities.length;
      if (res.entities.length === 0) return cell;
      for (const e of res.entities) {
        const key = `${e.category}:${e.normalized}`;
        if (!map.has(key)) {
          const n = (counters[e.category] ?? 0) + 1;
          counters[e.category] = n;
          map.set(key, `${CATEGORY_META[e.category].prefix}_${String(n).padStart(2, '0')}`);
        }
      }
      return sanitizeText(cell, res.entities, mode, map);
    }),
  );
  return { output: serializeCSV(sanitized), entityCount };
}
