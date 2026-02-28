/**
 * Express Router for AuraSkill AI API
 * Converts Vite middleware handlers to Express routes
 */

import { Router } from 'express';
import admin from 'firebase-admin';

// Import Firestore services
import {
    userService,
    interviewService,
    practiceAptitudeService,
    resumeService,
    careerPlanService,
    gapAnalysisService,
    learningRoadmapService,
    narrativeCacheService,
    userSkillProfileService,
    generateId,
    hashPassword,
    verifyPassword
} from './firestoreDAL';

import { runGapAnalysis, generateCacheKey } from './matchingEngine';
import { generateLearningRoadmap } from './roadmapGenerator';

const router = Router();

// ==================== ADMIN CONFIGURATION ====================
const ADMIN_EMAILS = ['admin@auraskills.com', 'admin@vidyamitra.com'];

// Token cache for performance
const tokenCache = new Map<string, { userId: string; email: string; isAdmin: boolean; name: string; expiresAt: number }>();

// ==================== AUTH MIDDLEWARE ====================
export async function getFirebaseSession(authHeader: string): Promise<{ userId: string; email: string; isAdmin: boolean; name: string } | null> {
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) return null;
    
    // Check cache
    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        return cached;
    }
    
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        let isAdmin = ADMIN_EMAILS.includes(decodedToken.email || '');
        let name = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';
        
        try {
            const userData = await userService.getById(decodedToken.uid);
            if (userData) {
                isAdmin = userData.isAdmin || isAdmin;
                name = userData.name || name;
            }
        } catch {
            // Use defaults if Firestore lookup fails
        }
        
        const session = {
            userId: decodedToken.uid,
            email: decodedToken.email || '',
            isAdmin,
            name
        };
        
        // Cache for 5 minutes
        tokenCache.set(token, { ...session, expiresAt: Date.now() + 5 * 60 * 1000 });
        
        return session;
    } catch {
        return null;
    }
}

// ==================== AUTH ROUTES ====================

router.post('/auth/firebase', async (req, res) => {
    try {
        const { idToken } = req.body;
        
        if (!idToken) {
            return res.status(400).json({ error: 'ID token required' });
        }
        
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Check if user exists in Firestore
        let user = await userService.getById(decodedToken.uid);
        
        if (!user) {
            // Create new user in Firestore
            user = {
                id: decodedToken.uid,
                email: decodedToken.email || '',
                name: decodedToken.name || '',
                isAdmin: ADMIN_EMAILS.includes(decodedToken.email || ''),
                created_at: new Date().toISOString(),
                password_hash: '' // Not used for Firebase Auth
            };
            await userService.create(user);
        }
        
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                isAdmin: user.isAdmin || false
            }
        });
    } catch (error: any) {
        console.error('Firebase auth error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
});

// ==================== GAP ANALYSIS ROUTES ====================

router.post('/analysis/run', async (req, res) => {
    try {
        const session = await getFirebaseSession(req.headers.authorization || '');
        
        if (!session) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const { targetRole } = req.body;
        
        if (!targetRole) {
            return res.status(400).json({ error: 'Target role required' });
        }
        
        console.log(`🔍 Running gap analysis for ${session.email} targeting ${targetRole}`);
        
        // Run gap analysis
        const analysis = await runGapAnalysis(session.userId, targetRole);
        
        res.json({ analysis });
    } catch (error: any) {
        console.error('Gap analysis error:', error);
        res.status(500).json({ error: error.message || 'Analysis failed' });
    }
});

router.get('/analysis/:userId', async (req, res) => {
    try {
        const session = await getFirebaseSession(req.headers.authorization || '');
        
        if (!session) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (session.userId !== req.params.userId && !session.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const analyses = await gapAnalysisService.getByUser(req.params.userId);
        
        if (!analyses || analyses.length === 0) {
            return res.status(404).json({ error: 'No analysis found' });
        }
        
        res.json({ analysis: analyses[0] });
    } catch (error: any) {
        console.error('Get analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== ROADMAP ROUTES ====================

router.post('/roadmap/generate', async (req, res) => {
    try {
        const session = await getFirebaseSession(req.headers.authorization || '');
        
        if (!session) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const { targetRole, gapAnalysisId } = req.body;
        
        if (!targetRole || !gapAnalysisId) {
            return res.status(400).json({ error: 'Target role and gap analysis ID required' });
        }
        
        console.log(`📚 Generating roadmap for ${session.email}`);
        
        // Get gap analysis
        const analysis = await gapAnalysisService.getById(gapAnalysisId);
        
        if (!analysis || analysis.user_id !== session.userId) {
            return res.status(404).json({ error: 'Gap analysis not found' });
        }
        
        // Generate roadmap
        const roadmap = await generateLearningRoadmap(
            session.userId,
            targetRole,
            analysis.skill_gaps,
            gapAnalysisId
        );
        
        res.json({ roadmap });
    } catch (error: any) {
        console.error('Roadmap generation error:', error);
        res.status(500).json({ error: error.message || 'Roadmap generation failed' });
    }
});

router.get('/roadmap/:userId', async (req, res) => {
    try {
        const session = await getFirebaseSession(req.headers.authorization || '');
        
        if (!session) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (session.userId !== req.params.userId && !session.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const roadmaps = await learningRoadmapService.getByUser(req.params.userId);
        
        if (!roadmaps || roadmaps.length === 0) {
            return res.status(404).json({ error: 'No roadmap found' });
        }
        
        res.json({ roadmap: roadmaps[0] });
    } catch (error: any) {
        console.error('Get roadmap error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== RESUME ROUTES ====================

router.get('/resumes/:userId', async (req, res) => {
    try {
        const session = await getFirebaseSession(req.headers.authorization || '');
        
        if (!session) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (session.userId !== req.params.userId && !session.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const resumes = await resumeService.getByUser(req.params.userId);
        
        res.json({ resumes });
    } catch (error: any) {
        console.error('Get resumes error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== CAREER PLANS ROUTES ====================

router.get('/career-plans/:userId', async (req, res) => {
    try {
        const session = await getFirebaseSession(req.headers.authorization || '');
        
        if (!session) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (session.userId !== req.params.userId && !session.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const plans = await careerPlanService.getByUser(req.params.userId);
        
        res.json({ plans });
    } catch (error: any) {
        console.error('Get career plans error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== INTERVIEWS ROUTES ====================

router.get('/interviews/:userId', async (req, res) => {
    try {
        const session = await getFirebaseSession(req.headers.authorization || '');
        
        if (!session) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (session.userId !== req.params.userId && !session.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const interviews = await interviewService.getByUser(req.params.userId);
        
        res.json({ interviews });
    } catch (error: any) {
        console.error('Get interviews error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== PRACTICE ROUTES ====================

router.get('/practice/aptitude/:userId', async (req, res) => {
    try {
        const session = await getFirebaseSession(req.headers.authorization || '');
        
        if (!session) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (session.userId !== req.params.userId && !session.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const sessions = await practiceAptitudeService.getByUser(req.params.userId);
        
        res.json({ sessions });
    } catch (error: any) {
        console.error('Get practice aptitude error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
