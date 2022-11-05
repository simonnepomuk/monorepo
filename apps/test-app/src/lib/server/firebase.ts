import type { App, AppOptions } from 'firebase-admin/app';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAuth } from 'firebase-admin/auth';
import {
  FIREBASE_ADMIN_CLIENT_EMAIL,
  FIREBASE_ADMIN_PRIVATE_KEY,
} from '$env/static/private';
import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_PROJECT_ID,
} from '$env/static/public';

const projectId = PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const apiKey = PUBLIC_FIREBASE_API_KEY;

if (!projectId || !clientEmail || !privateKey || !apiKey) {
  console.log(process.env);
  console.log(projectId, clientEmail, privateKey, apiKey);
  //throw new Error('Firebase Admin environment variables not set');
}

const adminConfig: AppOptions = {
  projectId: 'sveltekit-adapter',
};
export const getAdminApp = (): App =>
  getApps().length ? getApp() : initializeApp(adminConfig);

export const createSessionCookie = async (token: string, maxAge: number) => {
  const expiresIn = maxAge * 1000;
  const auth = getAuth(getAdminApp());
  return await auth.createSessionCookie(token, {
    expiresIn,
  });
};

export const createSessionCookieForUserId = async (
  userId: string,
  maxAge: number
) => {
  const auth = getAuth(getAdminApp());

  const customToken = await auth.createCustomToken(userId, {});
  const firebaseIdToken = await fetch(
    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  )
    .then((res) => res.json())
    .then((res) => res.idToken);

  return createSessionCookie(firebaseIdToken, maxAge);
};

export const verifyIdToken = (token: string): Promise<DecodedIdToken> => {
  const auth = getAuth(getAdminApp());
  return auth.verifyIdToken(token);
};

export const getIdTokenFromSessionCookie = async (
  sessionCookie: string | null
): Promise<DecodedIdToken | null> => {
  if (!sessionCookie) return null;

  const auth = getAuth(getAdminApp());

  return auth.verifySessionCookie(sessionCookie, true).catch(() => null);
};
