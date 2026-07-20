import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let isInitialized = false;

export function initFirebaseAdmin() {
  if (isInitialized || getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'chatapp-47b9d';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (clientEmail && privateKey && privateKey !== 'YOUR_FIREBASE_PRIVATE_KEY') {
    try {
      const app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      isInitialized = true;
      console.log('Firebase Admin initialized with service account.');
      return app;
    } catch (err) {
      console.warn('Firebase Admin cert init failed, falling back to projectId init:', err);
    }
  }

  try {
    const app = initializeApp({
      projectId,
    });
    isInitialized = true;
    console.log(`Firebase Admin initialized with projectId: ${projectId}`);
    return app;
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
    return getApp();
  }
}

export async function verifyFirebaseIdToken(idToken: string) {
  const app = initFirebaseAdmin();
  const auth = getAuth(app);
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    throw new Error('Invalid Firebase ID token');
  }
}
