/**
 * Example: How to integrate ResumeSelector in your feature
 * 
 * This file shows a before/after comparison of updating a feature
 * to use the centralized resume management system.
 */

// ============================================================================
// BEFORE: Using ResumeUpload directly
// ============================================================================

import { useState } from "react";
import { ResumeUpload } from "@/components/ResumeUpload";
import { ResumeData } from "@/types";

function MyFeatureBefore() {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const roleId = "software-engineer";

  const handleResumeProcessed = (resume: ResumeData) => {
    setResumeData(resume);
    // Process resume...
  };

  return (
    <div>
      <h1>My Feature</h1>
      
      {/* User has to upload resume every time they visit */}
      <ResumeUpload
        roleId={roleId}
        onResumeProcessed={handleResumeProcessed}
        minimumScore={60}
      />

      {resumeData && (
        <div>
          <h2>Resume Uploaded!</h2>
          <p>Score: {resumeData.atsScore}%</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AFTER: Using ResumeSelector with cached resume
// ============================================================================

import { useState, useEffect } from "react";
import { ResumeSelector } from "@/components/ResumeSelector";
import { useResume } from "@/contexts/ResumeContext";
import { ResumeData } from "@/types";
import { Button } from "@/components/ui/button";
import { CheckCircle, Upload } from "lucide-react";

function MyFeatureAfter() {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const { currentResume, processedResume, hasResume, clearResume } = useResume();
  const roleId = "software-engineer";

  // Auto-load cached resume on mount
  useEffect(() => {
    if (processedResume && hasResume) {
      setResumeData(processedResume);
    }
  }, [processedResume, hasResume]);

  const handleResumeProcessed = (resume: ResumeData) => {
    setResumeData(resume);
    // Process resume...
  };

  const handleClearAndReupload = () => {
    clearResume();
    setResumeData(null);
  };

  return (
    <div>
      <h1>My Feature</h1>
      
      {/* Smart component that shows "Use previous" option if resume exists */}
      <ResumeSelector
        roleId={roleId}
        onResumeProcessed={handleResumeProcessed}
        minimumScore={60}
        title="Resume Upload"
        description="Upload your resume or use a previously uploaded one"
      />

      {resumeData && (
        <div className="mt-6 p-4 border rounded-lg bg-green-50">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold">Resume Loaded!</h2>
          </div>
          
          <div className="space-y-2 text-sm">
            <p><strong>File:</strong> {currentResume?.fileName}</p>
            <p><strong>Score:</strong> {resumeData.atsScore}%</p>
            <p><strong>Skills:</strong> {resumeData.parsedData.skills.length}</p>
          </div>

          <Button 
            onClick={handleClearAndReupload}
            variant="outline"
            size="sm"
            className="mt-4"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Different Resume
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Advanced: Conditional rendering based on cached resume
// ============================================================================

function AdvancedFeature() {
  const { hasResume, currentResume, clearResume } = useResume();
  const [mode, setMode] = useState<'select' | 'proceed'>('select');

  // If user has cached resume, show quick action buttons
  if (hasResume && mode === 'select') {
    return (
      <div className="space-y-6">
        <div className="p-6 border rounded-lg bg-blue-50">
          <h3 className="text-lg font-semibold mb-2">
            Welcome back! We found your resume.
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Last uploaded: {currentResume?.fileName}
          </p>
          
          <div className="flex gap-3">
            <Button 
              onClick={() => setMode('proceed')}
              className="flex-1"
            >
              Continue with this resume
            </Button>
            <Button 
              onClick={clearResume}
              variant="outline"
            >
              Upload new resume
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Standard flow
  return (
    <ResumeSelector
      roleId="software-engineer"
      onResumeProcessed={(resume) => {
        console.log('Resume ready:', resume);
        setMode('proceed');
      }}
    />
  );
}

// ============================================================================
// Read-only: Just display cached resume info
// ============================================================================

function DisplayCachedResume() {
  const { currentResume, processedResume, hasResume } = useResume();

  if (!hasResume) {
    return <p>No resume uploaded yet.</p>;
  }

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">Your Resume</h3>
      <div className="space-y-1 text-sm">
        <p><strong>Name:</strong> {currentResume.extractedData.name || 'N/A'}</p>
        <p><strong>Email:</strong> {currentResume.extractedData.email || 'N/A'}</p>
        <p><strong>Skills:</strong> {currentResume.extractedData.skills.length}</p>
        {processedResume && (
          <p><strong>ATS Score:</strong> {processedResume.atsScore}%</p>
        )}
      </div>
    </div>
  );
}

export {
  MyFeatureBefore,
  MyFeatureAfter,
  AdvancedFeature,
  DisplayCachedResume
};
