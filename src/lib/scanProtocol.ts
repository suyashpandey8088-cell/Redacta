import { detectPII, type Category, type DetectionResult } from './pii';

/** Message sent to the scan worker. */
export interface ScanRequest {
  id: number;
  text: string;
  categories: Category[];
}

/** Message the scan worker sends back: a result, or an error message (never document text). */
export type ScanResponse = { id: number; ok: true; result: DetectionResult } | { id: number; ok: false; error: string };

/** Handles one request. Shared by the worker and the inline fallback so both behave identically. */
export function handleScanRequest({ id, text, categories }: ScanRequest): ScanResponse {
  try {
    return { id, ok: true, result: detectPII(text, categories) };
  } catch (err) {
    return { id, ok: false, error: err instanceof Error ? err.name : 'Error' };
  }
}
