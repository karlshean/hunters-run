import admin from "firebase-admin";
let app: admin.app.App | null = null;
export function getFirebase() {
  if (app) return app;
  
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const nodeEnv = process.env.NODE_ENV;
  
  // Production preference: Use FIREBASE_SERVICE_ACCOUNT_JSON for containerized environments
  if (nodeEnv === 'production' && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.log('🔑 Initializing Firebase with service account JSON (production)');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.log('🔑 Initializing Firebase with service account file');
    app = admin.initializeApp({
      credential: admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH),
      projectId
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.log('🔑 Initializing Firebase with service account JSON');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId
    });
  } else {
    // Fallback to environment variables
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    if (projectId && clientEmail && privateKey) {
      console.log('🔑 Initializing Firebase with individual env vars');
      app = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey })
      });
    } else {
      console.log('🔑 Initializing Firebase with default credentials');
      app = admin.initializeApp();
    }
  }
  return app;
}
export async function verifyIdToken(idToken: string) {
  const fb = getFirebase();
  return fb.auth().verifyIdToken(idToken);
}