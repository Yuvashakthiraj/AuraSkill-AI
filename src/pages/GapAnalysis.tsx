import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, XCircle,
  Target, Brain, Github, Code, BarChart3, Calendar, Clock, Award,
  Sparkles, RefreshCw, Filter, ArrowUpDown, ExternalLink, Info, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import mermaid from 'mermaid';

// ============================================================================
// TYPES
// ============================================================================

interface FutureReadyScore {
  overall: number;
  grade: string;
  resume_match: number;
  github_match: number;
  assessment_performance: number;
  market_alignment: number;
}

interface SkillGap {
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

interface ProfileConflict {
  type: 'CLAIMED_UNPROVEN' | 'PROVEN_UNCLAIMED' | 'ASSESSMENT_CONTRADICTION';
  skill: string;
  description: string;
  action: string;
  severity: 'high' | 'medium' | 'low';
}

interface GapAnalysis {
  id: string;
  target_role: string;
  future_ready_score: FutureReadyScore;
  skill_gaps: SkillGap[];
  profile_conflicts: ProfileConflict[];
  job_ready_date: string;
  job_ready_months: number;
}

interface CourseResource {
  name: string;
  platform: string;
  duration: string;
  free: boolean;
  url: string;
}

interface RoadmapSkill {
  skill: string;
  priority: string;
  hours: number;
  courses: CourseResource[];
}

interface RoadmapMonth {
  month: number;
  title: string;
  skills: RoadmapSkill[];
  total_hours: number;
  projected_score_improvement: number;
}

interface Roadmap {
  id: string;
  mermaid_code: string;
  monthly_plan: RoadmapMonth[];
  total_months: number;
  total_hours: number;
  job_ready_date: string;
}

interface AINarrative {
  executive_summary: string;
  critical_insights: Array<{ skill: string; insight: string }>;
  strength_callout: string;
  motivational_closing: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const GapAnalysis = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [narrative, setNarrative] = useState<AINarrative | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [useCustomRole, setUseCustomRole] = useState(false);

