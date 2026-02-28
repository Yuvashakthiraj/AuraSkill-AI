import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  User, Github, Linkedin, FileText, Brain, Code, Briefcase, TrendingUp,
  CheckCircle2, AlertCircle, Loader2, Upload, Sparkles, Target, Cpu,
  BookOpen, Play, BarChart3, Clock, ChevronRight
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from 'recharts';
import { analyzeProfile, getProfileGoals, type ProfileAnalysisInput, type ProfileAnalysisResult } from '@/utils/auraSkillService';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Pipeline steps
const PIPELINE_STEPS = [
  { id: 1, title: 'Parsing Resume', description: 'Extracting skills and experience from your resume', icon: FileText },
  { id: 2, title: 'Deep GitHub Analysis', description: 'Analyzing repositories and code contributions', icon: Github },
  { id: 3, title: 'Fetching LinkedIn', description: 'Gathering professional profile data', icon: Linkedin },
  { id: 4, title: 'Data Fusion', description: 'Merging insights from all sources', icon: Target },
  { id: 5, title: 'Groq AI Inference', description: 'Running AI-powered skill evaluation', icon: Cpu },
  { id: 6, title: 'Curating Resources', description: 'Finding personalized learning materials', icon: BookOpen },
];

const ProfileAnalyzer: React.FC = () => {
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [careerGoal, setCareerGoal] = useState('');
  const [availableGoals, setAvailableGoals] = useState<string[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [result, setResult] = useState<ProfileAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load available career goals
  useEffect(() => {
    getProfileGoals()
      .then((res) => setAvailableGoals(res.goals))
      .catch(() => console.log('Could not load career goals'));
  }, []);

  // Extract text from PDF
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => (item as { str: string }).str)
        .join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setResumeFile(file);
    setError(null);
    try {
      if (file.type === 'application/pdf') {
        const text = await extractTextFromPDF(file);
        setResumeText(text);
      } else if (file.type === 'text/plain') {
        const text = await file.text();
        setResumeText(text);
      } else {
        setError('Please upload a PDF or TXT file');
        setResumeFile(null);
      }
    } catch {
      setError('Failed to parse resume file');
      setResumeFile(null);
    }
  };

  const simulateSteps = () => {
    setCompletedSteps([]);
    setCurrentStep(1);
    const stepDurations = [1500, 2000, 1500, 1000, 2500, 1500];
    let totalDelay = 0;
    stepDurations.forEach((duration, index) => {
      totalDelay += duration;
      setTimeout(() => {
        setCompletedSteps(prev => [...prev, index + 1]);
        if (index + 2 <= PIPELINE_STEPS.length) setCurrentStep(index + 2);
      }, totalDelay);
    });
    return totalDelay;
  };

  const handleAnalyze = async () => {
    if (!githubUrl && !linkedinUrl && !resumeText) {
      setError('Please provide at least one input (GitHub URL, LinkedIn URL, or resume)');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const animationDuration = simulateSteps();

    try {
      const input: ProfileAnalysisInput = {
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        career_goal: careerGoal || 'Software Engineer',
        resume_text: resumeText || undefined,
      };
      const analysisResult = await analyzeProfile(input);
      setTimeout(() => {
        setResult(analysisResult);
        setLoading(false);
      }, Math.max(0, animationDuration - 5000));
    } catch (err: unknown) {
      setTimeout(() => {
        setError((err as Error).message || 'Failed to analyze profile');
        setLoading(false);
        setCurrentStep(0);
        setCompletedSteps([]);
      }, animationDuration);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 backdrop-blur-sm">
            <User className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Profile Analyzer</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive AI-powered analysis of your professional profile
            </p>
          </div>
        </div>

        {/* Input Form */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-violet-400" />
              Enter Your Profile Details
            </CardTitle>
            <CardDescription>
              Provide your GitHub URL, LinkedIn URL, and/or upload your resume
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="github" className="flex items-center gap-2">
                  <Github className="h-4 w-4" /> GitHub Profile URL
                </Label>
                <Input
                  id="github"
                  placeholder="https://github.com/username"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin" className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4" /> LinkedIn Profile URL
                </Label>
                <Input
                  id="linkedin"
                  placeholder="https://linkedin.com/in/username"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Career Goal / Target Role
              </Label>
              {availableGoals.length > 0 ? (
                <Select value={careerGoal} onValueChange={setCareerGoal}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your career goal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGoals.map((goal) => (
                      <SelectItem key={goal} value={goal}>{goal}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="e.g., Senior Full Stack Developer, Data Scientist"
                  value={careerGoal}
                  onChange={(e) => setCareerGoal(e.target.value)}
                  disabled={loading}
                />
              )}
            </div>

            {/* Resume Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Upload Resume (PDF or TXT)
              </Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${resumeFile ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.txt"
                  className="hidden"
                  disabled={loading}
                />
                {resumeFile ? (
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">{resumeFile.name}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click or drag to upload your resume</p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={loading || (!githubUrl && !linkedinUrl && !resumeText)}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 h-11"
              size="lg"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing Profile...</>
              ) : (
                <><Brain className="mr-2 h-4 w-4" /> Analyze My Profile</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Pipeline Animation */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-violet-500/20 bg-violet-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
                    Analysis Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {PIPELINE_STEPS.map((step, index) => {
                      const StepIcon = step.icon;
                      const isCompleted = completedSteps.includes(step.id);
                      const isActive = currentStep === step.id;
                      return (
                        <motion.div
                          key={step.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                            isCompleted ? 'bg-green-100 dark:bg-green-900/30'
                              : isActive ? 'bg-blue-100 dark:bg-blue-900/30'
                                : 'bg-muted/30'
                          }`}
                        >
                          <div className={`p-2 rounded-full ${
                            isCompleted ? 'bg-green-500 text-white'
                              : isActive ? 'bg-blue-500 text-white'
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {isCompleted ? <CheckCircle2 className="h-5 w-5" />
                              : isActive ? <Loader2 className="h-5 w-5 animate-spin" />
                                : <StepIcon className="h-5 w-5" />
                            }
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium ${isCompleted || isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.title}
                            </p>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                          </div>
                          {isCompleted && <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">Done</Badge>}
                          {isActive && <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">Processing</Badge>}
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* User Info + Overall Score */}
              <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5 overflow-hidden">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {result.userInfo?.avatar_url && (
                      <img
                        src={result.userInfo.avatar_url}
                        alt={result.userInfo.name}
                        className="w-20 h-20 rounded-full border-2 border-violet-500/30 shadow-lg"
                      />
                    )}
                    <div className="flex-1 text-center md:text-left">
                      <h2 className="text-2xl font-bold">{result.userInfo?.name || 'Profile Analysis'}</h2>
                      <p className="text-muted-foreground">{result.careerGoal}</p>
                      <div className="flex flex-wrap gap-2 mt-2 justify-center md:justify-start">
                        {(result.stepsCompleted || []).map((step) => (
                          <Badge key={step} variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> {step}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Score Circle */}
                    <div className="flex flex-col items-center">
                      <div className="relative w-28 h-28">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                          <circle
                            cx="56" cy="56" r="48" fill="none"
                            stroke="url(#profile-gradient)" strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={`${(result.score / 100) * 301} 301`}
                          />
                          <defs>
                            <linearGradient id="profile-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#8b5cf6" />
                              <stop offset="100%" stopColor="#a855f7" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-2xl font-bold ${getScoreColor(result.score)}`}>{result.score}%</span>
                          <span className="text-[10px] text-muted-foreground">Readiness</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Skill Gaps Alert */}
              {result.gaps && result.gaps.length > 0 && (
                <Card className="border-orange-500/30 bg-orange-500/5">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-orange-400 mb-1">Key Skill Gaps Identified</p>
                        <div className="flex flex-wrap gap-2">
                          {result.gaps.map((gap, i) => (
                            <Badge key={i} variant="outline" className="bg-orange-500/10 text-orange-300 border-orange-500/30">
                              {gap}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Main Tabs */}
              <Tabs defaultValue="radar" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="radar" className="flex items-center gap-1.5 text-xs">
                    <BarChart3 className="h-4 w-4" /> Skills
                  </TabsTrigger>
                  <TabsTrigger value="improve" className="flex items-center gap-1.5 text-xs">
                    <TrendingUp className="h-4 w-4" /> Improve
                  </TabsTrigger>
                  <TabsTrigger value="roadmap" className="flex items-center gap-1.5 text-xs">
                    <Target className="h-4 w-4" /> Roadmap
                  </TabsTrigger>
                  <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs">
                    <User className="h-4 w-4" /> Profile
                  </TabsTrigger>
                  <TabsTrigger value="videos" className="flex items-center gap-1.5 text-xs">
                    <Play className="h-4 w-4" /> Videos
                  </TabsTrigger>
                </TabsList>

                {/* Radar Chart Tab */}
                <TabsContent value="radar">
                  <Card className="border-border/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-violet-400" /> Skill Radar
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Skills scored from GitHub (40%), LinkedIn (30%), and Resume (30%)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {result.radarData && result.radarData.length > 0 ? (
                        <div className="space-y-6">
                          <ResponsiveContainer width="100%" height={400}>
                            <RadarChart data={result.radarData} cx="50%" cy="50%" outerRadius="75%">
                              <PolarGrid strokeDasharray="3 3" className="text-border" />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                              <Radar name="Overall" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} />
                              <Radar name="GitHub" dataKey="github" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={1} strokeDasharray="4 4" />
                              <Radar name="LinkedIn" dataKey="linkedin" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={1} strokeDasharray="4 4" />
                              <Radar name="Resume" dataKey="resume" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={1} strokeDasharray="4 4" />
                              <Tooltip
                                contentStyle={{ borderRadius: 8, fontSize: 12, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                              />
                            </RadarChart>
                          </ResponsiveContainer>

                          {/* Skill Breakdown Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border/50">
                                  <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Skill</th>
                                  <th className="text-center py-2 px-2 font-semibold text-muted-foreground">Overall</th>
                                  <th className="text-center py-2 px-2 font-semibold text-muted-foreground">GitHub</th>
                                  <th className="text-center py-2 px-2 font-semibold text-muted-foreground">LinkedIn</th>
                                  <th className="text-center py-2 px-2 font-semibold text-muted-foreground">Resume</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.radarData.map((item, i) => (
                                  <tr key={i} className="border-b border-border/20 hover:bg-muted/30">
                                    <td className="py-2 px-2 font-medium">{item.subject}</td>
                                    <td className="text-center py-2 px-2">
                                      <Badge variant="outline" className={`text-[10px] ${item.score >= 60 ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                        {item.score}
                                      </Badge>
                                    </td>
                                    <td className="text-center py-2 px-2 text-emerald-400">{item.github}</td>
                                    <td className="text-center py-2 px-2 text-blue-400">{item.linkedin}</td>
                                    <td className="text-center py-2 px-2 text-amber-400">{item.resume}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">No radar data available.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Improvements Tab */}
                <TabsContent value="improve">
                  <div className="space-y-4">
                    {result.improvements?.general && result.improvements.general.length > 0 && (
                      <Card className="border-border/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-yellow-400" /> General Improvements
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {result.improvements.general.map((tip, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="h-4 w-4 mt-0.5 text-violet-400 flex-shrink-0" />
                                <span className="text-muted-foreground">{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {result.improvements?.job_based && result.improvements.job_based.length > 0 && (
                      <Card className="border-violet-500/30">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-violet-400" /> Job-Specific Recommendations
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Targeted improvements for {result.careerGoal}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {result.improvements.job_based.map((tip, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <Target className="h-4 w-4 mt-0.5 text-emerald-400 flex-shrink-0" />
                                <span className="text-muted-foreground">{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {(!result.improvements?.general?.length && !result.improvements?.job_based?.length) && (
                      <Card className="border-border/50">
                        <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                          No improvement recommendations available.
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                {/* Learning Roadmap Tab */}
                <TabsContent value="roadmap">
                  <Card className="border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-violet-400" /> Learning Roadmap
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Step-by-step plan to reach your career goal
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {result.phases && result.phases.length > 0 ? (
                        <div className="space-y-4">
                          {result.phases.map((phase, i) => (
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
                              <div className="ml-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-semibold text-sm">{phase.title}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" /> {phase.duration}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30 text-[10px]">
                                    Focus: {phase.focus}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{phase.details}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">No roadmap data available.</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Profile Details Tab */}
                <TabsContent value="profile">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* GitHub Languages */}
                    <Card className="border-border/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Github className="h-4 w-4" /> GitHub Languages
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {result.githubLanguages && result.githubLanguages.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {result.githubLanguages.map((lang, i) => (
                              <Badge key={i} variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                <Code className="h-3 w-3 mr-1" /> {lang}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No GitHub data available.</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* LinkedIn Profile */}
                    <Card className="border-border/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Linkedin className="h-4 w-4 text-blue-400" /> LinkedIn Profile
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {result.linkedinProfile ? (
                          <>
                            {result.linkedinProfile.company && (
                              <div className="flex items-center gap-2 text-sm">
                                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{result.linkedinProfile.company}</span>
                              </div>
                            )}
                            {result.linkedinProfile.experience_years > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{result.linkedinProfile.experience_years} years experience</span>
                              </div>
                            )}
                            {result.linkedinProfile.job_titles?.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5">Job Titles</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {result.linkedinProfile.job_titles.map((title, i) => (
                                    <Badge key={i} variant="secondary" className="text-[10px]">{title}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {result.linkedinProfile.skills?.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5">Skills</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {result.linkedinProfile.skills.map((s, i) => (
                                    <Badge key={i} variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">
                                      {s.skill} ({s.proficiency}%)
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No LinkedIn data available.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Videos Tab */}
                <TabsContent value="videos">
                  <Card className="border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Play className="h-4 w-4 text-red-500" /> Recommended Videos
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Curated learning videos based on your skill gaps
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {result.videos && result.videos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {result.videos.map((video, i) => (
                            <motion.a
                              key={i}
                              href={`https://www.youtube.com/watch?v=${video.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="group block rounded-lg overflow-hidden border border-border/50 hover:border-violet-500/30 transition-all"
                            >
                              <div className="relative">
                                <img
                                  src={video.thumbnail}
                                  alt={video.title}
                                  className="w-full h-36 object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="h-10 w-10 text-white" />
                                </div>
                              </div>
                              <div className="p-3">
                                <p className="text-xs font-medium line-clamp-2 group-hover:text-violet-400 transition-colors">
                                  {video.title}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1">{video.channel}</p>
                              </div>
                            </motion.a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No video recommendations available.
                        </p>
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
              <div className="inline-flex p-4 rounded-full bg-violet-500/10 mb-4">
                <User className="h-8 w-8 text-violet-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Analyze Your Profile</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Enter your GitHub URL, LinkedIn URL, or upload your resume to get a
                comprehensive AI-powered profile analysis with skill radar, improvement
                tips, and personalized learning roadmap.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ProfileAnalyzer;
