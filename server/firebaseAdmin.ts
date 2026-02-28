/**
 * Firebase Admin SDK Configuration (Server-Side)
 * Used for backend operations and token verification
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let adminApp: admin.app.App | null = null;

export function initializeFirebaseAdmin(): admin.app.App {
  if (adminApp) {
    return adminApp;
  }

  try {
    // Load service account from file
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-admin-key.json';
    const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Firebase service account file not found at: ${absolutePath}`);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
      storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log('   Project ID:', serviceAccount.project_id);
    console.log('   Storage Bucket:', `${serviceAccount.project_id}.firebasestorage.app`);
    
    return adminApp;
  } catch (error: any) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    throw error;
  }
}

export function getFirebaseAdmin(): admin.app.App {
  if (!adminApp) {
    return initializeFirebaseAdmin();
  }
  return adminApp;
}

// Verify Firebase ID token
export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken | null> {
  try {
    const app = getFirebaseAdmin();
    const decodedToken = await app.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}

// Get user by UID
export async function getFirebaseUser(uid: string): Promise<admin.auth.UserRecord | null> {
  try {
    const app = getFirebaseAdmin();
    const user = await app.auth().getUser(uid);
    return user;
  } catch (error) {
    return null;
  }
}

// Create admin user if doesn't exist
export async function ensureAdminUser(email: string, password: string): Promise<void> {
  try {
    const app = getFirebaseAdmin();
    
    // Check if user exists
    try {
      const existingUser = await app.auth().getUserByEmail(email);
      console.log('✅ Admin user already exists:', email);
      
      // Make sure user is in Firestore with admin flag
      const db = app.firestore();
      await db.collection('users').doc(existingUser.uid).set({
        id: existingUser.uid,
        email: email,
        name: 'Admin',
        isAdmin: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      
      return;
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create new admin user
    const userRecord = await app.auth().createUser({
      email: email,
      password: password,
      displayName: 'Admin',
      emailVerified: true,
    });

    console.log('✅ Created admin user:', email);

    // Add to Firestore
    const db = app.firestore();
    await db.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email: email,
      name: 'Admin',
      isAdmin: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Admin user document created in Firestore');
  } catch (error: any) {
    console.error('❌ Failed to ensure admin user:', error.message);
    throw error;
  }
}

export default {
  initialize: initializeFirebaseAdmin,
  getAdmin: getFirebaseAdmin,
  verifyToken: verifyFirebaseToken,
  getUser: getFirebaseUser,
  ensureAdminUser,
};
