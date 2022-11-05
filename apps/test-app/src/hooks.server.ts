import type { Cookies, Handle } from '@sveltejs/kit';
import { ONE_DAY_IN_SECONDS, ONE_WEEK_IN_SECONDS } from '$lib/constants';
import {
  createSessionCookieForUserId,
  getIdTokenFromSessionCookie,
} from './lib/server/firebase';

import type { DecodedIdToken } from 'firebase-admin/auth';

const SIX_DAYS_IN_SECONDS = ONE_DAY_IN_SECONDS * 6;

export const handle: Handle = async ({ event, resolve }) => {
  console.log('------------------------------------');
  console.log(event.platform);
  console.log('------------------------------------');
  if (event.cookies.get('session')) {
    const token = await getIdTokenFromSessionCookie(
      event.cookies.get('session') || null
    );

    event.locals.user = token ? { id: token.uid, email: token.email } : null;

    if (token && shouldRefreshToken(token)) {
      await updateSessionCookie(token, event.cookies);
    }
  }

  return resolve(event);
};

const shouldRefreshToken = (token: DecodedIdToken | null) =>
  token && token.exp - Date.now() / 1000 < SIX_DAYS_IN_SECONDS;

async function updateSessionCookie(token: DecodedIdToken, cookies: Cookies) {
  const freshSessionCookie = await createSessionCookieForUserId(
    token.uid,
    ONE_WEEK_IN_SECONDS
  );

  cookies.set('session', freshSessionCookie, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    maxAge: ONE_WEEK_IN_SECONDS,
  });
}
