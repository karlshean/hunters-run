import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { config } from './environment';

export class FirebaseService {
  private static instance: admin.app.App;
  
  public static initialize(): admin.app.App {
    if (FirebaseService.instance) {
      return FirebaseService.instance;
    }
    
    try {
      let credential: admin.credential.Credential;
      
      // Production preference: JSON over file path for containerized environments
      if (config.NODE_ENV === 'production' && config.FIREBASE_SERVICE_ACCOUNT_JSON) {
        console.log('🔑 Initializing Firebase with service account JSON (production)');
        const serviceAccount = JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_JSON);
        credential = admin.credential.cert(serviceAccount);
      } else if (config.FIREBASE_SERVICE_ACCOUNT_PATH) {
        console.log('🔑 Initializing Firebase with service account file');
        const serviceAccount = JSON.parse(readFileSync(config.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
        credential = admin.credential.cert(serviceAccount);
      } else if (config.FIREBASE_SERVICE_ACCOUNT_JSON) {
        console.log('🔑 Initializing Firebase with service account JSON');
        const serviceAccount = JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_JSON);
        credential = admin.credential.cert(serviceAccount);
      } else {
        throw new Error('Firebase service account configuration missing');
      }
      
      FirebaseService.instance = admin.initializeApp({
        credential,
        projectId: config.FIREBASE_PROJECT_ID
      });
      
      console.log(`✅ Firebase initialized for project: ${config.FIREBASE_PROJECT_ID}`);
      return FirebaseService.instance;
      
    } catch (error: any) {
      console.error('❌ Firebase initialization failed:', error.message);
      throw new Error(`Firebase configuration error: ${error.message}`);
    }
  }
  
  public static getAuth(): admin.auth.Auth {
    if (!FirebaseService.instance) {
      throw new Error('Firebase not initialized. Call FirebaseService.initialize() first.');
    }
    return FirebaseService.instance.auth();
  }
  
  public static async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    const auth = FirebaseService.getAuth();
    return await auth.verifyIdToken(idToken);
  }
  
  public static async getUser(uid: string): Promise<admin.auth.UserRecord> {
    const auth = FirebaseService.getAuth();
    return await auth.getUser(uid);
  }
}