import React from 'react';
import { useParams, Link } from 'react-router-dom';
import Card from '../components/ui/Card';

export const SharePage = () => {
  const { shareId } = useParams();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-soft px-4 py-12">
      <div className="w-full max-w-md">
        <Card elevated={true} className="text-center space-y-4">
          <div className="text-primary text-3xl font-bold">🔗</div>
          <h2 className="text-lg font-bold text-ink">Shared Download link</h2>
          <span className="text-xs font-mono bg-canvas-soft px-3 py-1.5 rounded-sm border border-hairline inline-block">
            ID: {shareId}
          </span>
          <p className="text-xs text-ink-muted leading-relaxed pt-2">
            Share page coming in Phase C. Access controls, passwords, download tracking, and decryptions will be wired here.
          </p>
          <div className="pt-4 border-t border-hairline mt-4">
            <Link to="/login" className="text-xs text-primary hover:underline font-medium">
              Go to NimbusFS Drive
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SharePage;
