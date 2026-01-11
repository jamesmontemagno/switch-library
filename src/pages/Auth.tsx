import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSEO } from '../hooks/useSEO';
import './Auth.css';

type AuthMode = 'signin' | 'signup' | 'reset';

// Password validation helper function
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit';
  }
  if (!/[!@#$%^&*()_+\-=[\]{}';:"\\|,.<>/?]/.test(password)) {
    return 'Password must contain at least one symbol';
  }
  return null;
}

export function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // Dynamic page title based on auth mode
  useSEO({
    title: mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Reset Password',
    description: mode === 'signin' 
      ? 'Sign in to your Nintendo Switch Library account'
      : mode === 'signup'
      ? 'Create a free account to track your Nintendo Switch games'
      : 'Reset your account password',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, loginWithEmail, signUpWithEmail, resetPassword, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If user is already authenticated, redirect to library
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/library');
    }
  }, [isAuthenticated, navigate]);

  // Check if this is a password reset callback
  useEffect(() => {
    const isReset = searchParams.get('reset') === 'true';
    if (isReset && mode !== 'reset') {
      setMode('reset');
    }
  }, [searchParams, mode]);

  const handleGitHubLogin = () => {
    setError(null);
    login();
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'reset') {
        // Handle password reset
        if (!email) {
          setError('Please enter your email address');
          return;
        }

        setIsLoading(true);
        const { error: resetError } = await resetPassword(email);
        if (resetError) {
          setError(resetError.message || 'Failed to send reset email');
        } else {
          setSuccess('Password reset email sent! Check your inbox.');
          setEmail('');
        }
      } else if (mode === 'signup') {
        // Handle sign up
        if (!email || !password || !confirmPassword) {
          setError('Please fill in all fields');
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        // Validate password requirements
        const passwordError = validatePassword(password);
        if (passwordError) {
          setError(passwordError);
          return;
        }

        setIsLoading(true);
        const { error: signupError, needsConfirmation } = await signUpWithEmail(email, password, displayName);
        if (signupError) {
          setError(signupError.message || 'Failed to create account');
        } else if (needsConfirmation) {
          // Email confirmation is required
          setSuccess(
            'Account created successfully! ' +
            'Please check your email inbox (and spam folder) for a confirmation email. ' +
            'The email will be from "Supabase Auth <noreply@mail.app.supabase.io>" with the subject "Confirm your signup". ' +
            'You\'ll need to confirm your email address before you can sign in.'
          );
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setDisplayName('');
          // Switch to sign in mode after showing the message
          setTimeout(() => {
            setMode('signin');
          }, 8000);
        } else {
          // On successful signup without confirmation, user is already authenticated
          // Navigate to library immediately
          navigate('/library');
        }
      } else {
        // Handle sign in
        if (!email || !password) {
          setError('Please enter your email and password');
          return;
        }

        setIsLoading(true);
        const { error: loginError } = await loginWithEmail(email, password);
        if (loginError) {
          // Check if error is related to email confirmation
          const errorMsg = loginError.message || 'Invalid email or password';
          if (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes('confirm')) {
            setError('Please confirm your email address before signing in. Check your inbox for the confirmation link.');
          } else {
            setError(errorMsg);
          }
        } else {
          navigate('/library');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Auth error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">Welcome to My Switch Library</h1>
          <p className="auth-subtitle">
            Track your Nintendo Switch collection
          </p>
        </div>

        <div className="auth-card">
          {/* Mode Toggle */}
          {mode !== 'reset' && (
            <div className="auth-toggle">
              <button
                type="button"
                className={`auth-toggle-btn ${mode === 'signin' ? 'active' : ''}`}
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccess(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-toggle-btn ${mode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccess(null);
                }}
              >
                Sign Up
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="auth-mode-header">
              <h2>Reset Password</h2>
              <p>Enter your email to receive a password reset link</p>
            </div>
          )}

          {/* GitHub Login */}
          {mode !== 'reset' && (
            <>
              <button
                type="button"
                className="auth-github-btn"
                onClick={handleGitHubLogin}
              >
                <GitHubIcon />
                Continue with GitHub
              </button>

              <div className="auth-divider">
                <span>or</span>
              </div>
            </>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSubmit} className="auth-form">
            {error && (
              <div className="auth-message error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="auth-message success" role="status">
                {success}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isLoading}
              />
            </div>

            {mode === 'signup' && (
              <div className="form-group">
                <label htmlFor="displayName" className="form-label">
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  className="form-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How you want to be known"
                  maxLength={50}
                  disabled={isLoading}
                />
                <small style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Optional - defaults to your email username if not provided
                </small>
              </div>
            )}

            {mode !== 'reset' && (
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div className="auth-info-box" style={{
                padding: '0.75rem',
                backgroundColor: 'var(--surface-alt, rgba(59, 130, 246, 0.1))',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                color: 'var(--text-secondary, #6b7280)',
                marginBottom: '1rem',
              }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                  📧 Email Confirmation Required
                </strong>
                After signing up, you'll receive a confirmation email from <strong>Supabase Auth &lt;noreply@mail.app.supabase.io&gt;</strong> with the subject <strong>"Confirm your signup"</strong>. Please check your spam folder if you don't see it.
              </div>
            )}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Loading...</span>
              ) : mode === 'reset' ? (
                'Send Reset Link'
              ) : mode === 'signup' ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="auth-footer">
            {mode === 'signin' && (
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setMode('reset');
                  setError(null);
                  setSuccess(null);
                }}
              >
                Forgot password?
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccess(null);
                }}
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      className="github-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}
