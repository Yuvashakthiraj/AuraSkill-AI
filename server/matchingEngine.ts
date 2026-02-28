/**
 * AuraSkill Phase 3: Matching Engine
 * Compares market demand (Phase 1) with user skills (Phase 2)
 * Generates gap analysis, future-ready score, and learning roadmap
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import crypto from 'crypto';
import {
  resumeService,
  practiceAptitudeService,
  practiceCodingService,
  userSkillProfileService,
  gapAnalysisService
} from './firestoreDAL';

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
 * If user has minimal data, give baseline credit to avoid 0% dummy appearance
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

  const calculated = (
    github_score * GITHUB_WEIGHT +
    assessment_score * ASSESSMENT_WEIGHT +
    resume_score * RESUME_WEIGHT
  );

  // If user has ANY claimed skill (resume_score > 0), give minimum 30% baseline
  // This reflects that self-reported skills often indicate real knowledge
  if (calculated === 0 && resume_score > 0) {
    return Math.min(resume_score * 0.6, 40); // Up to 40% baseline for claimed skills
  }

  // If completely no data, return 0
  return calculated;
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
  _db: any, // Deprecated: kept for backward compatibility
  userId: string
): Promise<Map<string, UserSkillProfile>> {
  const profileMap = new Map<string, UserSkillProfile>();

  // 1. Get skills from resume
  const resumes = await resumeService.getByUser(userId, 1);
  const resume = resumes[0];
  if (resume && resume.parsedData) {
    try {
      const parsed = typeof resume.parsedData === 'string' ? JSON.parse(resume.parsedData) : resume.parsedData;
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
  const userSkillProfile = await userSkillProfileService.getByUser(userId);
  if (userSkillProfile && userSkillProfile.skills) {
    const skills = typeof userSkillProfile.skills === 'string' 
      ? JSON.parse(userSkillProfile.skills) 
      : userSkillProfile.skills;
    
    for (const skillData of (Array.isArray(skills) ? skills : [])) {
      const skillName = skillData.skill_name || skillData.skill;
      const githubScore = skillData.github_score || 0;
      if (githubScore > 0 && skillName) {
        if (!profileMap.has(skillName)) {
          profileMap.set(skillName, {
            skill: skillName,
            resume_score: 0,
            github_score: githubScore,
            assessment_score: 0,
            verified_score: 0,
          });
        } else {
          profileMap.get(skillName)!.github_score = githubScore;
        }
      }
    }
  }

  // 3. Get skills from assessments
  // Practice aptitude scores
  const aptitudeResults = await practiceAptitudeService.getByUser(userId, 1);
  const aptitude = aptitudeResults[0];
  if (aptitude && aptitude.categoryPerformance) {
    try {
      const perf = typeof aptitude.categoryPerformance === 'string' 
        ? JSON.parse(aptitude.categoryPerformance) 
        : aptitude.categoryPerformance;
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
  const codingResults = await practiceCodingService.getByUser(userId, 5);
  const languageScores = new Map<string, number[]>();
  
  for (const session of codingResults) {
    const sessionData = session.session_data || session.sessionData;
    if (sessionData) {
      try {
        const data = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
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
  // Score based on claimed skills vs market demand
  const skillsWithUserScore = skillGaps.filter(g => g.user_score > 0);
  let resume_match = 0;
  
  if (skillsWithUserScore.length > 0) {
    // Calculate match based on user skills vs market needs
    const totalMatch = skillsWithUserScore.reduce((sum, g) => {
      // Give credit for any skill level, not just perfect matches
      const matchScore = Math.min(g.user_score, g.market_score);
      return sum + matchScore;
    }, 0);
    resume_match = totalMatch / skillsWithUserScore.length;
    
    // Bonus: If user has multiple skills, boost score
    const skillCountBonus = Math.min(skillsWithUserScore.length * 2, 10);
    resume_match = Math.min(resume_match + skillCountBonus, 100);
  } else {
    // Baseline: Award points for profile engagement
    const resumeSkills = Array.from(userProfile.values()).filter(p => p.resume_score > 0);
    const verifiedSkills = Array.from(userProfile.values()).filter(p => p.verified_score > 0);
    
    if (resumeSkills.length > 0) {
      // Has resume data - give substantial baseline
      const avgResumeScore = resumeSkills.reduce((sum, p) => sum + p.resume_score, 0) / resumeSkills.length;
      resume_match = Math.min(avgResumeScore * 0.7, 55); // Up to 55% for resume claims
    } else if (verifiedSkills.length > 0) {
      // Has some verified skills from other sources
      resume_match = verifiedSkills.reduce((sum, p) => sum + p.verified_score, 0) / verifiedSkills.length * 0.5;
    } else if (userProfile.size > 0) {
      // User started profile but no concrete data - minimal baseline
      resume_match = 25;
    } else {
      // Completely empty profile
      resume_match = 15; // Still give baseline to encourage improvement
    }
  }

  // Component 2: GitHub Match (0-100)
  // Give credit for having GitHub data, or baseline for potential
  let githubTotal = 0;
  let githubWeight = 0;
  userProfile.forEach((profile) => {
    if (profile.github_score > 0) {
      githubTotal += profile.github_score;
      githubWeight += 1;
    }
  });
  
  let github_match = 0;
  if (githubWeight > 0) {
    github_match = githubTotal / githubWeight;
    // Bonus for active GitHub profile
    github_match = Math.min(github_match + 5, 100);
  } else {
    // Baseline: Encourage GitHub profile creation
    const technicalSkills = Array.from(userProfile.values()).filter(p => 
      p.verified_score > 30 || p.resume_score > 40
    );
    if (technicalSkills.length >= 3) {
      github_match = 35; // Good potential, needs GitHub
    } else if (technicalSkills.length > 0) {
      github_match = 25; // Some skills, encourage GitHub
    } else {
      github_match = 15; // Minimal baseline
    }
  }

  // Component 3: Assessment Performance (0-100)
  // Reward assessment completion, provide encouraging baseline otherwise
  let assessmentTotal = 0;
  let assessmentWeight = 0;
  userProfile.forEach((profile) => {
    if (profile.assessment_score > 0) {
      assessmentTotal += profile.assessment_score;
      assessmentWeight += 1;
    }
  });
  
  let assessment_performance = 0;
  if (assessmentWeight > 0) {
    assessment_performance = assessmentTotal / assessmentWeight;
    // Bonus for taking assessments
    assessment_performance = Math.min(assessment_performance + 5, 100);
  } else {
    // Baseline: Give credit based on claimed/verified skills
    const claimedSkills = Array.from(userProfile.values()).filter(p => p.resume_score > 0 || p.verified_score > 0);
    if (claimedSkills.length >= 5) {
      assessment_performance = 35; // Many skills claimed, encourage verification
    } else if (claimedSkills.length >= 3) {
      assessment_performance = 30; // Some skills, needs assessment
    } else if (claimedSkills.length > 0) {
      assessment_performance = 25; // Few skills
    } else {
      assessment_performance = 15; // Minimal baseline
    }
  }

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
  _db: any, // Deprecated: kept for backward compatibility
  userId: string,
  targetRole: string,
  marketSkills: Array<{ skill: string; demand_score: number; trend: string; growth_rate: number; category: string }>
): Promise<GapAnalysisResult> {
  // 1. Get user skill profile
  const userProfile = await getUserSkillProfile(null, userId);

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
  await gapAnalysisService.createOrUpdate({
    id,
    userId,
    targetRole,
    futureReadyScore: future_ready_score.overall,
    resumeMatchScore: future_ready_score.resume_match,
    githubMatchScore: future_ready_score.github_match,
    assessmentScore: future_ready_score.assessment_performance,
    marketAlignmentScore: future_ready_score.market_alignment,
    grade: future_ready_score.grade,
    skillGaps,
    profileConflicts: profile_conflicts,
    jobReadyDate: job_ready_date,
    jobReadyMonths: job_ready_months,
    analysisData: { userProfile: Array.from(userProfile.entries()) }
  });

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
