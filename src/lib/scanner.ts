import type { Category, DetectionResult } from './pii';
import { handleScanRequest, type ScanRequest, type ScanResponse } from './scanProtocol';

/**
 * Documents at or above this size are scanned in a Web Worker. Smaller ones
 * scan inline: they finish in a few milliseconds, faster than a round trip.
 */
export const WORKER_THRESHOLD = 150_000;

export interface Scanner {
  /** Scans `text`. Resolves with the result, or `null` if a newer scan superseded this one. */
  scan(text: string, categories: Category[]): Promise<DetectionResult | null>;
  /** Supersedes any scan in flight (it resolves to `null`), e.g. when the text changes. */
  cancel(): void;
  /** Stops the worker and drops pending scans. The scanner can still be used afterwards. */
  dispose(): void;
}

type WorkerFactory = () => Worker;

const defaultWorker: WorkerFactory = () => new Worker(new URL('../workers/scan.worker.ts', import.meta.url), { type: 'module' });

function settle(response: ScanResponse): DetectionResult {
  if (!response.ok) throw new Error(`Scan failed (${response.error})`);
  return response.result;
}

/**
 * Creates a scanner where the latest call wins: when scans overlap, earlier
 * ones resolve to `null`, so a slow scan can never overwrite newer results.
 * Falls back to scanning inline when workers are unavailable.
 */
export function createScanner(createWorker: WorkerFactory | null = typeof Worker === 'undefined' ? null : defaultWorker): Scanner {
  let worker: Worker | null = null;
  let workerFailed = false;
  let latest = 0;
  const pending = new Map<number, { resolve: (r: DetectionResult | null) => void; reject: (e: Error) => void }>();

  const failAll = (error: Error) => {
    for (const p of pending.values()) p.reject(error);
    pending.clear();
  };

  const getWorker = (): Worker | null => {
    if (worker || workerFailed || !createWorker) return worker;
    try {
      worker = createWorker();
      worker.onmessage = (event: MessageEvent<ScanResponse>) => {
        const p = pending.get(event.data.id);
        if (!p) return;
        pending.delete(event.data.id);
        if (event.data.id !== latest) p.resolve(null);
        else {
          try {
            p.resolve(settle(event.data));
          } catch (err) {
            p.reject(err instanceof Error ? err : new Error(String(err)));
          }
        }
      };
      worker.onerror = () => {
        failAll(new Error('Scan worker stopped unexpectedly'));
        worker?.terminate();
        worker = null;
        workerFailed = true;
      };
    } catch {
      workerFailed = true;
      worker = null;
    }
    return worker;
  };

  const supersede = () => {
    for (const p of pending.values()) p.resolve(null);
    pending.clear();
  };

  return {
    scan(text, categories) {
      const id = ++latest;
      supersede();

      const request: ScanRequest = { id, text, categories };
      const w = text.length >= WORKER_THRESHOLD ? getWorker() : null;
      if (!w) {
        try {
          return Promise.resolve(settle(handleScanRequest(request)));
        } catch (err) {
          return Promise.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        w.postMessage(request);
      });
    },
    cancel() {
      latest++;
      supersede();
    },
    dispose() {
      latest++;
      supersede();
      worker?.terminate();
      worker = null;
    },
  };
}
