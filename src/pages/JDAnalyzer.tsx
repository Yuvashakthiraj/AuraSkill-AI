import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText, Sparkles, AlertCircle, Loader2, CheckCircle, Briefcase, 
  Clock, Users, Code, Wrench, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  extractSkillsFromJD,
  type JDExtractionResponse,
} from '@/utils/auraSkillService';

const SAMPLE_JD = `Senior Software Engineer - Full Stack

We are looking for a skilled engineer to join our team.

Requirements:
- 5+ years of experience with React and TypeScript
- Proficiency in Python or Node.js
- Experience with cloud services (AWS preferred)
- Strong experience with microservices architecture
- Knowledge of Docker and CI/CD pipelines
- Excellent problem-solving and communication skills

Preferred:
- Experience with Kubernetes
- Knowledge of GraphQL
- Familiarity with ML/AI concepts

Tools:
- Jira, Git, Jenkins`;

const JDAnalyzer = () => {
  const [loading, setLoading] = useState(false);
  const [jdText, setJdText] = useState('');
  const [result, setResult] = useState<JDExtractionResponse | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!jdText.trim() || jdText.trim().length < 50) {
      toast.error('Please enter at least 50 characters');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await extractSkillsFromJD(jdText);
      setResult(data);
      toast.success('Analysis complete!');
    } catch (err: any) {
      const message = err.message || 'Failed to analyze job description';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = () => {
    setJdText(SAMPLE_JD);
    setResult(null);
    setError('');
    toast.success('Sample JD loaded');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 backdrop-blur-sm">
            <FileText className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">NLP Job Description Analyzer</h1>
            <p className="text-sm text-muted-foreground">
              Paste any job description — AI (LLM-based NLP) performs semantic analysis to extract skills, tools, and experience level
            </p>
          </div>
        </div>

        {/* Info Card */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="font-semibold text-blue-400">NLP Method:</span>{' '}
                  <span className="text-muted-foreground">
                    AI (llama-3.3-70b-versatile) — Large Language Model performs semantic parsing of unstructured text. 
                    Unlike keyword matching, the LLM understands <em>context</em> (e.g., distinguishes "Java experience" 
                    from "JavaScript"), infers skill levels, and classifies domain.
                  </span>
                </p>
                <p className="text-sm">
                  <span className="font-semibold text-blue-400">Caching:</span>{' '}
                  <span className="text-muted-foreground">
                    Results cached in SQLite with MD5 keys for performance.
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Input Form */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Paste Job Description Text</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste a full job description here...

Example: We are looking for a Senior Software Engineer with 5+ years of experience in Python, React, and AWS. The ideal candidate should have experience with microservices architecture, Docker, and CI/CD pipelines..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              disabled={loading}
              rows={14}
              className="resize-none font-mono text-sm"
            />

            <div className="flex gap-3">
              <Button
                onClick={handleAnalyze}
                disabled={loading || !jdText.trim() || jdText.trim().length < 50}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze with AI (NLP)
                  </>
                )}
              </Button>

              <Button
                onClick={handleLoadSample}
                disabled={loading}
                variant="outline"
              >
                <FileText className="mr-2 h-4 w-4" />
                Load Sample JD
              </Button>
            </div>
          </CardContent>
        </Card>

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
              {/* Summary Card */}
              <Card className="border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-blue-400" />
                    Role Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Users className="h-5 w-5 text-violet-400" />
                      <div>
                        <p className="text-xs text-muted-foreground">Experience Level</p>
                        <p className="font-semibold">{result.analysis.experience_level}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Briefcase className="h-5 w-5 text-blue-400" />
                      <div>
                        <p className="text-xs text-muted-foreground">Domain</p>
                        <p className="font-semibold">{result.analysis.domain}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Sparkles className="h-5 w-5 text-yellow-400" />
                      <div>
                        <p className="text-xs text-muted-foreground">NLP Method</p>
                        <p className="font-semibold text-xs">LLM-based</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-sm text-muted-foreground">{result.analysis.summary}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Skills Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Required Skills */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-red-400" />
                      Required Skills ({result.analysis.required_skills.length})
                    </CardTitle>
                    <CardDescription className="text-xs">Must-have competencies</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.analysis.required_skills.map((skill, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="bg-red-500/10 text-red-400 border-red-500/30"
                        >
                          <Code className="h-3 w-3 mr-1" />
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Preferred Skills */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-400" />
                      Preferred Skills ({result.analysis.preferred_skills.length})
                    </CardTitle>
                    <CardDescription className="text-xs">Nice-to-have skills</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.analysis.preferred_skills.map((skill, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="bg-blue-500/10 text-blue-400 border-blue-500/30"
                        >
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Tools */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-violet-400" />
                      Tools & Platforms ({result.analysis.tools.length})
                    </CardTitle>
                    <CardDescription className="text-xs">Technologies mentioned</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {result.analysis.tools.map((tool, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="bg-violet-500/10 text-violet-400 border-violet-500/30"
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* NLP Method Info */}
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">{result.nlp_method}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!loading && !result && !error && (
          <Card className="border-dashed border-border/50">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="inline-flex p-4 rounded-full bg-blue-500/10 mb-4">
                <FileText className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Analyze Job Descriptions</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Paste any job description and let our AI extract structured information including
                required skills, preferred skills, tools, experience level, and domain classification.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default JDAnalyzer;
