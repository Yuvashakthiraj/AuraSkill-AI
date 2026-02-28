import { useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Search, Briefcase, MapPin, Building2, Sparkles,
  TrendingUp, TrendingDown, Globe, DollarSign, Laptop, AlertCircle,
  Loader2, Zap, ArrowUpRight, ChevronRight, Lightbulb, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  scrapeJobs,
  type ScrapedJob,
  type ScrapeJobsResponse,
} from '@/utils/auraSkillService';

const QUICK_SEARCHES = [
  { label: 'React Developer', icon: '⚛️' },
  { label: 'Python Engineer', icon: '🐍' },
  { label: 'Data Scientist', icon: '📊' },
  { label: 'DevOps Engineer', icon: '🔧' },
  { label: 'ML Engineer', icon: '🤖' },
  { label: 'Full Stack', icon: '🌐' },
];

const LiveJobScraper = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeJobsResponse | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async (searchQuery?: string) => {
    const effectiveQuery = searchQuery || query;
    if (!effectiveQuery.trim()) {
      toast.error('Please enter a job title or skill to search');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await scrapeJobs(effectiveQuery, 25);
      setResult(data);
      if (data.jobs.length === 0) {
        toast.info('No jobs found. Try a different search term.');
      } else {
        toast.success(`Found ${data.jobs_scraped} jobs for "${effectiveQuery}"`);
      }
    } catch (err: any) {
      const message = err.message || 'Failed to fetch jobs. Make sure AuraSkill backend is running.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = (label: string) => {
    setQuery(label);
    handleSearch(label);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 backdrop-blur-sm">
            <Briefcase className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Live Job Scraper</h1>
            <p className="text-sm text-muted-foreground">
              Search real-time tech jobs with AI-powered market analysis
            </p>
          </div>
        </div>

        {/* Search Card */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-violet-400" />
              Job Search
            </CardTitle>
            <CardDescription>
              Enter a job title, skill, or technology to find matching positions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="e.g., React Developer, Python, Machine Learning..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={loading}
                  className="h-11"
                />
              </div>
              <Button
                onClick={() => handleSearch()}
                disabled={loading || !query.trim()}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 h-11 min-w-[120px]"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching...</>
                ) : (
                  <><Search className="mr-2 h-4 w-4" /> Search Jobs</>
                )}
              </Button>
            </div>

            {/* Quick Search Tags */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground pt-1">Quick search:</span>
              {QUICK_SEARCHES.map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSearch(item.label)}
                  disabled={loading}
                  className="h-7 text-xs hover:bg-violet-500/10 hover:border-violet-500/50"
                >
                  <span className="mr-1">{item.icon}</span>
                  {item.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 animate-pulse text-violet-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Scraping job boards and analyzing market data...</p>
                  <p className="text-xs text-muted-foreground mt-1">This may take 10-20 seconds for AI analysis</p>
                </div>
              </div>
              <Progress value={45} className="mt-4" />
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
              {/* AI Market Analysis */}
              {result.analysis && (
                <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-400" />
                        AI Market Analysis
                      </CardTitle>
                      {result.analysis.confidence && (
                        <Badge variant="outline" className={`text-[10px] ${
                          result.analysis.confidence === 'High' ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {result.analysis.confidence} confidence
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Market Summary */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {result.analysis.market_summary}
                    </p>

                    {/* Key Insights Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Salary Insights */}
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                          <DollarSign className="h-3 w-3" /> Salary Insights
                        </Label>
                        <p className="text-sm">{result.analysis.salary_insights}</p>
                      </div>

                      {/* Remote Work Trend */}
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                          <Laptop className="h-3 w-3" /> Remote Work
                        </Label>
                        <p className="text-sm">{result.analysis.remote_work_trend}</p>
                      </div>

                      {/* AI Impact */}
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                          <Sparkles className="h-3 w-3" /> AI Impact
                        </Label>
                        <p className="text-sm">{result.analysis.ai_impact}</p>
                      </div>
                    </div>

                    {/* Top Skills Demanded */}
                    {result.analysis.top_skills_demanded && result.analysis.top_skills_demanded.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                          <TrendingUp className="h-3 w-3" /> Top Skills in Demand
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {result.analysis.top_skills_demanded.slice(0, 8).map((item, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded bg-violet-500/5 border border-violet-500/20">
                              <Badge variant="outline" className="bg-violet-500/10 text-violet-300 border-violet-500/30 text-[10px]">
                                {item.skill}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground flex-1">{item.context}</span>
                              <Badge variant="outline" className={`text-[9px] ${
                                item.trend === 'rising' ? 'bg-green-500/10 text-green-400 border-green-500/30'
                                  : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                              }`}>
                                {item.frequency}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Emerging & Declining Skills */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Emerging */}
                      {result.analysis.emerging_skills && result.analysis.emerging_skills.length > 0 && (
                        <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                          <Label className="text-xs flex items-center gap-1 mb-2 text-emerald-400">
                            <ArrowUpRight className="h-3 w-3" /> Emerging Skills
                          </Label>
                          <div className="space-y-2">
                            {result.analysis.emerging_skills.map((s, i) => (
                              <div key={i} className="text-xs">
                                <span className="font-medium text-emerald-400">{s.skill}</span>
                                <span className="text-muted-foreground ml-1">- {s.evidence}</span>
                                <Badge variant="outline" className="ml-2 text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                  {s.growth_potential}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Declining */}
                      {result.analysis.declining_skills && result.analysis.declining_skills.length > 0 && (
                        <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                          <Label className="text-xs flex items-center gap-1 mb-2 text-red-400">
                            <TrendingDown className="h-3 w-3" /> Declining Skills
                          </Label>
                          <div className="space-y-2">
                            {result.analysis.declining_skills.map((s, i) => (
                              <div key={i} className="text-xs">
                                <span className="font-medium text-red-400">{s.skill}</span>
                                <span className="text-muted-foreground ml-1">- {s.evidence}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Role Evolution */}
                    {result.analysis.role_evolution && result.analysis.role_evolution.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                          <RefreshCw className="h-3 w-3" /> Role Evolution
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {result.analysis.role_evolution.map((r, i) => (
                            <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/30 text-xs">
                              <Briefcase className="h-3 w-3 text-violet-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-medium">{r.role}</span>
                                <span className="text-muted-foreground ml-1">- {r.change}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {result.analysis.recommendations && result.analysis.recommendations.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                          <Lightbulb className="h-3 w-3" /> Recommendations
                        </Label>
                        <ul className="space-y-1.5">
                          {result.analysis.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <ChevronRight className="h-3 w-3 mt-0.5 text-violet-400 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Job Listings Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Job Listings</h2>
                  <Badge variant="secondary">{result.jobs_scraped} found</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  Sources: {(result.analysis?.sources || []).join(', ')}
                </div>
              </div>

              {result.scrape_note && (
                <p className="text-xs text-muted-foreground italic">{result.scrape_note}</p>
              )}

              {/* Job Cards Grid */}
              {result.jobs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.jobs.map((job, index) => (
                    <JobCard key={`${job.title}-${job.company}-${index}`} job={job} index={index} />
                  ))}
                </div>
              ) : (
                <Card className="border-border/50">
                  <CardContent className="pt-6 text-center">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">
                      No jobs found for "{result.query}". Try a different search term.
                    </p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!loading && !result && !error && (
          <Card className="border-dashed border-border/50">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="inline-flex p-4 rounded-full bg-violet-500/10 mb-4">
                <Search className="h-8 w-8 text-violet-400" />
              </div>
              <h3 className="text-lg font-medium mb-2">Search for Jobs</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Enter a job title, skill, or technology above to discover real-time job
                postings with AI-powered market insights.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

// Job Card Component
const JobCard = ({ job, index }: { job: ScrapedJob; index: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="border-border/50 hover:border-violet-500/30 transition-colors h-full">
        <CardContent className="pt-5 pb-4 flex flex-col h-full">
          <div className="flex-1">
            {/* Title & Company */}
            <h3 className="font-semibold text-sm line-clamp-2 mb-1.5">{job.title}</h3>
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-2">
              <Building2 className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{job.company}</span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-3">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{job.location || 'Remote / Not specified'}</span>
            </div>

            {/* Tags/Skills */}
            {job.tags && job.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {job.tags.slice(0, 4).map((tag, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 bg-violet-500/5 border-violet-500/20"
                  >
                    {tag}
                  </Badge>
                ))}
                {job.tags.length > 4 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-muted/50">
                    +{job.tags.length - 4}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <Badge variant="outline" className="text-[10px]">
              {job.source}
            </Badge>
            {job.url && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                onClick={() => window.open(job.url, '_blank')}
              >
                View
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default LiveJobScraper;
