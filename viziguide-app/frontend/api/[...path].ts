import type { IncomingMessage, ServerResponse } from 'node:http';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    response.statusCode = 503;
    response.end('Backend service binding is not configured.');
    return;
  }

  try {
    const incomingUrl = new URL(request.url ?? '/', 'http://vercel.local');
    const targetUrl = new URL(backendUrl);
    targetUrl.pathname = `${targetUrl.pathname.replace(/\/+$/, '')}${incomingUrl.pathname}`;
    targetUrl.search = incomingUrl.search;

    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (value === undefined || HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }

    const chunks: Buffer[] = [];
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    if (hasBody) {
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk));
      }
    }

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: hasBody ? (Buffer.concat(chunks) as unknown as BodyInit) : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });

    response.statusCode = upstream.status;
    upstream.headers.forEach((value, name) => {
      if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
        response.setHeader(name, value);
      }
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.statusCode = 502;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ detail: 'The backend service could not be reached.' }));
  }
}
