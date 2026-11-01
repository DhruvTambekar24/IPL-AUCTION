import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

import PageLoader from '../components/PageLoader';

const AuthContext = createContext({
  user: null,
  loading: true,
  loginWithGoogle: async () => { },
  loginAsGuest: async () => { },
  logout: async () => { }
});

function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    uid: user.id,
    displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || null,
    photoURL: user.user_metadata?.avatar_url || null,
    isAnonymous: Boolean(user.is_anonymous),
    providerData: user.is_anonymous ? [] : [{}],
  };
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // AuthProvider check failed
  }
  return context || {};
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const hasSeen = sessionStorage.getItem('ipl_has_seen_loader');
      if (hasSeen) return false;
    }
    return true;
  });

  const markLoaderSeen = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ipl_has_seen_loader', 'true');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(normalizeUser(session?.user));
      const isLandingPage = typeof window !== 'undefined' && window.location.pathname === '/';
      if (!isLandingPage) {
        setTimeout(markLoaderSeen, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, [markLoaderSeen]);

  // Listen to manual skip/continue event from PageLoader
  useEffect(() => {
    const handleSkip = () => {
      markLoaderSeen();
    };
    document.addEventListener('skipIntro', handleSkip);
    return () => document.removeEventListener('skipIntro', handleSkip);
  }, [markLoaderSeen]);


  const loginWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    if (error) throw error;
    return data;
  };

  const loginAsGuest = async (displayName) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    const normalizedUser = normalizeUser(data.user);
    setUser(normalizedUser);
    return normalizedUser;
  };

  const logout = async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    loading,
    loginWithGoogle,
    loginAsGuest,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeIn" }}
            className="fixed inset-0 z-[9999]"
          >
            <PageLoader />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
};
