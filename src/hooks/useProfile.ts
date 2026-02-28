/**
 * useProfile Hook - Easy access to user profile data
 * 
 * Provides skills, experience, education, and other resume data
 * that's been saved across the app.
 * 
 * Usage:
 * const { profile, hasProfile, fetchProfile } = useProfile();
 */

import { useResume } from '@/contexts/ResumeContext';

export function useProfile() {
  const { 
    userProfile, 
    hasProfile, 
    updateProfile, 
    clearProfile,
    loadProfile 
  } = useResume();

  return {
    profile: userProfile,
    hasProfile,
    skills: userProfile?.skills || [],
    experience: userProfile?.experience || [],
    education: userProfile?.education || [],
    name: userProfile?.name,
    email: userProfile?.email,
    phone: userProfile?.phone,
    certifications: userProfile?.certifications || [],
    totalExperienceYears: userProfile?.totalExperienceYears,
    resumeFileName: userProfile?.resumeFileName,
    lastUpdated: userProfile?.lastUpdated,
    
    // Actions
    updateProfile,
    clearProfile,
    fetchProfile: loadProfile,
  };
}
