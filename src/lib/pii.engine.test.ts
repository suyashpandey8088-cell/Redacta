import { describe, expect, it } from 'vitest';
import { CATEGORIES, createLineIndex, detectPII, findEmailSpans } from './pii';

/** The original email pattern; the linear scanner must reproduce its matches exactly. */
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const regexSpans = (text: string) => [...text.matchAll(EMAIL_REGEX)].map((m) => ({ start: m.index, end: m.index + m[0].length }));

/** Small deterministic PRNG so failures are reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

describe('findEmailSpans', () => {
  it('matches the reference regex on hand-picked edge cases', () => {
    const cases = [
      'aarav.sharma@example.com',
      'Mail a@b.co, b@c.org; c@d.in.',
      '_x@y.com and x_@y.com and .a@b.com and -a@b.com',
      'a@b.com.c@d.org',
      'a@b.c',
      'a@b.com-x and a@b.com9 and a@b.comx_',
      'name+tag@sub.domain.co.uk>',
      '@@a@@b.com@',
      'a@.com a@-.com a@b..com',
      'a'.repeat(80) + '@example.com',
      'x@' + 'a.'.repeat(50) + 'io',
      '',
    ];
    for (const text of cases) expect(findEmailSpans(text), text).toEqual(regexSpans(text));
  });

  it('matches the reference regex on 60,000 random strings', () => {
    const next = rng(42);
    /* Tokens biased towards email shapes so real matches (and near misses) are common. */
    const tokens = ['a', 'B', '7', '_', '.', '-', '+', '%', '@', '@', '.com', '.io', '.c', 'x.y', ' ', '\n', ',', 'é', '..'];
    let matched = 0;
    for (let n = 0; n < 60_000; n++) {
      const count = 1 + Math.floor(next() * 14);
      let text = '';
      for (let i = 0; i < count; i++) text += tokens[Math.floor(next() * tokens.length)];
      const expected = regexSpans(text);
      matched += expected.length;
      expect(findEmailSpans(text), JSON.stringify(text)).toEqual(expected);
    }
    expect(matched).toBeGreaterThan(1000);
  });
});

describe('createLineIndex', () => {
  it('maps offsets to 1-based line and column', () => {
    const text = 'ab\ncd\n\nef';
    const at = createLineIndex(text);
    expect(at(0)).toEqual({ line: 1, column: 1 });
    expect(at(1)).toEqual({ line: 1, column: 2 });
    expect(at(3)).toEqual({ line: 2, column: 1 });
    expect(at(6)).toEqual({ line: 3, column: 1 });
    expect(at(8)).toEqual({ line: 4, column: 2 });
  });

  it('agrees with entity positions reported by detectPII', () => {
    const text = 'one\ntwo a@b.com\n\n  call 9876543210\nIP 10.0.0.1';
    for (const e of detectPII(text, CATEGORIES).entities) {
      const before = text.slice(0, e.start);
      expect(e.line).toBe(before.split('\n').length);
      expect(e.column).toBe(e.start - before.lastIndexOf('\n'));
    }
  });
});

describe('detection performance', () => {
  /* Inputs that made the previous engine backtrack for 20–40 seconds. */
  const adversarial: Record<string, string> = {
    'long dotted token': 'a.'.repeat(100_000),
    'long dashed digit run': '12-'.repeat(60_000) + 'x',
    'many findings': 'call 9876543210 or mail user@example.com\n'.repeat(5_000),
  };
  for (const [name, text] of Object.entries(adversarial)) {
    it(`scans a ${Math.round(text.length / 1000)} KB ${name} quickly`, () => {
      const t0 = performance.now();
      detectPII(text, CATEGORIES);
      expect(performance.now() - t0).toBeLessThan(2000);
    });
  }
});
