import React from 'react';
import { Target } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export const GoalsPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-[var(--accent-info-light)] rounded-full">
            <Target size={40} className="text-[var(--accent-info)]" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Goals</h2>
        <p className="text-[var(--text-secondary)] mb-4">
          Savings targets and financial goal progress tracking. Coming soon.
        </p>
        <span className="inline-block px-3 py-1 bg-[var(--accent-info-light)] text-[var(--accent-info)] text-sm font-medium rounded-full">
          Coming Soon
        </span>
      </Card>
    </div>
  );
};
