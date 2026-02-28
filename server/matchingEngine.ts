/**
 * AuraSkill Phase 3: Matching Engine
 * Compares market demand (Phase 1) with user skills (Phase 2)
 * Generates gap analysis, future-ready score, and learning roadmap
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface SkillGap {
  skill: string;
  user_score: number;
  market_score: number;
  gap: number;
  priority: 'CRITICAL' | 'IMPORTANT' | 'MONITOR' | 'STRENGTH' | 'RESKILL_ALERT';
  trend: string;
  growth_rate: number;
  estimated_hours: number;
  category: string;
}

export interface ProfileConflict {
  type: 'CLAIMED_UNPROVEN' | 'PROVEN_UNCLAIMED' | 'ASSESSMENT_CONTRADICTION';
  skill: string;
  description: string;
  action: string;
  severity: 'high' | 'medium' | 'low';
}

export interface FutureReadyScore {
  overall: number;
  grade: string;
  resume_match: number;
  github_match: number;
  assessment_performance: number;
  market_alignment: number;
}

export interface GapAnalysisResult {
  id: string;
  user_id: string;
  target_role: string;
  future_ready_score: FutureReadyScore;
  skill_gaps: SkillGap[];
  profile_conflicts: ProfileConflict[];
  job_ready_date: string;
  job_ready_months: number;
  created_at: string;
}

export interface RoadmapPhase {
  month: number;
  title: string;
  skills: Array<{
    skill: string;
    priority: string;
    hours: number;
    courses: Array<{
      name: string;
      platform: string;
      duration: string;
      free: boolean;
      url: string;
    }>;
  }>;
  total_hours: number;
  projected_score_improvement: number;
}

export interface LearningRoadmap {
  id: string;
  user_id: string;
  target_role: string;
  mermaid_code: string;
  monthly_plan: RoadmapPhase[];
  total_months: number;
  total_hours: number;
  job_ready_date: string;
  created_at: string;
}

// ============================================================================
// SKILL SCORING & TRUST HIERARCHY
// ============================================================================

/**
 * Calculate verified score using trust hierarchy:
 * GitHub (50%) > Assessment (30%) > Resume (20%)
 */
export function calculateVerifiedScore(
  resume_score: number,
  github_score: number,
  assessment_score: number
): number {
  const GITHUB_WEIGHT = 0.5;
  const ASSESSMENT_WEIGHT = 0.3;
  const RESUME_WEIGHT = 0.2;

  return (
    github_score * GITHUB_WEIGHT +
    assessment_score * ASSESSMENT_WEIGHT +
    resume_score * RESUME_WEIGHT
  );
}

/**
 * Classify gap into priority category
 */
export function classifyGap(
  user_score: number,
  market_score: number,
  trend: string,
  growth_rate: number
): 'CRITICAL' | 'IMPORTANT' | 'MONITOR' | 'STRENGTH' | 'RESKILL_ALERT' {
  const gap = market_score - user_score;

  // STRENGTH: user exceeds market requirement
  if (gap <= 0) {
    // But check if it's a declining skill
    if (trend === 'declining' || growth_rate < -10) {
      return 'RESKILL_ALERT';
    }
    return 'STRENGTH';
  }

  // CRITICAL: significant gap + growing demand
  if (gap >= 30 && (trend === 'rising' || growth_rate > 15)) {
    return 'CRITICAL';
  }

  // IMPORTANT: moderate gap + stable/growing demand
  if (gap >= 15 && (trend === 'stable' || trend === 'rising')) {
    return 'IMPORTANT';
  }

  // MONITOR: minor gap or stable demand
  return 'MONITOR';
}

/**
 * Estimate learning hours based on gap size and skill complexity
 */
export function estimateLearningHours(gap: number, skill: string): number {
  // Base hours per 10 points of gap
  const BASE_HOURS_PER_10_POINTS = 8;
  
  // Complexity multipliers for certain skill types
  const complexSkills = ['Machine Learning', 'AI', 'Kubernetes', 'System Design', 'Blockchain'];
  const isComplex = complexSkills.some(s => skill.toLowerCase().includes(s.toLowerCase()));
  const multiplier = isComplex ? 1.5 : 1.0;

  const hours = Math.ceil((gap / 10) * BASE_HOURS_PER_10_POINTS * multiplier);
  return Math.max(10, Math.min(hours, 100)); // Between 10-100 hours
}

