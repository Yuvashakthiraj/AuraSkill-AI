/**
 * Firebase Service Layer for VidyaMitra
 * Provides clean interfaces for Firebase operations
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
  UserCredential,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryConstraint,
  addDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';

// ==================== TYPES ====================
export interface User {
  id: string;
  email: string;
  name?: string;
  isAdmin: boolean;
  targetRole?: string;
  skills?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ==================== AUTHENTICATION ====================
export const firebaseAuthService = {
  // Sign up new user
  async signup(email: string, password: string, displayName?: string): Promise<UserCredential> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      id: userCredential.user.uid,
      email: email,
      name: displayName || email.split('@')[0],
      isAdmin: email === 'admin@auraskills.com', // Auto-set admin
      targetRole: null,
      skills: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    return userCredential;
  },

  // Sign in existing user
  async signin(email: string, password: string): Promise<UserCredential> {
    return await signInWithEmailAndPassword(auth, email, password);
  },

  // Sign out
  async signout(): Promise<void> {
    return await firebaseSignOut(auth);
  },

  // Get current user
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },

  // Reset password
  async resetPassword(email: string): Promise<void> {
    return await send

PasswordResetEmail(auth, email);
  },

  // Get ID token for API calls
  async getIdToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  },
};

// ==================== FIRESTORE OPERATIONS ====================
export const firestoreService = {
  // Generic CRUD operations
  async getDocument<T = DocumentData>(collectionName: string, docId: string): Promise<T | null> {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as T) : null;
  },

  async setDocument(collectionName: string, docId: string, data: Record<string, unknown>): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  async addDocument(collectionName: string, data: Record<string, unknown>): Promise<string> {
    const colRef = collection(db, collectionName);
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateDocument(collectionName: string, docId: string, data: Record<string, unknown>): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteDocument(collectionName: string, docId: string): Promise<void> {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  },

  async queryDocuments<T = DocumentData>(
    collectionName: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    const colRef = collection(db, collectionName);
    const q = query(colRef, ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  },

  // Batch operations
  async batchWrite(operations: Array<{
    type: 'set' | 'update' | 'delete';
    collection: string;
    docId: string;
    data?: Record<string, unknown>;
  }>): Promise<void> {
    const batch = writeBatch(db);
    
    operations.forEach(op => {
      const docRef = doc(db, op.collection, op.docId);
      
      if (op.type === 'set') {
        batch.set(docRef, { ...op.data, updatedAt: serverTimestamp() });
      } else if (op.type === 'update') {
        batch.update(docRef, { ...op.data, updatedAt: serverTimestamp() });
      } else if (op.type === 'delete') {
        batch.delete(docRef);
      }
    });
    
    await batch.commit();
  },
};

// ==================== HELPER FUNCTIONS ====================
export { where, orderBy, limit, Timestamp };

// ==================== API WRAPPER FUNCTIONS ====================
// Import API functions for backend communication
import {
  interviewsApi,
  practiceAptitudeApi,
  practiceInterviewsApi,
  botInterviewsApi,
  practiceCodingApi,
  resumesApi,
  round1Api,
} from './api';

// Types for interview results
export interface PracticeAptitudeResult {
  id?: string;
  userId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  answers: any[];
  completedAt: Date;
}

export interface PracticeInterviewResult {
  id?: string;
  userId: string;
  role: string;
  questions: any[];
  answers: any[];
  overallFeedback?: string;
  score?: number;
  completedAt: Date;
}

export interface BotInterviewResult {
  id?: string;
  userId: string;
  role: string;
  transcript: string;
  duration: number;
  feedback?: string;
  score?: number;
  completedAt: Date;
}

// ==================== INTERVIEW FUNCTIONS ====================
export async function saveInterview(interview: any, userId: string) {
  return await interviewsApi.save({ ...interview, userId });
}

export async function getInterview(interviewId: string) {
  // Get all interviews and find by ID
  const response = await interviewsApi.getAll();
  const interviews = response?.interviews || [];
  return interviews.find((i: any) => i.id === interviewId);
}

export async function getUserInterviews(userId: string) {
  const response = await interviewsApi.getAll();
  return response?.interviews || [];
}

export async function updateInterview(interviewId: string, updates: any) {
  // Not yet supported by backend, would need PATCH endpoint
  console.warn('updateInterview not yet implemented on backend');
  return Promise.resolve();
}

export async function deleteInterview(interviewId: string) {
  return await interviewsApi.delete(interviewId);
}

export async function getAllInterviews() {
  const response = await interviewsApi.getAll(true);
  return response?.interviews || [];
}

// ==================== PRACTICE APTITUDE FUNCTIONS ====================
export async function savePracticeAptitudeResult(result: PracticeAptitudeResult) {
  return await practiceAptitudeApi.save(result);
}

export async function getPracticeAptitudeHistory(userId: string) {
  const response = await practiceAptitudeApi.getHistory();
  return response?.results || [];
}

// ==================== PRACTICE INTERVIEW FUNCTIONS ====================
export async function savePracticeInterviewResult(result: PracticeInterviewResult) {
  return await practiceInterviewsApi.save(result);
}

export async function getPracticeInterviewHistory(userId: string) {
  const response = await practiceInterviewsApi.getHistory();
  return response?.results || [];
}

// ==================== BOT INTERVIEW FUNCTIONS ====================
export async function saveBotInterviewResult(result: BotInterviewResult) {
  return await botInterviewsApi.save(result);
}

export async function getBotInterviewHistory(userId: string) {
  const response = await botInterviewsApi.getHistory();
  return response?.results || [];
}

export async function getAllBotInterviews() {
  const response = await botInterviewsApi.getAll(true);
  return response?.results || [];
}

// ==================== PRACTICE CODING FUNCTIONS ====================
export async function savePracticeCodingResult(session: any) {
  return await practiceCodingApi.save(session);
}

// ==================== ROUND 1 APTITUDE FUNCTIONS ====================
export async function saveRound1AptitudeResult(result: any) {
  return await round1Api.save(result);
}

export async function getRound1AptitudeResults(userId?: string) {
  const response = await round1Api.getResults(!!userId);
  return response?.results || [];
}

export async function updateRound1AptitudeResult(id: string, updates: any) {
  return await round1Api.update(id, updates);
}

export default {
  auth: firebaseAuthService,
  firestore: firestoreService,
};
