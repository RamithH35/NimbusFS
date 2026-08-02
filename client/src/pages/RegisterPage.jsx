import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState('preview');

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Simple password strength check
  const getPasswordStrength = (pass) => {
    if (!pass) return { label: '', color: 'bg-hairline', width: 'w-0' };
    if (pass.length < 8) return { label: 'Weak', color: 'bg-accent-orange', width: 'w-1/3' };
    const hasNumber = /\d/.test(pass);
    if (hasNumber) return { label: 'Strong', color: 'bg-accent-green', width: 'w-full' };
    return { label: 'Medium', color: 'bg-primary', width: 'w-2/3' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      showToast('All fields are required', 'error');
      return;
    }

    setLoading(true);
    try {
      // 1. Call register
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      showToast('Registration successful! Logging in...', 'success');

      // 2. Auto-login
      const loginRes = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Show real avatar seed
      if (loginRes.user && loginRes.user.avatarSeed) {
        setAvatarSeed(loginRes.user.avatarSeed);
      }

      // Wait a brief moment for the user to see their customized avatar before redirect
      setTimeout(() => {
        login(loginRes.accessToken, loginRes.user);
        navigate('/');
      }, 1500);

    } catch (err) {
      showToast(err.message || 'Registration failed', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-soft px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-ink font-sans">NimbusFS</span>
          <p className="text-sm text-ink-muted mt-1">Create your secure storage account</p>
        </div>

        <Card elevated={true} className="flex flex-col">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 rounded-full border border-hairline bg-canvas-soft overflow-hidden mb-2 flex items-center justify-center">
              <img
                src={`https://api.dicebear.com/9.x/notionists/svg?seed=${avatarSeed}`}
                alt="Avatar Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xs text-ink-muted select-none">
              {avatarSeed === 'preview' ? 'Placeholder profile avatar' : 'Your real profile avatar'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="E.g. Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="name@nimbusfs.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[32px] text-xs font-medium text-ink-muted hover:text-ink select-none cursor-pointer"
                disabled={loading}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div className="text-left -mt-2 mb-4">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-ink-muted">Password Strength:</span>
                  <span className="font-semibold" style={{ color: strength.color === 'bg-accent-green' ? 'var(--color-accent-green)' : strength.color === 'bg-primary' ? 'var(--color-primary)' : 'var(--color-accent-orange)' }}>
                    {strength.label}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-hairline rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`}></div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full mt-4"
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Log in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