// ============================================================================
// USER SKILL PROFILE FETCHING
// ============================================================================

export interface UserSkillProfile {
  skill: string;
  resume_score: number;
  github_score: number;
  assessment_score: number;
  verified_score: number;
}

/**
 * Fetch or build user's skill profile from all evidence sources
 */
export async function getUserSkillProfile(
  db: Database.Database,
  userId: string
): Promise<Map<string, UserSkillProfile>> {
  const profileMap = new Map<string, UserSkillProfile>();

  // 1. Get skills from resume
  const resume = db.prepare('SELECT parsed_data FROM resumes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId) as { parsed_data?: string } | undefined;
  if (resume && resume.parsed_data) {
    try {
      const parsed = JSON.parse(resume.parsed_data);
      const skills = parsed.skills || parsed.skills_extracted?.technical_skills || [];
      
      for (const skillItem of skills) {
        const skillName = typeof skillItem === 'string' ? skillItem : skillItem.skill;
        const proficiency = typeof skillItem === 'object' ? skillItem.proficiency || 50 : 50;
        
        if (!profileMap.has(skillName)) {
          profileMap.set(skillName, {
            skill: skillName,
            resume_score: proficiency,
            github_score: 0,
            assessment_score: 0,
            verified_score: 0,
          });
        } else {
          profileMap.get(skillName)!.resume_score = proficiency;
        }
      }
    } catch (err) {
      console.error('Error parsing resume data:', err);
    }
  }

  // 2. Get skills from GitHub (via user_skill_profiles if previously analyzed)
  const githubSkills = db.prepare('SELECT skill_name, github_score FROM user_skill_profiles WHERE user_id = ?').all(userId) as Array<{ skill_name: string; github_score: number }>;
  for (const row of githubSkills) {
    if (row.github_score > 0) {
      if (!profileMap.has(row.skill_name)) {
        profileMap.set(row.skill_name, {
          skill: row.skill_name,
          resume_score: 0,
          github_score: row.github_score,
          assessment_score: 0,
          verified_score: 0,
        });
      } else {
        profileMap.get(row.skill_name)!.github_score = row.github_score;
      }
    }
  }

  // 3. Get skills from assessments
  // Practice aptitude scores
  const aptitude = db.prepare('SELECT category_performance FROM practice_aptitude WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId) as { category_performance?: string } | undefined;
  if (aptitude && aptitude.category_performance) {
    try {
      const perf = JSON.parse(aptitude.category_performance);
      Object.entries(perf).forEach(([category, score]) => {
        const normalizedScore = typeof score === 'number' ? score : 50;
        const skill = category;
        
        if (!profileMap.has(skill)) {
          profileMap.set(skill, {
            skill,
            resume_score: 0,
            github_score: 0,
            assessment_score: normalizedScore,
            verified_score: 0,
          });
        } else {
          profileMap.get(skill)!.assessment_score = normalizedScore;
        }
      });
    } catch (err) {
      console.error('Error parsing aptitude performance:', err);
    }
  }

  // Practice coding scores (use language proficiency as assessment score)
  const coding = db.prepare('SELECT session_data FROM practice_coding WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId) as Array<{ session_data?: string }>;
  const languageScores = new Map<string, number[]>();
  
  for (const session of coding) {
    if (session.session_data) {
      try {
        const data = JSON.parse(session.session_data);
        if (data.language) {
          const score = data.testsPassed ? (data.testsPassed / (data.testsTotal || 1)) * 100 : 50;
          if (!languageScores.has(data.language)) {
            languageScores.set(data.language, []);
          }
          languageScores.get(data.language)!.push(score);
        }
      } catch (err) {
        // Skip invalid session data
      }
    }
  }

  // Average coding scores per language
  languageScores.forEach((scores, language) => {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (!profileMap.has(language)) {
      profileMap.set(language, {
        skill: language,
        resume_score: 0,
        github_score: 0,
        assessment_score: avgScore,
        verified_score: 0,
      });
    } else {
      profileMap.get(language)!.assessment_score = Math.max(
        profileMap.get(language)!.assessment_score,
        avgScore
      );
    }
  });

  // Calculate verified scores
  profileMap.forEach((profile, skill) => {
    profile.verified_score = calculateVerifiedScore(
      profile.resume_score,
      profile.github_score,
      profile.assessment_score
    );
  });

  return profileMap;
}

// ============================================================================
// PROFILE CONFLICT DETECTION
// ============================================================================

export function detectProfileConflicts(
  userProfile: Map<string, UserSkillProfile>
): ProfileConflict[] {
  const conflicts: ProfileConflict[] = [];

  userProfile.forEach((profile, skill) => {
    const { resume_score, github_score, assessment_score } = profile;

    // CLAIMED_UNPROVEN: High resume score, but no GitHub or assessment evidence
    if (resume_score >= 60 && github_score < 20 && assessment_score < 30) {
      conflicts.push({
        type: 'CLAIMED_UNPROVEN',
        skill,
        description: `You listed ${skill} on your resume (${resume_score}/100), but have minimal GitHub evidence (${github_score}/100) and low assessment performance (${assessment_score}/100).`,
        action: `Build a public GitHub project demonstrating ${skill} or take an assessment to validate your claim.`,
        severity: 'high',
      });
    }

    // PROVEN_UNCLAIMED: High GitHub score but not on resume
    if (github_score >= 60 && resume_score < 30) {
      conflicts.push({
        type: 'PROVEN_UNCLAIMED',
        skill,
        description: `Your GitHub shows strong ${skill} activity (${github_score}/100), but it's not prominently featured on your resume (${resume_score}/100).`,
        action: `Add ${skill} to your resume and highlight relevant projects to strengthen applications.`,
        severity: 'medium',
      });
    }

    // ASSESSMENT_CONTRADICTION: Large divergence between GitHub and assessment
    if (Math.abs(github_score - assessment_score) >= 40 && github_score > 20 && assessment_score > 20) {
      if (github_score > assessment_score) {
        conflicts.push({
          type: 'ASSESSMENT_CONTRADICTION',
          skill,
          description: `Your GitHub ${skill} score (${github_score}/100) is much higher than your assessment score (${assessment_score}/100).`,
          action: `You use ${skill} practically but may lack theoretical depth. Review fundamentals and best practices.`,
          severity: 'low',
        });
      } else {
        conflicts.push({
          type: 'ASSESSMENT_CONTRADICTION',
          skill,
          description: `Your assessment ${skill} score (${assessment_score}/100) is higher than your GitHub activity (${github_score}/100).`,
          action: `You understand ${skill} theoretically but need more hands-on practice. Build real projects.`,
          severity: 'medium',
        });
      }
    }
  });

  return conflicts;
}

// ============================================================================
// FUTURE-READY SCORE CALCULATION
//============================================================================

export function calculateFutureReadyScore(
  userProfile: Map<string, UserSkillProfile>,
  skillGaps: SkillGap[]
): FutureReadyScore {
  // Component 1: Resume Match (0-100)
  // Average of resume scores for all skills with market demand
  const resumeMatches = skillGaps.filter(g => g.user_score > 0);
  const resume_match = resumeMatches.length > 0
    ? resumeMatches.reduce((sum, g) => sum + Math.min(g.user_score, g.market_score), 0) / resumeMatches.length
    : 0;

  // Component 2: GitHub Match (0-100)
  // Average GitHub scores weighted by market importance
  let githubTotal = 0;
  let githubWeight = 0;
  userProfile.forEach((profile) => {
    if (profile.github_score > 0) {
      githubTotal += profile.github_score;
      githubWeight += 1;
    }
  });
  const github_match = githubWeight > 0 ? githubTotal / githubWeight : 0;

  // Component 3: Assessment Performance (0-100)
  // Average assessment scores across all skills
  let assessmentTotal = 0;
  let assessmentWeight = 0;
  userProfile.forEach((profile) => {
    if (profile.assessment_score > 0) {
      assessmentTotal += profile.assessment_score;
      assessmentWeight += 1;
    }
  });
  const assessment_performance = assessmentWeight > 0 ? assessmentTotal / assessmentWeight : 0;

  // Component 4: Market Alignment (0-100)
  // Are the user's strong skills growing or declining?
  const strongSkills = Array.from(userProfile.values()).filter(p => p.verified_score >= 60);
  let alignmentScore = 50; // Neutral baseline
  
  if (strongSkills.length > 0) {
    let risingCount = 0;
    let decliningCount = 0;

    strongSkills.forEach((profile) => {
      const gap = skillGaps.find(g => g.skill === profile.skill);
      if (gap) {
        if (gap.trend === 'rising' || gap.growth_rate > 10) risingCount++;
        if (gap.trend === 'declining' || gap.growth_rate < -10) decliningCount++;
      }
    });

    // Boost if strong in growing skills, penalize if strong in declining
    alignmentScore = 50 + (risingCount * 10) - (decliningCount * 15);
    alignmentScore = Math.max(0, Math.min(100, alignmentScore));
  }

  // Overall score: Weighted average
  // Resume: 25%, GitHub: 30%, Assessment: 25%, Market Alignment: 20%
  const overall = (
    resume_match * 0.25 +
    github_match * 0.30 +
    assessment_performance * 0.25 +
    alignmentScore * 0.20
  );

  // Letter grade
  let grade = 'F';
  if (overall >= 90) grade = 'A';
  else if (overall >= 80) grade = 'B';
  else if (overall >= 70) grade = 'C';
  else if (overall >= 60) grade = 'D';

  return {
    overall: Math.round(overall),
    grade,
    resume_match: Math.round(resume_match),
    github_match: Math.round(github_match),
    assessment_performance: Math.round(assessment_performance),
    market_alignment: Math.round(alignmentScore),
  };
}

// ============================================================================
// SKILL DEPENDENCY RESOLUTION
// ============================================================================

/**
 * Define prerequisite relationships between skills
 * Returns an array of prerequisite skill names for the given skill
 */
export function getSkillPrerequisites(skill: string): string[] {
  const dependencies: Record<string, string[]> = {
    // AI/ML
    'Machine Learning': ['Python', 'NumPy', 'Statistics'],
    'Deep Learning': ['Python', 'Machine Learning', 'TensorFlow'],
    'LLM Fine-tuning': ['Python', 'Machine Learning', 'PyTorch'],
    'Computer Vision': ['Python', 'Machine Learning', 'OpenCV'],
    'NLP': ['Python', 'Machine Learning'],
    'PyTorch': ['Python', 'Machine Learning'],
    'TensorFlow': ['Python', 'Machine Learning'],
    
    // DevOps
    'Kubernetes': ['Docker', 'Linux'],
    'CI/CD': ['Git', 'Docker'],
    'Terraform': ['Cloud Computing', 'DevOps'],
    'AWS': ['Cloud Computing'],
    'Azure': ['Cloud Computing'],
    'GCP': ['Cloud Computing'],
    
    // Frontend
    'React': ['JavaScript', 'HTML', 'CSS'],
    'Next.js': ['React', 'JavaScript'],
    'Vue': ['JavaScript', 'HTML', 'CSS'],
    'TypeScript': ['JavaScript'],
    'Tailwind CSS': ['CSS', 'HTML'],
    
    // Backend
    'Node.js': ['JavaScript'],
    'Express': ['Node.js'],
    'Django': ['Python'],
    'FastAPI': ['Python'],
    'GraphQL': ['JavaScript'],
    
    // Data
    'Spark': ['Python', 'SQL'],
    'Airflow': ['Python'],
    'dbt': ['SQL'],
    'Snowflake': ['SQL', 'Cloud Computing'],
  };

  const normalized = skill.trim();
  for (const [key, deps] of Object.entries(dependencies)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      return deps;
    }
  }

  return [];
}

/**
 * Sort skills by dependency order (prerequisites first)
 */
export function sortByDependencies(skills: SkillGap[]): SkillGap[] {
  const sorted: SkillGap[] = [];
  const remaining = [...skills];
  const added = new Set<string>();

  let iterations = 0;
  const maxIterations = skills.length * 2;

  while (remaining.length > 0 && iterations < maxIterations) {
    iterations++;
    let progress = false;

    for (let i = remaining.length - 1; i >= 0; i--) {
      const skill = remaining[i];
      const prerequisites = getSkillPrerequisites(skill.skill);
      
      // Check if all prerequisites are already added or not in the list
      const prereqsMet = prerequisites.every(
        prereq => added.has(prereq) || !remaining.some(s => s.skill.toLowerCase().includes(prereq.toLowerCase()))
      );

      if (prereqsMet) {
        sorted.push(skill);
        added.add(skill.skill);
        remaining.splice(i, 1);
        progress = true;
      }
    }

    // If no progress, add remaining skills to avoid infinite loop
    if (!progress) {
      sorted.push(...remaining);
      break;
    }
  }

  return sorted;
}

// ============================================================================
// MAIN GAP ANALYSIS FUNCTION
// ============================================================================

export async function runGapAnalysis(
  db: Database.Database,
  userId: string,
  targetRole: string,
  marketSkills: Array<{ skill: string; demand_score: number; trend: string; growth_rate: number; category: string }>
): Promise<GapAnalysisResult> {
  // 1. Get user skill profile
  const userProfile = await getUserSkillProfile(db, userId);

  // 2. Build comprehensive skill gap list
  const skillGaps: SkillGap[] = [];
  const allSkills = new Set([
    ...marketSkills.map(s => s.skill),
    ...Array.from(userProfile.keys()),
  ]);

  allSkills.forEach(skill => {
    const marketSkill = marketSkills.find(s => s.skill === skill);
    const userSkill = userProfile.get(skill);

    const user_score = userSkill ? userSkill.verified_score : 0;
    const market_score = marketSkill ? marketSkill.demand_score : 0;
    const trend = marketSkill ? marketSkill.trend : 'stable';
    const growth_rate = marketSkill ? marketSkill.growth_rate : 0;
    const category = marketSkill ? marketSkill.category : 'general';

    const gap = market_score - user_score;
    const priority = classifyGap(user_score, market_score, trend, growth_rate);
    const estimated_hours = priority === 'STRENGTH' ? 0 : estimateLearningHours(Math.abs(gap), skill);

    skillGaps.push({
      skill,
      user_score,
      market_score,
      gap,
      priority,
      trend,
      growth_rate,
      estimated_hours,
      category,
    });
  });

  // 3. Detect profile conflicts
  const profile_conflicts = detectProfileConflicts(userProfile);

  // 4. Calculate future-ready score
  const future_ready_score = calculateFutureReadyScore(userProfile, skillGaps);

  // 5. Calculate job-ready timeline
  const criticalGaps = skillGaps.filter(g => g.priority === 'CRITICAL' || g.priority === 'IMPORTANT');
  const totalHours = criticalGaps.reduce((sum, g) => sum + g.estimated_hours, 0);
  const HOURS_PER_MONTH = 20;
  const job_ready_months = Math.ceil(totalHours / HOURS_PER_MONTH);
  
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + job_ready_months);
  const job_ready_date = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // 6. Save to database
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO gap_analyses 
    (id, user_id, target_role, future_ready_score, resume_match_score, github_match_score, 
     assessment_score, market_alignment_score, grade, skill_gaps, profile_conflicts, 
     job_ready_date, job_ready_months, analysis_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    targetRole,
    future_ready_score.overall,
    future_ready_score.resume_match,
    future_ready_score.github_match,
    future_ready_score.assessment_performance,
    future_ready_score.market_alignment,
    future_ready_score.grade,
    JSON.stringify(skillGaps),
    JSON.stringify(profile_conflicts),
    job_ready_date,
    job_ready_months,
    JSON.stringify({ userProfile: Array.from(userProfile.entries()) })
  );

  return {
    id,
    user_id: userId,
    target_role: targetRole,
    future_ready_score,
    skill_gaps: skillGaps,
    profile_conflicts,
    job_ready_date,
    job_ready_months,
    created_at: new Date().toISOString(),
  };
}

// ============================================================================
// GENERATE HASH FOR CACHING
// ============================================================================

export function generateCacheKey(input: unknown): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(input));
  return hash.digest('hex');
}
