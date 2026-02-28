/**
 * AuraSkill Phase 3: Learning Roadmap Generator
 * Generates month-by-month learning plans with course recommendations
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import type { SkillGap } from './matchingEngine';
import { sortByDependencies } from './matchingEngine';

export interface CourseResource {
  name: string;
  platform: string;
  duration: string;
  free: boolean;
  url: string;
}

export interface RoadmapSkill {
  skill: string;
  priority: string;
  hours: number;
  courses: CourseResource[];
}

export interface RoadmapMonth {
  month: number;
  title: string;
  skills: RoadmapSkill[];
  total_hours: number;
  projected_score_improvement: number;
}

export interface GeneratedRoadmap {
  id: string;
  user_id: string;
  target_role: string;
  gap_analysis_id: string;
  mermaid_code: string;
  monthly_plan: RoadmapMonth[];
  total_months: number;
  total_hours: number;
  job_ready_date: string;
  created_at: string;
}

// ============================================================================
// COURSE RECOMMENDATIONS DATABASE
// ============================================================================

/**
 * Get curated course recommendations for a skill
 * Uses real courses from major platforms
 */
export function getCourseRecommendations(skill: string): CourseResource[] {
  const skillLower = skill.toLowerCase();

  // Extensive course database with real resources
  const courseDatabase: Record<string, CourseResource[]> = {
    'python': [
      { name: 'Python for Everybody', platform: 'Coursera', duration: '8 weeks', free: true, url: 'https://www.coursera.org/specializations/python' },
      { name: 'Complete Python Bootcamp', platform: 'Udemy', duration: '22 hours', free: false, url: 'https://www.udemy.com/course/complete-python-bootcamp/' },
      { name: 'Learn Python', platform: 'Codecademy', duration: '25 hours', free: true, url: 'https://www.codecademy.com/learn/learn-python-3' },
    ],
    'javascript': [
      { name: 'JavaScript.info Tutorial', platform: 'JavaScript.info', duration: 'Self-paced', free: true, url: 'https://javascript.info/' },
      { name: 'Modern JavaScript', platform: 'Udemy', duration: '52 hours', free: false, url: 'https://www.udemy.com/course/the-complete-javascript-course/' },
      { name: 'JavaScript Algorithms', platform: 'freeCodeCamp', duration: '300 hours', free: true, url: 'https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/' },
    ],
    'react': [
      { name: 'React Official Docs', platform: 'React.dev', duration: 'Self-paced', free: true, url: 'https://react.dev/' },
      { name: 'React - The Complete Guide', platform: 'Udemy', duration: '49 hours', free: false, url: 'https://www.udemy.com/course/react-the-complete-guide/' },
      { name: 'Full Stack Open', platform: 'University of Helsinki', duration: '13 weeks', free: true, url: 'https://fullstackopen.com/' },
    ],
    'machine learning': [
      { name: 'Machine Learning by Andrew Ng', platform: 'Coursera', duration: '3 months', free: true, url: 'https://www.coursera.org/learn/machine-learning' },
      { name: 'Fast.ai Practical Deep Learning', platform: 'Fast.ai', duration: '7 weeks', free: true, url: 'https://course.fast.ai/' },
      { name: 'ML Crash Course', platform: 'Google', duration: '15 hours', free: true, url: 'https://developers.google.com/machine-learning/crash-course' },
    ],
    'docker': [
      { name: 'Docker Mastery', platform: 'Udemy', duration: '19 hours', free: false, url: 'https://www.udemy.com/course/docker-mastery/' },
      { name: 'Docker Docs Get Started', platform: 'Docker', duration: '2 hours', free: true, url: 'https://docs.docker.com/get-started/' },
      { name: 'Docker for Beginners', platform: 'freeCodeCamp', duration: '3 hours', free: true, url: 'https://www.youtube.com/watch?v=fqMOX6JJhGo' },
    ],
    'kubernetes': [
      { name: 'Kubernetes for Beginners', platform: 'Udemy', duration: '5 hours', free: false, url: 'https://www.udemy.com/course/learn-kubernetes/' },
      { name: 'Kubernetes Basics', platform: 'Kubernetes.io', duration: 'Self-paced', free: true, url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/' },
      { name: 'CNCF Kubernetes Course', platform: 'edX', duration: '4 months', free: true, url: 'https://www.edx.org/course/introduction-to-kubernetes' },
    ],
    'aws': [
      { name: 'AWS Cloud Practitioner', platform: 'AWS Training', duration: '4 weeks', free: true, url: 'https://aws.amazon.com/training/digital/' },
      { name: 'AWS Certified Solutions Architect', platform: 'Udemy', duration: '27 hours', free: false, url: 'https://www.udemy.com/course/aws-certified-solutions-architect-associate/' },
      { name: 'AWS Fundamentals', platform: 'Coursera', duration: '4 weeks', free: true, url: 'https://www.coursera.org/learn/aws-fundamentals-going-cloud-native' },
    ],
    'typescript': [
      { name: 'TypeScript Handbook', platform: 'TypeScript Official', duration: 'Self-paced', free: true, url: 'https://www.typescriptlang.org/docs/handbook/intro.html' },
      { name: 'Understanding TypeScript', platform: 'Udemy', duration: '15 hours', free: false, url: 'https://www.udemy.com/course/understanding-typescript/' },
      { name: 'TypeScript Full Course', platform: 'freeCodeCamp', duration: '5 hours', free: true, url: 'https://www.youtube.com/watch?v=30LWjhZzg50' },
    ],
    'node.js': [
      { name: 'Node.js Complete Guide', platform: 'Udemy', duration: '40 hours', free: false, url: 'https://www.udemy.com/course/nodejs-the-complete-guide/' },
      { name: 'Node.js Official Docs', platform: 'Node.js', duration: 'Self-paced', free: true, url: 'https://nodejs.org/en/docs/guides' },
      { name: 'Learn Node.js', platform: 'Codecademy', duration: '10 hours', free: true, url: 'https://www.codecademy.com/learn/learn-node-js' },
    ],
    'sql': [
      { name: 'SQL for Data Science', platform: 'Coursera', duration: '4 weeks', free: true, url: 'https://www.coursera.org/learn/sql-for-data-science' },
      { name: 'The Complete SQL Bootcamp', platform: 'Udemy', duration: '9 hours', free: false, url: 'https://www.udemy.com/course/the-complete-sql-bootcamp/' },
      { name: 'SQLBolt Interactive Tutorial', platform: 'SQLBolt', duration: 'Self-paced', free: true, url: 'https://sqlbolt.com/' },
    ],
    'git': [
      { name: 'Git Official Documentation', platform: 'Git-SCM', duration: 'Self-paced', free: true, url: 'https://git-scm.com/doc' },
      { name: 'Version Control with Git', platform: 'Coursera', duration: '4 weeks', free: true, url: 'https://www.coursera.org/learn/version-control-with-git' },
      { name: 'Git & GitHub Crash Course', platform: 'freeCodeCamp', duration: '1 hour', free: true, url: 'https://www.youtube.com/watch?v=RGOj5yH7evk' },
    ],
    'tensorflow': [
      { name: 'TensorFlow Developer Certificate', platform: 'Coursera', duration: '4 months', free: false, url: 'https://www.coursera.org/professional-certificates/tensorflow-in-practice' },
      { name: 'TensorFlow Basics', platform: 'TensorFlow.org', duration: 'Self-paced', free: true, url: 'https://www.tensorflow.org/tutorials' },
      { name: 'Deep Learning with TensorFlow', platform: 'Udemy', duration: '14 hours', free: false, url: 'https://www.udemy.com/course/complete-tensorflow-2-and-keras-deep-learning-bootcamp/' },
    ],
    'pytorch': [
      { name: 'PyTorch Official Tutorials', platform: 'PyTorch.org', duration: 'Self-paced', free: true, url: 'https://pytorch.org/tutorials/' },
      { name: 'Deep Learning with PyTorch', platform: 'Udemy', duration: '16 hours', free: false, url: 'https://www.udemy.com/course/pytorch-for-deep-learning-with-python-bootcamp/' },
      { name: 'PyTorch for Deep Learning', platform: 'freeCodeCamp', duration: '10 hours', free: true, url: 'https://www.youtube.com/watch?v=V_xro1bcAuA' },
    ],
    'go': [
      { name: 'A Tour of Go', platform: 'Go.dev', duration: 'Self-paced', free: true, url: 'https://go.dev/tour/' },
      { name: 'Go Programming Language', platform: 'Udemy', duration: '9 hours', free: false, url: 'https://www.udemy.com/course/go-the-complete-developers-guide/' },
      { name: 'Learn Go Programming', platform: 'freeCodeCamp', duration: '7 hours', free: true, url: 'https://www.youtube.com/watch?v=YS4e4q9oBaU' },
    ],
    'rust': [
      { name: 'The Rust Book', platform: 'Rust-Lang.org', duration: 'Self-paced', free: true, url: 'https://doc.rust-lang.org/book/' },
      { name: 'Rust Programming Course', platform: 'Udemy', duration: '18 hours', free: false, url: 'https://www.udemy.com/course/rust-programming-language/' },
      { name: 'Rust Crash Course', platform: 'freeCodeCamp', duration: '2 hours', free: true, url: 'https://www.youtube.com/watch?v=zF34dRivLOw' },
    ],
  };

  // Try exact match first
  if (courseDatabase[skillLower]) {
    return courseDatabase[skillLower];
  }

  // Try partial match
  for (const [key, courses] of Object.entries(courseDatabase)) {
    if (skillLower.includes(key) || key.includes(skillLower)) {
      return courses;
    }
  }

  // Generic fallback
  return [
    { name: `${skill} Complete Course`, platform: 'Udemy', duration: '10-20 hours', free: false, url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(skill)}` },
    { name: `${skill} Tutorial`, platform: 'YouTube', duration: 'Self-paced', free: true, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + ' tutorial')}` },
    { name: `${skill} Documentation`, platform: 'Official Docs', duration: 'Self-paced', free: true, url: `https://www.google.com/search?q=${encodeURIComponent(skill + ' official documentation')}` },
  ];
}

