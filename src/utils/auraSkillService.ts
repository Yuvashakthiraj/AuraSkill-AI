/**
 * AuraSkill API Service
 * Connects to the Python FastAPI backend for skill demand forecasting,
 * resume-JD matching, profile analysis, and live job scraping.
 */

// Base URL from environment (set in .env as VITE_AURASKILL_API_URL)
const AURASKILL_API = import.meta.env.VITE_AURASKILL_API_URL || 'http://localhost:5000';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AuraSkillOverview {
  total_postings: number;
  total_roles: number;
  total_categories: number;
  total_skills_tracked: number;
  remote_pct: number;
  avg_salary: number;
  grok_enabled: boolean;
}

export interface CombinedSkillTrend {
  skill: string;
  skill_type: 'technical' | 'soft';
  category: string;
  combined_score: number;
  ml_score: number;
  ai_score: number;
  ml_weight_used: number;
  ai_weight_used: number;
  current_demand_pct: number;
  ml_growth_rate: number;
  ai_predicted_growth: string;
  ml_trend_direction: 'rising' | 'stable' | 'declining';
  ai_trend_direction: string;
  combined_trend: 'rising' | 'stable' | 'declining';
  predicted_2031_pct: number;
  confidence: string;
  ai_reasoning: string;
  total_job_mentions: number;
}

export interface CombinedTrendsResponse {
  skills: CombinedSkillTrend[];
  meta: {
    ml_weight: number;
    ai_weight: number;
    ai_available: boolean;
    total_skills_analyzed: number;
    skill_type_filter: string;
    methodology: string;
  };
  market_insight: string;
}

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  tags?: string[];
  source: string;
  url?: string;
}

export interface TopSkillDemanded {
  skill: string;
  frequency: string;
  trend: string;
  context: string;
}

export interface EmergingSkill {
  skill: string;
  evidence: string;
  growth_potential: string;
}

export interface DecliningSkill {
  skill: string;
  evidence: string;
}

export interface RoleEvolution {
  role: string;
  change: string;
}

export interface ScrapeJobsAnalysis {
  market_summary: string;
  top_skills_demanded: TopSkillDemanded[];
  emerging_skills: EmergingSkill[];
  declining_skills: DecliningSkill[];
  salary_insights: string;
  remote_work_trend: string;
  ai_impact: string;
  role_evolution: RoleEvolution[];
  recommendations: string[];
  jobs_analyzed: number;
  sources: string[];
  confidence: string;
  data_source?: string;
  analysis_date?: string;
}

export interface ScrapeJobsResponse {
  success: boolean;
  jobs_scraped: number;
  query: string;
  jobs: ScrapedJob[];
  analysis?: ScrapeJobsAnalysis;
  scrape_note?: string;
}

export interface ProfileAnalysisInput {
  github_url: string;
  linkedin_url: string;
  career_goal: string;
  resume_text?: string;
}

export interface ProfileAnalysisResult {
  success: boolean;
  radarData: Array<{
    subject: string;
    score: number;
    github: number;
    linkedin: number;
    resume: number;
    fullMark: number;
  }>;
  score: number;
  gaps: string[];
  improvements: {
    general: string[];
    job_based: string[];
  };
  phases: Array<{
    phase: string;
    title: string;
    focus: string;
    duration: string;
    details: string;
  }>;
  videos: Array<{
    id: string;
    title: string;
    thumbnail: string;
    channel: string;
  }>;
  githubLanguages: string[];
  userInfo: {
    name: string;
    avatar_url: string | null;
  };
  linkedinProfile: {
    job_titles: string[];
    company: string;
    skills: Array<{ skill: string; proficiency: number }>;
    experience_years: number;
  };
  careerGoal: string;
  stepsCompleted: string[];
  availableGoals: string[];
}

export interface ResumeJDMatchInput {
  resume_text: string;
  jd_text: string;
}

export interface ResumeJDMatchResult {
  success: boolean;
  overall_score: number;
  fit_level: 'Strong Fit' | 'Good Fit' | 'Partial Fit' | 'Weak Fit';
  scores: {
    required_match_pct: number;
    preferred_match_pct: number;
    tools_match_pct: number;
    scoring_weights: string;
  };
  resume_analysis: {
    total_skills_found: number;
    experience_level: string;
    years_experience: number | null;
    strengths: string[];
    education: string;
    summary: string;
    skills: Array<{ skill: string; proficiency: number; skill_type: string; source: string }>;
    extraction_method: string;
  };
  jd_analysis: {
    required_skills: string[];
    preferred_skills: string[];
    tools: string[];
    experience_level: string;
    domain: string;
    summary: string;
  };
  match_details: {
    matched_required: Array<{ skill: string; proficiency: number }>;
    matched_preferred: Array<{ skill: string; proficiency: number }>;
    matched_tools: Array<{ skill: string; proficiency: number }>;
    total_matched: number;
  };
  gaps: {
    missing_required: Array<{ skill: string; priority: string }>;
    missing_preferred: Array<{ skill: string; priority: string }>;
    missing_tools: Array<{ skill: string; priority: string }>;
    total_missing: number;
    critical_count: number;
  };
  bonus_skills: Array<{ skill: string; proficiency: number }>;
  ai_assessment: {
    verdict: string;
    summary: string;
    talking_points: string[];
    improvement_plan: Array<{ skill: string; action: string; timeframe: string; priority: string }>;
    interview_tips: string[];
    salary_negotiation: string;
  } | null;
  steps_completed: string[];
}

