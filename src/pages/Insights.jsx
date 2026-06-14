import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Cpu, Clock, AlertCircle } from 'lucide-react';

/**
 * AI Insights View.
 * @param {Object} props
 * @param {Object} props.user
 */
export default function Insights({ user }) {
  const [insightText, setInsightText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cacheTime, setCacheTime] = useState(null);
  const [timeAgoText, setTimeAgoText] = useState('');
  const abortControllerRef = useRef(null);

  // Load cached insight on mount or user switch
  useEffect(() => {
    if (!user?.id) return;
    
    const cacheKey = `carbonlens_insight_${user.id}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const { text, timestamp } = JSON.parse(cachedData);
        setInsightText(text);
        setCacheTime(timestamp);
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    } else {
      setInsightText('');
      setCacheTime(null);
    }
    setError('');
  }, [user]);

  // Update "minutes ago" calculation
  useEffect(() => {
    if (!cacheTime) {
      setTimeAgoText('');
      return;
    }

    const calcTimeAgo = () => {
      const diffMs = Date.now() - cacheTime;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) {
        setTimeAgoText('Just generated');
      } else if (diffMins === 1) {
        setTimeAgoText('Last generated 1 minute ago');
      } else {
        setTimeAgoText(`Last generated ${diffMins} minutes ago`);
      }
    };

    calcTimeAgo();
    const interval = setInterval(calcTimeAgo, 30000); // update every 30s
    return () => clearInterval(interval);
  }, [cacheTime]);

  const generateInsights = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError('');
    setInsightText('');
    setCacheTime(null);

    // Setup AbortController for request cancellation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      let apiBaseUrl = import.meta.env.VITE_API_URL || '';
      if (apiBaseUrl.endsWith('/api')) {
        apiBaseUrl = apiBaseUrl.slice(0, -4);
      }
      const response = await fetch(`${apiBaseUrl}/api/insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.id }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No readable response stream found.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulatedText += parsed.text;
                // Instant update mimicking streaming typewriter
                setInsightText(accumulatedText);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (err) {
              // Ignore single malformed line parses unless it's a stream error
              if (err.message.includes('Rate limit')) {
                throw err;
              }
            }
          }
        }
      }

      // Finish streaming, write cache
      const finalTimestamp = Date.now();
      setCacheTime(finalTimestamp);
      localStorage.setItem(`carbonlens_insight_${user.id}`, JSON.stringify({
        text: accumulatedText,
        timestamp: finalTimestamp
      }));

    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'An error occurred during streaming.');
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">AI Footprint Coach</h2>
          <p className="text-sm text-textMuted mt-1">
            Receive personalized insights and reduction challenges curated by Claude.
          </p>
        </div>
        <button
          id="btn-generate-insights"
          onClick={generateInsights}
          disabled={loading}
          className="bg-[#22c55e] hover:bg-[#1db053] disabled:opacity-50 text-[#0a0f0a] px-5 py-3 rounded-lg text-sm font-bold tracking-wide transition shadow-lg shadow-[#22c55e]/15 flex items-center space-x-2 shrink-0 self-stretch md:self-auto justify-center"
        >
          <Sparkles size={16} />
          <span>{loading ? 'Analyzing...' : 'Generate Insights'}</span>
        </button>
      </div>

      {/* Powered by Claude Badge & Cache status */}
      <div className="flex flex-wrap items-center justify-between text-xs text-textMuted bg-[#111811] border border-[#1e2e1e] px-4 py-2.5 rounded-xl">
        <div className="flex items-center space-x-2">
          <Cpu size={14} className="text-[#22c55e]" />
          <span className="font-semibold text-white px-2 py-0.5 bg-[#0a0f0a] border border-[#1e2e1e] rounded-md text-[10px]">
            Powered by Claude
          </span>
        </div>
        {timeAgoText && (
          <div className="flex items-center space-x-1.5 mt-1 sm:mt-0">
            <Clock size={12} />
            <span>{timeAgoText}</span>
          </div>
        )}
      </div>

      {/* Error Panel */}
      {error && (
        <div className="p-4 bg-dangerRed/10 border border-dangerRed/30 rounded-xl text-dangerRed text-xs flex items-start space-x-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Insight Generation Failed</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Insights Content Card */}
      <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-6 shadow-xl min-h-[220px] flex flex-col justify-start relative overflow-hidden">
        {loading && !insightText ? (
          /* Loading Skeleton */
          <div className="space-y-4 animate-pulse w-full">
            <div className="h-4 bg-[#1e2e1e] rounded w-1/4" />
            <div className="space-y-2.5">
              <div className="h-3.5 bg-[#1e2e1e] rounded w-full" />
              <div className="h-3.5 bg-[#1e2e1e] rounded w-11/12" />
              <div className="h-3.5 bg-[#1e2e1e] rounded w-5/6" />
            </div>
            <div className="h-4 bg-[#1e2e1e] rounded w-1/3 pt-4" />
            <div className="space-y-2.5">
              <div className="h-3.5 bg-[#1e2e1e] rounded w-full" />
              <div className="h-3.5 bg-[#1e2e1e] rounded w-3/4" />
            </div>
          </div>
        ) : insightText ? (
          /* Streaming / Cached Text Content */
          <div className="prose prose-invert max-w-none text-[#e2e8f0] text-sm leading-relaxed space-y-4 whitespace-pre-line">
            {insightText}
            {loading && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-[#22c55e] animate-pulse" />
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center py-12 space-y-3 my-auto">
            <div className="bg-[#22c55e]/10 p-3 rounded-full text-[#22c55e]">
              <Sparkles size={28} />
            </div>
            <div>
              <p className="font-semibold text-white">No Insights Generated Yet</p>
              <p className="text-xs text-textMuted max-w-sm mt-1 mx-auto">
                Click the button above to analyze your last 30 days of data and get customized reduction recommendations.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
