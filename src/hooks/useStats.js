import { useState, useCallback } from 'react';
import api from '../utils/api.js';

/**
 * Custom React hook for fetching carbon footprint stats.
 */
export function useStats() {
  const [stats, setStats] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async (userId, period = 'month') => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, compareRes] = await Promise.all([
        api.get('/stats', { params: { userId, period } }),
        api.get('/stats/compare', { params: { userId } })
      ]);
      setStats(statsRes.data);
      setComparison(compareRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stats,
    comparison,
    loading,
    error,
    fetchStats
  };
}
