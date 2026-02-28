import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  Clock, 
  Trash2,
  ChevronRight,
  Info
} from "lucide-react";
import { ResumeUpload } from "@/components/ResumeUpload";
import { useResume } from "@/contexts/ResumeContext";
import { useAuth } from "@/contexts/AuthContext";
import { ResumeData } from "@/types";
import { motion } from "framer-motion";

interface ResumeSelectorProps {
  roleId?: string;
  onResumeProcessed?: (resume: ResumeData) => void;
  minimumScore?: number;
  showBestMatch?: boolean;
  title?: string;
  description?: string;
}

export const ResumeSelector = ({ 
  roleId, 
  onResumeProcessed, 
  minimumScore = 60,
  showBestMatch = false,
  title = "Resume Upload",
  description = "Upload your resume or use a previously uploaded one"
}: ResumeSelectorProps) => {
  const { user } = useAuth();
  const { currentResume, processedResume, hasResume, clearResume, loadStoredResume } = useResume();
  const [mode, setMode] = useState<'select' | 'upload' | 'using-previous'>('select');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkResume = async () => {
      if (user) {
        await loadStoredResume();
      }
      setLoading(false);
    };
    checkResume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleUsePrevious = () => {
    setMode('using-previous');
    if (processedResume) {
      onResumeProcessed?.(processedResume);
    }
  };

  const handleUploadNew = () => {
    setMode('upload');
  };

  const handleResumeProcessed = (resume: ResumeData) => {
    onResumeProcessed?.(resume);
  };

  const handleClearResume = () => {
    clearResume();
    setMode('select');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  // Selection Mode - Choose between previous resume or upload new
  if (mode === 'select' && hasResume) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You have a previously uploaded resume. You can use it to save time, or upload a new one.
            </AlertDescription>
          </Alert>

          {/* Previous Resume Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{currentResume?.fileName}</h3>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDate(currentResume?.uploadDate || '')}
                  </Badge>
                </div>
                
                {currentResume?.fileSize && (
                  <p className="text-sm text-muted-foreground mb-2">
                    Size: {formatFileSize(currentResume.fileSize)}
                  </p>
                )}

                {currentResume?.extractedData && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {currentResume.extractedData.name && (
                      <Badge variant="secondary" className="text-xs">
                        {currentResume.extractedData.name}
                      </Badge>
                    )}
                    {currentResume.extractedData.email && (
                      <Badge variant="secondary" className="text-xs">
                        {currentResume.extractedData.email}
                      </Badge>
                    )}
                    {currentResume.extractedData.skills?.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {currentResume.extractedData.skills.length} skills
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearResume}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleUsePrevious}
                className="flex-1"
                size="lg"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Use This Resume
              </Button>
            </div>
          </motion.div>

          {/* Upload New Option */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            onClick={handleUploadNew}
            variant="outline"
            size="lg"
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload New Resume
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Using Previous Resume Mode
  if (mode === 'using-previous' && hasResume) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          </motion.div>
          <h3 className="text-xl font-semibold mb-2">Resume Loaded Successfully!</h3>
          <p className="text-muted-foreground mb-4">
            Using: {currentResume?.fileName}
          </p>
          <Button
            onClick={() => setMode('select')}
            variant="outline"
          >
            Change Resume
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Upload Mode - Show standard upload component
  return (
    <div className="space-y-4">
      {hasResume && (
        <Button
          onClick={() => setMode('select')}
          variant="ghost"
          size="sm"
        >
          <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
          Back to Selection
        </Button>
      )}
      <ResumeUpload
        roleId={roleId}
        onResumeProcessed={handleResumeProcessed}
        minimumScore={minimumScore}
        showBestMatch={showBestMatch}
      />
    </div>
  );
};
