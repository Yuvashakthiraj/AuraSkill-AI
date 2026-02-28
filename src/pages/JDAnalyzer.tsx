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
  Clock, Users, Code, Wrench, Info, ExternalLink, GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  extractSkillsFromJD,
  type JDExtractionResponse,
} from '@/utils/auraSkillService';

// Top-rated course recommendations for skills
const skillCourseMap: Record<string, { name: string; url: string; platform: string; rating: string }> = {
  // Programming Languages
  'javascript': { name: 'Complete JavaScript Course 2024', url: 'https://www.udemy.com/course/the-complete-javascript-course/', platform: 'Udemy', rating: '4.7' },
  'typescript': { name: 'Understanding TypeScript', url: 'https://www.udemy.com/course/understanding-typescript/', platform: 'Udemy', rating: '4.7' },
  'python': { name: 'Python for Everybody Specialization', url: 'https://www.coursera.org/specializations/python', platform: 'Coursera', rating: '4.8' },
  'java': { name: 'Java Programming Masterclass', url: 'https://www.udemy.com/course/java-the-complete-java-developer-course/', platform: 'Udemy', rating: '4.6' },
  'c++': { name: 'Beginning C++ Programming', url: 'https://www.udemy.com/course/beginning-c-plus-plus-programming/', platform: 'Udemy', rating: '4.6' },
  'go': { name: 'Go: The Complete Developers Guide', url: 'https://www.udemy.com/course/go-the-complete-developers-guide/', platform: 'Udemy', rating: '4.6' },
  'golang': { name: 'Go: The Complete Developers Guide', url: 'https://www.udemy.com/course/go-the-complete-developers-guide/', platform: 'Udemy', rating: '4.6' },
  'rust': { name: 'The Rust Programming Language', url: 'https://www.udemy.com/course/rust-lang/', platform: 'Udemy', rating: '4.5' },
  'swift': { name: 'iOS & Swift - Complete iOS App Development', url: 'https://www.udemy.com/course/ios-13-app-development-bootcamp/', platform: 'Udemy', rating: '4.7' },
  'kotlin': { name: 'Android Kotlin Development Masterclass', url: 'https://www.udemy.com/course/android-kotlin-developer/', platform: 'Udemy', rating: '4.5' },
  
  // Frontend
  'react': { name: 'React - The Complete Guide 2024', url: 'https://www.udemy.com/course/react-the-complete-guide-incl-redux/', platform: 'Udemy', rating: '4.7' },
  'react.js': { name: 'React - The Complete Guide 2024', url: 'https://www.udemy.com/course/react-the-complete-guide-incl-redux/', platform: 'Udemy', rating: '4.7' },
  'vue': { name: 'Vue - The Complete Guide', url: 'https://www.udemy.com/course/vuejs-2-the-complete-guide/', platform: 'Udemy', rating: '4.7' },
  'vue.js': { name: 'Vue - The Complete Guide', url: 'https://www.udemy.com/course/vuejs-2-the-complete-guide/', platform: 'Udemy', rating: '4.7' },
  'angular': { name: 'Angular - The Complete Guide', url: 'https://www.udemy.com/course/the-complete-guide-to-angular-2/', platform: 'Udemy', rating: '4.6' },
  'next.js': { name: 'Next.js & React - The Complete Guide', url: 'https://www.udemy.com/course/nextjs-react-the-complete-guide/', platform: 'Udemy', rating: '4.7' },
  'nextjs': { name: 'Next.js & React - The Complete Guide', url: 'https://www.udemy.com/course/nextjs-react-the-complete-guide/', platform: 'Udemy', rating: '4.7' },
  'html': { name: 'Build Responsive Websites with HTML & CSS', url: 'https://www.udemy.com/course/design-and-develop-a-killer-website-with-html5-and-css3/', platform: 'Udemy', rating: '4.7' },
  'css': { name: 'Advanced CSS and Sass', url: 'https://www.udemy.com/course/advanced-css-and-sass/', platform: 'Udemy', rating: '4.8' },
  'tailwind': { name: 'Tailwind CSS From Scratch', url: 'https://www.udemy.com/course/tailwind-css-from-scratch/', platform: 'Udemy', rating: '4.7' },
  'tailwind css': { name: 'Tailwind CSS From Scratch', url: 'https://www.udemy.com/course/tailwind-css-from-scratch/', platform: 'Udemy', rating: '4.7' },
  
  // Backend
  'node.js': { name: 'Node.js, Express, MongoDB & More', url: 'https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/', platform: 'Udemy', rating: '4.7' },
  'nodejs': { name: 'Node.js, Express, MongoDB & More', url: 'https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/', platform: 'Udemy', rating: '4.7' },
  'express': { name: 'Node.js, Express, MongoDB & More', url: 'https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/', platform: 'Udemy', rating: '4.7' },
  'express.js': { name: 'Node.js, Express, MongoDB & More', url: 'https://www.udemy.com/course/nodejs-express-mongodb-bootcamp/', platform: 'Udemy', rating: '4.7' },
  'django': { name: 'Python Django - The Practical Guide', url: 'https://www.udemy.com/course/python-django-the-practical-guide/', platform: 'Udemy', rating: '4.6' },
  'flask': { name: 'REST APIs with Flask and Python', url: 'https://www.udemy.com/course/rest-api-flask-and-python/', platform: 'Udemy', rating: '4.6' },
  'spring': { name: 'Spring Framework Master Class', url: 'https://www.udemy.com/course/spring-framework-5-beginner-to-guru/', platform: 'Udemy', rating: '4.5' },
  'spring boot': { name: 'Spring Boot 3, Spring 6 & Hibernate', url: 'https://www.udemy.com/course/spring-hibernate-tutorial/', platform: 'Udemy', rating: '4.6' },
  
  // Databases
  'sql': { name: 'The Complete SQL Bootcamp', url: 'https://www.udemy.com/course/the-complete-sql-bootcamp/', platform: 'Udemy', rating: '4.7' },
  'mysql': { name: 'MySQL Database Development Mastery', url: 'https://www.udemy.com/course/mysql-database-development-mastery/', platform: 'Udemy', rating: '4.5' },
  'postgresql': { name: 'SQL and PostgreSQL: The Complete Guide', url: 'https://www.udemy.com/course/sql-and-postgresql/', platform: 'Udemy', rating: '4.7' },
  'mongodb': { name: 'MongoDB - The Complete Developer Guide', url: 'https://www.udemy.com/course/mongodb-the-complete-developers-guide/', platform: 'Udemy', rating: '4.7' },
  'redis': { name: 'Redis: The Complete Developer Guide', url: 'https://www.udemy.com/course/redis-the-complete-developers-guide-p/', platform: 'Udemy', rating: '4.6' },
  'elasticsearch': { name: 'Complete Guide to Elasticsearch', url: 'https://www.udemy.com/course/elasticsearch-complete-guide/', platform: 'Udemy', rating: '4.5' },
  
  // Cloud & DevOps
  'aws': { name: 'AWS Certified Solutions Architect', url: 'https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/', platform: 'Udemy', rating: '4.7' },
  'azure': { name: 'AZ-900 Azure Fundamentals', url: 'https://www.udemy.com/course/az900-azure/', platform: 'Udemy', rating: '4.6' },
  'gcp': { name: 'Google Cloud Professional Cloud Architect', url: 'https://www.coursera.org/professional-certificates/gcp-cloud-architect', platform: 'Coursera', rating: '4.6' },
  'docker': { name: 'Docker & Kubernetes: The Practical Guide', url: 'https://www.udemy.com/course/docker-kubernetes-the-practical-guide/', platform: 'Udemy', rating: '4.7' },
  'kubernetes': { name: 'Kubernetes for the Absolute Beginners', url: 'https://www.udemy.com/course/learn-kubernetes/', platform: 'Udemy', rating: '4.6' },
  'terraform': { name: 'HashiCorp Certified: Terraform Associate', url: 'https://www.udemy.com/course/terraform-beginner-to-advanced/', platform: 'Udemy', rating: '4.6' },
  'jenkins': { name: 'Jenkins, From Zero To Hero', url: 'https://www.udemy.com/course/jenkins-from-zero-to-hero/', platform: 'Udemy', rating: '4.5' },
  'ci/cd': { name: 'DevOps: CI/CD with Jenkins Pipelines', url: 'https://www.udemy.com/course/learn-devops-ci-cd-with-jenkins-using-pipelines-and-docker/', platform: 'Udemy', rating: '4.5' },
  'ci/cd pipelines': { name: 'DevOps: CI/CD with Jenkins Pipelines', url: 'https://www.udemy.com/course/learn-devops-ci-cd-with-jenkins-using-pipelines-and-docker/', platform: 'Udemy', rating: '4.5' },
  
  // Data & ML
  'machine learning': { name: 'Machine Learning A-Z', url: 'https://www.udemy.com/course/machinelearning/', platform: 'Udemy', rating: '4.5' },
  'deep learning': { name: 'Deep Learning Specialization', url: 'https://www.coursera.org/specializations/deep-learning', platform: 'Coursera', rating: '4.9' },
  'tensorflow': { name: 'TensorFlow Developer Certificate', url: 'https://www.coursera.org/professional-certificates/tensorflow-in-practice', platform: 'Coursera', rating: '4.7' },
  'pytorch': { name: 'PyTorch for Deep Learning', url: 'https://www.udemy.com/course/pytorch-for-deep-learning-with-python-bootcamp/', platform: 'Udemy', rating: '4.6' },
  'data science': { name: 'Data Science Course 2024', url: 'https://www.udemy.com/course/the-data-science-course-complete-data-science-bootcamp/', platform: 'Udemy', rating: '4.6' },
  'pandas': { name: 'Data Analysis with Pandas and Python', url: 'https://www.udemy.com/course/data-analysis-with-pandas/', platform: 'Udemy', rating: '4.6' },
  'numpy': { name: 'Python for Data Science and Machine Learning', url: 'https://www.udemy.com/course/python-for-data-science-and-machine-learning-bootcamp/', platform: 'Udemy', rating: '4.6' },
  
  // APIs & Architecture
  'graphql': { name: 'GraphQL by Example', url: 'https://www.udemy.com/course/graphql-by-example/', platform: 'Udemy', rating: '4.5' },
  'rest': { name: 'REST API Design, Development & Management', url: 'https://www.udemy.com/course/rest-api/', platform: 'Udemy', rating: '4.4' },
  'restful apis': { name: 'REST API Design, Development & Management', url: 'https://www.udemy.com/course/rest-api/', platform: 'Udemy', rating: '4.4' },
  'microservices': { name: 'Microservices Architecture', url: 'https://www.udemy.com/course/microservices-architecture-and-implementation-on-dotnet/', platform: 'Udemy', rating: '4.5' },
  'microservices architecture': { name: 'Microservices Architecture', url: 'https://www.udemy.com/course/microservices-architecture-and-implementation-on-dotnet/', platform: 'Udemy', rating: '4.5' },
  'containerization': { name: 'Docker & Kubernetes: The Practical Guide', url: 'https://www.udemy.com/course/docker-kubernetes-the-practical-guide/', platform: 'Udemy', rating: '4.7' },
  'system design': { name: 'Grokking Modern System Design', url: 'https://www.educative.io/courses/grokking-modern-system-design-interview-for-engineers-managers', platform: 'Educative', rating: '4.7' },
  
  // Tools
  'git': { name: 'Git Complete: The Definitive Guide', url: 'https://www.udemy.com/course/git-complete/', platform: 'Udemy', rating: '4.6' },
  'github actions': { name: 'GitHub Actions - The Complete Guide', url: 'https://www.udemy.com/course/github-actions-the-complete-guide/', platform: 'Udemy', rating: '4.7' },
  'jira': { name: 'Learn JIRA with Real-World Examples', url: 'https://www.udemy.com/course/the-complete-guide-to-jira-with-real-world-examples/', platform: 'Udemy', rating: '4.4' },
  'confluence': { name: 'Atlassian Confluence Fundamentals', url: 'https://www.udemy.com/course/confluence-fundamentals/', platform: 'Udemy', rating: '4.3' },
  'postman': { name: 'Postman: The Complete Guide', url: 'https://www.udemy.com/course/postman-the-complete-guide/', platform: 'Udemy', rating: '4.6' },
  'vs code': { name: 'Visual Studio Code Tutorial', url: 'https://www.udemy.com/course/learn-visual-studio-code/', platform: 'Udemy', rating: '4.5' },
  'slack': { name: 'Slack Fundamentals', url: 'https://www.udemy.com/course/slack-fundamentals/', platform: 'Udemy', rating: '4.3' },
  
  // Security
  'security': { name: 'Web Security & Bug Bounty', url: 'https://www.udemy.com/course/web-security-and-bug-bounty-learn-penetration-testing/', platform: 'Udemy', rating: '4.6' },
  'oauth': { name: 'OAuth 2.0 in Depth', url: 'https://www.udemy.com/course/oauth-2-simplified/', platform: 'Udemy', rating: '4.5' },
  'oauth 2.0': { name: 'OAuth 2.0 in Depth', url: 'https://www.udemy.com/course/oauth-2-simplified/', platform: 'Udemy', rating: '4.5' },
  'cybersecurity': { name: 'Complete Cybersecurity Bootcamp', url: 'https://www.udemy.com/course/the-complete-cyber-security-course/', platform: 'Udemy', rating: '4.5' },
  
  // Testing
  'testing': { name: 'Selenium WebDriver with Java', url: 'https://www.udemy.com/course/selenium-real-time-examplesinterview-questions/', platform: 'Udemy', rating: '4.5' },
  'jest': { name: 'Testing React with Jest and Testing Library', url: 'https://www.udemy.com/course/react-testing-library/', platform: 'Udemy', rating: '4.6' },
  'unit testing': { name: 'Unit Testing for C# Developers', url: 'https://www.udemy.com/course/unit-testing-csharp/', platform: 'Udemy', rating: '4.5' },
  
  // Mobile
  'react native': { name: 'React Native - The Practical Guide', url: 'https://www.udemy.com/course/react-native-the-practical-guide/', platform: 'Udemy', rating: '4.6' },
  'flutter': { name: 'Flutter & Dart - The Complete Guide', url: 'https://www.udemy.com/course/learn-flutter-dart-to-build-ios-android-apps/', platform: 'Udemy', rating: '4.6' },
  'ios': { name: 'iOS & Swift - Complete iOS Development', url: 'https://www.udemy.com/course/ios-13-app-development-bootcamp/', platform: 'Udemy', rating: '4.7' },
  'android': { name: 'Android App Development Masterclass', url: 'https://www.udemy.com/course/android-oreo-kotlin-app-masterclass/', platform: 'Udemy', rating: '4.4' },
};

