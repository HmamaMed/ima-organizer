import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, type StorageReference } from 'firebase/storage';

/**
 * Firebase client SDK for direct-to-Storage media uploads (photos, audio).
 *
 * Config comes from Vite env vars (VITE_FIREBASE_*). If they're not set, the
 * module degrades gracefully — uploads will throw a clear error rather than
 * crashing the app.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    if (!firebaseConfig.projectId) {
      throw new Error('Firebase is not configured. Set VITE_FIREBASE_* env vars.');
    }
    app = initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Uploads a Blob to Firebase Storage under the given path and returns its
 * download URL.
 */
export async function uploadToStorage(path: string, blob: Blob): Promise<string> {
  const storage = getStorage(getApp());
  const ref_: StorageReference = ref(storage, path);
  await uploadBytes(ref_, blob);
  return getDownloadURL(ref_);
}
