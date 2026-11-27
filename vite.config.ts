import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production Content-Security-Policy. Redacta never needs the network after it
 * loads, so `connect-src 'none'` makes "nothing is uploaded" a guarantee the
 * browser enforces: fetch, XHR, WebSocket and beacons are all blocked, even
 * for injected or third-party code. Only applied to builds — the dev server
 * needs inline scripts and a WebSocket for hot reload.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function securityHeaders(): Plugin {
  return {
    name: 'redacta-security-meta',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

/*
 * The dev server listens on localhost only. Set REDACTA_EXPOSE=1 to serve on
 * all interfaces with any Host header — needed inside containers or remote
 * preview environments, but it lets other machines on the network reach it.
 */
const expose = process.env.REDACTA_EXPOSE === '1';
const server = {
  host: expose ? '0.0.0.0' : 'localhost',
  port: 5173,
  ...(expose ? { allowedHosts: true as const } : {}),
};

export default defineConfig({
  plugins: [react(), securityHeaders()],
  server,
  preview: server,
});
