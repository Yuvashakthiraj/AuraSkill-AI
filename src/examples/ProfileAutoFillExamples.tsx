/**
 * Integration Examples: How to use FetchProfileButton & Profile System
 * 
 * This file demonstrates various ways to integrate auto-fill functionality
 * across different features that need skills or resume data.
 */

import { useState } from "react";
import { FetchProfileButton } from "@/components/FetchProfileButton";
import { useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

// ============================================================================
// Example 1: Skills Input with Auto-Fill
// Use this in ANY feature that asks for skills (Career Planner, Job Board, etc.)
// ============================================================================

export function SkillsInputWithAutoFill() {
  const [skills, setSkills] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  const handleFetchProfile = (profile: any) => {
    // Auto-fill skills from saved profile
    setSkills(profile.skills || []);
  };

  const addSkill = () => {
    if (inputValue.trim() && !skills.includes(inputValue.trim())) {
      setSkills([...skills, inputValue.trim()]);
      setInputValue("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Your Skills</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Add your skills manually or fetch from your saved resume
        </p>

        {/* Fetch Profile Button - Only shows if profile exists */}
        <FetchProfileButton 
          onFetchComplete={handleFetchProfile}
          showPreview={true}
        />
      </div>

      {/* Manual Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a skill (e.g., React, Python, Leadership)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addSkill()}
        />
        <Button onClick={addSkill}>Add</Button>
      </div>

      {/* Skills Display */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-muted/30">
          {skills.map((skill, i) => (
            <Badge key={i} variant="secondary" className="text-sm">
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                className="ml-2 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {skills.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
          No skills added yet. Add manually or fetch from your profile.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Example 2: Complete Profile Form with Auto-Fill
// Use in features that need full profile (Job Applications, Interview Prep)
// ============================================================================

export function ProfileFormWithAutoFill() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    skills: [] as string[],
    experience: [] as string[],
  });

  const handleFetchProfile = (profile: any) => {
    // Auto-fill entire form from saved profile
    setFormData({
      name: profile.name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      skills: profile.skills || [],
      experience: profile.experience || [],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Your Information</h3>
        
        {/* Auto-Fill Button */}
        <FetchProfileButton
          onFetchComplete={handleFetchProfile}
          variant="outline"
          size="sm"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Name</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter your name"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Email</label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Phone</label>
          <Input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="Enter your phone"
          />
        </div>

        {formData.skills.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-2 block">Skills</label>
            <div className="flex flex-wrap gap-2">
              {formData.skills.map((skill, i) => (
                <Badge key={i} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Example 3: Read-Only Profile Display
// Show saved profile data in dashboard or settings
// ============================================================================

export function ProfileDisplay() {
  const { profile, hasProfile, skills, experience, education } = useProfile();

  if (!hasProfile) {
    return (
      <div className="text-center py-8 border rounded-lg border-dashed">
        <p className="text-muted-foreground">
          No profile data saved yet. Upload your resume in any feature to save your profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6 border rounded-lg">
      <h3 className="text-lg font-semibold">Your Profile</h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {profile?.name && (
          <div>
            <span className="text-muted-foreground">Name:</span>
            <p className="font-medium">{profile.name}</p>
          </div>
        )}

        {profile?.email && (
          <div>
            <span className="text-muted-foreground">Email:</span>
            <p className="font-medium">{profile.email}</p>
          </div>
        )}

        {profile?.phone && (
          <div>
            <span className="text-muted-foreground">Phone:</span>
            <p className="font-medium">{profile.phone}</p>
          </div>
        )}

        {profile?.totalExperienceYears && (
          <div>
            <span className="text-muted-foreground">Experience:</span>
            <p className="font-medium">{profile.totalExperienceYears} years</p>
          </div>
        )}
      </div>

      {skills.length > 0 && (
        <div>
          <span className="text-sm text-muted-foreground">Skills ({skills.length})</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {skills.slice(0, 10).map((skill, i) => (
              <Badge key={i} variant="secondary">
                {skill}
              </Badge>
            ))}
            {skills.length > 10 && (
              <Badge variant="outline">+{skills.length - 10} more</Badge>
            )}
          </div>
        </div>
      )}

      {experience.length > 0 && (
        <div>
          <span className="text-sm text-muted-foreground">Experience</span>
          <ul className="mt-2 space-y-1 text-sm">
            {experience.slice(0, 3).map((exp, i) => (
              <li key={i} className="text-muted-foreground">• {exp}</li>
            ))}
          </ul>
        </div>
      )}

      {education.length > 0 && (
        <div>
          <span className="text-sm text-muted-foreground">Education</span>
          <ul className="mt-2 space-y-1 text-sm">
            {education.slice(0, 3).map((edu, i) => (
              <li key={i} className="text-muted-foreground">• {edu}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Example 4: Conditional Auto-Fill Banner
// Show a banner when profile exists, suggesting to auto-fill
// ============================================================================

export function AutoFillBanner({ onAutoFill }: { onAutoFill: (profile: any) => void }) {
  const { hasProfile, profile } = useProfile();
  const [dismissed, setDismissed] = useState(false);

  if (!hasProfile || dismissed) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">
            💡 Save time! We found your saved profile.
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Last updated: {profile?.resumeFileName || 'Recently'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <FetchProfileButton
            onFetchComplete={(data) => {
              onAutoFill(data);
              setDismissed(true);
            }}
            variant="default"
            size="sm"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 5: Smart Skills Textarea with Auto-Fill
// For features using textarea for skills (comma-separated)
// ============================================================================

export function SkillsTextareaWithAutoFill() {
  const [skillsText, setSkillsText] = useState("");

  const handleFetchProfile = (profile: any) => {
    const skillsString = (profile.skills || []).join(", ");
    setSkillsText(skillsString);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium">
          Skills (comma-separated)
        </label>
        <FetchProfileButton
          onFetchComplete={handleFetchProfile}
          variant="ghost"
          size="sm"
        />
      </div>

      <textarea
        className="w-full min-h-[100px] p-3 border rounded-lg"
        value={skillsText}
        onChange={(e) => setSkillsText(e.target.value)}
        placeholder="Enter skills separated by commas (e.g., React, Python, Leadership)"
      />

      <p className="text-xs text-muted-foreground">
        {skillsText.split(',').filter(s => s.trim()).length} skills entered
      </p>
    </div>
  );
}

// ============================================================================
// Export all examples
// ============================================================================

export {
  SkillsInputWithAutoFill,
  ProfileFormWithAutoFill,
  ProfileDisplay,
  AutoFillBanner,
  SkillsTextareaWithAutoFill,
};
