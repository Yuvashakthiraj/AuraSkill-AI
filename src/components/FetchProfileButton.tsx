import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  User, 
  CheckCircle, 
  Sparkles,
  Calendar,
  FileText
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProfile, hasUserProfile } from "@/lib/resumeService";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface FetchProfileButtonProps {
  onFetchComplete: (profile: {
    skills?: string[];
    experience?: string[];
    education?: string[];
    name?: string;
    email?: string;
    phone?: string;
    certifications?: string[];
    totalExperienceYears?: number;
  }) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showPreview?: boolean;
}

/**
 * FetchProfileButton - Universal "Auto-Fill from Resume" button
 * 
 * Shows only if user has previously uploaded resume
 * One click fills all skills/data across any feature
 * 
 * Usage:
 * <FetchProfileButton 
 *   onFetchComplete={(profile) => {
 *     setSkills(profile.skills || []);
 *     setName(profile.name || '');
 *   }}
 * />
 */
export const FetchProfileButton = ({
  onFetchComplete,
  variant = "default",
  size = "default",
  className = "",
  showPreview = true,
}: FetchProfileButtonProps) => {
  const { user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [fetching, setFetching] = useState(false);

  if (!user) return null;

  // Only show button if profile exists
  const hasProfile = hasUserProfile(user.id);
  if (!hasProfile) return null;

  const profile = getUserProfile(user.id);
  if (!profile) return null;

  const handleFetch = async () => {
    setFetching(true);
    
    try {
      // Simulate slight delay for UX (makes it feel like fetching)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onFetchComplete({
        skills: profile.skills || [],
        experience: profile.experience || [],
        education: profile.education || [],
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        certifications: profile.certifications,
        totalExperienceYears: profile.totalExperienceYears,
      });
      
      toast.success("Profile data loaded!", {
        description: `${profile.skills?.length || 0} skills and ${profile.experience?.length || 0} experiences loaded`,
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error("Failed to load profile data");
    } finally {
      setFetching(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-3">
      {/* Main Fetch Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleFetch}
          disabled={fetching}
          variant={variant}
          size={size}
          className={`relative overflow-hidden group ${className}`}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20"
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 0.5 }}
          />
          {fetching ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              Loading...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2 group-hover:animate-bounce" />
              Fetch Resume Details
              <Sparkles className="h-3 w-3 ml-2 text-yellow-500" />
            </>
          )}
        </Button>

        {showPreview && (
          <Button
            onClick={() => setShowDetails(!showDetails)}
            variant="ghost"
            size="sm"
          >
            <FileText className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Preview Details (Collapsible) */}
      <AnimatePresence>
        {showDetails && showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-2 border-blue-200 bg-blue-50/50">
              <CardContent className="pt-4 space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-blue-600" />
                  <h4 className="font-semibold text-sm">Your Saved Profile</h4>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(profile.lastUpdated)}
                  </Badge>
                </div>

                {/* Profile Info */}
                <div className="space-y-2 text-sm">
                  {profile.name && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{profile.name}</span>
                    </div>
                  )}
                  
                  {profile.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{profile.email}</span>
                    </div>
                  )}

                  {profile.resumeFileName && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Resume:</span>
                      <span className="font-medium truncate max-w-[200px]">
                        {profile.resumeFileName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {profile.skills && profile.skills.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                      {profile.skills.length} Skills
                    </Badge>
                  )}
                  
                  {profile.experience && profile.experience.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1 text-blue-500" />
                      {profile.experience.length} Experiences
                    </Badge>
                  )}
                  
                  {profile.education && profile.education.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1 text-purple-500" />
                      {profile.education.length} Education
                    </Badge>
                  )}
                </div>

                {/* Preview Skills */}
                {profile.skills && profile.skills.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                    <div className="flex flex-wrap gap-1">
                      {profile.skills.slice(0, 8).map((skill, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {profile.skills.length > 8 && (
                        <Badge variant="secondary" className="text-xs">
                          +{profile.skills.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
