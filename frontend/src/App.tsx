import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { Dashboard } from './components/Dashboard';
import { RubricView } from './components/RubricView';
import { AuthModal } from './components/AuthModal';
import { Problems } from './components/Problems';
import { Contests } from './components/Contests';
import { Profile } from './components/Profile';
import { AdminPanel } from './components/AdminPanel';

export const AppContent: React.FC = () => {
  const { isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'problems' | 'contests' | 'profile' | 'auth' | 'rubric' | 'admin'>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/problems')) return 'problems';
    if (path.startsWith('/contests')) return 'contests';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/rubric')) return 'rubric';
    return 'dashboard';
  });
  const [isAuthOpen, setIsAuthOpen] = useState(() => {
    const path = window.location.pathname;
    return path === '/login' || path === '/auth';
  });
  const [authDefaultTab, setAuthDefaultTab] = useState<'login' | 'signup'>('login');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const openAuthModal = (defaultMode: 'login' | 'signup' = 'login') => {
    setAuthDefaultTab(defaultMode);
    setIsAuthOpen(true);
  };

  const handleNavigateToUserProfile = (userId: number) => {
    setSelectedUserId(userId);
    setCurrentTab('profile');
    window.history.pushState(null, '', '/profile');
  };

  const handleNavigateTab = (tab: 'dashboard' | 'problems' | 'contests' | 'profile' | 'auth' | 'rubric' | 'admin') => {
    if (tab !== 'profile') setSelectedUserId(null);
    setCurrentTab(tab);
    const targetUrl = tab === 'admin' ? '/admin/dashboard' : `/${tab}`;
    window.history.pushState(null, '', targetUrl);
  };

  const handleRedirect = (path: string) => {
    window.history.pushState(null, '', path);
    if (path.startsWith('/admin')) {
      setCurrentTab('admin');
    } else if (path.startsWith('/problems')) {
      setCurrentTab('problems');
    } else if (path.startsWith('/contests')) {
      setCurrentTab('contests');
    } else if (path.startsWith('/profile')) {
      setCurrentTab('profile');
    } else if (path.startsWith('/rubric')) {
      setCurrentTab('rubric');
    } else {
      setCurrentTab('dashboard');
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        setCurrentTab('admin');
      } else if (path.startsWith('/problems')) {
        setCurrentTab('problems');
      } else if (path.startsWith('/contests')) {
        setCurrentTab('contests');
      } else if (path.startsWith('/profile')) {
        setCurrentTab('profile');
      } else if (path.startsWith('/rubric')) {
        setCurrentTab('rubric');
      } else if (path.startsWith('/dashboard') || path === '/') {
        setCurrentTab('dashboard');
      }

      if (path === '/login' || path === '/auth') {
        setIsAuthOpen(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="app-layout">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={handleNavigateTab}
        openAuth={() => openAuthModal('login')}
      />

      <main className="main-content">
        {currentTab === 'dashboard' && (
          <Dashboard
            openAuth={openAuthModal}
            onNavigateTab={handleNavigateTab}
          />
        )}
        {currentTab === 'problems' && (
          <Problems openAuth={() => openAuthModal('login')} />
        )}
        {currentTab === 'contests' && (
          <Contests
            openAuth={() => openAuthModal('login')}
            onViewProfile={handleNavigateToUserProfile}
            onNavigateTab={handleNavigateTab}
          />
        )}
        {currentTab === 'profile' && (
          <Profile
            openAuth={() => openAuthModal('login')}
            targetUserId={selectedUserId}
          />
        )}
        {currentTab === 'admin' && isAdmin && (
          <AdminPanel openAuth={() => openAuthModal('login')} />
        )}
        {currentTab === 'rubric' && <RubricView />}
      </main>

      <Footer onNavigateTab={handleNavigateTab} />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        defaultTab={authDefaultTab}
        onNavigate={handleRedirect}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
