/// <reference lib="webworker" />
/*
 * Runs detection off the main thread so large documents never freeze the page.
 * The worker is bundled from this origin and, like the page, has no network
 * access under the Content-Security-Policy.
 */
import { handleScanRequest, type ScanRequest } from '../lib/scanProtocol';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<ScanRequest>) => {
  self.postMessage(handleScanRequest(event.data));
};
