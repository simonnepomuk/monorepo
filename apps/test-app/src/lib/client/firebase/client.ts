import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  setPersistence,
  signInWithEmailLink,
  inMemoryPersistence,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_PROJECT_ID,
} from '$env/static/public';

const firebaseConfig: FirebaseOptions = {
  apiKey: PUBLIC_FIREBASE_API_KEY,
  authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: PUBLIC_FIREBASE_PROJECT_ID,
};
export const getClientApp: () => Promise<FirebaseApp> = async () => {
  if (getApps().length) return getApp();
  console.log(firebaseConfig);

  const clientApp = initializeApp(firebaseConfig);
  const auth = getAuth(clientApp);
  connectAuthEmulator(auth, 'http://localhost:9099');
  await setPersistence(auth, inMemoryPersistence);

  return clientApp;
};

export const isMagicLink = async (link: string) => {
  const auth = getAuth(await getClientApp());

  return isSignInWithEmailLink(auth, link);
};

export const signInWithMagicLink = async (email: string, link: string) => {
  const auth = getAuth(await getClientApp());

  return signInWithEmailLink(auth, email, link);
};

export const sendMagicLink = async (email: string, redirectUrl: string) => {
  const auth = getAuth(await getClientApp());
  const actionCodeSettings = {
    url: redirectUrl,
    handleCodeInApp: true,
  };
  return sendSignInLinkToEmail(auth, email, actionCodeSettings);
};