// ============================================================================
// ROADMAP GENERATION
// ============================================================================

export function generateMonthlyPlan(
  criticalGaps: SkillGap[],
  HOURS_PER_MONTH: number = 20
): RoadmapMonth[] {
  // Sort by dependencies first, then by priority
  const sortedGaps = sortByDependencies(criticalGaps);

  const months: RoadmapMonth[] = [];
  let currentMonth = 1;
  let currentMonthHours = 0;
  let currentMonthSkills: RoadmapSkill[] = [];
  let cumulativeScoreImprovement = 0;

  for (const gap of sortedGaps) {
    const courses = getCourseRecommendations(gap.skill);

    const skillEntry: RoadmapSkill = {
      skill: gap.skill,
      priority: gap.priority,
      hours: gap.estimated_hours,
      courses: courses.slice(0, 3), // Top 3 courses
    };

    // Check if adding this skill exceeds month capacity
    if (currentMonthHours + gap.estimated_hours > HOURS_PER_MONTH && currentMonthSkills.length > 0) {
      // Save current month and start new one
      const scoreImprovement = currentMonthSkills.reduce((sum, s) => {
        const g = sortedGaps.find(gap => gap.skill === s.skill);
        return sum + (g ? Math.min(g.gap, 15) : 5);
      }, 0);
      cumulativeScoreImprovement += scoreImprovement;

      months.push({
        month: currentMonth,
        title: getMonthTitle(currentMonth, currentMonthSkills),
        skills: currentMonthSkills,
        total_hours: currentMonthHours,
        projected_score_improvement: Math.round(cumulativeScoreImprovement),
      });

      currentMonth++;
      currentMonthHours = 0;
      currentMonthSkills = [];
    }

    currentMonthSkills.push(skillEntry);
    currentMonthHours += gap.estimated_hours;
  }

  // Add final month if there are remaining skills
  if (currentMonthSkills.length > 0) {
    const scoreImprovement = currentMonthSkills.reduce((sum, s) => {
      const g = sortedGaps.find(gap => gap.skill === s.skill);
      return sum + (g ? Math.min(g.gap, 15) : 5);
    }, 0);
    cumulativeScoreImprovement += scoreImprovement;

    months.push({
      month: currentMonth,
      title: getMonthTitle(currentMonth, currentMonthSkills),
      skills: currentMonthSkills,
      total_hours: currentMonthHours,
      projected_score_improvement: Math.round(cumulativeScoreImprovement),
    });
  }

  return months;
}

