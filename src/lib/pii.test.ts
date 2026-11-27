import { describe, expect, it } from 'vitest';
import {
  buildPseudonymMap,
  detectPII,
  luhnCheck,
  parseCSV,
  partialMask,
  sanitizeCSV,
  sanitizeText,
  serializeCSV,
  guardFormula,
  type Category,
} from './pii';

const ALL: Category[] = ['EMAIL', 'PHONE', 'IP', 'PAN', 'AADHAAR', 'CARD'];

describe('luhnCheck', () => {
  it('accepts a valid card number', () => {
    expect(luhnCheck('4111111111111111')).toBe(true);
    expect(luhnCheck('5500005555555559')).toBe(true);
  });
  it('rejects an invalid card number', () => {
    expect(luhnCheck('4111111111111112')).toBe(false);
  });
});

describe('detectPII', () => {
  it('detects all six categories', () => {
    const text =
      'a@b.com +91 98765 43210 192.168.1.45 2001:0db8:85a3:0000:0000:8a2e:0370:7334 ABCDE1234F 2345 6789 0123, card 4111 1111 1111 1111';
    const res = detectPII(text, ALL);
    const cats = new Set(res.entities.map((e) => e.category));
    expect(cats.has('EMAIL')).toBe(true);
    expect(cats.has('PHONE')).toBe(true);
    expect(cats.has('IP')).toBe(true);
    expect(cats.has('PAN')).toBe(true);
    expect(cats.has('AADHAAR')).toBe(true);
    expect(cats.has('CARD')).toBe(true);
  });

  it('rejects invalid Luhn candidates', () => {
    const res = detectPII('card 4111 1111 1111 1112', ALL);
    expect(res.entities.filter((e) => e.category === 'CARD')).toHaveLength(0);
    expect(res.rejected.some((r) => r.category === 'CARD')).toBe(true);
  });

  it('rejects IPv4 octets above 255', () => {
    const res = detectPII('host 999.168.1.45', ALL);
    expect(res.entities.filter((e) => e.category === 'IP')).toHaveLength(0);
    expect(res.rejected.some((r) => r.category === 'IP')).toBe(true);
  });

  it('ignores ordinary numbers', () => {
    const res = detectPII('Order 12345, year 2024, amount 1500', ALL);
    expect(res.entities).toHaveLength(0);
  });

  it('leaves disabled categories untouched', () => {
    const res = detectPII('a@b.com 9876543210', ['EMAIL']);
    expect(res.entities.map((e) => e.category)).toEqual(['EMAIL']);
  });

  it('resolves card vs aadhaar overlap in favour of the longer match', () => {
    const res = detectPII('4111 1111 1111 1111', ALL);
    expect(res.entities).toHaveLength(1);
    expect(res.entities[0].category).toBe('CARD');
  });
});

describe('redaction modes', () => {
  const text = 'mail aarav.sharma@example.com phone +91 98765 43210 card 4111 1111 1111 1111';
  const res = detectPII(text, ALL);
  const map = buildPseudonymMap(res.entities);

  it('full mask removes everything', () => {
    const out = sanitizeText(text, res.entities, 'FULL', map);
    expect(out).not.toContain('aarav.sharma');
    expect(out).not.toContain('98765');
    expect(out).not.toContain('4111');
    expect(out).toContain('[REDACTED]');
  });

  it('partial mask never exposes the complete identifier', () => {
    for (const e of res.entities) {
      const masked = partialMask(e.value, e.category);
      expect(masked).not.toBe(e.value);
      expect(masked).not.toContain(e.value);
    }
    const out = sanitizeText(text, res.entities, 'PARTIAL', map);
    expect(out).toContain('a***@example.com');
    expect(out).toContain('**** **** **** 1111');
  });

  it('pseudonyms are consistent for repeated normalized values', () => {
    const dup = 'a@b.com and a@b.com and +91 98765 43210 and 9876543210';
    const r = detectPII(dup, ALL);
    const m = buildPseudonymMap(r.entities);
    const out = sanitizeText(dup, r.entities, 'PSEUDONYM', m);
    expect(out).toContain('USER_01');
    expect(out.match(/USER_01/g)).toHaveLength(2);
    expect(out.match(/PHONE_01/g)).toHaveLength(2);
  });

  it('mode switching regenerates from the original input', () => {
    const full = sanitizeText(text, res.entities, 'FULL', map);
    const partial = sanitizeText(text, res.entities, 'PARTIAL', map);
    expect(full).not.toBe(partial);
    expect(full).toContain('[REDACTED]');
  });
});

