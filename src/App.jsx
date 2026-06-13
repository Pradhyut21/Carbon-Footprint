import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LogActivity from './pages/LogActivity.jsx';
import History from './pages/History.jsx';
import Insights from './pages/Insights.jsx';
import Challenges from './pages/Challenges.jsx';
import api from './utils/api.js';
import { Leaf } from 'lucide-react';

/**
 * Main App Component.
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Load session on startup
  useEffect(() => {
    const cached = localStorage.getItem('carbonlens_user');
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch (e) {
        localStorage.removeItem('carbonlens_user');
      }
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim()) {
      setLoginError('Please enter a username');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await api.post('/users/login', { username: loginUsername.trim() });
      setUser(res.data);
      localStorage.setItem('carbonlens_user', JSON.stringify(res.data));
      setCurrentView('dashboard');
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Failed to login. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('carbonlens_user');
    setLoginUsername('');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard user={user} />;
      case 'log':
        return <LogActivity user={user} />;
      case 'history':
        return <History user={user} />;
      case 'insights':
        return <Insights user={user} />;
      case 'challenges':
        return <Challenges user={user} />;
      default:
        return <Dashboard user={user} />;
    }
  };

  if (!user) {
    // Beautiful Login Screen
    return (
      <div className="min-h-screen bg-[#0a0f0a] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#111811] border border-[#1e2e1e] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-[#22c55e]/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full bg-[#22c55e]/5 blur-3xl" />

          <div className="relative space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="bg-[#22c55e]/20 p-4 rounded-2xl text-[#22c55e] inline-block shadow-inner">
                <Leaf size={36} className="animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide">CarbonLens</h1>
                <p className="text-xs text-textMuted mt-1 max-w-[280px]">
                  Analyze, understand, and reduce your personal carbon footprint.
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-dangerRed/10 border border-dangerRed/30 rounded-lg text-dangerRed text-xs text-center">
                  {loginError}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="usernameInput" className="text-xs font-semibold text-textMuted uppercase tracking-wider block">
                  Username
                </label>
                <input
                  id="usernameInput"
                  type="text"
                  placeholder="Enter username (e.g. demo)"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full bg-[#0a0f0a] border border-[#1e2e1e] rounded-xl px-4 py-3.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22c55e] transition"
                  required
                />
              </div>

              <button
                type="submit"
                id="btn-login"
                disabled={isLoggingIn}
                className="w-full bg-[#22c55e] hover:bg-[#1db053] disabled:opacity-50 text-[#0a0f0a] py-3.5 rounded-xl text-sm font-bold tracking-wide transition shadow-lg shadow-[#22c55e]/15 flex items-center justify-center"
              >
                {isLoggingIn ? 'Entering...' : 'Get Started'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // App Layout
  return (
    <div className="min-h-screen bg-[#0a0f0a] text-[#e2e8f0] flex">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-[#22c55e] text-[#0a0f0a] px-4 py-2.5 rounded-lg text-xs font-bold z-50 transition"
      >
        Skip to main content
      </a>
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        user={user} 
        onLogout={handleLogout} 
      />

      <main id="main-content" className="flex-1 ml-[240px] min-h-screen p-8 lg:p-10 relative overflow-y-auto" tabIndex="-1">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[#22c55e]/5 blur-3xl pointer-events-none -z-10" />
        <div className="max-w-5xl mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
