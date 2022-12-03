import './shims';
// 0SERVER gets replaced by real import during build
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Server } from '0SERVER';
import { SSRManifest } from '@sveltejs/kit';
import type { Request as FirebaseRequest } from 'firebase-functions/v2/https';
import type { Response as ExpressResponse } from 'express';
import {
  IncomingHttpHeaders,
  OutgoingHttpHeader,
  OutgoingHttpHeaders,
} from 'http';

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

declare module 'express' {
  interface Request {
    method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers: IncomingHttpHeaders;
    url: string;
    body: unknown;
    statusCode: number;
  }

  interface Response {
    statusCode: number;
    end: (chunk?: unknown, cb?: () => void) => void;
    writeHead: (
      statusCode: number,
      headers?: OutgoingHttpHeaders | OutgoingHttpHeader[] | string
    ) => this;
    locals: unknown;
  }
}

export function init(
  manifest: SSRManifest
): (request: FirebaseRequest, response: ExpressResponse) => Promise<void> {
  const server = new Server(manifest);

  let initPromise = server.init({
    env: process.env,
  });

  return async (req, res) => {
    if (initPromise !== null) {
      await initPromise;
      initPromise = null;
    }

    let request;

    try {
      request = isGetOrPatchRequest(<HttpMethod>req.method)
        ? new Request(getOrigin(req.headers) + req.url, {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            duplex: 'half',
            method: req.method,
            headers: <Record<string, string>>req.headers,
          })
        : new Request(getOrigin(req.headers) + req.url, {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            duplex: 'half',
            method: req.method,
            headers: <Record<string, string>>req.headers,
            body: req.body as BodyInit,
          });
    } catch (err) {
      res.statusCode = err.status || 400;
      res.end('Invalid request body');
      return;
    }

    const rendered = await server.respond(request, { platform: res.locals });
    const body = await rendered.text();

    return rendered
      ? res
          .writeHead(rendered.status, Object.fromEntries(rendered.headers))
          .end(body)
      : res.writeHead(404, 'Not Found').end();
  };
}

function isGetOrPatchRequest(method: HttpMethod) {
  return ['GET', 'PATCH'].includes(method);
}

function getOrigin(headers) {
  const protocol = 'https';
  const host = headers['host'];
  return `${protocol}://${host}`;
}