describe('sample record document', () => {
  it('finds 9 entities and rejects the invalid card', async () => {
    const { SAMPLE_DOCUMENT } = await import('./sample');
    const res = detectPII(SAMPLE_DOCUMENT, ALL);
    expect(res.entities).toHaveLength(9);
    expect(res.rejected).toHaveLength(1);
    expect(res.rejected[0].category).toBe('CARD');
    const byCat = (c: Category) => res.entities.filter((e) => e.category === c).length;
    expect(byCat('EMAIL')).toBe(2);
    expect(byCat('PHONE')).toBe(2);
    expect(byCat('IP')).toBe(2);
    expect(byCat('PAN')).toBe(1);
    expect(byCat('AADHAAR')).toBe(1);
    expect(byCat('CARD')).toBe(1);
    /* Repeated email/phone share one pseudonym each. */
    const map = buildPseudonymMap(res.entities);
    const out = sanitizeText(SAMPLE_DOCUMENT, res.entities, 'PSEUDONYM', map);
    expect(out.match(/USER_01/g)).toHaveLength(2);
    expect(out.match(/PHONE_01/g)).toHaveLength(2);
    expect(out).not.toContain('aarav.sharma');
    expect(out).not.toContain('98765');
  });
});

describe('CSV', () => {
  it('preserves quoting through parse/serialize', () => {
    const rows = parseCSV('a,b\n"x, y","he said ""hi"""');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ]);
    expect(serializeCSV(rows)).toBe('a,b\n"x, y","he said ""hi"""');
  });

  it('sanitizes CSV cells while preserving structure', () => {
    const csv = 'name,email\nAarav,a@b.com';
    const { output, entityCount } = sanitizeCSV(csv, ALL, 'FULL');
    expect(entityCount).toBe(1);
    expect(output).toBe('name,email\nAarav,[REDACTED]');
  });

  it('keeps pseudonyms consistent across CSV rows', () => {
    const csv = 'email,backup\na@example.com,b@example.com\nb@example.com,a@example.com';
    const { output } = sanitizeCSV(csv, ALL, 'PSEUDONYM');
    expect(output).toBe('email,backup\nUSER_01,USER_02\nUSER_02,USER_01');
  });

  it('reuses document-level aliases when a base map is supplied', () => {
    const csv = 'name,email\nPriya,priya@example.com\nAarav,aarav@example.com';
    const docMap = buildPseudonymMap(detectPII(csv, ALL).entities);
    const { output } = sanitizeCSV(csv, ALL, 'PSEUDONYM', docMap);
    expect(output).toBe('name,email\nPriya,USER_01\nAarav,USER_02');
  });

  it('neutralizes spreadsheet formulas but leaves plain numbers alone', () => {
    expect(guardFormula('=HYPERLINK("http://x","y")')).toBe('\'=HYPERLINK("http://x","y")');
    expect(guardFormula('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(guardFormula('+cmd|x')).toBe("'+cmd|x");
    expect(guardFormula('\t=1')).toBe("'\t=1");
    for (const n of ['-12', '+3.5', '-0.25', '1e5', '-.5', 'plain', '']) expect(guardFormula(n)).toBe(n);
  });

  it('guards formulas in sanitized CSV exports', () => {
    const csv = 'note,email,delta\n"=1+2",a@b.com,-4\n@cmd,x,+7';
    const { output } = sanitizeCSV(csv, ALL, 'FULL');
    expect(output).toBe("note,email,delta\n'=1+2,[REDACTED],-4\n'@cmd,x,+7");
    /* Partial masking never leaves a leading "+" behind. */
    expect(sanitizeCSV('phone\n+91 98765 43210', ALL, 'PARTIAL').output).toBe('phone\n••••••3210');
  });
});

describe('line boundaries', () => {
  it('never lets a value run onto the next line', () => {
    const text = 'Call +91 98765 43210\n12 items\nid 2345\n6789\n0123 end\nm 98765\n43210';
    const entities = detectPII(text, ALL).entities;
    for (const e of entities) expect(text.slice(e.start, e.end)).not.toContain('\n');
    expect(entities.map((e) => text.slice(e.start, e.end))).toEqual(['+91 98765 43210']);
  });

  it('keeps the sanitized output line-for-line with the original', () => {
    const text = 'Phone: +91 98765 43210\n2024 total\nAadhaar 2345 6789 0123\nend';
    for (const mode of ['FULL', 'PARTIAL', 'PSEUDONYM'] as const) {
      const { entities } = detectPII(text, ALL);
      const out = sanitizeText(text, entities, mode, buildPseudonymMap(entities));
      expect(out.split('\n')).toHaveLength(4);
      expect(out.split('\n')[1]).toBe('2024 total');
    }
  });
});
