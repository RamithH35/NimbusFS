import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      showToast('Please enter your email address', 'error');
      return;
    }

    setLoading(true);
    try {
      // POST to forgot-password
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      // If success, just set submitted true
      setSubmitted(true);
    } catch (err) {
      // Even if endpoint returns 404 or fails, do not leak user existence.
      // Simply show success screen.
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-soft px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-ink font-sans">NimbusFS</span>
          <p className="text-sm text-ink-muted mt-1">Reset your account password</p>
        </div>

        <Card elevated={true} className="flex flex-col text-center">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-ink-secondary text-left mb-2">
                Enter your email address below and we'll send you a password reset link if your account exists.
              </p>
              <Input
                label="Email Address"
                type="email"
                placeholder="name@nimbusfs.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="w-full mt-2"
              >
                Send Reset Link
              </Button>
            </form>
          ) : (
            <div className="space-y-4 py-4">
              <div className="text-accent-green text-3xl font-bold select-none">✓</div>
              <p className="text-sm text-ink-secondary font-medium">
                Check your inbox
              </p>
              <p className="text-xs text-ink-muted px-4">
                If that email exists, we have sent a link to reset your password. Please check your spam folder if you do not receive it in a few minutes.
              </p>
            </div>
          )}

          <div className="mt-6 text-center text-xs text-ink-muted">
            <Link to="/login" className="text-primary hover:underline font-medium">
              Back to login
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
