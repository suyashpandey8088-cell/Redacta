import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import vercel from './vercel.json' with { type: 'json' };

/*
 * Security headers live in vercel.json, the single source of truth. The
 * production host sends them as HTTP headers, `vite preview` sends the same
 * set so local checks match production, and the CSP is also embedded as a
 * <meta> tag so the policy still applies on hosts that send no headers.
 *
 * Redacta never needs the network after it loads, so `connect-src 'none'`
 * makes "nothing is uploaded" a guarantee the browser enforces: fetch, XHR,
 * WebSocket and beacons are all blocked, even for injected code.
 */
const SECURITY_HEADERS: { key: string; value: string }[] = vercel.headers[0].headers;
const CONTENT_SECURITY_POLICY = SECURITY_HEADERS.find((h) => h.key === 'Content-Security-Policy')!.value;
/* frame-ancestors is ignored (and warned about) in <meta>; X-Frame-Options covers it as a header. */
const META_CSP = CONTENT_SECURITY_POLICY.split('; ')
  .filter((d) => !d.startsWith('frame-ancestors'))
  .join('; ');

function securityHeaders(): Plugin {
  return {
    name: 'redacta-security',
    /* Only builds: the dev server needs inline scripts and a WebSocket for hot reload. */
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: META_CSP }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

function previewHeaders(embeddable: boolean): Plugin {
  const headers = SECURITY_HEADERS
    /* HSTS is meaningless over plain-HTTP localhost. */
    .filter((h) => h.key !== 'Strict-Transport-Security')
    /* Remote preview environments show the app in an iframe, so drop the anti-framing headers there. */
    .filter((h) => !embeddable || h.key !== 'X-Frame-Options')
    .map((h) => (embeddable && h.key === 'Content-Security-Policy' ? { ...h, value: META_CSP } : h));
  return {
    name: 'redacta-preview-headers',
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const { key, value } of headers) res.setHeader(key, value);
        next();
      });
    },
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
  plugins: [react(), securityHeaders(), previewHeaders(expose)],
  server,
  preview: server,
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
