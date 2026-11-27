import { describe, expect, it } from 'vitest';
import { classifyFile, exportFileName, formatBytes, looksBinary, readTextFile } from './files';

describe('classifyFile', () => {
  it('recognises CSV and text by extension or MIME type', () => {
    expect(classifyFile('People.CSV', '')).toBe('csv');
    expect(classifyFile('export', 'text/csv')).toBe('csv');
    expect(classifyFile('notes.txt', '')).toBe('txt');
    expect(classifyFile('README', 'text/markdown')).toBe('txt');
  });

  it('rejects everything else', () => {
    expect(classifyFile('photo.png', 'image/png')).toBeNull();
    expect(classifyFile('report.pdf', 'application/pdf')).toBeNull();
  });
});

describe('exportFileName', () => {
  it('appends the suffix and the output extension', () => {
    expect(exportFileName('customer-record.txt', 'txt')).toBe('customer-record-sanitized.txt');
    expect(exportFileName('people.csv', 'csv')).toBe('people-sanitized.csv');
  });

  it('strips path separators, reserved and control characters', () => {
    expect(exportFileName('../../etc/passwd.txt', 'txt')).toBe('etc-passwd-sanitized.txt');
    expect(exportFileName('a<b>:c"|?*\u0007.txt', 'txt')).toBe('a-b-c-sanitized.txt');
    expect(exportFileName('C:\\Users\\me\\doc.csv', 'csv')).toBe('C-Users-me-doc-sanitized.csv');
  });

  it('falls back to "document" and caps the length', () => {
    expect(exportFileName('', 'txt')).toBe('document-sanitized.txt');
    expect(exportFileName('...', 'txt')).toBe('document-sanitized.txt');
    expect(exportFileName('x'.repeat(500) + '.txt', 'txt').length).toBeLessThanOrEqual(120 + '-sanitized.txt'.length);
  });
});

describe('looksBinary / formatBytes', () => {
  it('flags NUL bytes only', () => {
    expect(looksBinary('plain text\nwith lines')).toBe(false);
    expect(looksBinary('PK\u0003\u0004\u0000\u0000')).toBe(true);
  });

  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });
});

describe('readTextFile', () => {
  it('reads a supported text file', async () => {
    const res = await readTextFile(new File(['name,email\nA,a@b.co'], 'people.csv', { type: 'text/csv' }));
    expect(res).toEqual({ ok: true, text: 'name,email\nA,a@b.co', kind: 'csv' });
  });

  it('rejects unsupported, oversized and binary files', async () => {
    const png = await readTextFile(new File(['x'], 'a.png', { type: 'image/png' }));
    expect(png.ok).toBe(false);
    const big = await readTextFile(new File(['x'.repeat(2048)], 'big.txt'), 1024);
    expect(big).toEqual({ ok: false, message: 'That file is 2 KB — the limit is 1 KB' });
    const bin = await readTextFile(new File(['abc\u0000def'], 'data.txt'));
    expect(bin).toEqual({ ok: false, message: 'That file looks binary, not plain text' });
  });
});
