/**
 * API Configuration
 * Automatically switches between local and production backend
 */

export const API_BASE_URL = import.meta.env.PROD 
  ? import.meta.env.VITE_API_URL || 'https://auraskill-api.onrender.com'  // Production backend
  : 'http://localhost:8080';  // Local Vite dev server with API plugin

export const API_ENDPOINTS = {
  // Auth
  auth: {
    firebase: `${API_BASE_URL}/api/auth/firebase`,
    login: `${API_BASE_URL}/api/auth/login`,
    signup: `${API_BASE_URL}/api/auth/signup`,
  },
  
  // Gap Analysis
  analysis: {
    run: `${API_BASE_URL}/api/analysis/run`,
    get: (userId: string) => `${API_BASE_URL}/api/analysis/${userId}`,
    narrative: `${API_BASE_URL}/api/analysis/narrative`,
    skillExplain: `${API_BASE_URL}/api/analysis/skill-explain`,
  },
  
  // Learning Roadmap
  roadmap: {
    generate: `${API_BASE_URL}/api/roadmap/generate`,
    get: (userId: string) => `${API_BASE_URL}/api/roadmap/${userId}`,
  },
  
  // Resumes
  resumes: {
    list: (userId: string) => `${API_BASE_URL}/api/resumes/${userId}`,
  },
  
  // Interviews
  interviews: {
    list: (userId: string) => `${API_BASE_URL}/api/interviews/${userId}`,
  },
  
  // Practice
  practice: {
    aptitude: (userId: string) => `${API_BASE_URL}/api/practice/aptitude/${userId}`,
    coding: (userId: string) => `${API_BASE_URL}/api/practice/coding/${userId}`,
  },
  
  // Career Plans
  careerPlans: {
    list: (userId: string) => `${API_BASE_URL}/api/career-plans/${userId}`,
  },
};

/**
 * Helper function to make authenticated API calls
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Get Firebase auth token
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { auth } = await import('./firebase');
    return await auth.currentUser?.getIdToken(true) || null;
  } catch {
    return null;
  }
}

export default {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: API_ENDPOINTS,
  call: apiCall,
};
