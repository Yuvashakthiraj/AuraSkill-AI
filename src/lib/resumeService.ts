/**
 * Resume Service - Centralized resume management with caching
 * Provides "Upload Once, Use Everywhere" functionality
 */

import { resumesApi } from './api';
import { ParsedResume } from '@/utils/resumeParser';
import { ResumeData } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorage Keys
// ─────────────────────────────────────────────────────────────────────────────
const CURRENT_RESUME_KEY = 'vidyamitra_current_resume';
const RESUME_CACHE_KEY = 'vidyamitra_resume_cache';
const USER_PROFILE_KEY = 'vidyamitra_user_profile';

// ─────────────────────────────────────────────────────────────────────────────
// Cached Resume Storage (Upload Once, Use Everywhere)
// ─────────────────────────────────────────────────────────────────────────────

interface StoredResume {
  parsed: ParsedResume;
  processed?: ResumeData;
  timestamp: string;
  userId: string;
}

/**
 * Store the current resume in localStorage for quick access across features
 */
export const setCurrentResume = (
  userId: string,
  parsed: ParsedResume,
  processed?: ResumeData
): void => {
  try {
    const stored: StoredResume = {
      parsed,
      processed,
      timestamp: new Date().toISOString(),
      userId,
    };
    localStorage.setItem(`${CURRENT_RESUME_KEY}_${userId}`, JSON.stringify(stored));
    console.log('✅ Current resume cached in localStorage');
  } catch (error) {
    console.error('Failed to cache resume:', error);
  }
};

/**
 * Retrieve the current resume from localStorage
 */
export const getCurrentResume = (userId: string): StoredResume | null => {
  try {
    const data = localStorage.getItem(`${CURRENT_RESUME_KEY}_${userId}`);
    if (!data) return null;
    
    const stored: StoredResume = JSON.parse(data);
    // Check if resume is less than 7 days old
    const age = Date.now() - new Date(stored.timestamp).getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    if (age > maxAge) {
      clearCurrentResume(userId);
      return null;
    }
    
    return stored;
  } catch (error) {
    console.error('Failed to retrieve cached resume:', error);
    return null;
  }
};

/**
 * Clear the current resume cache
 */
export const clearCurrentResume = (userId: string): void => {
  try {
    localStorage.removeItem(`${CURRENT_RESUME_KEY}_${userId}`);
    console.log('🗑️ Current resume cache cleared');
  } catch (error) {
    console.error('Failed to clear resume cache:', error);
  }
};

/**
 * Check if user has a stored resume
 */
export const hasStoredResume = (userId: string): boolean => {
  return getCurrentResume(userId) !== null;
};

// ─────────────────────────────────────────────────────────────────────────────
// User Profile Management (Auto-Fill Skills & Data Everywhere)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
  name?: string;
  email?: string;
  phone?: string;
  skills: string[];
  experience: string[];
  education: string[];
  certifications?: string[];
  totalExperienceYears?: number;
  resumeFileName?: string;
  lastUpdated: string;
  userId: string;
}

/**
 * Save user profile data extracted from resume
 * This enables "Fetch Resume Details" button across all features
 */
export const saveUserProfile = (userId: string, profileData: Partial<UserProfile>): void => {
  try {
    const existing = getUserProfile(userId);
    const updated: UserProfile = {
      ...existing,
      ...profileData,
      userId,
      lastUpdated: new Date().toISOString(),
    };
    
    localStorage.setItem(`${USER_PROFILE_KEY}_${userId}`, JSON.stringify(updated));
    console.log('✅ User profile saved:', {
      skills: updated.skills?.length || 0,
      experience: updated.experience?.length || 0,
      education: updated.education?.length || 0,
    });
  } catch (error) {
    console.error('Failed to save user profile:', error);
  }
};

/**
 * Get user profile data
 * Returns null if no profile exists (first time user)
 */
export const getUserProfile = (userId: string): UserProfile | null => {
  try {
    const data = localStorage.getItem(`${USER_PROFILE_KEY}_${userId}`);
    if (!data) return null;
    
    const profile: UserProfile = JSON.parse(data);
    return profile;
  } catch (error) {
    console.error('Failed to retrieve user profile:', error);
    return null;
  }
};

/**
 * Check if user has a saved profile
 * Used to show/hide "Fetch Resume Details" button
 */
export const hasUserProfile = (userId: string): boolean => {
  const profile = getUserProfile(userId);
  return profile !== null && (profile.skills?.length > 0 || profile.experience?.length > 0);
};

/**
 * Clear user profile data
 */
export const clearUserProfile = (userId: string): void => {
  try {
    localStorage.removeItem(`${USER_PROFILE_KEY}_${userId}`);
    console.log('🗑️ User profile cleared');
  } catch (error) {
    console.error('Failed to clear user profile:', error);
  }
};

/**
 * Update profile when resume is uploaded
 * Automatically called from ResumeUpload component
 */
export const updateProfileFromResume = (
  userId: string,
  parsedResume: ParsedResume,
  processedResume?: ResumeData
): void => {
  const profileData: Partial<UserProfile> = {
    name: parsedResume.extractedData?.name || processedResume?.parsedData?.name,
    email: parsedResume.extractedData?.email || processedResume?.parsedData?.email,
    phone: parsedResume.extractedData?.phone || processedResume?.parsedData?.phone,
    skills: [
      ...(parsedResume.extractedData?.skills || []),
      ...(processedResume?.parsedData?.skills || []),
    ].filter((skill, index, self) => self.indexOf(skill) === index), // Remove duplicates
    experience: parsedResume.extractedData?.experience || processedResume?.parsedData?.experience || [],
    education: parsedResume.extractedData?.education || processedResume?.parsedData?.education || [],
    certifications: processedResume?.parsedData?.certifications || [],
    totalExperienceYears: processedResume?.parsedData?.totalExperienceYears,
    resumeFileName: parsedResume.fileName,
  };
  
  saveUserProfile(userId, profileData);
};


// ─────────────────────────────────────────────────────────────────────────────
// Firebase / Backend Storage
// ─────────────────────────────────────────────────────────────────────────────


export const saveResumeToFirestore = async (
  userId: string,
  resume: ParsedResume
): Promise<{ success: boolean; resumeId: string }> => {
  try {
    const data = await resumesApi.save({
      fileName: resume.fileName,
      rawText: resume.rawText,
      parsedData: resume.extractedData,
      atsScore: 0,
      targetRole: '',
    });
    return { success: true, resumeId: data.id || '' };
  } catch (error) {
    console.error('Error saving resume:', error);
    return { success: false, resumeId: '' };
  }
};

export const getUserResumes = async (userId: string): Promise<ParsedResume[]> => {
  try {
    const data = await resumesApi.getAll();
    return (data.resumes || []).map((r: any) => ({
      fileName: r.file_name || r.fileName,
      rawText: r.raw_text || r.rawText || '',
      extractedData: typeof r.parsed_data === 'string' ? JSON.parse(r.parsed_data) : (r.parsed_data || r.parsedData || {}),
    }));
  } catch {
    return [];
  }
};

export const processResumeForInterview = async (
  file: File,
  userId: string
): Promise<{ success: boolean; resume?: ParsedResume; error?: string }> => {
  try {
    const { parseResumeFile } = await import('@/utils/resumeParser');
    const parsedResume = await parseResumeFile(file);

    const { success } = await saveResumeToFirestore(userId, parsedResume);
    if (!success) {
      return { success: false, error: 'Failed to save resume to database' };
    }
    return { success: true, resume: parsedResume };
  } catch (error) {
    console.error('Error processing resume:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process resume',
    };
  }
};