export interface SkillGapInput {
  user_skills: string[];
  target_role: string;
}

export interface SkillGapResult {
  target_role: string;
  match_score: number;
  total_market_skills: number;
  matched_skills: Array<{ skill: string; market_demand: number; status: string }>;
  skill_gaps: Array<{ skill: string; market_demand: number; priority: string; status: string }>;
  extra_skills: string[];
  critical_gaps: Array<{ skill: string; market_demand: number; priority: string; status: string }>;
  high_gaps: Array<{ skill: string; market_demand: number; priority: string; status: string }>;
  medium_gaps: Array<{ skill: string; market_demand: number; priority: string; status: string }>;
  role_stats: {
    posting_count: number;
    avg_salary: number | null;
    remote_pct: number | null;
  };
  readiness_level: string;
  sample_jobs: Array<{
    title: string;
    company_name: string;
    location: string;
    experience_level: string;
    remote_allowed: number;
    med_salary: number | null;
    job_posting_url: string | null;
    listed_date: string;
  }>;
}

export interface LearningPathwayInput {
  user_skills: string[];
  target_role: string;
  skill_gaps: string[];
}

export interface LearningPathway {
  pathway_title?: string;
  estimated_duration?: string;
  phases: Array<{
    phase: number;
    title: string;
    duration: string;
    skills_covered?: string[];
    skills?: string[];
    steps?: Array<{
      order: number;
      action: string;
      resource: string;
      resource_url?: string;
      resource_type: string;
      estimated_hours?: number;
      why?: string;
    }>;
    resources?: Array<{ name: string; type: string; url?: string }>;
    project?: string;
  }>;
  total_duration?: string;
  projects?: Array<{
    title: string;
    description: string;
    skills_practiced: string[];
    difficulty: string;
  }>;
  certifications?: Array<{
    name: string;
    provider?: string;
    relevance?: string;
  }>;
  certification_path?: string[];
  career_progression?: string;
  advice?: string;
}

export interface AvailableRole {
  title: string;
  category: string;
  posting_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────────────────

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${AURASKILL_API}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `API error: ${res.status}`);
  }
  
  return res.json();
}

/** Get overview stats from AuraSkill backend */
export async function getOverview(): Promise<AuraSkillOverview> {
  return fetchApi('/api/overview');
}

/** Get combined ML + AI skill trends (unified 0-100 scores) */
export async function getCombinedTrends(
  topN: number = 30,
  skillType: 'all' | 'technical' | 'soft' = 'all'
): Promise<CombinedTrendsResponse> {
  return fetchApi(`/api/trends/combined?top_n=${topN}&skill_type=${skillType}`);
}

/** Get top skills by frequency */
export async function getTopSkills(limit: number = 25, skillType: string = 'all') {
  return fetchApi<{
    skills: Array<{
      skill_name: string;
      category: string;
      total_freq: number;
      avg_pct: number;
    }>;
    skill_type: string;
  }>(`/api/trends/top-skills?limit=${limit}&skill_type=${skillType}`);
}

/** Get ML forecasts for multiple skills */
export async function getAllForecasts(topN: number = 10, periods: number = 24, skillType: string = 'technical') {
  return fetchApi<{
    forecasts: Array<{
      skill: string;
      model: string;
      skill_type: string;
      current_demand: number;
      predicted_2031: number;
      growth_rate: number;
      r2_score: number;
      trend_direction: string;
      historical: Array<{ period: string; demand_pct: number }>;
      forecast: Array<{ period: string; demand_pct: number }>;
    }>;
    count: number;
    skill_type: string;
  }>(`/api/trends/forecast?top_n=${topN}&periods=${periods}&skill_type=${skillType}`);
}

