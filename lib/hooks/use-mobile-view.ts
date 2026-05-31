import { useState, useEffect } from 'react';

export function useMobileView() {
  const [viewMode, setViewMode] = useState<'standard' | 'compact'>('standard');

  useEffect(() => {
    const saved = localStorage.getItem('mobile_view_mode');
    if (saved === 'standard' || saved === 'compact') {
      setViewMode(saved);
    }
  }, []);

  const toggleViewMode = () => {
    const nextMode = viewMode === 'standard' ? 'compact' : 'standard';
    setViewMode(nextMode);
    localStorage.setItem('mobile_view_mode', nextMode);
  };

  return { viewMode, toggleViewMode };
}
