import admin from "firebase-admin";
let app: admin.app.App | null = null;
export function getFirebase() {
  if (app) return app;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
  } else {
    app = admin.initializeApp();
  }
  return app;
}
export async function verifyIdToken(idToken: string) {
  const fb = getFirebase();
  return fb.auth().verifyIdToken(idToken);
}