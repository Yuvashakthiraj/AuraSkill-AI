import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ParsedResume } from '@/utils/resumeParser';
import { ResumeData } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getCurrentResume, 
  setCurrentResume, 
  clearCurrentResume,
  hasStoredResume,
  getUserProfile,
  saveUserProfile,
  clearUserProfile,
  hasUserProfile,
  updateProfileFromResume,
  UserProfile,
} from '@/lib/resumeService';

interface ResumeContextType {
  currentResume: ParsedResume | null;
  processedResume: ResumeData | null;
  hasResume: boolean;
  setResume: (resume: ParsedResume, processed?: ResumeData) => void;
  clearResume: () => void;
  loadStoredResume: () => Promise<boolean>;
  // Profile management
  userProfile: UserProfile | null;
  hasProfile: boolean;
  updateProfile: (profileData: Partial<UserProfile>) => void;
  clearProfile: () => void;
  loadProfile: () => void;
}

const ResumeContext = createContext<ResumeContextType | undefined>(undefined);

export const ResumeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentResume, setCurrentResumeState] = useState<ParsedResume | null>(null);
  const [processedResume, setProcessedResumeState] = useState<ResumeData | null>(null);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);

  // Load stored resume and profile on mount
  useEffect(() => {
    if (user) {
      loadStoredResume();
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadStoredResume = async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const stored = getCurrentResume(user.id);
      if (stored) {
        setCurrentResumeState(stored.parsed);
        setProcessedResumeState(stored.processed || null);
        return true;
      }
    } catch (error) {
      console.error('Failed to load stored resume:', error);
    }
    return false;
  };

  const loadProfile = () => {
    if (!user) return;
    
    try {
      const profile = getUserProfile(user.id);
      setUserProfileState(profile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const setResume = (resume: ParsedResume, processed?: ResumeData) => {
    if (!user) return;
    
    setCurrentResumeState(resume);
    if (processed) {
      setProcessedResumeState(processed);
    }
    setCurrentResume(user.id, resume, processed);
    
    // Auto-update profile from resume
    updateProfileFromResume(user.id, resume, processed);
    loadProfile(); // Reload profile state
  };

  const clearResume = () => {
    if (!user) return;
    
    setCurrentResumeState(null);
    setProcessedResumeState(null);
    clearCurrentResume(user.id);
  };

  const updateProfile = (profileData: Partial<UserProfile>) => {
    if (!user) return;
    
    saveUserProfile(user.id, profileData);
    loadProfile();
  };

  const clearProfile = () => {
    if (!user) return;
    
    setUserProfileState(null);
    clearUserProfile(user.id);
  };

  return (
    <ResumeContext.Provider
      value={{
        currentResume,
        processedResume,
        hasResume: !!currentResume,
        setResume,
        clearResume,
        loadStoredResume,
        // Profile management
        userProfile,
        hasProfile: !!userProfile && (userProfile.skills?.length > 0 || userProfile.experience?.length > 0),
        updateProfile,
        clearProfile,
        loadProfile,
      }}
    >
      {children}
    </ResumeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useResume() {
  const context = useContext(ResumeContext);
  if (!context) {
    throw new Error('useResume must be used within ResumeProvider');
  }
  return context;
}
