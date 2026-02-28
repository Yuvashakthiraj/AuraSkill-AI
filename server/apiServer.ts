/**
 * AuraSkill AI API Server - Vite Plugin
 * All API keys stay server-side. Frontend calls /api/* endpoints.
 * Rate limiting enforced for free-tier APIs.
 */

import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { loadEnv } from 'vite';
import { initializeFirebaseAdmin } from './firebaseAdmin';
import { runGapAnalysis, type SkillGap, generateCacheKey } from './matchingEngine';
import { generateLearningRoadmap } from './roadmapGenerator';
import admin from 'firebase-admin';

// Import Firestore Data Access Layer
import {
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
    userSkillProfileService
} from './firestoreDAL';

// ==================== TYPES ====================
interface ApiKeys {
    GEMINI_API_KEY: string;
    GEMINI_IMAGE_API_KEY: string;
    YOUTUBE_API_KEY: string;
    PEXELS_API_KEY: string;
    NEWS_API_KEY: string;
    EXCHANGE_RATE_API_KEY: string;
    OPENAI_API_KEY: string;
    JUDGE0_API_KEY: string;
    JUDGE0_API_HOST: string;
    JUDGE0_BASE_URL: string;
    GROQ_API_KEY: string;
    GROQ_SKILL_TRENDS_KEY: string;
    ELEVENLABS_API_KEY: string;
}

// ==================== RATE LIMITING ====================
interface RateBucket {
    timestamps: number[];
    maxPerMinute: number;
    maxPerDay: number;
    dayStart: number;
    dayCount: number;
}

const rateBuckets: Record<string, RateBucket> = {};

function getRateBucket(name: string, maxPerMinute: number, maxPerDay: number): RateBucket {
    if (!rateBuckets[name]) {
        rateBuckets[name] = {
            timestamps: [],
            maxPerMinute,
            maxPerDay,
            dayStart: new Date().setHours(0, 0, 0, 0),
            dayCount: 0,
        };
    }
    return rateBuckets[name];
}

function checkAndRecordRate(bucketName: string, maxPerMinute: number, maxPerDay: number): { ok: boolean; error?: string } {
    const bucket = getRateBucket(bucketName, maxPerMinute, maxPerDay);
    const now = Date.now();

    // Reset daily if new day
    const todayStart = new Date().setHours(0, 0, 0, 0);
    if (todayStart !== bucket.dayStart) {
        bucket.dayCount = 0;
        bucket.dayStart = todayStart;
    }

    // Clean minute window
    bucket.timestamps = bucket.timestamps.filter(t => t > now - 60000);

    if (bucket.timestamps.length >= bucket.maxPerMinute) {
        return { ok: false, error: `Rate limit: max ${bucket.maxPerMinute} requests/min for ${bucketName}. Wait a moment.` };
    }
    if (bucket.dayCount >= bucket.maxPerDay) {
        return { ok: false, error: `Daily limit reached for ${bucketName} (${bucket.maxPerDay}/day).` };
    }

    bucket.timestamps.push(now);
    bucket.dayCount++;
    return { ok: true };
}

// Gemini rate limiter: 10 RPM for free tier safety
async function geminiRateWait() {
    const bucket = getRateBucket('gemini', 10, 1400);
    const now = Date.now();
    bucket.timestamps = bucket.timestamps.filter(t => t > now - 60000);
    if (bucket.timestamps.length >= 10) {
        const oldest = bucket.timestamps[0];
        const waitMs = oldest + 60000 - now + 500;
        console.log(`⏳ Gemini rate limit: waiting ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
    }
}

// ==================== HELPERS ====================
function parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
            if (body.length > 2 * 1024 * 1024) reject(new Error('Body too large'));
        });
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

function sendJson(res: ServerResponse, status: number, data: any) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
}

function getUrlPath(req: IncomingMessage): string {
    return (req.url || '').split('?')[0];
}

function getQueryParams(req: IncomingMessage): URLSearchParams {
    const url = req.url || '';
    const qIndex = url.indexOf('?');
    return new URLSearchParams(qIndex >= 0 ? url.slice(qIndex + 1) : '');
}

// ==================== FIREBASE AUTH ====================
// Cache for verified tokens to avoid repeated verification
const tokenCache: Map<string, { userId: string; email: string; isAdmin: boolean; name: string; expiresAt: number }> = new Map();

// Admin emails list
const ADMIN_EMAILS = ['admin@auraskills.com', 'admin@vidyamitra.com'];

// Verify Firebase ID token and return session info
async function getFirebaseSession(req: IncomingMessage): Promise<{ userId: string; email: string; isAdmin: boolean; name: string } | null> {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) return null;
    
    // Check cache first
    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        return { userId: cached.userId, email: cached.email, isAdmin: cached.isAdmin, name: cached.name };
    }
    
    try {
        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Try to get user data from Firestore for isAdmin status
        let isAdmin = ADMIN_EMAILS.includes(decodedToken.email || '');
        let name = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';
        
        try {
            const userData = await userService.getById(decodedToken.uid);
            if (userData) {
                isAdmin = userData.isAdmin || isAdmin;
                name = userData.name || name;
            }
        } catch {
            // Firestore lookup failed, use defaults
        }
        
        const session = {
            userId: decodedToken.uid,
            email: decodedToken.email || '',
            isAdmin,
            name
        };
        
        // Cache for 5 minutes
        tokenCache.set(token, { 
            ...session, 
            expiresAt: Date.now() + 5 * 60 * 1000 
        });
        
        return session;
    } catch (error: any) {
        // Token verification failed - expired or invalid
        tokenCache.delete(token);
        return null;
    }
}

// Legacy function for backward compatibility (now uses Firebase)
function getSession(req: IncomingMessage) {
    // This is now a stub - use getFirebaseSession instead
    // Returning null forces all endpoints to use async getFirebaseSession
    return null;
}

// ==================== EXTERNAL API CALLS ====================

async function callGemini(apiKey: string, prompt: string, options: { temperature?: number; maxTokens?: number } = {}): Promise<{ success: boolean; text?: string; error?: string }> {
    try {
        await geminiRateWait();
        const rate = checkAndRecordRate('gemini', 10, 1400);
        if (!rate.ok) return { success: false, error: rate.error };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: options.temperature ?? 0.7,
                        maxOutputTokens: options.maxTokens ?? 2048,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini API error:', response.status, errText);
            if (response.status === 429) return { success: false, error: 'Gemini rate limit exceeded. Please wait.' };
            return { success: false, error: `Gemini API error: ${response.status}` };
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return { success: false, error: 'Empty response from Gemini' };
        return { success: true, text };
    } catch (err: any) {
        return { success: false, error: err.message || 'Gemini call failed' };
    }
}

async function callGeminiImage(apiKey: string, prompt: string): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
    try {
        await geminiRateWait();
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseModalities: ["TEXT", "IMAGE"],
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            console.error('Gemini Image API error:', response.status, errText);
            return { success: false, error: `Gemini API error: ${response.status}` };
        }

        const data = await response.json();
        // The API might return text or image inlineData. If it returns an image, it's typically in parts[0].inlineData.data
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p: any) => p.inlineData);
        if (imagePart && imagePart.inlineData.data) {
            return { success: true, imageBase64: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` };
        }

        // Some models drop text response containing image markdown
        const textPart = parts.find((p: any) => p.text);
        if (textPart) {
            console.warn('Gemini 2.5 Flash Image returned text instead of image blob', textPart.text);
            return { success: false, error: 'Model returned text instead of image' };
        }

        return { success: false, error: 'No image found in response' };
    } catch (err: any) {
        return { success: false, error: err.message || 'Gemini Image call failed' };
    }
}

// ==================== GROQ API (Mermaid Roadmap) ====================
async function callGroq(apiKey: string, prompt: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
        const rate = checkAndRecordRate('groq', 5, 60);
        if (!rate.ok) return { success: false, error: rate.error };

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a career roadmap expert. Generate ONLY valid Mermaid.js flowchart code with subgraph groupings. No explanations, no markdown backticks, just the raw Mermaid code starting with graph TD. Use subgraph blocks for phases. Never use colons in labels.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.1,
                max_tokens: 4096,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Groq API error:', response.status, errText);
            return { success: false, error: `Groq API error: ${response.status}` };
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content?.trim() || '';

        // Clean up: strip markdown code fences if present
        content = content.replace(/```mermaid\s*/gi, '').replace(/```\s*/g, '').trim();
        // Ensure it starts with graph TD
        const graphIdx = content.indexOf('graph TD');
        if (graphIdx > 0) content = content.substring(graphIdx);
        if (!content.startsWith('graph TD')) {
            return { success: false, error: 'Invalid Mermaid code generated' };
        }

        // Sanitize: remove colons inside square-bracket labels (common LLM mistake)
        content = content.replace(/\[([^\]]*):([^\]]*)\]/g, (_, a, b) => `[${a} - ${b}]`);

        return { success: true, content };
    } catch (err: any) {
        console.error('Groq call failed:', err);
        return { success: false, error: err.message || 'Groq call failed' };
    }
}