function getMonthTitle(monthNumber: number, skills: RoadmapSkill[]): string {
  const critical = skills.filter(s => s.priority === 'CRITICAL');
  const important = skills.filter(s => s.priority === 'IMPORTANT');

  if (monthNumber === 1) {
    return critical.length > 0 ? 'Critical Foundations' : 'Build Core Skills';
  }
  
  if (critical.length > 0) {
    return `Master ${critical[0].skill}`;
  }
  
  if (important.length > 0) {
    return `Strengthen ${important[0].skill}`;
  }

  return `Advanced Skills - Month ${monthNumber}`;
}

// ============================================================================
// MERMAID CHART GENERATION
// ============================================================================

export function generateMermaidRoadmap(
  monthlyPlan: RoadmapMonth[],
  targetRole: string
): string {
  let mermaid = 'graph TD\n';
  mermaid += '    Start[Start Learning] --> Phase1\n\n';

  // Group months into phases (3 months per phase max)
  const phases: RoadmapMonth[][] = [];
  for (let i = 0; i < monthlyPlan.length; i += 3) {
    phases.push(monthlyPlan.slice(i, i + 3));
  }

  let previousPhaseEnd = 'Start';

  phases.forEach((phaseMonths, phaseIdx) => {
    const phaseNum = phaseIdx + 1;
    const phaseName = `Phase${phaseNum}`;
    
    mermaid += `    subgraph ${phaseName}[Phase ${phaseNum} - Months ${phaseMonths[0].month}-${phaseMonths[phaseMonths.length - 1].month}]\n`;

    // Add nodes for each skill in this phase
    phaseMonths.forEach((month, monthIdx) => {
      month.skills.forEach((skill, skillIdx) => {
        const nodeId = `P${phaseNum}M${month.month}S${skillIdx}`;
        const label = skill.skill.length > 20 ? skill.skill.substring(0, 17) + '...' : skill.skill;
        mermaid += `        ${nodeId}["${label} ${skill.hours}h"]\n`;
      });
    });

    mermaid += '    end\n\n';

    // Connect previous phase to this phase
    const firstNode = `P${phaseNum}M${phaseMonths[0].month}S0`;
    mermaid += `    ${previousPhaseEnd} --> ${firstNode}\n`;

    // Connect skills within phase sequentially
    let prevNode = firstNode;
    phaseMonths.forEach((month) => {
      month.skills.forEach((skill, skillIdx) => {
        if (skillIdx > 0 || month.month !== phaseMonths[0].month) {
          const nodeId = `P${phaseNum}M${month.month}S${skillIdx}`;
          if (prevNode !== nodeId) {
            mermaid += `    ${prevNode} --> ${nodeId}\n`;
          }
          prevNode = nodeId;
        }
      });
    });

    previousPhaseEnd = prevNode;
  });

  // Final goal node
  mermaid += `\n    ${previousPhaseEnd} --> Goal["Ready for ${targetRole}"]\n\n`;

  // Styling
  mermaid += '    classDef critical fill:#dc2626,stroke:#991b1b,color:#fff\n';
  mermaid += '    classDef important fill:#f59e0b,stroke:#d97706,color:#fff\n';
  mermaid += '    classDef monitor fill:#eab308,stroke:#ca8a04,color:#000\n';
  mermaid += '    classDef goal fill:#10b981,stroke:#059669,color:#fff\n\n';

  // Apply styles
  phases.forEach((phaseMonths, phaseIdx) => {
    const phaseNum = phaseIdx + 1;
    phaseMonths.forEach((month) => {
      month.skills.forEach((skill, skillIdx) => {
        const nodeId = `P${phaseNum}M${month.month}S${skillIdx}`;
        if (skill.priority === 'CRITICAL') {
          mermaid += `    class ${nodeId} critical\n`;
        } else if (skill.priority === 'IMPORTANT') {
          mermaid += `    class ${nodeId} important\n`;
        } else {
          mermaid += `    class ${nodeId} monitor\n`;
        }
      });
    });
  });
  
  mermaid += '    class Goal goal\n';

  return mermaid;
}

