import { useState, useCallback } from 'react';
import api from '../utils/api.js';

/**
 * Custom React hook for tracking challenges state.
 */
export function useChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchChallenges = useCallback(async (userId) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/challenges', { params: { userId } });
      setChallenges(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch challenges');
    } finally {
      setLoading(false);
    }
  }, []);

  const joinChallenge = useCallback(async (userId, challengeInput) => {
    setError(null);
    try {
      const payload = typeof challengeInput === 'string'
        ? { userId, title: challengeInput }
        : { userId, ...challengeInput };
      const res = await api.post('/challenges', payload);
      setChallenges(prev => {
        const title = typeof challengeInput === 'string' ? challengeInput : challengeInput.title;
        const filtered = prev.filter(c => !(c.title === title && c.status === 'active'));
        return [...filtered, res.data];
      });
      return res.data;
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to join challenge';
      setError(errMsg);
      throw new Error(errMsg);
    }
  }, []);

  const updateChallenge = useCallback(async (id, status) => {
    setError(null);
    try {
      await api.put(`/challenges/${id}`, { status });
      setChallenges(prev =>
        prev.map(c => (c.id === id ? { ...c, status } : c))
      );
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to update challenge';
      setError(errMsg);
      throw new Error(errMsg);
    }
  }, []);

  return {
    challenges,
    loading,
    error,
    fetchChallenges,
    joinChallenge,
    updateChallenge
  };
}
