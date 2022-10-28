import './shims.js';
// 0SERVER gets replaced by real import during build
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Server } from '0SERVER';
import { SSRManifest } from '@sveltejs/kit';
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { getRequest, setResponse } from '@sveltejs/kit/node';

const BODY_SIZE_LIMIT_V1 = 10485760;
const BODY_SIZE_LIMIT_V2 = 33554432;

export function init(
  manifest: SSRManifest,
  v2: boolean
): (
  request: ExpressRequest,
  response: ExpressResponse
) => void | Promise<void> {
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
      request = await getRequest({
        base: getOrigin(req.headers),
        request: req,
        bodySizeLimit: v2 ? BODY_SIZE_LIMIT_V2 : BODY_SIZE_LIMIT_V1,
      });
    } catch (err) {
      res.statusCode = err.status || 400;
      res.end('Invalid request body');
      return;
    }

    await setResponse(
      res,
      await server.respond(request, {
        platform: res.locals,
        getClientAddress() {
          return (
            (<string>req.headers['X-Forwarded-For']).split(',')[0] ||
            req.socket?.remoteAddress
          );
        },
      })
    );
  };
}

function getOrigin(headers) {
  const protocol = 'https';
  const host = headers['host'];
  return `${protocol}://${host}`;
}
