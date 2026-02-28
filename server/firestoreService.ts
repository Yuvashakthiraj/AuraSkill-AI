/**
 * Firestore Database Service for VidyaMitra
 * Provides SQLite-compatible API using Firestore collections
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getFirebaseAdmin, ensureAdminUser } from './firebaseAdmin';
import admin from 'firebase-admin';
import crypto from 'crypto';

type Firestore = admin.firestore.Firestore;
type FieldValue = typeof admin.firestore.FieldValue;

/**
 * Get Firestore instance
 */
export function getDb(): Firestore {
  const app = getFirebaseAdmin();
  return app.firestore();
}

/**
 * Generate unique ID (compatible with Firestore auto-IDs)
 */
export function generateId(): string {
  return getDb().collection('_').doc().id;
}

/**
 * Hash password using bcrypt-compatible method
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify password
 */
export function verifyPassword(password: string, hash: string): boolean {
  const testHash = hashPassword(password);
  return testHash === hash;
}

/**
 * Initialize Firestore schema and create admin user
 */
export async function initializeSchema(): Promise<void> {
  console.log('🔥 Initializing Firestore schema...');
  
  // Firestore doesn't need explicit schema creation
  // Collections are created automatically when documents are added
  
  // Create admin user
  await seedAdminUser();
  
  console.log('✅ Firestore schema initialized');
}

/**
 * Create default admin user
 */
export async function seedAdminUser(): Promise<void> {
  try {
    await ensureAdminUser('admin@auraskills.com', 'admin@123');
    console.log('✅ Admin user ensured: admin@auraskills.com');
  } catch (error: any) {
    console.error('❌ Failed to seed admin user:', error.message);
  }
}

/**
 * Firestore Query Builder (SQLite-compatible interface)
 */
export class FirestoreQueryBuilder {
  private collectionRef: admin.firestore.CollectionReference;
  private query: admin.firestore.Query;

  constructor(collectionName: string) {
    this.collectionRef = getDb().collection(collectionName);
    this.query = this.collectionRef;
  }

  where(field: string, operator: admin.firestore.WhereFilterOp, value: any): this {
    this.query = this.query.where(field, operator, value);
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.query = this.query.orderBy(field, direction);
    return this;
  }

  limit(count: number): this {
    this.query = this.query.limit(count);
    return this;
  }

  async get(): Promise<any[]> {
    const snapshot = await this.query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async getOne(): Promise<any | null> {
    const results = await this.limit(1).get();
    return results[0] || null;
  }
}

/**
 * SQLite-compatible prepare interface for Firestore
 */
export class FirestorePreparedStatement {
  private collectionName: string;
  private type: 'get' | 'insert' | 'update' | 'delete';

  constructor(collectionName: string, type: 'get' | 'insert' | 'update' | 'delete') {
    this.collectionName = collectionName;
    this.type = type;
  }

  get(id: string): any | null {
    // Synchronous get - not ideal but matches SQLite API
    // For async, use collections directly
    throw new Error('Use async methods: getDb().collection().doc().get()');
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    throw new Error('Use async methods: getDb().collection().doc().set()');
  }

  all(...params: any[]): any[] {
    throw new Error('Use async methods: getDb().collection().where().get()');
  }
}

/**
 * Helper: Get user by email
 */
export async function getUserByEmail(email: string): Promise<any | null> {
  const db = getDb();
  const snapshot = await db.collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Helper: Get user by ID
 */
export async function getUserById(id: string): Promise<any | null> {
  const db = getDb();
  const doc = await db.collection('users').doc(id).get();
  
  if (!doc.exists) return null;
  
  return { id: doc.id, ...doc.data() };
}

/**
 * Helper: Create user
 */
export async function createUser(user: {
  email: string;
  password: string;
  name?: string;
  isAdmin?: boolean;
}): Promise<string> {
  const db = getDb();
  const userId = generateId();
  
  await db.collection('users').doc(userId).set({
    id: userId,
    email: user.email,
    password_hash: hashPassword(user.password),
    name: user.name || user.email.split('@')[0],
    is_admin: user.isAdmin || false,
    target_role: null,
    skills: [],
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  return userId;
}

/**
 * Helper: Update user
 */
export async function updateUser(userId: string, updates: any): Promise<void> {
  const db = getDb();
  await db.collection('users').doc(userId).update({
    ...updates,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Export for compatibility with existing code
 */
export default {
  getDb,
  generateId,
  hashPassword,
  verifyPassword,
  initializeSchema,
  seedAdminUser,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
};
