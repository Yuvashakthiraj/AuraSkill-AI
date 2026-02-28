/**
 * Skill Trend Analysis Service
 *
 * Calls the backend /api/skill-trends/analyze endpoint which:
 * 1. Fetches 30+ news articles via News API across several tech/career queries
 * 2. Sends the article corpus to Gemini for NLP-based skill extraction
 * 3. Returns skill mentions, demand scores, trend directions, and industry breakdowns
 *
 * Results are cached in localStorage for 30 minutes to avoid unnecessary API calls.
 */
import { auth } from '@/lib/firebase';
// ─── Types ────────────────────────────────────────────────────────

export interface TrendSkill {
    name: string;
    mentions: number;
    demandScore: number;
    trend: 'rising' | 'stable' | 'declining';
    growthLabel: string;
    industry: string;
    category: string;
}

export interface EmergingSkill {
    name: string;
    reason: string;
}

export interface DecliningSkill {
    name: string;
    reason: string;
}

export interface IndustryBreakdown {
    industry: string;
    topSkills: string[];
    outlook: string;
}

export interface SourceArticle {
    title: string;
    source: string;
    url: string;
    publishedAt: string;
}

export interface SkillTrendAnalysis {
    success: boolean;
    totalArticlesAnalyzed: number;
    analyzedAt: string;
    summary: string;
    skills: TrendSkill[];
    emergingSkills: EmergingSkill[];
    decliningSkills: DecliningSkill[];
    industryBreakdown: IndustryBreakdown[];
    sourceArticles: SourceArticle[];
}

// ─── Cache ────────────────────────────────────────────────────────

const CACHE_KEY = 'vidyamitra_skill_trends';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCachedAnalysis(): SkillTrendAnalysis | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (Date.now() - cached._cachedAt > CACHE_TTL) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        return cached.data as SkillTrendAnalysis;
    } catch {
        return null;
    }
}

function setCachedAnalysis(data: SkillTrendAnalysis): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, _cachedAt: Date.now() }));
    } catch { /* ignore quota errors */ }
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Fetch the NLP-powered skill trend analysis from the backend.
 * Uses cache if available and fresh. Includes auth token if logged in.
 */
export async function fetchSkillTrends(): Promise<SkillTrendAnalysis> {
    // Check cache first
    const cached = getCachedAnalysis();
    if (cached) return cached;

    // Get fresh Firebase ID token if user is logged in
    const token = await auth.currentUser?.getIdToken(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/skill-trends/analyze', { headers });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Skill trend analysis failed (${res.status})`);
    }

    const data: SkillTrendAnalysis = await res.json();

    // Cache result
    setCachedAnalysis(data);

    return data;
}

/**
 * Clear the cached analysis (force next call to be fresh).
 */
export function clearSkillTrendsCache(): void {
    localStorage.removeItem(CACHE_KEY);
}
