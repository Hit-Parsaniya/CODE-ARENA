import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, User as UserIcon, AlertTriangle, ArrowRight, ShieldCheck, Shield, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup';
  initialIntendedRole?: 'admin' | 'user';
  onNavigate?: (path: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'login',
  initialIntendedRole = 'user',
  onNavigate,
}) => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(defaultTab);
  const [intendedRole, setIntendedRole] = useState<'admin' | 'user'>(initialIntendedRole);

  // Form states
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setError('Please provide both username/email and password.');
      return;
    }

    try {
      setLoading(true);
      const res = await login({
        username_or_email: loginIdentifier.trim(),
        password: loginPassword,
        intended_role: intendedRole,
      });

      // Close modal and navigate
      onClose();
      if (onNavigate) {
        onNavigate(res.redirectPath);
      } else {
        window.history.pushState(null, '', res.redirectPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (err: any) {
      // Rejection: e.g. "This account does not have admin access"
      setError(err.message || 'Failed to authenticate. Please check your credentials.');
      // Do not redirect, modal remains open
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupUsername.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setError('All fields are required.');
      return;
    }

    if (signupUsername.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (signupPassword !== signupConfirm) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await signup({
        username: signupUsername.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
      });
      onClose();
      if (onNavigate) {
        onNavigate('/dashboard');
      } else {
        window.history.pushState(null, '', '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try a different username or email.');
    } finally {
      setLoading(false);
    }
  };

  const loadDemoAdmin = () => {
    setLoginIdentifier('admin@codearena.com');
    setLoginPassword('AdminPass123!');
    setIntendedRole('admin');
    setMode('login');
    setError(null);
  };

  const loadDemoRegular = () => {
    setLoginIdentifier('regular@codearena.com');
    setLoginPassword('UserPass123!');
    setMode('login');
    setError(null);
  };

  const loadDemoUserSignup = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setSignupUsername(`coder_${randomSuffix}`);
    setSignupEmail(`competitor_${randomSuffix}@codearena.com`);
    setSignupPassword('pass1234');
    setSignupConfirm('pass1234');
    setMode('signup');
    setError(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card auth-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <X size={20} />
        </button>

        <div className="auth-header">
          <div className={`auth-icon-badge ${intendedRole === 'admin' && mode === 'login' ? 'admin-badge' : ''}`}>
            {mode === 'login' ? (
              intendedRole === 'admin' ? <Shield size={28} /> : <ShieldCheck size={28} />
            ) : (
              <Sparkles size={28} />
            )}
          </div>
          <h2 className="auth-title">
            {mode === 'login'
              ? intendedRole === 'admin'
                ? 'Admin Portal Login'
                : 'Competitor Arena Login'
              : 'Create Competitor Account'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? intendedRole === 'admin'
                ? 'Access administration controls, contest orchestration, and user role management.'
                : 'Access automated AI code reviews, real-time rubric feedback, and contest challenges.'
              : 'Join the next generation competitive programming arena with multi-pillar AI code analysis.'}
          </p>
        </div>

        {mode === 'login' ? (
          <>
            {/* Top Role Toggle Tabs: User Login & Admin Login (default: User) */}
            <div className="role-tabs-wrapper">
              <div className="role-tabs-container" role="tablist" aria-label="Login Role Selection">
                <button
                  type="button"
                  id="tab-user-login"
                  role="tab"
                  aria-selected={intendedRole === 'user'}
                  className={`role-tab-btn ${intendedRole === 'user' ? 'active' : ''}`}
                  onClick={() => {
                    setIntendedRole('user');
                    setError(null);
                  }}
                >
                  <UserIcon size={16} />
                  <span>User Login</span>
                </button>
                <button
                  type="button"
                  id="tab-admin-login"
                  role="tab"
                  aria-selected={intendedRole === 'admin'}
                  className={`role-tab-btn ${intendedRole === 'admin' ? 'active' : ''}`}
                  onClick={() => {
                    setIntendedRole('admin');
                    setError(null);
                  }}
                >
                  <Shield size={16} />
                  <span>Admin Login</span>
                </button>
              </div>
              <div className="role-tab-hint">
                {intendedRole === 'admin' ? (
                  <span className="role-hint-admin">
                    <Shield size={12} /> Intended Mode: <strong>Administrator</strong> (Redirects to /admin/dashboard)
                  </span>
                ) : (
                  <span className="role-hint-user">
                    <UserIcon size={12} /> Intended Mode: <strong>Standard User</strong> (Redirects to /dashboard)
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div id="login-error" className="error-banner inline-error" role="alert">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form id="form-login" onSubmit={handleLoginSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="login-identifier">Username or Email</label>
                <div className="input-with-icon">
                  <UserIcon size={18} className="input-icon" />
                  <input
                    id="login-identifier"
                    name="login-identifier"
                    type="text"
                    placeholder="e.g. regular@codearena.com or admin@codearena.com"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="login-password"
                    name="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                id="btn-submit-login"
                type="submit"
                className={`btn-submit-full ${intendedRole === 'admin' ? 'btn-submit-admin' : ''}`}
                disabled={loading}
              >
                {loading ? 'Authenticating...' : intendedRole === 'admin' ? 'Sign In as Admin' : 'Sign In as User'}
                <ArrowRight size={18} />
              </button>
            </form>

            <div className="auth-switcher">
              <span>New to Code Arena?</span>{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
              >
                Register Competitor Account
              </button>
            </div>
          </>
        ) : (
          <>
            {error && (
              <div id="signup-error" className="error-banner inline-error" role="alert">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            <form id="form-signup" onSubmit={handleSignupSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="signup-username">Username</label>
                <div className="input-with-icon">
                  <UserIcon size={18} className="input-icon" />
                  <input
                    id="signup-username"
                    name="signup-username"
                    type="text"
                    placeholder="alphanumeric, min 3 chars"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-email">Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    id="signup-email"
                    name="signup-email"
                    type="email"
                    placeholder="dev@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-password">Password</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="signup-password"
                    name="signup-password"
                    type="password"
                    placeholder="Min 6 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="signup-confirm">Confirm Password</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    id="signup-confirm"
                    name="signup-confirm"
                    type="password"
                    placeholder="Repeat password"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <button
                id="btn-submit-signup"
                type="submit"
                className="btn-submit-full"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
                <ArrowRight size={18} />
              </button>
            </form>

            <div className="auth-switcher">
              <span>Already registered?</span>{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                Back to Sign In
              </button>
            </div>
          </>
        )}

        <div className="auth-demo-section">
          <div className="auth-demo-title">Test Quick-Fill Credentials</div>
          <div className="auth-demo-buttons">
            <button
              type="button"
              className="btn-demo-pill demo-admin"
              onClick={loadDemoAdmin}
              title="Loads admin credentials into the Admin Login tab"
            >
              <Shield size={13} />
              <span>Admin (test_admin)</span>
            </button>
            <button
              type="button"
              className="btn-demo-pill demo-user"
              onClick={loadDemoRegular}
              title="Loads regular user credentials"
            >
              <UserIcon size={13} />
              <span>User (test_regular)</span>
            </button>
            <button
              type="button"
              className="btn-demo-pill demo-new"
              onClick={loadDemoUserSignup}
              title="Generates random registration data"
            >
              <Sparkles size={13} />
              <span>New Coder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
