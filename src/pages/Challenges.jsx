import React, { useEffect, useState } from 'react';
import { useChallenges } from '../hooks/useChallenges.js';
import api from '../utils/api.js';
import { 
  Trophy, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Flame, 
  Compass,
  ArrowRight
} from 'lucide-react';

const getChallengeIcon = (title) => {
  const t = title.toLowerCase();
  if (t.includes('car') || t.includes('transit') || t.includes('commute') || t.includes('drive')) return Compass;
  if (t.includes('plant') || t.includes('food') || t.includes('veget') || t.includes('dairy')) return Trophy;
  if (t.includes('energy') || t.includes('electr') || t.includes('power') || t.includes('temp')) return Flame;
  return Trophy;
};

/**
 * Challenges View.
 * @param {Object} props
 * @param {Object} props.user
 */
export default function Challenges({ user }) {
  const { challenges, loading, fetchChallenges, joinChallenge } = useChallenges();
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchChallenges(user.id);
      
      // Fetch dynamic templates
      setTemplatesLoading(true);
      api.get('/challenges/templates', { params: { userId: user.id } })
        .then(res => setTemplates(res.data))
        .catch(() => {})
        .finally(() => setTemplatesLoading(false));
    }
  }, [user, fetchChallenges]);

  const handleAcceptChallenge = async (tmpl) => {
    if (!user?.id) return;
    try {
      setSuccessMsg('');
      await joinChallenge(user.id, tmpl);
      setSuccessMsg(`Accepted challenge: "${tmpl.title}"! Good luck!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchChallenges(user.id);
    } catch (err) {
      alert(err.message || 'Failed to accept challenge');
    }
  };

  if ((loading || templatesLoading) && challenges.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div>
          <div className="h-6 bg-[#1e2e1e] rounded w-1/4" />
          <div className="h-4 bg-[#1e2e1e] rounded w-1/2 mt-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-44 bg-[#111811] border border-[#1e2e1e] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Reduction Challenges</h2>
        <p className="text-sm text-textMuted mt-1">
          Engage in structured activities to reduce carbon emissions and build sustainable habits.
        </p>
      </div>

      {successMsg && (
        <div 
          id="toast-challenge-success"
          role="status"
          className="p-4 bg-primaryGreen/10 border border-primaryGreen/30 text-primaryGreen rounded-xl text-sm font-medium flex items-center space-x-2 animate-pulse"
        >
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {templates.map((tmpl) => {
          // Find the active instance of this challenge first
          let instance = challenges.find(c => c.title === tmpl.title && c.status === 'active');
          // If no active instance, search for a completed/failed instance (taking the latest by ID)
          if (!instance) {
            const matches = challenges.filter(c => c.title === tmpl.title);
            if (matches.length > 0) {
              instance = matches[matches.length - 1]; // get latest instance
            }
          }

          const ChallengeIcon = getChallengeIcon(tmpl.title);

          // Determine challenge status styling
          let statusBadge = null;
          let acceptButtonDisabled = false;
          let buttonLabel = 'Accept Challenge';

          if (instance) {
            if (instance.status === 'active') {
              acceptButtonDisabled = true;
              buttonLabel = 'Active';
              statusBadge = (
                <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-warningGold/10 text-warningGold border border-warningGold/20">
                  <Clock size={12} className="animate-spin" />
                  <span>Active ({instance.progress}%)</span>
                </span>
              );
            } else if (instance.status === 'completed') {
              statusBadge = (
                <span id={`badge-completed-${tmpl.title.replace(/\s+/g, '-')}`} className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primaryGreen/10 text-primaryGreen border border-primaryGreen/20">
                  <CheckCircle size={12} />
                  <span>Completed</span>
                </span>
              );
              buttonLabel = 'Retake Challenge';
            } else if (instance.status === 'failed') {
              statusBadge = (
                <span className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-dangerRed/10 text-dangerRed border border-dangerRed/20">
                  <XCircle size={12} />
                  <span>Failed</span>
                </span>
              );
              buttonLabel = 'Retry Challenge';
            }
          }

          return (
            <div 
              key={tmpl.title} 
              className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-5 flex flex-col justify-between space-y-4 hover:border-[#22c55e]/30 transition duration-300"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="bg-[#22c55e]/10 p-2.5 rounded-lg text-[#22c55e]">
                    <ChallengeIcon size={20} />
                  </div>
                  {statusBadge}
                </div>

                <div>
                  <h3 className="font-bold text-white text-base tracking-wide">{tmpl.title}</h3>
                  <p className="text-xs text-textMuted mt-1 leading-relaxed">{tmpl.description}</p>
                </div>
              </div>

              {/* Progress Bar for Active Challenge */}
              {instance && instance.status === 'active' && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[10px] font-bold text-textMuted uppercase tracking-wider">
                    <span>Progress</span>
                    <span>{instance.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0a0f0a] rounded-full overflow-hidden border border-[#1e2e1e]">
                    <div 
                      className="h-full bg-gradient-to-r from-primaryGreen to-emerald-400 transition-all duration-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                      style={{ width: `${instance.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-textMuted">
                    <span>Starts: {instance.start_date}</span>
                    <span>Ends: {instance.end_date}</span>
                  </div>
                </div>
              )}

              {/* Accept/Action Button */}
              <div className="pt-2 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#22c55e] bg-[#22c55e]/5 border border-[#22c55e]/10 px-2 py-1 rounded">
                  -{tmpl.target_reduction_kg} kg CO₂
                </span>
                <button
                  onClick={() => handleAcceptChallenge(tmpl)}
                  disabled={acceptButtonDisabled}
                  className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition flex items-center space-x-1.5 ${
                    acceptButtonDisabled
                      ? 'bg-[#1e2e1e] text-[#64748b] cursor-not-allowed border border-[#1e2e1e]'
                      : 'bg-[#22c55e] text-[#0a0f0a] hover:bg-[#1db053] shadow-lg shadow-[#22c55e]/10'
                  }`}
                >
                  <span>{buttonLabel}</span>
                  {!acceptButtonDisabled && <ArrowRight size={12} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
