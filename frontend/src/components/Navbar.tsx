import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Shield, LogOut, RefreshCw, User as UserIcon, Sun, Moon, Menu, X, BookOpen, Trophy, Code2, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  currentTab: 'dashboard' | 'problems' | 'contests' | 'profile' | 'auth' | 'rubric' | 'admin';
  setCurrentTab: (tab: 'dashboard' | 'problems' | 'contests' | 'profile' | 'auth' | 'rubric' | 'admin') => void;
  openAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, openAuth }) => {
  const { user, isAuthenticated, isAdmin, logout, backendStatus, refreshHealth } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (tab: 'dashboard' | 'problems' | 'contests' | 'profile' | 'auth' | 'rubric' | 'admin') => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-left">
          {/* Code Arena SVG Brand */}
          <div
            className="brand"
            onClick={() => handleNavClick('dashboard')}
            role="button"
            tabIndex={0}
            title="Code Arena — Home"
            id="brand-logo-btn"
          >
            <div className="brand-icon-wrapper">
              <svg viewBox="0 0 48 48" width="28" height="28" fill="none" className="brand-svg">
                <defs>
                  <linearGradient id="nbGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <path d="M24 4L40 10V22C40 32.5 33.2 41.5 24 44C14.8 41.5 8 32.5 8 22V10L24 4Z"
                      stroke="url(#nbGrad)" strokeWidth="3" strokeLinejoin="round" fill="rgba(15, 23, 42, 0.75)" />
                <path d="M19 18L13 24L19 30" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M29 18L35 24L29 30" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M26 16L22 32" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-title">
                CODE <span className="brand-highlight">ARENA</span>
              </span>
              <span className="brand-badge">COMPETE & REVIEW</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="nav-links" aria-label="Main Navigation">
            <button
              id="nav-btn-dashboard"
              className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavClick('dashboard')}
            >
              <LayoutDashboard size={15} />
              <span>Dashboard</span>
            </button>
            <button
              id="nav-btn-problems"
              className={`nav-link ${currentTab === 'problems' ? 'active' : ''}`}
              onClick={() => handleNavClick('problems')}
            >
              <Code2 size={15} />
              <span>Problems</span>
            </button>
            <button
              id="nav-btn-contests"
              className={`nav-link ${currentTab === 'contests' ? 'active' : ''}`}
              onClick={() => handleNavClick('contests')}
            >
              <Trophy size={15} />
              <span>Contests</span>
            </button>
            {isAuthenticated && (
              <button
                id="nav-btn-profile"
                className={`nav-link ${currentTab === 'profile' ? 'active' : ''}`}
                onClick={() => handleNavClick('profile')}
              >
                <UserIcon size={15} />
                <span>Profile</span>
              </button>
            )}
            <button
              id="nav-btn-rubric"
              className={`nav-link ${currentTab === 'rubric' ? 'active' : ''}`}
              onClick={() => handleNavClick('rubric')}
            >
              <BookOpen size={15} />
              <span>AI Rubric</span>
            </button>
            {isAdmin && (
              <button
                id="nav-btn-admin"
                className={`nav-link admin-nav-link ${currentTab === 'admin' ? 'active' : ''}`}
                onClick={() => handleNavClick('admin')}
              >
                <Shield size={14} />
                <span>Admin Panel</span>
              </button>
            )}
          </nav>
        </div>

        <div className="navbar-right">
          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            className="btn-theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            id="btn-theme-toggle"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Backend API Health Badge */}
          <div
            className={`health-badge ${backendStatus}`}
            title={`API Backend: ${backendStatus.toUpperCase()} (Click to verify)`}
            onClick={refreshHealth}
            role="button"
            tabIndex={0}
            aria-label={`API Backend: ${backendStatus}`}
          >
            {backendStatus === 'ok' ? (
              <>
                <span className="health-dot online" />
                <span className="health-label">API Online</span>
              </>
            ) : backendStatus === 'checking' ? (
              <>
                <RefreshCw size={12} className="spin" />
                <span className="health-label">Checking...</span>
              </>
            ) : (
              <>
                <span className="health-dot offline" />
                <span className="health-label">API Offline</span>
              </>
            )}
          </div>

          {/* User Auth Info / Dropdown */}
          {isAuthenticated && user ? (
            <div className="user-profile-menu">
              <div
                className={`user-pill ${currentTab === 'profile' ? 'active-pill' : ''}`}
                onClick={() => handleNavClick('profile')}
                role="button"
                tabIndex={0}
                title="View your user profile"
              >
                <div className="avatar-circle">
                  <UserIcon size={14} />
                </div>
                <div className="user-info-text">
                  <span className="user-name">{user.username}</span>
                  <span className="user-id">#{user.id}</span>
                </div>
              </div>
              <button
                id="btn-logout"
                className="btn-icon-danger"
                onClick={logout}
                title="Log out of session"
                aria-label="Log out"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button
                id="btn-nav-login"
                className="btn-primary"
                onClick={openAuth}
              >
                <Shield size={16} />
                <span>Sign In / Register</span>
              </button>
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            className="btn-mobile-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer" role="menu">
          <button
            className={`mobile-nav-link ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavClick('dashboard')}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button
            className={`mobile-nav-link ${currentTab === 'problems' ? 'active' : ''}`}
            onClick={() => handleNavClick('problems')}
          >
            <Code2 size={16} /> Problems
          </button>
          <button
            className={`mobile-nav-link ${currentTab === 'contests' ? 'active' : ''}`}
            onClick={() => handleNavClick('contests')}
          >
            <Trophy size={16} /> Contests
          </button>
          <button
            className={`mobile-nav-link ${currentTab === 'rubric' ? 'active' : ''}`}
            onClick={() => handleNavClick('rubric')}
          >
            <BookOpen size={16} /> AI Rubric
          </button>
          {isAuthenticated && (
            <button
              className={`mobile-nav-link ${currentTab === 'profile' ? 'active' : ''}`}
              onClick={() => handleNavClick('profile')}
            >
              <UserIcon size={16} /> Profile
            </button>
          )}
          {isAdmin && (
            <button
              className={`mobile-nav-link admin-nav-link ${currentTab === 'admin' ? 'active' : ''}`}
              onClick={() => handleNavClick('admin')}
            >
              <Shield size={16} /> Admin Panel
            </button>
          )}
        </div>
      )}
    </header>
  );
};