async function fetchYouTubeVideos(apiKey: string, query: string, maxResults = 3): Promise<any[]> {
    try {
        const rate = checkAndRecordRate('youtube', 5, 90);
        if (!rate.ok) {
            console.warn('YouTube rate limit:', rate.error);
            return getFallbackYouTubeVideos(query);
        }

        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error('YouTube API error:', res.status);
            return getFallbackYouTubeVideos(query);
        }
        const data = await res.json();
        return (data.items || []).map((item: any) => ({
            id: item.id?.videoId,
            title: item.snippet?.title,
            description: item.snippet?.description,
            thumbnail: item.snippet?.thumbnails?.medium?.url,
            channelTitle: item.snippet?.channelTitle,
            url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
        }));
    } catch (err) {
        console.error('YouTube fetch error:', err);
        return getFallbackYouTubeVideos(query);
    }
}

function getFallbackYouTubeVideos(query: string): any[] {
    return [
        { id: 'fallback1', title: `Learn ${query} - Full Course`, description: `Complete tutorial on ${query}`, thumbnail: '', channelTitle: 'VidyaMitra', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' tutorial')}` },
        { id: 'fallback2', title: `${query} for Beginners`, description: `Beginner guide to ${query}`, thumbnail: '', channelTitle: 'VidyaMitra', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' beginners')}` },
    ];
}

async function fetchPexelsImages(apiKey: string, query: string, perPage = 3): Promise<any[]> {
    try {
        const rate = checkAndRecordRate('pexels', 5, 180);
        if (!rate.ok) return getFallbackPexelsImages(query);

        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`;
        const res = await fetch(url, { headers: { Authorization: apiKey } });
        if (!res.ok) return getFallbackPexelsImages(query);
        const data = await res.json();
        return (data.photos || []).map((photo: any) => ({
            id: photo.id,
            url: photo.src?.medium || photo.src?.original,
            alt: photo.alt || query,
            photographer: photo.photographer,
        }));
    } catch {
        return getFallbackPexelsImages(query);
    }
}

function getFallbackPexelsImages(query: string): any[] {
    return [
        { id: 'fb1', url: `https://via.placeholder.com/400x300?text=${encodeURIComponent(query)}`, alt: query, photographer: 'VidyaMitra' },
    ];
}

async function fetchNews(apiKey: string, query: string): Promise<any[]> {
    try {
        const rate = checkAndRecordRate('news', 3, 90);
        if (!rate.ok) return getFallbackNews(query);

        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=5&sortBy=publishedAt&language=en&apiKey=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return getFallbackNews(query);
        const data = await res.json();
        return (data.articles || []).slice(0, 5).map((a: any) => ({
            title: a.title,
            description: a.description,
            url: a.url,
            source: a.source?.name,
            publishedAt: a.publishedAt,
            image: a.urlToImage,
        }));
    } catch {
        return getFallbackNews(query);
    }
}

function getFallbackNews(query: string): any[] {
    return [
        { title: `Latest trends in ${query}`, description: `Stay updated with ${query} industry news`, url: `https://news.google.com/search?q=${encodeURIComponent(query)}`, source: 'Google News', publishedAt: new Date().toISOString(), image: null },
    ];
}

async function fetchExchangeRate(apiKey: string): Promise<any> {
    try {
        const rate = checkAndRecordRate('exchange', 2, 50);
        if (!rate.ok) return getFallbackExchangeRates();

        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
        const res = await fetch(url);
        if (!res.ok) return getFallbackExchangeRates();
        const data = await res.json();
        return {
            base: data.base_code || 'USD',
            rates: {
                INR: data.conversion_rates?.INR || 83.5,
                EUR: data.conversion_rates?.EUR || 0.92,
                GBP: data.conversion_rates?.GBP || 0.79,
                JPY: data.conversion_rates?.JPY || 149.5,
            },
            lastUpdated: data.time_last_update_utc || new Date().toISOString(),
        };
    } catch {
        return getFallbackExchangeRates();
    }
}

function getFallbackExchangeRates() {
    return { base: 'USD', rates: { INR: 83.5, EUR: 0.92, GBP: 0.79, JPY: 149.5 }, lastUpdated: new Date().toISOString() };
}

