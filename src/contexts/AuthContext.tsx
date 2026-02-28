import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, AuthContextType } from '@/types/auth';
import { useToast } from '@/components/ui/use-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { firebaseAuthService, firestoreService } from '@/lib/firebaseService';

const ADMIN_EMAILS = ['admin@auraskills.com', 'admin@vidyamitra.com'];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get user data from Firestore
          const userData = await firestoreService.getDocument('users', firebaseUser.uid);
          
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: userData?.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            isAdmin: userData?.isAdmin || ADMIN_EMAILS.includes(firebaseUser.email || ''),
          });

          // Store token in localStorage for API calls
          const idToken = await firebaseUser.getIdToken();
          localStorage.setItem('vidyamitra_token', idToken);
          
        } catch (error) {
          console.error('Error loading user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
        localStorage.removeItem('vidyamitra_token');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<User> => {
    try {
      // Sign in with Firebase
      const userCredential = await firebaseAuthService.signin(credentials.email, credentials.password);
      
      // Get user data from Firestore
      const userData = await firestoreService.getDocument('users', userCredential.user.uid);
      
      const appUser: User = {
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        isAdmin: userData?.isAdmin || ADMIN_EMAILS.includes(userCredential.user.email || ''),
        name: userData?.name || userCredential.user.displayName || userCredential.user.email?.split('@')[0] || 'User',
      };

      // User state will be updated by onAuthStateChanged listener
      
      toast({
        title: appUser.isAdmin ? 'Welcome, Admin!' : 'Welcome!',
        description: appUser.isAdmin
          ? 'You have successfully logged in as an administrator.'
          : 'You have successfully logged in.',
      });

      return appUser;
    } catch (error: unknown) {
      console.error('Login error:', error);
      const message = error instanceof Error ? error.message : 'Invalid email or password. Please try again.';
      throw new Error(message);
    }
  };

  const signup = async (credentials: LoginCredentials): Promise<User> => {
    try {
      if (ADMIN_EMAILS.includes(credentials.email)) {
        throw new Error('This email is reserved for admin access. Please use a different email.');
      }

      // Create user with Firebase
      const userCredential = await firebaseAuthService.signup(
        credentials.email,
        credentials.password,
        credentials.email.split('@')[0]
      );

      const appUser: User = {
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        isAdmin: false,
        name: userCredential.user.displayName || credentials.email.split('@')[0],
      };

      // User state will be updated by onAuthStateChanged listener

      toast({
        title: 'Account created!',
        description: 'You have successfully signed up and logged in.',
      });

      return appUser;
    } catch (error: unknown) {
      console.error('Signup error:', error);
      const message = error instanceof Error ? error.message : 'Failed to create account. Please try again.';
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await firebaseAuthService.signout();
      // User state will be updated by onAuthStateChanged listener
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out.',
      });
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      localStorage.removeItem('vidyamitra_token');
      toast({
        title: 'Logged out',
        description: 'You have been logged out.',
      });
    }
  };

  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAdmin: user?.isAdmin || false,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