// ============================================================================
// MAIN ROADMAP GENERATION FUNCTION
// ============================================================================

export async function generateLearningRoadmap(
  db: Database.Database,
  userId: string,
  targetRole: string,
  gapAnalysisId: string,
  skillGaps: SkillGap[]
): Promise<GeneratedRoadmap> {
  // Filter to CRITICAL and IMPORTANT gaps only
  const criticalGaps = skillGaps.filter(
    g => g.priority === 'CRITICAL' || g.priority === 'IMPORTANT'
  );

  if (criticalGaps.length === 0) {
    // User is already job-ready!
    const id = crypto.randomUUID();
    const roadmap: GeneratedRoadmap = {
      id,
      user_id: userId,
      target_role: targetRole,
      gap_analysis_id: gapAnalysisId,
      mermaid_code: `graph TD\n    Start[You are ready!] --> Goal["Apply for ${targetRole} roles"]\n    class Goal goal\n    classDef goal fill:#10b981,stroke:#059669,color:#fff`,
      monthly_plan: [],
      total_months: 0,
      total_hours: 0,
      job_ready_date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      created_at: new Date().toISOString(),
    };

    // Save to database
    db.prepare(`
      INSERT INTO learning_roadmaps 
      (id, user_id, target_role, gap_analysis_id, mermaid_code, monthly_plan, 
       total_months, total_hours, job_ready_date, roadmap_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, userId, targetRole, gapAnalysisId, roadmap.mermaid_code,
      JSON.stringify(roadmap.monthly_plan), 0, 0, roadmap.job_ready_date, '{}'
    );

    return roadmap;
  }

  // Generate monthly plan
  const monthly_plan = generateMonthlyPlan(criticalGaps);
  const total_hours = monthly_plan.reduce((sum, m) => sum + m.total_hours, 0);
  const total_months = monthly_plan.length;

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + total_months);
  const job_ready_date = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Generate Mermaid code
  const mermaid_code = generateMermaidRoadmap(monthly_plan, targetRole);

  // Save to database
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO learning_roadmaps 
    (id, user_id, target_role, gap_analysis_id, mermaid_code, monthly_plan, 
     total_months, total_hours, job_ready_date, roadmap_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId, targetRole, gapAnalysisId, mermaid_code,
    JSON.stringify(monthly_plan), total_months, total_hours, job_ready_date,
    JSON.stringify({ criticalGaps })
  );

  return {
    id,
    user_id: userId,
    target_role: targetRole,
    gap_analysis_id: gapAnalysisId,
    mermaid_code,
    monthly_plan,
    total_months,
    total_hours,
    job_ready_date,
    created_at: new Date().toISOString(),
  };
}
