/**
 * File import/export helpers. Everything here stays in the browser:
 * files are read with the File API and exports are local Blob downloads.
 */

export type FileKind = 'txt' | 'csv';

/** Largest document accepted, in bytes (and characters for pasted text). Keeps the editor responsive. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export type ReadResult = { ok: true; text: string; kind: FileKind } | { ok: false; message: string };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`;
}

/** Decide how a file should be treated from its name and MIME type, or null if unsupported. */
export function classifyFile(name: string, type: string): FileKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv') || type === 'text/csv') return 'csv';
  if (lower.endsWith('.txt') || type.startsWith('text/')) return 'txt';
  return null;
}

/** NUL characters never appear in real text files; their presence means the file is binary. */
export function looksBinary(text: string): boolean {
  return text.slice(0, 8192).includes('\u0000');
}

/** Validate and read a user-selected file as text. Size is checked before anything is read. */
export async function readTextFile(file: File, maxBytes = MAX_DOCUMENT_BYTES): Promise<ReadResult> {
  const kind = classifyFile(file.name, file.type);
  if (!kind) return { ok: false, message: 'Only .txt and .csv files are supported' };
  if (file.size > maxBytes) {
    return { ok: false, message: `That file is ${formatBytes(file.size)} — the limit is ${formatBytes(maxBytes)}` };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, message: 'That file could not be read' };
  }
  if (looksBinary(text)) return { ok: false, message: 'That file looks binary, not plain text' };
  return { ok: true, text, kind };
}

/**
 * Build a portable download name such as `customer-record-sanitized.csv`.
 * Path separators, reserved and control characters are removed so the name
 * is valid on every OS.
 */
export function exportFileName(sourceName: string, kind: FileKind, suffix = 'sanitized'): string {
  const stem = sourceName
    .replace(/\.[^.]+$/, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '-')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .slice(0, 120);
  return `${stem || 'document'}-${suffix}.${kind}`;
}

/** Save text as a local file. The object URL is revoked once the browser has started the download. */
export function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Revoking synchronously can cancel the download in some browsers; one tick later is enough. */
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
