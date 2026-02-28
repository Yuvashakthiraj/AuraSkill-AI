import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileCheck, FileText, Briefcase, Sparkles, AlertCircle, Loader2, CheckCircle,
  XCircle, Target, TrendingUp, Lightbulb, MessageSquare, DollarSign, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  matchResumeToJD,
  type ResumeJDMatchResult,
} from '@/utils/auraSkillService';

const ResumeJDMatcher = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeJDMatchResult | null>(null);
  const [error, setError] = useState('');

  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');

  const handleMatch = async () => {
    if (!resumeText.trim()) {
      toast.error('Please paste your resume text');
      return;
    }

    if (!jdText.trim()) {
      toast.error('Please paste the job description');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await matchResumeToJD({
        resume_text: resumeText,
        jd_text: jdText,
      });
      setResult(data);
      toast.success(`Match complete! Fit score: ${data.overall_score}%`);
    } catch (err: any) {
      const message = err.message || 'Failed to match resume. Make sure AuraSkill backend is running.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getFitBadgeColor = (fit: string) => {
    switch (fit) {
      case 'Strong Fit':
        return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'Good Fit':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Partial Fit':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-red-500/10 text-red-400 border-red-500/30';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 backdrop-blur-sm">
            <FileCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Resume-JD Matcher</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered resume analysis against job descriptions with skill gap insights
            </p>
          </div>
        </div>

        {/* Input Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resume Input */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-violet-400" />
                Your Resume
              </CardTitle>
              <CardDescription>Paste your resume text</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste your resume content here...

Example:
John Doe
Software Engineer | john@email.com

EXPERIENCE
Senior Developer at Tech Corp (2020-Present)
- Built scalable React applications
- Led team of 5 engineers

SKILLS
Python, JavaScript, React, Node.js, AWS, Docker..."
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                disabled={loading}
                rows={12}
                className="resize-none font-mono text-sm"
              />
            </CardContent>
          </Card>

          {/* JD Input */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-400" />
                Job Description
              </CardTitle>
              <CardDescription>Paste the job description</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste the job description here...

Example:
Software Engineer - Full Stack

We are looking for a skilled engineer to join our team.

Requirements:
- 3+ years of experience with React
- Proficiency in Python or Node.js
- Experience with cloud services (AWS preferred)
- Strong problem-solving skills..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                disabled={loading}
                rows={12}
                className="resize-none font-mono text-sm"
              />
            </CardContent>
          </Card>
        </div>

        {/* Match Button */}
        <Button
          onClick={handleMatch}
          disabled={loading || !resumeText.trim() || !jdText.trim()}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 h-12 text-base"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Analyzing Match...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Analyze Resume Match
            </>
          )}
        </Button>

        {/* Loading State */}
        {loading && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 animate-pulse text-emerald-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Extracting skills, analyzing requirements, and generating AI assessment...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This may take 15-30 seconds for comprehensive analysis
                  </p>
                </div>
              </div>
              <Progress value={55} className="mt-4" />
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Overall Score Card */}
              <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Main Score */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative w-32 h-32">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-muted/20"
                          />
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            fill="none"
                            stroke="url(#match-gradient)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${(result.overall_score / 100) * 352} 352`}
                          />
                          <defs>
                            <linearGradient id="match-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#14b8a6" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-3xl font-bold ${getScoreColor(result.overall_score)}`}>
                            {result.overall_score}%
                          </span>
                          <Badge
                            variant="outline"
                            className={`mt-1 text-[10px] ${getFitBadgeColor(result.fit_level)}`}
                          >
                            {result.fit_level}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground">Score Breakdown</Label>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Required Skills</span>
                            <span className={getScoreColor(result.scores.required_match_pct)}>
                              {result.scores.required_match_pct}%
                            </span>
                          </div>
                          <Progress value={result.scores.required_match_pct} className="h-1.5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Preferred Skills</span>
                            <span className={getScoreColor(result.scores.preferred_match_pct)}>
                              {result.scores.preferred_match_pct}%
                            </span>
                          </div>
                          <Progress value={result.scores.preferred_match_pct} className="h-1.5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Tools & Technologies</span>
                            <span className={getScoreColor(result.scores.tools_match_pct)}>
                              {result.scores.tools_match_pct}%
                            </span>
                          </div>
                          <Progress value={result.scores.tools_match_pct} className="h-1.5" />
                        </div>
                      </div>
                    </div>

                    {/* Match Stats */}
                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground">Match Statistics</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-green-500/10 text-center">
                          <div className="text-lg font-bold text-green-400">
                            {result.match_details.total_matched}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Skills Matched</div>
                        </div>
                        <div className="p-2 rounded bg-red-500/10 text-center">
                          <div className="text-lg font-bold text-red-400">
                            {result.gaps.total_missing}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Skills Missing</div>
                        </div>
                        <div className="p-2 rounded bg-yellow-500/10 text-center">
                          <div className="text-lg font-bold text-yellow-400">
                            {result.gaps.critical_count}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Critical Gaps</div>
                        </div>
                        <div className="p-2 rounded bg-blue-500/10 text-center">
                          <div className="text-lg font-bold text-blue-400">
                            {result.bonus_skills.length}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Bonus Skills</div>
                        </div>
                      </div>
                    </div>

                    {/* Resume Summary */}
                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground">Resume Summary</Label>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Experience</span>
                          <span className="font-medium">{result.resume_analysis.experience_level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Skills Found</span>
                          <span className="font-medium">{result.resume_analysis.total_skills_found}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">JD Domain</span>
                          <span className="font-medium">{result.jd_analysis.domain}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Tabs */}
              <Tabs defaultValue="gaps" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                  <TabsTrigger value="gaps" className="gap-2">
                    <XCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Skill Gaps</span>
                  </TabsTrigger>
                  <TabsTrigger value="matched" className="gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Matched</span>
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">AI Tips</span>
                  </TabsTrigger>
                  <TabsTrigger value="improve" className="gap-2">
                    <Target className="h-4 w-4" />
                    <span className="hidden sm:inline">Action Plan</span>
                  </TabsTrigger>
                </TabsList>

                {/* Gaps Tab */}
                <TabsContent value="gaps">
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-400" />
                        Missing Skills ({result.gaps.total_missing})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {result.gaps.missing_required.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Required Skills ({result.gaps.missing_required.length})
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {result.gaps.missing_required.map((g, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className={
                                  g.priority === 'Critical'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                    : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                }
                              >
                                {g.skill}
                                <span className="ml-1 text-[10px] opacity-70">({g.priority})</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.gaps.missing_preferred.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Preferred Skills ({result.gaps.missing_preferred.length})
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {result.gaps.missing_preferred.map((g, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                              >
                                {g.skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.gaps.missing_tools.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Missing Tools ({result.gaps.missing_tools.length})
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {result.gaps.missing_tools.map((g, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="bg-blue-500/10 text-blue-400 border-blue-500/30"
                              >
                                {g.skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Matched Tab */}
                <TabsContent value="matched">
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        Matched Skills ({result.match_details.total_matched})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {result.match_details.matched_required.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Required ({result.match_details.matched_required.length})
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {result.match_details.matched_required.map((s, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="bg-green-500/10 text-green-400 border-green-500/30"
                              >
                                {s.skill}
                                <span className="ml-1 text-[10px] opacity-70">
                                  ({s.proficiency}%)
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.match_details.matched_preferred.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Preferred ({result.match_details.matched_preferred.length})
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {result.match_details.matched_preferred.map((s, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="bg-blue-500/10 text-blue-400 border-blue-500/30"
                              >
                                {s.skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.bonus_skills.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Bonus Skills ({result.bonus_skills.length})
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {result.bonus_skills.map((s, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="bg-violet-500/10 text-violet-400 border-violet-500/30"
                              >
                                {s.skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* AI Tips Tab */}
                <TabsContent value="ai">
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-yellow-400" />
                        AI Assessment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {result.ai_assessment ? (
                        <>
                          {/* Verdict */}
                          <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20">
                            <Label className="text-xs text-muted-foreground mb-2 block">
                              AI Verdict
                            </Label>
                            <p className="text-sm font-medium">{result.ai_assessment.verdict}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                              {result.ai_assessment.summary}
                            </p>
                          </div>

                          {/* Interview Tips */}
                          {result.ai_assessment.talking_points.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-sm flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-blue-400" />
                                Interview Talking Points
                              </Label>
                              <ul className="space-y-2">
                                {result.ai_assessment.talking_points.map((tip, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm">
                                    <Lightbulb className="h-4 w-4 mt-0.5 text-yellow-400 flex-shrink-0" />
                                    <span className="text-muted-foreground">{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Salary Negotiation */}
                          {result.ai_assessment.salary_negotiation && (
                            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                              <Label className="text-sm flex items-center gap-2 mb-2">
                                <DollarSign className="h-4 w-4 text-green-400" />
                                Salary Negotiation Tip
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {result.ai_assessment.salary_negotiation}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p>AI assessment not available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Improvement Plan Tab */}
                <TabsContent value="improve">
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-5 w-5 text-violet-400" />
                        Improvement Action Plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {result.ai_assessment?.improvement_plan &&
                      result.ai_assessment.improvement_plan.length > 0 ? (
                        <div className="space-y-4">
                          {result.ai_assessment.improvement_plan.map((item, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex gap-4 p-4 rounded-lg bg-muted/30 border border-border/50"
                            >
                              <div className="flex-shrink-0">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    item.priority === 'Critical'
                                      ? 'bg-red-500/20 text-red-400'
                                      : item.priority === 'High'
                                      ? 'bg-orange-500/20 text-orange-400'
                                      : 'bg-yellow-500/20 text-yellow-400'
                                  }`}
                                >
                                  {i + 1}
                                </div>
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium text-sm">{item.skill}</h4>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className={
                                        item.priority === 'Critical'
                                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                          : item.priority === 'High'
                                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                                      }
                                    >
                                      {item.priority}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {item.timeframe}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground">{item.action}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Target className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p>No improvement plan available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!loading && !result && !error && (
          <Card className="border-dashed border-border/50">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="inline-flex p-4 rounded-full bg-emerald-500/10 mb-4">
                <FileCheck className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Match Your Resume</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Paste your resume and a job description to get an AI-powered match analysis
                with skill gap insights and interview preparation tips.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ResumeJDMatcher;