  // UI state
  const [selectedSkill, setSelectedSkill] = useState<SkillGap | null>(null);
  const [skillExplanation, setSkillExplanation] = useState<{ why_matters: string; how_to_prove: string; project_idea: string } | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('gap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#4f46e5',
        primaryTextColor: '#fff',
        primaryBorderColor: '#6366f1',
        lineColor: '#818cf8',
        secondaryColor: '#10b981',
        tertiaryColor: '#f59e0b',
      },
    });
  }, []);

  // Load existing analysis on mount
  useEffect(() => {
    if (user) {
      console.log('✅ User authenticated:', { id: user.id, email: user.email });
      loadAnalysis();
    } else {
      console.log('⚠️ No authenticated user found');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Render Mermaid when roadmap changes
  useEffect(() => {
    if (roadmap && roadmap.mermaid_code) {
      renderMermaid();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmap]);

  const renderMermaid = async () => {
    const element = document.getElementById('mermaid-roadmap');
    if (element && roadmap) {
      try {
        element.innerHTML = roadmap.mermaid_code;
        await mermaid.run({ nodes: [element] });
      } catch (err) {
        console.error('Mermaid render error:', err);
      }
    }
  };

  const loadAnalysis = async () => {
    if (!user?.id) {
      console.log('No user ID, skipping analysis load');
      return;
    }

    try {
      const token = localStorage.getItem('vidyamitra_token');
      if (!token) {
        console.log('No auth token found');
        return;
      }

      const res = await fetch(`/api/analysis/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        console.log('Unauthorized - please log in');
        toast.error('Please log in to view gap analysis');
        navigate('/login');
        return;
      }

      if (res.status === 404) {
        console.log('No previous analysis found - that\'s okay, run a new analysis');
        return; // This is fine, user hasn't run analysis yet
      }

      if (!res.ok) {
        console.warn(`Unexpected response status: ${res.status}`);
        return; // Don't try to parse HTML as JSON
      }

      // Only parse JSON if response is OK
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Response is not JSON, skipping parse');
        return;
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setTargetRole(data.analysis.target_role);

      // Load roadmap
      const roadmapRes = await fetch(`/api/roadmap/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (roadmapRes.ok) {
        const roadmapData = await roadmapRes.json();
        setRoadmap(roadmapData.roadmap);
      }

      // Load AI narrative
      fetchNarrative(data.analysis);
    } catch (err) {
      console.error('Failed to load analysis:', err);
      // Don't show error toast - this is just a background load
    }
  };

  const runAnalysis = async () => {
    if (!targetRole.trim()) {
      toast.error('Please enter a target role');
      return;
    }

    if (!user?.id) {
      toast.error('Please log in to run analysis');
      navigate('/login');
      return;
    }

    const token = localStorage.getItem('vidyamitra_token');
    if (!token) {
      toast.error('Authentication required. Please log in.');
      navigate('/login');
      return;
    }

    setLoading(true);
    
    // Show progress toast
    const loadingToast = toast.loading('🔍 Fetching real-time market data from job boards...');
    
    try {
      // Step 1: Run gap analysis with real-time market data
      const res = await fetch('/api/analysis/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetRole }),
      });

      if (res.status === 401) {
        toast.dismiss(loadingToast);
        toast.error('Session expired. Please log in again.');
        navigate('/login');
        return;
      }

      if (!res.ok) {
        let errorMessage = 'Analysis failed';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error (${res.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      
      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success(`✅ Analysis complete! Found ${data.analysis.skill_gaps.length} skills to track`);

      // Step 2: Generate roadmap
      setGenerating(true);
      const roadmapToast = toast.loading('📚 Generating personalized learning roadmap...');
      
      const roadmapRes = await fetch('/api/roadmap/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetRole,
          gapAnalysisId: data.analysis.id,
        }),
      });

      toast.dismiss(roadmapToast);
      if (roadmapRes.ok) {
        const roadmapData = await roadmapRes.json();
        setRoadmap(roadmapData.roadmap);
        toast.success(`🎯 ${roadmapData.roadmap.total_months}-month roadmap ready with ${roadmapData.roadmap.total_hours} hours of learning!`);
      } else {
        toast.error('Failed to generate roadmap');
      }

      // Step 3: Fetch AI narrative (no toast - happens in background)
      fetchNarrative(data.analysis);
    } catch (err) {
      toast.dismiss(loadingToast);
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      console.error('Analysis error:', err);
      toast.error(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const fetchNarrative = async (analysisData: GapAnalysis) => {
    try {
      const res = await fetch('/api/analysis/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole: analysisData.target_role,
          futureReadyScore: analysisData.future_ready_score,
          skillGaps: analysisData.skill_gaps.slice(0, 10),
          profileConflicts: analysisData.profile_conflicts,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNarrative(data.narrative);
      } else {
        console.warn(`Narrative API returned ${res.status}`);
        // Don't show error toast - narrative is optional, analysis still works
        try {
          const errorData = await res.json();
          console.error('Narrative error:', errorData.error);
        } catch {
          console.error('Could not parse narrative error response');
        }
      }
    } catch (err) {
      console.error('Failed to fetch narrative:', err);
      // Don't show error toast - narrative is optional
    }
  };

  const fetchSkillExplanation = async (gap: SkillGap) => {
    try {
      const res = await fetch('/api/analysis/skill-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill: gap.skill,
          userScore: gap.user_score,
          marketScore: gap.market_score,
          targetRole: analysis?.target_role || 'this role',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSkillExplanation(data.explanation);
      } else {
        console.warn(`Skill explanation API returned ${res.status}`);
        toast.error('Could not generate skill explanation. Please try again.');
      }
    } catch (err) {
      console.error('Failed to fetch skill explanation:', err);
      toast.error('Network error. Please check your connection.');
    }
  };

  const handleSkillClick = (gap: SkillGap) => {
    setSelectedSkill(gap);
    setSkillExplanation(null);
    fetchSkillExplanation(gap);
  };

  // Priority colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'IMPORTANT': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'MONITOR': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'STRENGTH': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'RESKILL_ALERT': return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    }
  };

  // Filter and sort gaps
  const getFilteredGaps = () => {
    if (!analysis) return [];
    let filtered = analysis.skill_gaps;

    if (filterPriority !== 'all') {
      filtered = filtered.filter(g => g.priority === filterPriority);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (sortBy === 'gap') {
        aVal = Math.abs(a.gap);
        bVal = Math.abs(b.gap);
      } else if (sortBy === 'user_score') {
        aVal = a.user_score;
        bVal = b.user_score;
      } else if (sortBy === 'market_score') {
        aVal = a.market_score;
        bVal = b.market_score;
      } else if (sortBy === 'hours') {
        aVal = a.estimated_hours;
        bVal = b.estimated_hours;
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (!user) {
    return (
      <Layout>
        <Card className="max-w-2xl mx-auto mt-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              You need to be logged in to access the Career Gap Analysis feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The Gap Analysis feature helps you:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
              <li>Compare your skills with real-time market demand</li>
              <li>Get personalized learning roadmaps</li>
              <li>Track your career readiness score</li>
              <li>Receive AI-powered career guidance</li>
            </ul>
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full"
              size="lg"
            >
              Login to Continue
            </Button>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20">
              <Target className="h-6 w-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Career Gap Analysis</h1>
              <p className="text-sm text-muted-foreground">
                Your personalized path to becoming job-ready
              </p>
            </div>
          </div>
          <Button onClick={runAnalysis} disabled={loading || generating}>
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {analysis ? 'Refresh Analysis' : 'Run Analysis'}
              </>
            )}
          </Button>
        </div>

        {/* Input for target role */}
        {!analysis && (
          <>
            {/* Quick start guide */}
            <Alert className="border-blue-500/50 bg-blue-500/5">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-sm">
                <strong>Quick Start:</strong> To get accurate gap analysis, make sure you've:
                <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                  <li>📄 Uploaded your resume (or filled profile details)</li>
                  <li>💻 Completed some coding practice questions</li>
                  <li>🔗 (Optional) Connected your GitHub profile for better accuracy</li>
                </ul>
                <p className="mt-2 text-xs">
                  💡 The analysis uses <strong>real-time market data</strong> from job boards to compare your skills with current industry demand.
                </p>
              </AlertDescription>
            </Alert>

            <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Target Role</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUseCustomRole(!useCustomRole);
                    setTargetRole('');
                  }}
                  className="text-xs"
                >
                  {useCustomRole ? '📋 Use Preset Roles' : '✏️ Enter Custom Role'}
                </Button>
              </CardTitle>
              <CardDescription>
                {useCustomRole ? 'Enter any job title you\'re targeting' : 'Select from popular tech roles'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {useCustomRole ? (
                <Input
                  placeholder="e.g., Blockchain Developer, Game Developer, etc."
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && runAnalysis()}
                  autoFocus
                />
              ) : (
                <Select value={targetRole} onValueChange={setTargetRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your target role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full Stack Developer">🌐 Full Stack Developer</SelectItem>
                    <SelectItem value="Frontend Developer">🎨 Frontend Developer</SelectItem>
                    <SelectItem value="Backend Developer">⚙️ Backend Developer</SelectItem>
                    <SelectItem value="Mobile Developer">📱 Mobile Developer</SelectItem>
                    <SelectItem value="DevOps Engineer">🔧 DevOps Engineer</SelectItem>
                    <SelectItem value="Data Scientist">📊 Data Scientist</SelectItem>
                    <SelectItem value="Data Engineer">🔢 Data Engineer</SelectItem>
                    <SelectItem value="Machine Learning Engineer">🤖 Machine Learning Engineer</SelectItem>
                    <SelectItem value="AI Engineer">🧠 AI Engineer</SelectItem>
                    <SelectItem value="Cloud Architect">☁️ Cloud Architect</SelectItem>
                    <SelectItem value="Software Architect">🏗️ Software Architect</SelectItem>
                    <SelectItem value="Security Engineer">🔒 Security Engineer</SelectItem>
                    <SelectItem value="QA Engineer">✅ QA Engineer</SelectItem>
                    <SelectItem value="Site Reliability Engineer">⚡ Site Reliability Engineer</SelectItem>
                    <SelectItem value="Platform Engineer">🚀 Platform Engineer</SelectItem>
                    <SelectItem value="Embedded Systems Engineer">🔌 Embedded Systems Engineer</SelectItem>
                    <SelectItem value="Database Administrator">🗄️ Database Administrator</SelectItem>
                    <SelectItem value="Solutions Architect">💡 Solutions Architect</SelectItem>
                    <SelectItem value="Technical Lead">👨‍💼 Technical Lead</SelectItem>
                    <SelectItem value="Engineering Manager">📋 Engineering Manager</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button 
                onClick={runAnalysis} 
                disabled={loading || !targetRole.trim()} 
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Real-Time Market Data...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    🎯 Run Analysis
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          </>
        )}

        {analysis && (
          <>
            {/* Section 1: Readiness Header */}
            <Card className="border-2 border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-600/5">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>At 20 hours/month of focused learning</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">
                  You can be job-ready as a{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">
                    {analysis.target_role}
                  </span>
                  {' '}by{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
                    {analysis.job_ready_date}
                  </span>
                </h2>
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{analysis.job_ready_months} months</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4" />
                    <span>{roadmap?.total_hours || 0} hours total</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Score Display */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Circular Gauge */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Future-Ready Score</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(100,116,139,0.2)" strokeWidth="8" />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="url(#gradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 45}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 45 * (1 - analysis.future_ready_score.overall / 100) }}
                        transition={{ duration: 2, ease: 'easeOut' }}
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <motion.div
                        className="text-4xl font-bold"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, delay: 0.5 }}
                      >
                        {analysis.future_ready_score.overall}
                      </motion.div>
                      <div className="text-2xl font-bold text-muted-foreground">
                        {analysis.future_ready_score.grade}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Component Scores */}
              <Card className="lg:col-span-2 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Score Breakdown</CardTitle>
                  <CardDescription>How we calculated your readiness</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm flex items-center gap-2">
                        <Award className="h-4 w-4 text-blue-400" />
                        Resume Match
                      </span>
                      <span className="text-sm font-bold">{analysis.future_ready_score.resume_match}%</span>
                    </div>
                    <Progress value={analysis.future_ready_score.resume_match} className="h-2" />
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm flex items-center gap-2">
                        <Github className="h-4 w-4 text-purple-400" />
                        GitHub Proof
                      </span>
                      <span className="text-sm font-bold">{analysis.future_ready_score.github_match}%</span>
                    </div>
                    <Progress value={analysis.future_ready_score.github_match} className="h-2" />
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm flex items-center gap-2">
                        <Code className="h-4 w-4 text-teal-400" />
                        Assessment Performance
                      </span>
                      <span className="text-sm font-bold">{analysis.future_ready_score.assessment_performance}%</span>
                    </div>
                    <Progress value={analysis.future_ready_score.assessment_performance} className="h-2" />
                  </motion.div>

                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-green-400" />
                        Market Alignment
                      </span>
                      <span className="text-sm font-bold">{analysis.future_ready_score.market_alignment}%</span>
                    </div>
                    <Progress value={analysis.future_ready_score.market_alignment} className="h-2" />
                  </motion.div>
                </CardContent>
              </Card>
            </div>

            {/* Section 3: AI Career Narrative */}
            {narrative && (
              <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-violet-400" />
                    AI Career Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-lg leading-relaxed">{narrative.executive_summary}</p>
                  
                  {narrative.critical_insights.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-red-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Critical Focus Areas
                      </h4>
                      {narrative.critical_insights.map((insight, idx) => (
                        <div key={idx} className="pl-4 border-l-2 border-red-500/50">
                          <div className="font-medium text-sm">{insight.skill}</div>
                          <p className="text-sm text-muted-foreground">{insight.insight}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <h4 className="font-semibold text-sm text-green-400 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Your Competitive Advantage
                    </h4>
                    <p className="text-sm">{narrative.strength_callout}</p>
                  </div>

                  <p className="text-sm text-teal-400 italic">{narrative.motivational_closing}</p>
                </CardContent>
              </Card>
            )}

            {/* Section 5: Gap Priority Table */}
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Skill Gap Breakdown</CardTitle>
                    <CardDescription>Click any skill for detailed guidance</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilterPriority('all')}
                      className={filterPriority === 'all' ? 'bg-violet-500/20' : ''}
                    >
                      All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilterPriority('CRITICAL')}
                      className={filterPriority === 'CRITICAL' ? 'bg-red-500/20' : ''}
                    >
                      Critical
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilterPriority('IMPORTANT')}
                      className={filterPriority === 'IMPORTANT' ? 'bg-amber-500/20' : ''}
                    >
                      Important
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilterPriority('STRENGTH')}
                      className={filterPriority === 'STRENGTH' ? 'bg-green-500/20' : ''}
                    >
                      Strengths
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left text-sm">
                        <th className="pb-3 font-medium cursor-pointer" onClick={() => toggleSort('skill')}>
                          <div className="flex items-center gap-1">
                            Skill <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="pb-3 font-medium cursor-pointer" onClick={() => toggleSort('user_score')}>
                          <div className="flex items-center gap-1">
                            Your Score <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="pb-3 font-medium cursor-pointer" onClick={() => toggleSort('market_score')}>
                          <div className="flex items-center gap-1">
                            Market <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="pb-3 font-medium cursor-pointer" onClick={() => toggleSort('gap')}>
                          <div className="flex items-center gap-1">
                            Gap <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="pb-3 font-medium">Trend</th>
                        <th className="pb-3 font-medium">Priority</th>
                        <th className="pb-3 font-medium cursor-pointer" onClick={() => toggleSort('hours')}>
                          <div className="flex items-center gap-1">
                            Hours <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredGaps().slice(0, 20).map((gap, idx) => (
                        <motion.tr
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="border-b border-border/50 hover:bg-white/5 cursor-pointer transition-colors"
                          onClick={() => handleSkillClick(gap)}
                        >
                          <td className="py-3 font-medium">{gap.skill}</td>
                          <td className="py-3">{gap.user_score}</td>
                          <td className="py-3">{gap.market_score}</td>
                          <td className="py-3">
                            <span className={gap.gap > 0 ? 'text-red-400' : 'text-green-400'}>
                              {gap.gap > 0 ? '+' : ''}{Math.round(gap.gap)}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              {gap.trend === 'rising' && <TrendingUp className="h-3 w-3 text-green-400" />}
                              {gap.trend === 'declining' && <TrendingDown className="h-3 w-3 text-red-400" />}
                              {gap.trend === 'stable' && <Minus className="h-3 w-3 text-gray-400" />}
                              <span className="text-xs">{gap.growth_rate > 0 ? '+' : ''}{gap.growth_rate}%</span>
                            </div>
                          </td>
                          <td className="py-3">
                            <Badge className={`${getPriorityColor(gap.priority)} text-xs`}>
                              {gap.priority.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 text-sm">{gap.estimated_hours}h</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Skill Explanation Modal */}
            <AnimatePresence>
              {selectedSkill && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  onClick={() => setSelectedSkill(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="bg-slate-900 border border-border rounded-lg max-w-2xl w-full p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold">{selectedSkill.skill}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getPriorityColor(selectedSkill.priority)}>
                            {selectedSkill.priority}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {selectedSkill.user_score}/100 → {selectedSkill.market_score}/100
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSkill(null)}>
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>

                    {skillExplanation ? (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-sm text-violet-400 mb-2">Why This Matters</h4>
                          <p className="text-sm">{skillExplanation.why_matters}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-teal-400 mb-2">How to Prove It</h4>
                          <p className="text-sm">{skillExplanation.how_to_prove}</p>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-amber-400 mb-2">Project Idea</h4>
                          <p className="text-sm">{skillExplanation.project_idea}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Section 6: Profile Conflicts */}
            {analysis.profile_conflicts.length > 0 && (
              <Card className="border-red-500/30 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    Profile Conflicts Detected
                  </CardTitle>
                  <CardDescription>These inconsistencies may hurt your job applications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.profile_conflicts.map((conflict, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-slate-800 border border-border">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded ${
                          conflict.severity === 'high' ? 'bg-red-500/20' :
                          conflict.severity === 'medium' ? 'bg-amber-500/20' : 'bg-yellow-500/20'
                        }`}>
                          {conflict.type === 'CLAIMED_UNPROVEN' && <XCircle className="h-5 w-5 text-red-400" />}
                          {conflict.type === 'PROVEN_UNCLAIMED' && <Info className="h-5 w-5 text-amber-400" />}
                          {conflict.type === 'ASSESSMENT_CONTRADICTION' && <AlertTriangle className="h-5 w-5 text-yellow-400" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{conflict.skill}</h4>
                            <Badge variant="outline" className="text-xs">
                              {conflict.type.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{conflict.description}</p>
                          <div className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5" />
                            <span className="text-green-400">{conflict.action}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {analysis.profile_conflicts.length === 0 && (
              <Alert className="bg-green-500/10 border-green-500/30">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-400">
                  No profile conflicts detected. Your resume, GitHub, and assessment scores are consistent!
                </AlertDescription>
              </Alert>
            )}

            {/* Section 8: Learning Roadmap */}
            {roadmap && (
              <>
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Your Learning Roadmap</CardTitle>
                    <CardDescription>Month-by-month plan to close all critical gaps</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div id="mermaid-roadmap" className="flex justify-center overflow-x-auto py-4"></div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roadmap.monthly_plan.map((month) => (
                    <Card key={month.month} className="border-border/50">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>Month {month.month}: {month.title}</span>
                          <Badge variant="outline">{month.total_hours}h</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {month.skills.map((skill, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{skill.skill}</span>
                              <Badge className={`${getPriorityColor(skill.priority)} text-xs`}>
                                {skill.priority}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              {skill.courses.map((course, cidx) => (
                                <a
                                  key={cidx}
                                  href={course.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between p-2 rounded bg-slate-800 hover:bg-slate-700 transition-colors text-xs group"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{course.name}</div>
                                    <div className="text-muted-foreground">
                                      {course.platform} • {course.duration}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-2">
                                    {course.free && (
                                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400">
                                        Free
                                      </Badge>
                                    )}
                                    <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-border">
                          <div className="text-xs text-muted-foreground">
                            Projected score: +{month.projected_score_improvement} points
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

          </>
        )}
      </div>
    </Layout>
  );
};

export default GapAnalysis;