// ==================== VITE PLUGIN ====================
export function auraSkillApiPlugin(): Plugin {
    let keys: ApiKeys = {} as ApiKeys;

    return {
        name: 'auraskill-api',

        configResolved(config) {
            const env = loadEnv(config.mode, config.root, '');
            keys = {
                GEMINI_API_KEY: env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '',
                GEMINI_IMAGE_API_KEY: env.GEMINI_IMAGE_API_KEY || env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '',
                YOUTUBE_API_KEY: env.YOUTUBE_API_KEY || '',
                PEXELS_API_KEY: env.PEXELS_API_KEY || '',
                NEWS_API_KEY: env.NEWS_API_KEY || '',
                EXCHANGE_RATE_API_KEY: env.EXCHANGE_RATE_API_KEY || '',
                OPENAI_API_KEY: env.OPENAI_API_KEY || '',
                // Server-side only – reads JUDGE0_HOST (no VITE_ prefix → never exposed to browser)
                JUDGE0_API_KEY: env.JUDGE0_API_KEY || '',
                JUDGE0_API_HOST: env.JUDGE0_API_HOST || '',
                JUDGE0_BASE_URL: env.JUDGE0_HOST || '',  // primary config var
                GROQ_API_KEY: env.GROQ_API_KEY || '',
                GROQ_SKILL_TRENDS_KEY: env.GROQ_SKILL_TRENDS_KEY || env.GROQ_API_KEY || '',
                ELEVENLABS_API_KEY: env.ELEVENLABS_API_KEY || '',
            };

            // Initialize Firebase Admin
            try {
                initializeFirebaseAdmin();
                console.log('✅ Firebase Admin initialized');
            } catch (error: any) {
                console.error('❌ Firebase Admin initialization failed:', error.message);
                throw new Error('Firebase is required - cannot start without it');
            }

            console.log('✅ AuraSkill AI API server initialized');
            console.log('  Gemini:', keys.GEMINI_API_KEY ? '✅' : '❌');
            console.log('  YouTube:', keys.YOUTUBE_API_KEY ? '✅' : '❌');
            console.log('  Pexels:', keys.PEXELS_API_KEY ? '✅' : '❌');
            console.log('  News:', keys.NEWS_API_KEY ? '✅' : '❌');
            console.log('  Exchange:', keys.EXCHANGE_RATE_API_KEY ? '✅' : '❌');
            console.log('  Groq:', keys.GROQ_API_KEY ? '✅' : '❌');
            console.log('  ElevenLabs:', keys.ELEVENLABS_API_KEY ? '✅' : '❌');
            console.log('  Judge0:', keys.JUDGE0_BASE_URL ? `✅ (${keys.JUDGE0_BASE_URL})` : '❌ (JUDGE0_HOST not set)');
        },

        configureServer(server: ViteDevServer) {
            // Global error handlers to prevent server crashes
            process.on('uncaughtException', (err) => {
                console.error('❌ Uncaught Exception:', err.message);
            });
            process.on('unhandledRejection', (reason: any) => {
                console.error('❌ Unhandled Rejection:', reason?.message || reason);
            });

            // Helper to wrap async handlers with error handling
            const safeHandler = (handler: (req: any, res: any, next: any) => Promise<any>) => {
                return async (req: any, res: any, next: any) => {
                    try {
                        await handler(req, res, next);
                    } catch (err: any) {
                        console.error(`❌ API Error [${req.url}]:`, err.message);
                        if (!res.headersSent) {
                            sendJson(res, 500, { error: err.message || 'Internal server error' });
                        }
                    }
                };
            };

            // CORS preflight
            server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
                if (req.url?.startsWith('/api/') && req.method === 'OPTIONS') {
                    res.writeHead(204, {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    });
                    res.end();
                    return;
                }
                next();
            });

            // ==================== AUTH ROUTES ====================
            server.middlewares.use('/api/auth/login', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                try {
                    const { email, password } = await parseBody(req);
                    if (!email || !password) {
                        return sendJson(res, 400, { error: 'Email and password required' });
                    }

                    // Get user from Firestore
                    const user = await userService.getByEmail(email);
                    
                    if (!user) {
                        return sendJson(res, 401, { error: 'Invalid email or password' });
                    }

                    // Verify password
                    if (!verifyPassword(password, user.password_hash)) {
                        return sendJson(res, 401, { error: 'Invalid email or password' });
                    }

                    // Create session token
                    const token = createSession(user.id, user.email, !!user.is_admin, user.name || '');
                    
                    console.log('✅ Login successful:', email);
                    
                    return sendJson(res, 200, {
                        token,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name || '',
                            isAdmin: !!user.is_admin
                        },
                    });
                } catch (err: any) {
                    console.error('Login error:', err);
                    return sendJson(res, 500, { error: err.message });
                }
            });

            server.middlewares.use('/api/auth/signup', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                try {
                    const { email, password, name } = await parseBody(req);
                    if (!email || !password) {
                        return sendJson(res, 400, { error: 'Email and password required' });
                    }
                    if (email === 'admin@vidyamitra.com' || email === 'admin@auraskills.com') {
                        return sendJson(res, 403, { error: 'Email reserved for admin' });
                    }

                    // Check if user already exists
                    const existing = await userService.getByEmail(email);
                    if (existing) {
                        return sendJson(res, 409, { error: 'Email already in use' });
                    }

                    // Create new user in Firestore
                    const userId = generateId();
                    const displayName = name || email.split('@')[0];
                    const passwordHash = hashPassword(password);

                    const firestore = initializeFirebaseAdmin().firestore();
                    await firestore.collection('users').doc(userId).set({
                        id: userId,
                        email,
                        password_hash: passwordHash,
                        name: displayName,
                        is_admin: false,
                        target_role: null,
                        skills: [],
                        created_at: admin.firestore.FieldValue.serverTimestamp(),
                        updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    });

                    // Create session token
                    const token = createSession(userId, email, false, displayName);
                    
                    console.log('✅ Signup successful:', email);
                    
                    return sendJson(res, 201, {
                        token,
                        user: { id: userId, email, name: displayName, isAdmin: false },
                    });
                } catch (err: any) {
                    console.error('Signup error:', err);
                    return sendJson(res, 500, { error: err.message });
                }
            });

            server.middlewares.use('/api/auth/me', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
                sendJson(res, 200, { user: { id: session.userId, email: session.email, name: session.name, isAdmin: session.isAdmin } });
            });

            server.middlewares.use('/api/auth/logout', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                const authHeader = req.headers.authorization || '';
                const token = authHeader.replace('Bearer ', '');
                // Clear from cache (actual logout happens client-side via Firebase)
                tokenCache.delete(token);
                sendJson(res, 200, { success: true });
            });

            // ==================== GEMINI PROXY ====================
            server.middlewares.use('/api/gemini/generate', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                try {
                    const { prompt, temperature, maxTokens } = await parseBody(req);
                    if (!prompt) return sendJson(res, 400, { error: 'prompt is required' });
                    if (!keys.GEMINI_API_KEY) return sendJson(res, 503, { error: 'Gemini API key not configured' });

                    const result = await callGemini(keys.GEMINI_API_KEY, prompt, { temperature, maxTokens });
                    if (result.success) {
                        sendJson(res, 200, { success: true, text: result.text });
                    } else {
                        sendJson(res, 500, { success: false, error: result.error });
                    }
                } catch (err: any) {
                    sendJson(res, 500, { error: err.message });
                }
            });

            // ==================== YOUTUBE PROXY ====================
            server.middlewares.use('/api/youtube/search', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const params = getQueryParams(req);
                const query = params.get('q') || '';
                const maxResults = parseInt(params.get('maxResults') || '3');
                if (!query) return sendJson(res, 400, { error: 'q parameter required' });
                const videos = await fetchYouTubeVideos(keys.YOUTUBE_API_KEY, query, maxResults);
                sendJson(res, 200, { videos });
            });

            // ==================== PEXELS PROXY ====================
            server.middlewares.use('/api/pexels/search', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const params = getQueryParams(req);
                const query = params.get('q') || '';
                if (!query) return sendJson(res, 400, { error: 'q parameter required' });
                const images = await fetchPexelsImages(keys.PEXELS_API_KEY, query);
                sendJson(res, 200, { images });
            });

            // ==================== NEWS PROXY ====================
            server.middlewares.use('/api/news/search', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const params = getQueryParams(req);
                const query = params.get('q') || 'technology jobs';
                const articles = await fetchNews(keys.NEWS_API_KEY, query);
                sendJson(res, 200, { articles });
            });

            // ==================== EXCHANGE RATE PROXY ====================
            server.middlewares.use('/api/exchange-rates', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const rates = await fetchExchangeRate(keys.EXCHANGE_RATE_API_KEY);
                sendJson(res, 200, rates);
            });

            // ==================== DB CRUD: INTERVIEWS ====================
            server.middlewares.use('/api/interviews', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                const path = getUrlPath(req);

                if (req.method === 'GET' && (path === '/' || path === '')) {
                    if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
                    const params = getQueryParams(req);
                    const allParam = params.get('all');

                    if (allParam === 'true' && session.isAdmin) {
                        const interviews = await interviewService.getAll();
                        return sendJson(res, 200, { interviews });
                    }
                    const interviews = await interviewService.getByUser(session.userId);
                    return sendJson(res, 200, { interviews });
                }

                if (req.method === 'POST' && (path === '/' || path === '')) {
                    if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
                    try {
                        const body = await parseBody(req);
                        const id = body.id || generateId();
                        await interviewService.create({
                            id,
                            userId: session.userId,
                            roleId: body.roleId || '',
                            roleName: body.roleName || '',
                            questions: body.questions || [],
                            answers: body.answers || [],
                            completed: body.completed || false,
                            score: body.score || null,
                            feedback: body.feedback || '',
                            outcome: body.outcome || '',
                            isPracticeMode: body.isPracticeMode || false,
                            aborted: body.aborted || false,
                            abortReason: body.abortReason || '',
                            aiDetectionCount: body.aiDetectionCount || 0,
                            startTime: body.startTime || new Date().toISOString(),
                            endTime: body.endTime || null
                        });
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }

                if (req.method === 'DELETE') {
                    if (!session) return sendJson(res, 401, { error: 'Not authenticated' });
                    const idMatch = path.match(/^\/(.+)/);
                    if (idMatch) {
                        await interviewService.delete(idMatch[1]);
                        return sendJson(res, 200, { success: true });
                    }
                }

                next();
            }));

            // ==================== DB CRUD: PRACTICE APTITUDE ====================
            server.middlewares.use('/api/practice-aptitude', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const results = await practiceAptitudeService.getByUser(session.userId, 50);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        await practiceAptitudeService.create({
                            id,
                            user_id: session.userId,
                            score: body.score,
                            total_questions: body.totalQuestions,
                            correct_answers: body.correctAnswers,
                            category_performance: JSON.stringify(body.categoryPerformance || {}),
                            weak_topics: JSON.stringify(body.weakTopics || []),
                            recommendations: JSON.stringify(body.recommendations || []),
                            completed_at: body.completedAt || new Date().toISOString()
                        });
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            }));

            // ==================== DB CRUD: PRACTICE INTERVIEWS ====================
            server.middlewares.use('/api/practice-interviews', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const results = await practiceInterviewService.getByUser(session.userId, 50);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        await practiceInterviewService.create({
                            id,
                            user_id: session.userId,
                            role_id: body.roleId || '',
                            role_name: body.roleName || '',
                            questions: JSON.stringify(body.questions || []),
                            overall_score: body.overallScore || 0,
                            average_question_score: body.averageQuestionScore || 0,
                            strengths: JSON.stringify(body.strengths || []),
                            improvements: JSON.stringify(body.improvements || []),
                            recommendations: JSON.stringify(body.recommendations || []),
                            completed_at: body.completedAt || new Date().toISOString()
                        });
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            }));

            // ==================== DB CRUD: BOT INTERVIEWS ====================
            server.middlewares.use('/api/bot-interviews', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const results = await botInterviewService.getByUser(session.userId, 50);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        await botInterviewService.create({
                            id,
                            user_id: session.userId,
                            candidate_name: body.candidateName || '',
                            role: body.role || '',
                            conversation_log: JSON.stringify(body.conversationLog || []),
                            feedback: JSON.stringify(body.feedback || {}),
                            completed_at: body.completedAt || new Date().toISOString()
                        });
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            }));

            // ==================== DB CRUD: PRACTICE CODING ====================
            server.middlewares.use('/api/practice-coding', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const results = await practiceCodingService.getByUser(session.userId, 50);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = body.id || generateId();
                        await practiceCodingService.createOrUpdate({
                            id,
                            user_id: session.userId,
                            session_data: JSON.stringify(body),
                            date: body.date || new Date().toISOString(),
                            start_time: body.startTime || '',
                            end_time: body.endTime || ''
                        });
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            }));

            // ==================== DB CRUD: RESUMES ====================
            server.middlewares.use('/api/resumes', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const results = await resumeService.getByUser(session.userId);
                    return sendJson(res, 200, { resumes: results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        await resumeService.create({
                            id,
                            userId: session.userId,
                            fileName: body.fileName || '',
                            rawText: body.rawText || '',
                            parsedData: body.parsedData || {},
                            atsScore: body.atsScore || 0,
                            atsAnalysis: body.atsAnalysis || {},
                            targetRole: body.targetRole || ''
                        });
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            }));

            // ==================== DB CRUD: ROUND 1 APTITUDE ====================
            server.middlewares.use('/api/round1-aptitude', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'GET') {
                    const params = getQueryParams(req);
                    if (params.get('all') === 'true' && session.isAdmin) {
                        const results = await round1AptitudeService.getAll();
                        return sendJson(res, 200, { results });
                    }
                    const results = await round1AptitudeService.getByUser(session.userId);
                    return sendJson(res, 200, { results });
                }

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = generateId();
                        await round1AptitudeService.create({
                            id,
                            userId: session.userId,
                            userEmail: session.email,
                            userName: session.name,
                            roleId: body.roleId || '',
                            roleName: body.roleName || '',
                            score: body.score || 0,
                            totalQuestions: body.totalQuestions || 0,
                            correctAnswers: body.correctAnswers || 0,
                            categoryPerformance: body.categoryPerformance || {},
                            completedAt: body.completedAt || new Date().toISOString(),
                            aborted: body.aborted || false,
                            abortReason: body.abortReason || ''
                        });
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }

                if (req.method === 'PUT') {
                    try {
                        const body = await parseBody(req);
                        const path = getUrlPath(req);
                        const idMatch = path.match(/^\/(.+)/);
                        if (idMatch && session.isAdmin) {
                            const updates: any = {};
                            if (body.selectedForRound2 !== undefined) updates.selectedForRound2 = body.selectedForRound2;
                            if (body.round2EmailSent !== undefined) updates.round2EmailSent = body.round2EmailSent;
                            if (Object.keys(updates).length > 0) {
                                await round1AptitudeService.update(idMatch[1], updates);
                            }
                            return sendJson(res, 200, { success: true });
                        }
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            }));

            // ==================== CAREER PLAN ====================
            server.middlewares.use('/api/career-plan', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'POST') {
                    try {
                        const { targetRole, skillGaps } = await parseBody(req);
                        if (!targetRole) return sendJson(res, 400, { error: 'targetRole required' });
                        if (!keys.GEMINI_API_KEY) return sendJson(res, 503, { error: 'Gemini not configured' });

                        // Generate training plan via Gemini
                        const prompt = `You are a career counselor and technical mentor. Create a detailed 8-week training plan for someone aiming to become a "${targetRole}".

Their skill gaps are: ${JSON.stringify(skillGaps || [])}.

Return valid JSON with this structure:
{
  "weeklyPlan": [
    { "week": 1, "title": "Week 1: ...", "topics": ["topic1", "topic2"], "goals": ["goal1"], "resources": ["resource1"] },
    ...8 total weeks
  ],
  "milestones": ["milestone1", "milestone2", "milestone3", "milestone4"],
  "estimatedCompletion": "8 weeks",
  "dailyHours": 2
}

Return ONLY valid JSON.`;

                        const result = await callGemini(keys.GEMINI_API_KEY, prompt, { temperature: 0.6, maxTokens: 2048 });
                        let trainingPlan = {};
                        if (result.success && result.text) {
                            try {
                                let clean = result.text.replace(/```json\n?|\n?```/g, '').trim();
                                const match = clean.match(/\{[\s\S]*\}/);
                                if (match) clean = match[0];
                                trainingPlan = JSON.parse(clean);
                            } catch {
                                trainingPlan = { error: 'Failed to parse plan', raw: result.text?.substring(0, 500) };
                            }
                        }

                        // Fetch YouTube videos for top skills
                        const topSkills = (skillGaps || [targetRole]).slice(0, 3);
                        const allVideos: any[] = [];
                        for (const skill of topSkills) {
                            const videos = await fetchYouTubeVideos(keys.YOUTUBE_API_KEY, `${skill} tutorial for ${targetRole}`, 2);
                            allVideos.push({ skill, videos });
                        }

                        // Generate Image using gemini-2.5-flash-image
                        const imagePrompt = `A visually appealing, highly detailed info-graphic roadmap and flowchart for a learning journey to become a ${targetRole}. Make it modern and clean with milestone paths. Include text highlighting ${targetRole} roadmap.`;
                        const geminiImageResponse = await callGeminiImage(keys.GEMINI_IMAGE_API_KEY, imagePrompt);

                        // Fetch Pexels images fallback if needed, or simply append
                        const images = await fetchPexelsImages(keys.PEXELS_API_KEY, `${targetRole} career learning`);

                        // If the Gemini image generation succeeds, prepend it as the main image
                        if (geminiImageResponse.success && geminiImageResponse.imageBase64) {
                            images.unshift({
                                id: 'gemini-generated',
                                url: geminiImageResponse.imageBase64,
                                photographer: 'Generated by Gemini 2.5 Flash Image',
                                alt: `AI Generated Roadmap for ${targetRole}`,
                                isGemini: true
                            });
                        }

                        // Save plan
                        const id = generateId();
                        await careerPlanService.create({
                            id,
                            userId: session.userId,
                            targetRole,
                            skillGaps: skillGaps || [],
                            trainingPlan,
                            youtubeVideos: allVideos,
                            pexelsImages: images
                        });

                        sendJson(res, 200, { success: true, id, trainingPlan, videos: allVideos, images });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }

                if (req.method === 'GET') {
                    const plans = await careerPlanService.getByUser(session.userId);
                    return sendJson(res, 200, { plans });
                }
                next();
            }));

            // ==================== ROADMAP CHART (Groq + Mermaid) ====================
            server.middlewares.use('/api/roadmap-chart', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method !== 'POST') return next();

                try {
                    const { targetRole, timeline, currentSkills, skillsToLearn, notes } = await parseBody(req);
                    if (!targetRole) return sendJson(res, 400, { error: 'Target role is required' });

                    if (!keys.GROQ_API_KEY) {
                        return sendJson(res, 500, { error: 'Groq API key not configured' });
                    }

                    const timelineText = timeline || '3 months';
                    const currentSkillsText = currentSkills || 'None specified';
                    const skillsToLearnText = skillsToLearn || targetRole;
                    const notesText = notes ? `\nAdditional notes: ${notes}` : '';

                    const prompt = `Create a career learning roadmap flowchart for someone who wants to become a "${targetRole}" within ${timelineText}.

Current skills: ${currentSkillsText}
Skills to learn: ${skillsToLearnText}${notesText}

Generate ONLY valid Mermaid.js flowchart code following these STRICT rules:

1. Start with exactly "graph TD" on the first line
2. Use subgraph blocks to group skills by phase/month. Label each subgraph by the phase name.
   Example: subgraph Phase1[Month 1 Fundamentals]
3. Use ONLY alphanumeric characters and underscores for node IDs (e.g., A1, B2, Step1)
4. Use square brackets for node labels: A1[Label Text Here]
5. Use --> for connections between nodes
6. NEVER use colons inside node labels
7. NEVER use quotes or parentheses in labels
8. Keep labels short - maximum 4 words per label
9. Create a WIDE layout - each subgraph should have 2-3 parallel vertical branches side by side
10. Connect the branches within each subgraph vertically (top to bottom)
11. Connect the last nodes of one subgraph to the first nodes of the next subgraph
12. Use style lines at the end with different colors for each phase
13. Create 15-25 nodes across ${timelineText === '1 month' ? '2 phases' : timelineText === '3 months' ? '3 phases' : '4-6 phases'}
14. End with a single final goal node that all paths converge to

Example format:
graph TD
    subgraph Phase1[Month 1 Fundamentals]
        A1[Learn Basics] --> A2[Core Concepts]
        A2 --> A3[Practice Skills]
        B1[Setup Tools] --> B2[Read Docs]
        B2 --> B3[Build Demo]
    end
    subgraph Phase2[Month 2 Advanced]
        C1[Advanced Topics] --> C2[Deep Dive]
        C2 --> C3[Build Projects]
        D1[Testing] --> D2[Optimization]
        D2 --> D3[Deploy Apps]
    end
    A3 --> C1
    B3 --> D1
    C3 --> E1[Final Goal]
    D3 --> E1
    style A1 fill:#4CAF50,color:#fff
    style B1 fill:#4CAF50,color:#fff
    style C1 fill:#2196F3,color:#fff
    style D1 fill:#2196F3,color:#fff
    style E1 fill:#FF9800,color:#fff

Generate the Mermaid code now for the ${targetRole} roadmap:`;

                    const result = await callGroq(keys.GROQ_API_KEY, prompt);
                    if (!result.success) {
                        return sendJson(res, 500, { error: result.error || 'Failed to generate roadmap chart' });
                    }

                    sendJson(res, 200, { success: true, mermaidCode: result.content });
                } catch (err: any) {
                    sendJson(res, 500, { error: err.message });
                }
            }));

            // ==================== RESUME BUILDER ====================
            server.middlewares.use('/api/resume-builder', safeHandler(async (req: any, res: any, next: any) => {
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                if (req.method === 'POST') {
                    try {
                        const body = await parseBody(req);
                        const id = body.id || generateId();
                        await resumeBuildService.createOrUpdate({
                            id,
                            userId: session.userId,
                            personalInfo: body.personalInfo || {},
                            education: body.education || [],
                            experience: body.experience || [],
                            projects: body.projects || [],
                            skills: body.skills || [],
                            template: body.template || 'modern',
                            atsScore: body.atsScore || 0
                        });
                        sendJson(res, 201, { success: true, id });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }

                if (req.method === 'GET') {
                    const builds = await resumeBuildService.getByUser(session.userId);
                    return sendJson(res, 200, { builds });
                }
                next();
            }));

            // ==================== ADMIN: ALL USERS ====================
            server.middlewares.use('/api/admin/users', safeHandler(async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const session = await getFirebaseSession(req);
                if (!session || !session.isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
                const users = await userService.getAll();
                sendJson(res, 200, { users });
            }));

            // ==================== ADMIN: STATS ====================
            server.middlewares.use('/api/admin/stats', safeHandler(async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();
                const session = await getFirebaseSession(req);
                if (!session || !session.isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
                const totalUsers = await userService.count();
                const totalInterviews = await interviewService.count();
                const completedInterviews = await interviewService.countCompleted();
                const avgScore = await interviewService.getAverageScore();
                sendJson(res, 200, { totalUsers, totalInterviews, completedInterviews, averageScore: Math.round(avgScore * 10) / 10 });
            }));

            // ==================== ROLES ====================
            server.middlewares.use('/api/roles', safeHandler(async (req: any, res: any, next: any) => {
                if (req.method === 'GET') {
                    const roles = await roleService.getAll();
                    return sendJson(res, 200, { roles });
                }
                if (req.method === 'POST') {
                    const session = await getFirebaseSession(req);
                    if (!session || !session.isAdmin) return sendJson(res, 403, { error: 'Admin access required' });
                    try {
                        const { roleId, isOpen } = await parseBody(req);
                        const id = generateId();
                        await roleService.createOrUpdate({ id, roleId, isOpen });
                        sendJson(res, 200, { success: true });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            }));

            // ==================== SKILL TREND ANALYSIS (Groq-powered) ====================
            // In-memory cache for skill trends (refresh every 2 hours to save API calls)
            let skillTrendsCache: { data: any; timestamp: number } | null = null;
            const SKILL_TRENDS_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

            // Fallback data when APIs are unavailable
            function getSkillTrendsFallback(): any {
                return {
                    success: true,
                    totalArticlesAnalyzed: 0,
                    analyzedAt: new Date().toISOString(),
                    summary: 'AI/ML, cloud computing, and cybersecurity continue to dominate job market demand in 2026. Generative AI skills have seen the steepest growth, while traditional IT support roles are declining. Full-stack development and DevOps remain essential across all industries.',
                    skills: [
                        { name: 'Generative AI / LLMs', mentions: 30, demandScore: 96, trend: 'rising', growthLabel: '+45%', industry: 'AI/ML', category: 'technical' },
                        { name: 'Python', mentions: 28, demandScore: 93, trend: 'stable', growthLabel: '+5%', industry: 'General', category: 'technical' },
                        { name: 'Cloud Computing (AWS/Azure/GCP)', mentions: 25, demandScore: 90, trend: 'rising', growthLabel: '+20%', industry: 'Cloud', category: 'technical' },
                        { name: 'Kubernetes', mentions: 20, demandScore: 87, trend: 'rising', growthLabel: '+28%', industry: 'DevOps', category: 'technical' },
                        { name: 'React / Next.js', mentions: 18, demandScore: 85, trend: 'stable', growthLabel: '+8%', industry: 'Frontend', category: 'technical' },
                        { name: 'Cybersecurity', mentions: 17, demandScore: 84, trend: 'rising', growthLabel: '+22%', industry: 'Security', category: 'technical' },
                        { name: 'Data Engineering', mentions: 15, demandScore: 82, trend: 'rising', growthLabel: '+18%', industry: 'Data', category: 'technical' },
                        { name: 'TypeScript', mentions: 14, demandScore: 80, trend: 'rising', growthLabel: '+15%', industry: 'Frontend', category: 'technical' },
                        { name: 'Docker', mentions: 13, demandScore: 78, trend: 'stable', growthLabel: '+6%', industry: 'DevOps', category: 'technical' },
                        { name: 'SQL / NoSQL Databases', mentions: 12, demandScore: 76, trend: 'stable', growthLabel: '+3%', industry: 'Data', category: 'technical' },
                        { name: 'Machine Learning', mentions: 12, demandScore: 75, trend: 'rising', growthLabel: '+12%', industry: 'AI/ML', category: 'technical' },
                        { name: 'Rust', mentions: 10, demandScore: 72, trend: 'rising', growthLabel: '+35%', industry: 'Systems', category: 'technical' },
                        { name: 'Node.js', mentions: 10, demandScore: 70, trend: 'stable', growthLabel: '+4%', industry: 'Backend', category: 'technical' },
                        { name: 'CI/CD Pipelines', mentions: 9, demandScore: 68, trend: 'stable', growthLabel: '+7%', industry: 'DevOps', category: 'technical' },
                        { name: 'Prompt Engineering', mentions: 8, demandScore: 65, trend: 'rising', growthLabel: '+200%', industry: 'AI/ML', category: 'technical' },
                        { name: 'Go (Golang)', mentions: 7, demandScore: 60, trend: 'rising', growthLabel: '+18%', industry: 'Backend', category: 'technical' },
                        { name: 'Java', mentions: 10, demandScore: 58, trend: 'stable', growthLabel: '-2%', industry: 'Enterprise', category: 'technical' },
                        { name: 'PHP', mentions: 3, demandScore: 25, trend: 'declining', growthLabel: '-15%', industry: 'Web', category: 'technical' },
                        { name: 'jQuery', mentions: 1, demandScore: 12, trend: 'declining', growthLabel: '-30%', industry: 'Frontend', category: 'technical' },
                    ],
                    emergingSkills: [
                        { name: 'Prompt Engineering', reason: 'Massive growth due to enterprise adoption of LLMs across all industries' },
                        { name: 'AI Safety & Alignment', reason: 'Regulatory requirements and responsible AI initiatives are creating new specialist roles' },
                        { name: 'Rust', reason: 'Increasingly adopted for performance-critical systems, WebAssembly, and blockchain' },
                        { name: 'Edge Computing', reason: 'IoT growth and real-time processing needs are driving demand for edge skills' },
                        { name: 'Platform Engineering', reason: 'Evolution of DevOps towards internal developer platforms' },
                    ],
                    decliningSkills: [
                        { name: 'jQuery', reason: 'Modern frameworks like React and Vue have made jQuery obsolete for new projects' },
                        { name: 'Manual QA Testing', reason: 'Automation tools and AI-driven testing are replacing manual testing roles' },
                        { name: 'PHP (legacy)', reason: 'While still used, new projects rarely choose PHP over Node.js, Python, or Go' },
                    ],
                    industryBreakdown: [
                        { industry: 'AI/ML', topSkills: ['Python', 'TensorFlow', 'PyTorch', 'LLMs', 'Prompt Engineering'], outlook: 'Very Strong' },
                        { industry: 'Cloud & DevOps', topSkills: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD'], outlook: 'Strong' },
                        { industry: 'Cybersecurity', topSkills: ['SOC', 'Penetration Testing', 'Zero Trust', 'Cloud Security'], outlook: 'Very Strong' },
                        { industry: 'Frontend', topSkills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'], outlook: 'Moderate' },
                        { industry: 'Data', topSkills: ['SQL', 'Spark', 'Airflow', 'dbt', 'Snowflake'], outlook: 'Strong' },
                        { industry: 'Backend', topSkills: ['Node.js', 'Go', 'Python', 'Java', 'Microservices'], outlook: 'Stable' },
                    ],
                    sourceArticles: [],
                    _fallback: true,
                };
            }

            server.middlewares.use('/api/skill-trends/analyze', async (req: any, res: any, next: any) => {
                if (req.method !== 'GET') return next();

                // Return cached result if fresh
                if (skillTrendsCache && (Date.now() - skillTrendsCache.timestamp) < SKILL_TRENDS_CACHE_TTL) {
                    return sendJson(res, 200, skillTrendsCache.data);
                }

                // Check Groq key
                const groqKey = keys.GROQ_SKILL_TRENDS_KEY;
                if (!groqKey) {
                    console.warn('⚠️ Groq Skill Trends key not configured, using fallback data');
                    const fallback = getSkillTrendsFallback();
                    skillTrendsCache = { data: fallback, timestamp: Date.now() };
                    return sendJson(res, 200, fallback);
                }

                // Strict rate limit: 2/min, 20/day for free Groq tier
                const rateCheck = checkAndRecordRate('groq-skill-trends', 2, 20);
                if (!rateCheck.ok) {
                    console.warn('⚠️ Groq skill trends rate limit hit, using fallback');
                    const fallback = getSkillTrendsFallback();
                    return sendJson(res, 200, fallback);
                }

                try {
                    // 1. Fetch news articles (limited to 3 queries to stay within News API rate)
                    const queries = [
                        'technology hiring skills 2026',
                        'AI machine learning developer jobs',
                        'software engineering job trends',
                    ];

                    const allArticles: any[] = [];
                    for (const q of queries) {
                        try {
                            const articles = await fetchNews(keys.NEWS_API_KEY, q);
                            allArticles.push(...articles);
                        } catch { /* skip failed queries */ }
                    }

                    // De-duplicate by title
                    const seen = new Set<string>();
                    const uniqueArticles = allArticles.filter((a: any) => {
                        if (!a.title || seen.has(a.title)) return false;
                        seen.add(a.title);
                        return true;
                    });

                    // 2. Build article text (sanitize to avoid breaking JSON)
                    const articleTexts = uniqueArticles.map((a: any, i: number) => {
                        const title = (a.title || '').replace(/[\r\n"\\]/g, ' ').trim();
                        const desc = (a.description || '').replace(/[\r\n"\\]/g, ' ').trim();
                        return `${i + 1}. ${title}${desc ? ' - ' + desc : ''}`;
                    }).join('\n');

                    const totalArticles = uniqueArticles.length;

                    // 3. Call Groq API for NLP analysis
                    console.log(`📊 Skill Trends: Analyzing ${totalArticles} articles with Groq...`);

                    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${groqKey}`,
                        },
                        body: JSON.stringify({
                            model: 'llama-3.3-70b-versatile',
                            messages: [
                                {
                                    role: 'system',
                                    content: 'You are an NLP job market analyst. You analyze tech news and extract skill demand trends. Always respond with valid JSON only. No markdown, no backticks, no explanations.'
                                },
                                {
                                    role: 'user',
                                    content: `Analyze these ${totalArticles} recent tech news headlines and extract skill trends.\n\nARTICLES:\n${articleTexts}\n\nReturn JSON with this exact structure:\n{"totalArticlesAnalyzed":${totalArticles},"analyzedAt":"${new Date().toISOString()}","summary":"2-3 sentence market summary","skills":[{"name":"SkillName","mentions":5,"demandScore":85,"trend":"rising","growthLabel":"+25%","industry":"AI/ML","category":"technical"}],"emergingSkills":[{"name":"Skill","reason":"Why emerging"}],"decliningSkills":[{"name":"Skill","reason":"Why declining"}],"industryBreakdown":[{"industry":"AI/ML","topSkills":["Python","TensorFlow"],"outlook":"Very Strong"}]}\n\nInclude at least 15 skills. Trend must be rising, stable, or declining. DemandScore 0-100.`
                                },
                            ],
                            temperature: 0.3,
                            max_tokens: 3000,
                        }),
                    });

                    if (!groqResponse.ok) {
                        const errText = await groqResponse.text();
                        console.error('❌ Groq skill trends error:', groqResponse.status, errText);

                        // Fall back to static data on API error
                        const fallback = getSkillTrendsFallback();
                        skillTrendsCache = { data: fallback, timestamp: Date.now() };
                        return sendJson(res, 200, fallback);
                    }

                    const groqData: any = await groqResponse.json();
                    let content = groqData.choices?.[0]?.message?.content?.trim() || '';

                    // 4. Parse JSON from Groq response
                    let analysis: any;
                    try {
                        content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
                        analysis = JSON.parse(content);
                    } catch (parseErr) {
                        console.error('Failed to parse Groq skill trend JSON:', parseErr, '\nRaw:', content.substring(0, 200));
                        const fallback = getSkillTrendsFallback();
                        skillTrendsCache = { data: fallback, timestamp: Date.now() };
                        return sendJson(res, 200, fallback);
                    }

                    // 5. Build response with source articles
                    const responseData = {
                        success: true,
                        ...analysis,
                        sourceArticles: uniqueArticles.slice(0, 10).map((a: any) => ({
                            title: a.title,
                            source: a.source,
                            url: a.url,
                            publishedAt: a.publishedAt,
                        })),
                    };

                    // Cache for 2 hours
                    skillTrendsCache = { data: responseData, timestamp: Date.now() };
                    console.log('✅ Skill trends analysis complete, cached for 2 hours');

                    sendJson(res, 200, responseData);
                } catch (err: any) {
                    console.error('Skill trend analysis error:', err);
                    // Always return fallback on error so UI never breaks
                    const fallback = getSkillTrendsFallback();
                    skillTrendsCache = { data: fallback, timestamp: Date.now() };
                    sendJson(res, 200, fallback);
                }
            });

            // ==================== JUDGE0 CODE EXECUTION PROXY ====================
            // All requests to /api/judge0/* are proxied server-side.
            // The real Judge0 host (JUDGE0_HOST) never reaches the browser.
            server.middlewares.use('/api/judge0', async (req: any, res: any, next: any) => {
                if (!keys.JUDGE0_BASE_URL) {
                    return sendJson(res, 500, { error: 'Judge0 host not configured. Add JUDGE0_HOST to your .env file.' });
                }

                const path = req.url || '/';

                // Build upstream headers – add RapidAPI creds only if configured
                const judge0Headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (keys.JUDGE0_API_KEY && keys.JUDGE0_API_HOST) {
                    judge0Headers['x-rapidapi-key'] = keys.JUDGE0_API_KEY;
                    judge0Headers['x-rapidapi-host'] = keys.JUDGE0_API_HOST;
                }

                try {
                    // POST /api/judge0/submit  →  POST Judge0 /submissions
                    if (req.method === 'POST' && path === '/submit') {
                        const body = await parseBody(req);
                        const upstream = await fetch(
                            `${keys.JUDGE0_BASE_URL}/submissions?base64_encoded=true&wait=false`,
                            { method: 'POST', headers: judge0Headers, body: JSON.stringify(body) }
                        );
                        const data = await upstream.json();
                        return sendJson(res, upstream.status, data);
                    }

                    // GET /api/judge0/submission/:token  →  GET Judge0 /submissions/:token
                    if (req.method === 'GET' && path.startsWith('/submission/')) {
                        const token = path.replace('/submission/', '').split('?')[0];
                        const upstream = await fetch(
                            `${keys.JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=true&fields=*`,
                            { method: 'GET', headers: judge0Headers }
                        );
                        const data = await upstream.json();
                        return sendJson(res, upstream.status, data);
                    }

                    next();
                } catch (err: any) {
                    console.error('❌ Judge0 proxy error:', err.message);
                    sendJson(res, 500, { error: `Judge0 proxy error: ${err.message}` });
                }
            });

            // ==================== ELEVENLABS SIGNED URL ====================
            server.middlewares.use('/api/elevenlabs-signed-url', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();

                if (!keys.ELEVENLABS_API_KEY) {
                    return sendJson(res, 500, { error: 'ElevenLabs API key not configured' });
                }

                // Rate limit: max 3 signed URLs per minute
                const rateCheck = checkAndRecordRate('elevenlabs', 3, 50);
                if (!rateCheck.ok) {
                    return sendJson(res, 429, { error: rateCheck.error });
                }

                try {
                    const agentId = process.env.VITE_ELEVENLABS_AGENT_ID || 'agent_1001kjd3c2k0ec59q6t0g57rxrem';
                    const response = await fetch(
                        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
                        {
                            method: 'GET',
                            headers: {
                                'xi-api-key': keys.ELEVENLABS_API_KEY,
                            },
                        }
                    );

                    if (!response.ok) {
                        const errText = await response.text();
                        console.error('❌ ElevenLabs signed URL error:', response.status, errText);
                        return sendJson(res, response.status, {
                            error: `ElevenLabs API error: ${response.status}`,
                            fallback: true,
                        });
                    }

                    const data = await response.json();
                    sendJson(res, 200, { signedUrl: data.signed_url });
                } catch (err: any) {
                    console.error('❌ ElevenLabs signed URL fetch failed:', err.message);
                    sendJson(res, 500, { error: 'Failed to get signed URL', fallback: true });
                }
            });

            // ==================== PHASE 3: GAP ANALYSIS & ROADMAP ====================
            
            // POST /api/analysis/run - Run full gap analysis
            server.middlewares.use('/api/analysis/run', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                try {
                    const { targetRole } = await parseBody(req);
                    if (!targetRole) return sendJson(res, 400, { error: 'targetRole required' });
                    
                    // Check if user has any profile data (resume, GitHub, or assessments)
                    const resumeCount = await resumeService.count(session.userId);
                    const assessmentCount = await practiceAptitudeService.count(session.userId);
                    const codingCount = await practiceCodingService.count(session.userId);
                    
                    if (resumeCount.count === 0 && assessmentCount.count === 0 && codingCount.count === 0) {
                        return sendJson(res, 400, { error: 'Please upload a resume or complete some practice assessments first to generate your gap analysis' });
                    }

                    // Fetch market skills from Phase 1 (external Python API or fallback)
                    const AURASKILL_API = process.env.VITE_AURASKILL_API_URL || 'http://localhost:5000';
                    let marketSkills: Array<{ skill: string; demand_score: number; trend: string; growth_rate: number; category: string }> = [];

                    try {
                        console.log(`🔍 Fetching real-time market data for: ${targetRole}`);
                        const skillResponse = await fetch(`${AURASKILL_API}/api/trends/combined?top_n=30&skill_type=technical`, {
                            signal: AbortSignal.timeout(5000) // 5 second timeout
                        });
                        if (skillResponse.ok) {
                            const data = await skillResponse.json();
                            marketSkills = data.skills.map((s: any) => ({
                                skill: s.skill,
                                demand_score: s.combined_score || s.ml_score || 50,
                                trend: s.combined_trend || s.ml_trend_direction || 'stable',
                                growth_rate: s.ml_growth_rate || 0,
                                category: s.category || 'technical',
                            }));
                            console.log(`✅ Fetched ${marketSkills.length} real-time market skills`);
                        }
                    } catch (apiErr) {
                        console.warn('⚠️ Could not fetch from AuraSkill API, using fallback market data');
                    }

                    // Fallback if API unavailable
                    if (marketSkills.length === 0) {
                        console.log('📋 Using fallback market data');
                        marketSkills = [
                            { skill: 'Python', demand_score: 90, trend: 'stable', growth_rate: 5, category: 'technical' },
                            { skill: 'JavaScript', demand_score: 88, trend: 'stable', growth_rate: 3, category: 'technical' },
                            { skill: 'React', demand_score: 85, trend: 'rising', growth_rate: 12, category: 'technical' },
                            { skill: 'Machine Learning', demand_score: 92, trend: 'rising', growth_rate: 25, category: 'technical' },
                            { skill: 'Docker', demand_score: 78, trend: 'stable', growth_rate: 6, category: 'technical' },
                            { skill: 'Kubernetes', demand_score: 87, trend: 'rising', growth_rate: 28, category: 'technical' },
                            { skill: 'AWS', demand_score: 89, trend: 'rising', growth_rate: 18, category: 'technical' },
                            { skill: 'TypeScript', demand_score: 80, trend: 'rising', growth_rate: 15, category: 'technical' },
                            { skill: 'SQL', demand_score: 75, trend: 'stable', growth_rate: 2, category: 'technical' },
                            { skill: 'Git', demand_score: 70, trend: 'stable', growth_rate: 0, category: 'technical' },
                            { skill: 'Node.js', demand_score: 82, trend: 'stable', growth_rate: 4, category: 'technical' },
                            { skill: 'MongoDB', demand_score: 68, trend: 'stable', growth_rate: 1, category: 'technical' },
                            { skill: 'PostgreSQL', demand_score: 72, trend: 'rising', growth_rate: 8, category: 'technical' },
                            { skill: 'GraphQL', demand_score: 65, trend: 'rising', growth_rate: 10, category: 'technical' },
                            { skill: 'TensorFlow', demand_score: 85, trend: 'rising', growth_rate: 20, category: 'technical' },
                            { skill: 'PyTorch', demand_score: 88, trend: 'rising', growth_rate: 22, category: 'technical' },
                            { skill: 'Vue.js', demand_score: 70, trend: 'stable', growth_rate: 5, category: 'technical' },
                            { skill: 'Angular', demand_score: 68, trend: 'declining', growth_rate: -3, category: 'technical' },
                            { skill: 'Java', demand_score: 75, trend: 'stable', growth_rate: 1, category: 'technical' },
                            { skill: 'Go', demand_score: 78, trend: 'rising', growth_rate: 16, category: 'technical' },
                        ];
                    }

                    // Run gap analysis
                    console.log(`🧮 Running gap analysis for user ${session.userId}`);
                    const analysis = await runGapAnalysis(null, session.userId, targetRole, marketSkills);
                    console.log(`✅ Gap analysis complete. Score: ${analysis.future_ready_score.overall}`);

                    sendJson(res, 200, { success: true, analysis });
                } catch (err: any) {
                    console.error('❌ Gap analysis error:', err);
                    sendJson(res, 500, { error: err.message || 'Gap analysis failed' });
                }
            });

            // GET /api/analysis/:user_id - Get latest gap analysis
            server.middlewares.use('/api/analysis', async (req: any, res: any, next: any) => {
                const path = getUrlPath(req);
                const match = path.match(/^\/api\/analysis\/([^\/]+)$/);
                
                if (req.method === 'GET' && match) {
                    const userId = match[1];
                    const session = await getFirebaseSession(req);
                    if (!session || (session.userId !== userId && !session.isAdmin)) {
                        return sendJson(res, 403, { error: 'Access denied' });
                    }

                    try {
                        const analysis = await gapAnalysisService.getByUser(userId);

                        if (!analysis) {
                            return sendJson(res, 404, { error: 'No gap analysis found' });
                        }

                        sendJson(res, 200, { success: true, analysis });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            });

            // POST /api/roadmap/generate - Generate learning roadmap
            server.middlewares.use('/api/roadmap/generate', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();
                const session = await getFirebaseSession(req);
                if (!session) return sendJson(res, 401, { error: 'Not authenticated' });

                try {
                    const { targetRole, gapAnalysisId } = await parseBody(req);
                    if (!targetRole) return sendJson(res, 400, { error: 'targetRole required' });
                    
                    // Get gap analysis
                    let gapId = gapAnalysisId;
                    if (!gapId) {
                        const analysis = await gapAnalysisService.getByUser(session.userId, targetRole);
                        gapId = analysis?.id;
                    }

                    if (!gapId) {
                        return sendJson(res, 400, { error: 'No gap analysis found. Run analysis first.' });
                    }

                    // Get skill gaps
                    const analysis = await gapAnalysisService.getById(gapId);
                    const skillGaps: SkillGap[] = analysis?.skillGaps || [];

                    // Generate roadmap
                    const roadmap = await generateLearningRoadmap(db, session.userId, targetRole, gapId, skillGaps);

                    sendJson(res, 200, { success: true, roadmap });
                } catch (err: any) {
                    console.error('❌ Roadmap generation error:', err);
                    sendJson(res, 500, { error: err.message || 'Roadmap generation failed' });
                }
            });

            // GET /api/roadmap/:user_id - Get latest roadmap
            server.middlewares.use('/api/roadmap', async (req: any, res: any, next: any) => {
                const path = getUrlPath(req);
                const match = path.match(/^\/api\/roadmap\/([^\/]+)$/);
                
                if (req.method === 'GET' && match) {
                    const userId = match[1];
                    const session = await getFirebaseSession(req);
                    if (!session || (session.userId !== userId && !session.isAdmin)) {
                        return sendJson(res, 403, { error: 'Access denied' });
                    }

                    try {
                        const roadmap = await learningRoadmapService.getByUser(userId);

                        if (!roadmap) {
                            return sendJson(res, 404, { error: 'No roadmap found' });
                        }

                        sendJson(res, 200, { success: true, roadmap });
                    } catch (err: any) {
                        sendJson(res, 500, { error: err.message });
                    }
                    return;
                }
                next();
            });

            // POST /api/analysis/narrative - Generate AI career narrative
            server.middlewares.use('/api/analysis/narrative', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();

                try {
                    const { targetRole, futureReadyScore, skillGaps, profileConflicts } = await parseBody(req);

                    // Validate required fields
                    if (!targetRole || !futureReadyScore) {
                        console.error('❌ Narrative: Missing required fields');
                        return sendJson(res, 400, { error: 'targetRole and futureReadyScore required' });
                    }

                    if (!keys.GEMINI_API_KEY) {
                        console.warn('⚠️ Gemini API key not configured, skipping narrative');
                        return sendJson(res, 503, { error: 'Gemini API not configured' });
                    }

                    // Check cache
                    const cacheKey = generateCacheKey({ targetRole, futureReadyScore, skillGaps: skillGaps?.slice(0, 10) || [] });
                    const cached = await narrativeCacheService.get(cacheKey, 'narrative');

                    if (cached) {
                        console.log('✅ Narrative: Using cached result');
                        return sendJson(res, 200, { success: true, narrative: JSON.parse(cached.output_data), cached: true });
                    }

                    // Generate narrative with Gemini
                    const criticalGaps = (skillGaps || []).filter((g: any) => g.priority === 'CRITICAL').slice(0, 3);
                    const strengths = (skillGaps || []).filter((g: any) => g.priority === 'STRENGTH').slice(0, 3);

                    console.log(`🤖 Generating narrative for ${targetRole} (Score: ${futureReadyScore.overall})`);

                    const prompt = `You are a career coach analyzing a candidate for a ${targetRole} role.

**Future-Ready Score:** ${futureReadyScore.overall}/100 (Grade ${futureReadyScore.grade})
- Resume Match: ${futureReadyScore.resume_match}/100
- GitHub Proof: ${futureReadyScore.github_match}/100  
- Assessment: ${futureReadyScore.assessment_performance}/100
- Market Alignment: ${futureReadyScore.market_alignment}/100

**Critical Skill Gaps:**
${criticalGaps.map((g: any) => `- ${g.skill}: ${g.gap} point gap, ${g.trend} trend (${g.growth_rate}% growth)`).join('\n')}

**Strengths:**
${strengths.map((g: any) => `- ${g.skill}: User score ${g.user_score}/100 vs market ${g.market_score}/100`).join('\n')}

**Profile Conflicts:** ${profileConflicts.length} issues found

Generate a JSON response with this exact structure:
{
  "executive_summary": "3-sentence assessment using the candidate's actual numbers and grade",
  "critical_insights": [
    {"skill": "SkillName", "insight": "Why this matters right now with specific market context"}
  ],
  "strength_callout": "One sentence highlighting their competitive advantage",
  "motivational_closing": "One encouraging statement with timeline reference"
}

Be specific. Reference the actual scores and trends. Never give generic advice.`;

                    const result = await callGemini(keys.GEMINI_API_KEY, prompt, { temperature: 0.7, maxTokens: 1024 });
                    
                    if (!result.success || !result.text) {
                        console.error('❌ Gemini API failed:', result.error);
                        return sendJson(res, 500, { error: result.error || 'Failed to generate narrative' });
                    }

                    let narrative;
                    try {
                        let clean = result.text.replace(/```json\n?|\n?```/g, '').trim();
                        const match = clean.match(/\{[\s\S]*\}/);
                        if (match) clean = match[0];
                        narrative = JSON.parse(clean);
                        console.log('✅ Narrative generated successfully');
                    } catch (parseErr) {
                        console.error('❌ Failed to parse Gemini response:', result.text?.substring(0, 200));
                        return sendJson(res, 500, { error: 'Failed to parse AI response' });
                    }

                    // Cache result
                    const cacheId = generateId();
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
                    try {
                        await narrativeCacheService.set({
                            id: cacheId,
                            cacheKey,
                            cacheType: 'narrative',
                            inputHash: cacheKey,
                            outputData: narrative,
                            expiresAt: expiresAt.toISOString()
                        });
                        console.log('💾 Narrative cached for 7 days');
                    } catch (cacheErr) {
                        console.warn('⚠️ Failed to cache narrative (non-fatal):', cacheErr);
                        // Continue anyway - caching failure shouldn't break the response
                    }

                    sendJson(res, 200, { success: true, narrative, cached: false });
                } catch (err: any) {
                    console.error('❌ Narrative generation error:', err.message || err);
                    console.error('Stack trace:', err.stack);
                    sendJson(res, 500, { error: err.message || 'Failed to generate narrative' });
                }
            });

            // POST /api/analysis/skill-explain - Explain specific skill gap
            server.middlewares.use('/api/analysis/skill-explain', async (req: any, res: any, next: any) => {
                if (req.method !== 'POST') return next();

                try {
                    const { skill, userScore, marketScore, targetRole } = await parseBody(req);

                    if (!keys.GEMINI_API_KEY) {
                        return sendJson(res, 503, { error: 'Gemini API not configured' });
                    }

                    // Check cache
                    const cacheKey = generateCacheKey({ skill, userScore, marketScore, targetRole });
                    const cached = await narrativeCacheService.get(cacheKey, 'skill_explain');

                    if (cached) {
                        return sendJson(res, 200, { success: true, explanation: cached, cached: true });
                    }

                    const prompt = `Explain why ${skill} matters for a ${targetRole} role.

User's current level: ${userScore}/100
Market requirement: ${marketScore}/100
Gap: ${marketScore - userScore} points

Provide exactly 3 sentences in this JSON format:
{
  "why_matters": "Why ${skill} is critical for ${targetRole} right now",
  "how_to_prove": "What the candidate specifically needs to do to prove proficiency",
  "project_idea": "One concrete GitHub project that would demonstrate this skill"
}`;

                    const result = await callGemini(keys.GEMINI_API_KEY, prompt, { temperature: 0.6, maxTokens: 512 });
                    
                    if (!result.success || !result.text) {
                        return sendJson(res, 500, { error: 'Failed to generate explanation' });
                    }

                    let explanation;
                    try {
                        let clean = result.text.replace(/```json\n?|\n?```/g, '').trim();
                        const match = clean.match(/\{[\s\S]*\}/);
                        if (match) clean = match[0];
                        explanation = JSON.parse(clean);
                    } catch (parseErr) {
                        return sendJson(res, 500, { error: 'Failed to parse AI response' });
                    }

                    // Cache result
                    const cacheId = generateId();
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
                    await narrativeCacheService.set({
                        id: cacheId,
                        cacheKey,
                        cacheType: 'skill_explain',
                        inputHash: cacheKey,
                        outputData: explanation,
                        expiresAt: expiresAt.toISOString()
                    });

                    sendJson(res, 200, { success: true, explanation, cached: false });
                } catch (err: any) {
                    console.error('❌ Skill explanation error:', err);
                    sendJson(res, 500, { error: err.message });
                }
            });

            // ==================== OPENAI PROXY (KEEP EXISTING) ====================
            // Re-use the existing OpenAI proxy routes
            const { openaiProxyPlugin } = require('./openaiProxy');
            // This is already registered via vite.config, we'll keep it as-is
        },
    };
}