/** Get forecast for a specific skill */
export async function getSkillForecast(skillName: string, periods: number = 12) {
  return fetchApi<{
    skill: string;
    model: string;
    skill_type: string;
    current_demand: number;
    predicted_2031: number;
    growth_rate: number;
    r2_score: number;
    trend_direction: string;
    historical: Array<{ period: string; demand_pct: number }>;
    forecast: Array<{ period: string; demand_pct: number }>;
  }>(`/api/trends/forecast/${encodeURIComponent(skillName)}?periods=${periods}`);
}

/** Get AI predictions (Groq LLM analysis) */
export async function getAIPredictions() {
  return fetchApi<{
    analysis: {
      market_insight: string;
      top_emerging: string[];
      top_declining: string[];
      predictions: Array<{
        skill: string;
        current_demand_pct: number;
        predicted_growth_12m: string;
        confidence: string;
        trend_direction: string;
        reasoning: string;
      }>;
    };
  }>('/api/trends/ai-predictions');
}

/** Scrape live jobs and analyze with NLP */
export async function scrapeJobs(query: string, limit: number = 20): Promise<ScrapeJobsResponse> {
  return fetchApi('/api/scrape-jobs', {
    method: 'POST',
    body: JSON.stringify({ query, limit }),
  });
}

/** Run full profile analysis (GitHub + LinkedIn + Resume + AI) */
export async function analyzeProfile(input: ProfileAnalysisInput): Promise<ProfileAnalysisResult> {
  return fetchApi('/api/profile/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Get available career goals for profile analysis */
export async function getProfileGoals(): Promise<{ goals: string[] }> {
  return fetchApi('/api/profile/goals');
}

/** Match resume against job description */
export async function matchResumeToJD(input: ResumeJDMatchInput): Promise<ResumeJDMatchResult> {
  return fetchApi('/api/resume-jd/match', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Analyze resume only (skill extraction) */
export async function analyzeResume(resumeText: string) {
  return fetchApi<{
    success: boolean;
    total_skills: number;
    skills: Array<{ skill: string; proficiency: number; skill_type: string }>;
    experience_level: string;
    years_experience: number | null;
    strengths: string[];
    education: string;
    summary: string;
    method: string;
  }>('/api/resume/analyze', {
    method: 'POST',
    body: JSON.stringify({ resume_text: resumeText }),
  });
}

/** Analyze skill gap between user skills and target role */
export async function analyzeSkillGap(input: SkillGapInput): Promise<SkillGapResult> {
  return fetchApi('/api/skill-gap', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Get available roles for skill gap analysis */
export async function getAvailableRoles(): Promise<{ roles: AvailableRole[] }> {
  return fetchApi('/api/roles');
}

/** Get available skills */
export async function getAvailableSkills(): Promise<{ skills: string[] }> {
  return fetchApi('/api/skills');
}

/** Generate AI-powered learning pathway */
export async function generateLearningPathway(input: LearningPathwayInput): Promise<{ success: boolean; pathway: LearningPathway }> {
  return fetchApi('/api/learning-pathway', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Get YouTube tutorials for a skill */
export async function getSkillTutorials(skill: string, maxResults: number = 3) {
  return fetchApi<{ skill: string; videos: Array<{ title: string; url: string; thumbnail: string; channel: string }> }>(
    `/api/youtube/tutorials?skill=${encodeURIComponent(skill)}&max_results=${maxResults}`
  );
}

/** Get YouTube tutorials for multiple skills */
export async function getMultiSkillTutorials(skills: string[], maxPerSkill: number = 2) {
  return fetchApi<{ tutorials: Record<string, Array<{ title: string; url: string; thumbnail: string; channel: string }>> }>(
    '/api/youtube/multi-tutorials',
    {
      method: 'POST',
      body: JSON.stringify({ skills, max_per_skill: maxPerSkill }),
    }
  );
}

/** Get role demand statistics */
export async function getRoleDemand() {
  return fetchApi<{
    roles: Array<{
      category: string;
      posting_count: number;
      percentage: number;
      avg_salary: number | null;
      remote_count: number;
    }>;
  }>('/api/trends/role-demand');
}

/** Check if AuraSkill backend is available */
export async function checkAuraSkillHealth(): Promise<boolean> {
  try {
    await getOverview();
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JD Analyzer (NLP Skill Extraction)
// ─────────────────────────────────────────────────────────────────────────────

export interface JDExtractionResult {
  required_skills: string[];
  preferred_skills: string[];
  tools: string[];
  experience_level: string;
  domain: string;
  summary: string;
}

export interface JDExtractionResponse {
  success: boolean;
  analysis: JDExtractionResult;
  nlp_method: string;
}

/** Extract skills from job description using AI NLP */
export async function extractSkillsFromJD(jdText: string): Promise<JDExtractionResponse> {
  return fetchApi('/api/extract-skills', {
    method: 'POST',
    body: JSON.stringify({ text: jdText }),
  });
}
