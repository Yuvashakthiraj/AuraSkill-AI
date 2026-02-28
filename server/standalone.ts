/**
 * AuraSkill AI - Standalone Express Server
 * Can be deployed to Render, Railway, or any Node.js hosting
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeFirebaseAdmin } from './firebaseAdmin';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// ==================== INITIALIZE FIREBASE ====================
try {
    initializeFirebaseAdmin();
    console.log('✅ Firebase Admin initialized');
} catch (error: any) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
    process.exit(1);
}

// ==================== API KEYS ====================
const API_KEYS = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
    PEXELS_API_KEY: process.env.PEXELS_API_KEY || '',
    NEWS_API_KEY: process.env.NEWS_API_KEY || '',
    EXCHANGE_RATE_API_KEY: process.env.EXCHANGE_RATE_API_KEY || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    JUDGE0_API_KEY: process.env.JUDGE0_API_KEY || '',
    JUDGE0_BASE_URL: process.env.JUDGE0_HOST || '',
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    GROQ_API_KEY_2: process.env.GROQ_API_KEY_2 || '',
    GROQ_API_KEY_3: process.env.GROQ_API_KEY_3 || '',
    GROQ_SKILL_TRENDS_KEY: process.env.GROQ_SKILL_TRENDS_KEY || process.env.GROQ_API_KEY || '',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
};

console.log('✅ AuraSkill AI API server initialized');
console.log('  Gemini:', API_KEYS.GEMINI_API_KEY ? '✅' : '❌');
console.log('  YouTube:', API_KEYS.YOUTUBE_API_KEY ? '✅' : '❌');
console.log('  Pexels:', API_KEYS.PEXELS_API_KEY ? '✅' : '❌');
console.log('  News:', API_KEYS.NEWS_API_KEY ? '✅' : '❌');
console.log('  Exchange:', API_KEYS.EXCHANGE_RATE_API_KEY ? '✅' : '❌');
const groqKeysCount = [API_KEYS.GROQ_API_KEY, API_KEYS.GROQ_API_KEY_2, API_KEYS.GROQ_API_KEY_3].filter(k => k).length;
console.log('  Groq:', groqKeysCount > 0 ? `✅ (${groqKeysCount} keys)` : '❌');
console.log('  ElevenLabs:', API_KEYS.ELEVENLABS_API_KEY ? '✅' : '❌');
console.log('  Judge0:', API_KEYS.JUDGE0_BASE_URL ? `✅ (${API_KEYS.JUDGE0_BASE_URL})` : '❌');

// ==================== IMPORT API ROUTES ====================
import apiRouter from './expressRouter.js';

// Mount API routes
app.use('/api', apiRouter);

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        services: {
            firebase: '✅',
            groq: API_KEYS.GROQ_API_KEY ? '✅' : '❌',
            gemini: API_KEYS.GEMINI_API_KEY ? '✅' : '❌'
        }
    });
});

app.get('/', (req, res) => {
    res.json({
        name: 'AuraSkill AI API Server',
        version: '2.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            auth: '/api/auth/*',
            analysis: '/api/analysis/*',
            roadmap: '/api/roadmap/*',
            resumes: '/api/resumes/*',
            interviews: '/api/interviews/*',
            practice: '/api/practice/*'
        }
    });
});

// ==================== ERROR HANDLING ====================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('❌ Error:', err.message);
    res.status(500).json({
        error: err.message || 'Internal server error'
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`🚀 AuraSkill AI API Server running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

export default app;
