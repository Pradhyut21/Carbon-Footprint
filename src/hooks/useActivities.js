import { useState, useCallback } from 'react';
import api from '../utils/api.js';

/**
 * Custom React hook for activities CRUD operations.
 */
export function useActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchActivities = useCallback(async (userId, days = 30) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/activities', { params: { userId, days } });
      setActivities(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  }, []);

  const logActivity = useCallback(async (userId, activityData) => {
    setError(null);
    try {
      const res = await api.post('/activities', { userId, ...activityData });
      setActivities(prev => [res.data, ...prev]);
      return res.data;
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to log activity';
      setError(errMsg);
      throw new Error(errMsg);
    }
  }, []);

  const deleteActivity = useCallback(async (id) => {
    setError(null);
    let originalActivities = null;
    setActivities(prev => {
      originalActivities = prev;
      return prev.filter(act => act.id !== id);
    });
    try {
      await api.delete(`/activities/${id}`);
    } catch (err) {
      if (originalActivities) {
        setActivities(originalActivities);
      }
      const errMsg = err.response?.data?.error || 'Failed to delete activity';
      setError(errMsg);
      throw new Error(errMsg);
    }
  }, []);

  return {
    activities,
    loading,
    error,
    fetchActivities,
    logActivity,
    deleteActivity
  };
}
