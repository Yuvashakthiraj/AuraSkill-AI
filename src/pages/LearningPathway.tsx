import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Route, Target, Sparkles, AlertCircle, Loader2, CheckCircle, Plus, X,
  Clock, BookOpen, Award, TrendingUp, ChevronRight, ExternalLink, Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  analyzeSkillGap,
  getAvailableRoles,
  getAvailableSkills,
  generateLearningPathway,
  type SkillGapResult,
  type LearningPathway as LearningPathwayType,
  type AvailableRole,
} from '@/utils/auraSkillService';

const SKILL_SUGGESTIONS = [
  'Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'AWS', 'Docker',
  'Kubernetes', 'TensorFlow', 'Machine Learning', 'Git', 'REST APIs',
];

const LearningPathway = () => {
  const [loading, setLoading] = useState(false);
  const [loadingPathway, setLoadingPathway] = useState(false);
  const [roles, setRoles] = useState<AvailableRole[]>([]);
  const [availableSkills, setAvailableSkills] = useState<string[]>(SKILL_SUGGESTIONS);
  const [error, setError] = useState('');

  const [targetRole, setTargetRole] = useState('');
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  const [skillGapResult, setSkillGapResult] = useState<SkillGapResult | null>(null);
  const [pathway, setPathway] = useState<LearningPathwayType | null>(null);

  // Load roles and skills
  useEffect(() => {
    getAvailableRoles()
      .then((res) => setRoles(res.roles))
      .catch(() => console.log('Could not load roles'));

    getAvailableSkills()
      .then((res) => {
        // Handle both string[] and {skill_name, skill_category}[] formats
        const skills = res.skills.slice(0, 100).map((s: unknown) => 
          typeof s === 'string' ? s : (s as { skill_name: string }).skill_name || String(s)
        );
        setAvailableSkills(skills);
      })
      .catch(() => console.log('Could not load skills'));
  }, []);

  const addSkill = (skill?: string) => {
    const s = (skill || skillInput).trim();
    if (s && !userSkills.includes(s)) {
      setUserSkills((prev) => [...prev, s]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setUserSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleAnalyzeGap = async () => {
    if (!targetRole) {
      toast.error('Please select a target role');
      return;
    }

    setLoading(true);
    setError('');
    setSkillGapResult(null);
    setPathway(null);

    try {
      const data = await analyzeSkillGap({
        user_skills: userSkills,
        target_role: targetRole,
      });
      setSkillGapResult(data);
      toast.success(`Skill gap analysis complete! Match Score: ${data.match_score}%`);
    } catch (err: any) {
      const message = err.message || 'Failed to analyze skill gap';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePathway = async () => {
    if (!skillGapResult) return;

    setLoadingPathway(true);

    try {
      const gapSkills = skillGapResult.skill_gaps.map((g) => g.skill);
      const data = await generateLearningPathway({
        user_skills: userSkills,
        target_role: targetRole,
        skill_gaps: gapSkills,
      });
      setPathway(data.pathway);
      toast.success('Learning pathway generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate pathway');
    } finally {
      setLoadingPathway(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 backdrop-blur-sm">
            <Route className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Learning Pathway</h1>
            <p className="text-sm text-muted-foreground">
              Get AI-generated learning roadmaps based on your skill gaps
            </p>
          </div>
        </div>

        {/* Input Form */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-violet-400" />
              Skill Gap Analysis
            </CardTitle>
            <CardDescription>
              Tell us your current skills and target role to identify gaps
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Target Role */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-violet-400" />
                Target Role *
              </Label>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your target role..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.title} value={role.title}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{role.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {role.posting_count} jobs
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Skills */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                Your Current Skills
              </Label>

              <div className="flex gap-2">
                <Input
                  placeholder="Add a skill..."
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                  disabled={loading}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => addSkill()}
                  disabled={!skillInput.trim() || loading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Skill Tags */}
              <div className="flex flex-wrap gap-2">
                {userSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="pl-2 pr-1 py-1 flex items-center gap-1"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="ml-1 hover:bg-muted rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {/* Quick Add Suggestions */}
              {userSkills.length < 5 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground pt-1">Suggestions:</span>
                  {availableSkills
                    .filter((s) => typeof s === 'string' && !userSkills.includes(s))
                    .slice(0, 8)
                    .map((skill, idx) => (
                      <Button
                        key={`skill-${idx}-${skill}`}
                        variant="ghost"
                        size="sm"
                        onClick={() => addSkill(String(skill))}
                        className="h-6 text-xs px-2 hover:bg-violet-500/10"
                      >
                        + {String(skill)}
                      </Button>
                    ))}
                </div>
              )}
            </div>

            <Button
              onClick={handleAnalyzeGap}
              disabled={loading || !targetRole}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 h-11"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Skill Gap...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze Skill Gap
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Skill Gap Results */}
        <AnimatePresence>
          {skillGapResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Readiness Score */}
              <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Score */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative w-28 h-28">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="56"
                            cy="56"
                            r="48"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-muted/20"
                          />
                          <circle
                            cx="56"
                            cy="56"
                            r="48"
                            fill="none"
                            stroke="url(#gap-gradient)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${(skillGapResult.match_score / 100) * 301} 301`}
                          />
                          <defs>
                            <linearGradient id="gap-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#8b5cf6" />
                              <stop offset="100%" stopColor="#a855f7" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold">
                            {skillGapResult.match_score}%
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {skillGapResult.readiness_level}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Matched Skills */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-400" />
                        Skills You Have ({skillGapResult.matched_skills.length})
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {skillGapResult.matched_skills.slice(0, 8).map((s, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="bg-green-500/10 text-green-400 border-green-500/30 text-xs"
                          >
                            {s.skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Missing Skills */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-red-400" />
                        Skills to Learn ({skillGapResult.skill_gaps.length})
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {skillGapResult.skill_gaps.slice(0, 8).map((g, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className={`text-xs ${
                              g.priority === 'Critical'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : g.priority === 'High'
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                            }`}
                          >
                            {g.skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Generate Pathway Button */}
                  {skillGapResult.skill_gaps.length > 0 && !pathway && (
                    <div className="mt-6 pt-6 border-t border-border/50 text-center">
                      <Button
                        onClick={handleGeneratePathway}
                        disabled={loadingPathway}
                        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                      >
                        {loadingPathway ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating Pathway...
                          </>
                        ) : (
                          <>
                            <Route className="mr-2 h-4 w-4" />
                            Generate Learning Pathway
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Role Stats */}
              {skillGapResult.role_stats && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-blue-400" />
                      Role Market Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-violet-400">{skillGapResult.role_stats.posting_count}</div>
                        <div className="text-xs text-muted-foreground">Job Postings</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-400">{skillGapResult.role_stats.avg_salary}</div>
                        <div className="text-xs text-muted-foreground">Avg Salary</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-400">{skillGapResult.role_stats.remote_pct}%</div>
                        <div className="text-xs text-muted-foreground">Remote</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Extra Skills */}
              {skillGapResult.extra_skills && skillGapResult.extra_skills.length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-yellow-400" />
                      Bonus Skills You Have
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {skillGapResult.extra_skills.map((s, i) => (
                        <Badge key={i} variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Learning Pathway */}
              {pathway && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="border-violet-500/30">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Route className="h-5 w-5 text-violet-400" />
                        {pathway.pathway_title || 'Your Personalized Learning Pathway'}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        {(pathway.total_duration || pathway.estimated_duration) && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {pathway.total_duration || pathway.estimated_duration}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          {pathway.phases.length} phases
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Phases */}
                      {pathway.phases.map((phase, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="relative pl-6 pb-6 border-l-2 border-violet-500/30 last:pb-0"
                        >
                          <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <span className="text-xs text-white font-bold">{phase.phase}</span>
                          </div>
                          <div className="ml-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold">{phase.title}</h4>
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {phase.duration}
                              </Badge>
                            </div>

                            {/* Skills */}
                            {(phase.skills || phase.skills_covered) && (phase.skills || phase.skills_covered).length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {(phase.skills || phase.skills_covered).map((skill, j) => (
                                  <Badge
                                    key={j}
                                    variant="outline"
                                    className="bg-violet-500/10 text-violet-300 border-violet-500/30 text-xs"
                                  >
                                    {skill}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Resources from steps */}
                            {phase.steps && phase.steps.length > 0 && (
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Learning Steps
                                </Label>
                                <div className="space-y-2">
                                  {phase.steps.map((step, j) => (
                                    <div key={j} className="p-2 rounded-lg bg-muted/20 text-xs">
                                      <div className="font-medium">{step.action}</div>
                                      <div className="text-muted-foreground mt-1 flex items-center gap-2">
                                        <span>{step.resource}</span>
                                        {step.estimated_hours && (
                                          <span className="text-violet-400">• {step.estimated_hours}h</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Resources (old format) */}
                            {phase.resources && phase.resources.length > 0 && (
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Resources
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                  {phase.resources.map((res, j) => (
                                    <Badge
                                      key={j}
                                      variant="secondary"
                                      className="text-xs cursor-pointer hover:bg-violet-500/20"
                                      onClick={() => res.url && window.open(res.url, '_blank')}
                                    >
                                      <BookOpen className="h-3 w-3 mr-1" />
                                      {res.name}
                                      {res.url && <ExternalLink className="h-2.5 w-2.5 ml-1" />}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Project */}
                            {phase.project && (
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                  <Target className="h-3 w-3" /> Recommended Project
                                </Label>
                                <p className="text-sm">{phase.project}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}

                      {/* Certifications (new format) */}
                      {pathway.certifications && pathway.certifications.length > 0 && (
                        <div className="pt-4 border-t border-border/50">
                          <Label className="text-sm flex items-center gap-2 mb-3">
                            <Award className="h-4 w-4 text-yellow-400" />
                            Recommended Certifications
                          </Label>
                          <div className="space-y-2">
                            {pathway.certifications.map((cert, i) => (
                              <div key={i} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                                <div className="font-medium text-sm">{cert.name}</div>
                                {cert.provider && (
                                  <div className="text-xs text-muted-foreground mt-1">Provider: {cert.provider}</div>
                                )}
                                {cert.relevance && (
                                  <div className="text-xs text-muted-foreground mt-1">{cert.relevance}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Certification Path (old format) */}
                      {pathway.certification_path && pathway.certification_path.length > 0 && (
                        <div className="pt-4 border-t border-border/50">
                          <Label className="text-sm flex items-center gap-2 mb-3">
                            <Award className="h-4 w-4 text-yellow-400" />
                            Recommended Certifications
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {pathway.certification_path.map((cert, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                              >
                                <Award className="h-3 w-3 mr-1" />
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Projects */}
                      {pathway.projects && pathway.projects.length > 0 && (
                        <div className="pt-4 border-t border-border/50">
                          <Label className="text-sm flex items-center gap-2 mb-3">
                            <Target className="h-4 w-4 text-blue-400" />
                            Portfolio Projects
                          </Label>
                          <div className="space-y-2">
                            {pathway.projects.map((project, i) => (
                              <div key={i} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-medium text-sm">{project.title}</div>
                                  <Badge variant="outline" className="text-xs">
                                    {project.difficulty}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">{project.description}</div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {project.skills_practiced.map((skill, j) => (
                                    <Badge key={j} variant="secondary" className="text-xs">
                                      {skill}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Career Advice / Progression */}
                      {(pathway.career_progression || pathway.advice) && (
                        <div className="p-4 rounded-lg bg-gradient-to-br from-violet-500/5 to-purple-500/5 border border-violet-500/20">
                          <Label className="text-sm flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-green-400" />
                            {pathway.advice ? 'Career Advice' : 'Career Progression'}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {pathway.advice || pathway.career_progression}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!loading && !skillGapResult && !error && (
          <Card className="border-dashed border-border/50">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="inline-flex p-4 rounded-full bg-violet-500/10 mb-4">
                <Route className="h-8 w-8 text-violet-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Build Your Learning Path</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Select your target role and add your current skills to get a personalized
                skill gap analysis and AI-generated learning roadmap.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default LearningPathway;