// Get course for a skill (case-insensitive lookup)
const getCourseForSkill = (skill: string) => {
  const normalizedSkill = skill.toLowerCase().trim();
  return skillCourseMap[normalizedSkill] || null;
};

// Clickable skill badge component
const SkillBadgeWithCourse = ({ 
  skill, 
  variant 
}: { 
  skill: string; 
  variant: 'required' | 'preferred' | 'tool';
}) => {
  const course = getCourseForSkill(skill);
  
  const variantStyles = {
    required: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20',
    preferred: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
    tool: 'bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20',
  };
  
  const IconComponent = variant === 'tool' ? Wrench : Code;
  
  if (course) {
    return (
      <a
        href={course.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block"
        title={`${course.name} (${course.platform} - ⭐${course.rating})`}
      >
        <Badge
          variant="outline"
          className={`${variantStyles[variant]} cursor-pointer transition-all hover:scale-105 group`}
        >
          <IconComponent className="h-3 w-3 mr-1" />
          {skill}
          <ExternalLink className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Badge>
      </a>
    );
  }
  
  return (
    <Badge
      variant="outline"
      className={variantStyles[variant]}
    >
      <IconComponent className="h-3 w-3 mr-1" />
      {skill}
    </Badge>
  );
};

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to analyze job description';
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

              {/* Course Recommendation Info */}
              <Alert className="border-emerald-500/30 bg-emerald-500/5">
                <GraduationCap className="h-4 w-4 text-emerald-400" />
                <AlertDescription className="text-emerald-300">
                  <strong>Course Recommendations:</strong> Click on any skill badge to access top-rated courses from Udemy, Coursera & more. Skills with available courses show an <ExternalLink className="h-3 w-3 inline mx-1" /> icon on hover.
                </AlertDescription>
              </Alert>

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
                        <SkillBadgeWithCourse key={i} skill={skill} variant="required" />
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
                        <SkillBadgeWithCourse key={i} skill={skill} variant="preferred" />
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
                        <SkillBadgeWithCourse key={i} skill={tool} variant="tool" />
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
