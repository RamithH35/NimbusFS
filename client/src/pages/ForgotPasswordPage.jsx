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

        <Card elevated={true} className="flex flex-col text-center p-6">
          <div className="space-y-4 py-2">
            <div className="text-accent-orange text-3xl font-bold select-none">⚠</div>
            <p className="text-sm text-ink-secondary font-semibold">
              Password Reset Disabled
            </p>
            <p className="text-xs text-ink-muted px-4 leading-relaxed">
              Self-service password resets are currently disabled because email infrastructure has not been configured for this environment.
            </p>
            <p className="text-xs text-ink-muted px-4 leading-relaxed">
              Please contact your administrator directly to reset your account password.
            </p>
          </div>

          <div className="mt-6 text-center text-xs text-ink-muted border-t border-hairline pt-4">
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
