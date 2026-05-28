'use client';

import { useState } from 'react';
import { Wand2, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface AutoAssignButtonProps {
  weekStart: Date;
}

interface AssignmentResult {
  success: boolean;
  message?: string;
  error?: string;
  assignmentsCreated: number;
  violations: Array<{ type: string; message: string }>;
}

export function AutoAssignButton({ weekStart }: AutoAssignButtonProps) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [result, setResult] = useState<AssignmentResult | null>(null);

  const handleAutoAssign = async () => {
    if (!confirm('This will auto-assign staff to all unlocked exam sessions for this week. Continue?')) {
      return;
    }

    setIsAssigning(true);
    setResult(null);

    try {
      const response = await fetch('/api/assignments/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: weekStart.toISOString() }),
      });

      const data: AssignmentResult = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Auto-assignment failed');
      }

      setResult(data);

      // Show result and reload after delay
      if (data.assignmentsCreated > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Auto-assignment error:', error);
      setResult({
        success: false,
        error: error.message || 'Failed to auto-assign',
        assignmentsCreated: 0,
        violations: [],
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {result && (
        <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-amber-600'}`}>
          {result.success ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span>
            {result.error || result.message || `${result.assignmentsCreated} assignments created`}
          </span>
        </div>
      )}
      <button
        onClick={handleAutoAssign}
        disabled={isAssigning}
        className="btn btn-primary px-4 py-2"
      >
        {isAssigning ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Assigning...
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4 mr-2" />
            Auto-Assign Week
          </>
        )}
      </button>
    </div>
  );
}

