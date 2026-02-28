/**
 * Firestore Data Access Layer for AuraSkill AI
 * Replaces all SQLite operations with Firestore
 */

import { getFirebaseAdmin } from './firebaseAdmin';
import admin from 'firebase-admin';
import crypto from 'crypto';

type Firestore = admin.firestore.Firestore;

/**
 * Get Firestore instance
 */
export function getFirestore(): Firestore {
  return getFirebaseAdmin().firestore();
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return getFirestore().collection('_').doc().id;
}

/**
 * Password hashing (compatible with SQLite version)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verify;
}

/**
 * User Operations
 */
export const userService = {
  async getByEmail(email: string) {
    const snapshot = await getFirestore()
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  },

  async getById(id: string) {
    const doc = await getFirestore().collection('users').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async getAll() {
    const snapshot = await getFirestore().collection('users').orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async count() {
    const snapshot = await getFirestore().collection('users').count().get();
    return snapshot.data().count;
  }
};

/**
 * Interview Operations
 */
export const interviewService = {
  async getAll() {
    const snapshot = await getFirestore().collection('interviews').orderBy('created_at', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getByUser(userId: string) {
    const snapshot = await getFirestore()
      .collection('interviews')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async create(data: any) {
    const docRef = getFirestore().collection('interviews').doc(data.id);
    await docRef.set({
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return data.id;
  },

  async delete(id: string) {
    await getFirestore().collection('interviews').doc(id).delete();
  },

  async count() {
    const snapshot = await getFirestore().collection('interviews').count().get();
    return snapshot.data().count;
  },

  async countCompleted() {
    const snapshot = await getFirestore()
      .collection('interviews')
      .where('completed', '==', 1)
      .count()
      .get();
    return snapshot.data().count;
  },

  async getAverageScore() {
    const snapshot = await getFirestore()
      .collection('interviews')
      .where('completed', '==', 1)
      .where('score', '!=', null)
      .get();
    
    if (snapshot.empty) return 0;
    
    const scores = snapshot.docs.map(doc => doc.data().score).filter(s => s != null);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }
};

/**
 * Practice Aptitude Operations
 */
export const practiceAptitudeService = {
  async getByUser(userId: string, limit = 50) {
    const snapshot = await getFirestore()
      .collection('practiceAptitude')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async create(data: any) {
    const docRef = getFirestore().collection('practiceAptitude').doc(data.id);
    await docRef.set({
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return data.id;
  },

  async count(userId: string) {
    const snapshot = await getFirestore()
      .collection('practiceAptitude')
      .where('user_id', '==', userId)
      .count()
      .get();
    return snapshot.data().count;
  }
};

/**
 * Practice Interviews Operations
 */
export const practiceInterviewService = {
  async getByUser(userId: string, limit = 50) {
    const snapshot = await getFirestore()
      .collection('practiceInterviews')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async create(data: any) {
    const docRef = getFirestore().collection('practiceInterviews').doc(data.id);
    await docRef.set({
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return data.id;
  }
};

/**
 * Bot Interview Operations
 */
export const botInterviewService = {
  async getByUser(userId: string, limit = 50) {
    const snapshot = await getFirestore()
      .collection('botInterviews')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async create(data: any) {
    const docRef = getFirestore().collection('botInterviews').doc(data.id);
    await docRef.set({
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return data.id;
  }
};

/**
 * Practice Coding Operations
 */
export const practiceCodingService = {
  async getByUser(userId: string, limit = 50) {
    const snapshot = await getFirestore()
      .collection('practiceCoding')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async createOrUpdate(data: any) {
    const docRef = getFirestore().collection('practiceCoding').doc(data.id);
    await docRef.set({
      ...data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return data.id;
  },

  async count(userId: string) {
    const snapshot = await getFirestore()
      .collection('practiceCoding')
      .where('user_id', '==', userId)
      .count()
      .get();
    return snapshot.data().count;
  }
};

/**
 * Resume Operations
 */
export const resumeService = {
  async getByUser(userId: string) {
    const snapshot = await getFirestore()
      .collection('resumes')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async create(data: any) {
    const docRef = getFirestore().collection('resumes').doc(data.id);
    await docRef.set({
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return data.id;
  },

  async count(userId: string) {
    const snapshot = await getFirestore()
      .collection('resumes')
      .where('user_id', '==', userId)
      .count()
      .get();
    return snapshot.data().count;
  }
};

/**
 * Round1 Aptitude Operations
 */
export const round1AptitudeService = {
  async getAll() {
    const snapshot = await getFirestore()
      .collection('round1Aptitude')
      .orderBy('created_at', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async getByUser(userId: string) {
    const snapshot = await getFirestore()
      .collection('round1Aptitude')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async create(data: any) {
    const docRef = getFirestore().collection('round1Aptitude').doc(data.id);
    await docRef.set({
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return data.id;
  },

  async update(id: string, updates: any) {
    const docRef = getFirestore().collection('round1Aptitude').doc(id);
    await docRef.update({
      ...updates,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }
};

/**
 * Career Plans Operations
 */
export const careerPlanService = {
  async getByUser(userId: string) {
    const snapshot = await getFirestore()
      .collection('careerPlans')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async create(data: any) {
    const docRef = getFirestore().collection('careerPlans').doc(data.id);
    await docRef.set({
      ...data,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return data.id;
  }
};

/**
 * Resume Build Operations
 */
export const resumeBuildService = {
  async getByUser(userId: string) {
    const snapshot = await getFirestore()
      .collection('resumeBuilds')
      .where('user_id', '==', userId)
      .orderBy('updated_at', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async createOrUpdate(data: any) {
    const docRef = getFirestore().collection('resumeBuilds').doc(data.id);
    await docRef.set({
      ...data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return data.id;
  }
};

/**
 * Roles Operations
 */
export const roleService = {
  async getAll() {
    const snapshot = await getFirestore().collection('roles').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async createOrUpdate(data: any) {
    const docRef = getFirestore().collection('roles').doc(data.id);
    await docRef.set({
      ...data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return data.id;
  }
};

/**
 * Gap Analysis Operations
 */
export const gapAnalysisService = {
  async getByUser(userId: string) {
    const snapshot = await getFirestore()
      .collection('gapAnalyses')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  },

  async getById(id: string) {
    const doc = await getFirestore().collection('gapAnalyses').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async createOrUpdate(data: any) {
    const docRef = getFirestore().collection('gapAnalyses').doc(data.id);
    await docRef.set({
      ...data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return data.id;
  }
};

/**
 * Learning Roadmap Operations
 */
export const learningRoadmapService = {
  async getByGapAnalysis(gapAnalysisId: string) {
    const snapshot = await getFirestore()
      .collection('learningRoadmaps')
      .where('gap_analysis_id', '==', gapAnalysisId)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  },

  async createOrUpdate(data: any) {
    const docRef = getFirestore().collection('learningRoadmaps').doc(data.id);
    await docRef.set({
      ...data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return data.id;
  }
};

/**
 * AI Narrative Cache Operations
 */
export const narrativeCacheService = {
  async get(cacheKey: string) {
    const doc = await getFirestore().collection('aiNarrativeCache').doc(cacheKey).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async set(cacheKey: string, narrative: string, metadata: any) {
    const docRef = getFirestore().collection('aiNarrativeCache').doc(cacheKey);
    await docRef.set({
      cache_key: cacheKey,
      narrative,
      metadata: JSON.stringify(metadata),
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }
};

/**
 * User Skill Profile Operations
 */
export const userSkillProfileService = {
  async getByUser(userId: string) {
    const doc = await getFirestore().collection('userSkillProfiles').doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },

  async createOrUpdate(userId: string, data: any) {
    const docRef = getFirestore().collection('userSkillProfiles').doc(userId);
    await docRef.set({
      user_id: userId,
      ...data,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return userId;
  }
};

// Export all services
export default {
  getFirestore,
  generateId,
  hashPassword,
  verifyPassword,
  userService,
  interviewService,
  practiceAptitudeService,
  practiceInterviewService,
  botInterviewService,
  practiceCodingService,
  resumeService,
  round1AptitudeService,
  careerPlanService,
  resumeBuildService,
  roleService,
  gapAnalysisService,
  learningRoadmapService,
  narrativeCacheService,
  userSkillProfileService,
};
