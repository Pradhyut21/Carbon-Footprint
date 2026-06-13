import React from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Sparkles, 
  Trophy, 
  LogOut,
  Leaf
} from 'lucide-react';

/**
 * Sidebar Navigation Component.
 * @param {Object} props
 * @param {string} props.currentView
 * @param {Function} props.onViewChange
 * @param {Object} props.user
 * @param {Function} props.onLogout
 */
export default function Sidebar({ currentView, onViewChange, user, onLogout }) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'log', name: 'Log Activity', icon: PlusCircle },
    { id: 'history', name: 'History', icon: History },
    { id: 'insights', name: 'Insights (AI)', icon: Sparkles },
    { id: 'challenges', name: 'Challenges', icon: Trophy }
  ];

  return (
    <aside className="fixed top-0 left-0 h-screen w-[240px] bg-[#111811] border-r border-[#1e2e1e] flex flex-col justify-between text-[#e2e8f0] z-20">
      <div className="flex flex-col">
        {/* Header Branding */}
        <div className="p-6 border-b border-[#1e2e1e] flex items-center space-x-3">
          <div className="bg-[#22c55e]/20 p-2 rounded-lg text-[#22c55e]">
            <Leaf size={22} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide text-white">CarbonLens</h1>
            <span className="text-[10px] text-[#22c55e] font-semibold uppercase tracking-wider">AI Coaching</span>
          </div>
        </div>

        {/* Logged in User Profile */}
        {user && (
          <div className="px-6 py-4 border-b border-[#1e2e1e] bg-[#0a0f0a]/50">
            <p className="text-[10px] text-textMuted font-semibold uppercase tracking-wider">Active User</p>
            <p className="font-semibold text-sm truncate text-[#22c55e] mt-0.5">@{user.username}</p>
          </div>
        )}

        {/* Sidebar Tabs Navigation */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onViewChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  isActive 
                    ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30 shadow-md shadow-[#22c55e]/5' 
                    : 'text-textMuted hover:text-[#e2e8f0] hover:bg-[#1e2e1e]/50'
                }`}
              >
                <Icon 
                  size={18} 
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-[#22c55e]' : 'text-textMuted group-hover:text-[#e2e8f0]'
                  }`} 
                />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout Action Area */}
      <div className="p-4 border-t border-[#1e2e1e]">
        <button
          id="btn-logout"
          onClick={onLogout}
          aria-label="Switch current user session"
          className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium text-textMuted hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded-lg transition-all duration-200"
        >
          <LogOut size={18} />
          <span>Switch User</span>
        </button>
      </div>
    </aside>
  );
}
