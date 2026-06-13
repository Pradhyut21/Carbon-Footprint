import React, { useState, useEffect } from 'react';
import { useActivities } from '../hooks/useActivities.js';
import { EMISSION_FACTORS } from '../constants/emissionFactors.js';
import { Trash2, Download, Search, Calendar, Filter } from 'lucide-react';

const CATEGORIES = ['transport', 'food', 'energy', 'shopping', 'waste'];
const CATEGORY_LABELS = {
  transport: 'Transport',
  food: 'Food',
  energy: 'Energy',
  shopping: 'Shopping',
  waste: 'Waste'
};

/**
 * History View.
 * @param {Object} props
 * @param {Object} props.user
 */
export default function History({ user }) {
  const { activities, loading, fetchActivities, deleteActivity } = useActivities();

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user?.id) {
      // Fetch the last 365 days of activity for history view
      fetchActivities(user.id, 365);
    }
  }, [user, fetchActivities]);

  // Apply filters on the client side
  const filteredActivities = activities.filter(activity => {
    // Category Filter
    if (selectedCategory !== 'all' && activity.category !== selectedCategory) {
      return false;
    }

    // Date Range Filter
    if (startDate && activity.logged_at < startDate) {
      return false;
    }
    if (endDate && activity.logged_at > endDate) {
      return false;
    }

    // Search Term Filter (checks notes or activity type label)
    if (searchTerm) {
      const notesMatch = activity.notes && activity.notes.toLowerCase().includes(searchTerm.toLowerCase());
      const label = EMISSION_FACTORS[activity.category]?.[activity.activity_type]?.label || '';
      const labelMatch = label.toLowerCase().includes(searchTerm.toLowerCase());
      if (!notesMatch && !labelMatch) {
        return false;
      }
    }

    return true;
  });

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this activity log?')) {
      try {
        await deleteActivity(id);
      } catch (err) {
        alert(err.message || 'Failed to delete activity');
      }
    }
  };

  // Export to CSV client-side
  const handleExportCSV = () => {
    if (filteredActivities.length === 0) {
      alert('No data available to export.');
      return;
    }

    const headers = ['Date', 'Category', 'Activity Type', 'Quantity', 'Unit', 'CO2 (kg)', 'Notes'];
    const rows = filteredActivities.map(act => {
      const typeLabel = EMISSION_FACTORS[act.category]?.[act.activity_type]?.label || act.activity_type;
      const cleanNotes = act.notes ? `"${act.notes.replace(/"/g, '""')}"` : '';
      return [
        act.logged_at,
        CATEGORY_LABELS[act.category] || act.category,
        typeLabel,
        act.quantity,
        act.unit,
        act.co2_kg.toFixed(2),
        cleanNotes
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `carbonlens_history_${user.username}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Activity History</h2>
          <p className="text-sm text-textMuted mt-1">Review, filter, and export your historical carbon footprint logs.</p>
        </div>
        <button
          id="btn-export-csv"
          onClick={handleExportCSV}
          className="bg-[#111811] hover:bg-[#1e2e1e] border border-[#1e2e1e] text-white px-4 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition flex items-center space-x-2 shrink-0 self-stretch md:self-auto justify-center"
        >
          <Download size={16} />
          <span>Export to CSV</span>
        </button>
      </div>

      {/* Filter and Search Panel */}
      <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Category Filter */}
        <div className="space-y-1.5">
          <label htmlFor="filterCategory" className="text-[10px] font-semibold text-textMuted uppercase tracking-wider block">
            Category
          </label>
          <div className="relative">
            <select
              id="filterCategory"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#0a0f0a] border border-[#1e2e1e] rounded-lg pl-3 pr-8 py-2.5 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22c55e] transition appearance-none"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-textMuted">
              <Filter size={14} />
            </div>
          </div>
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <label htmlFor="filterStartDate" className="text-[10px] font-semibold text-textMuted uppercase tracking-wider block">
            Start Date
          </label>
          <input
            id="filterStartDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-[#0a0f0a] border border-[#1e2e1e] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22c55e] transition"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <label htmlFor="filterEndDate" className="text-[10px] font-semibold text-textMuted uppercase tracking-wider block">
            End Date
          </label>
          <input
            id="filterEndDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-[#0a0f0a] border border-[#1e2e1e] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22c55e] transition"
          />
        </div>

        {/* Keyword Search */}
        <div className="space-y-1.5">
          <label htmlFor="filterSearch" className="text-[10px] font-semibold text-textMuted uppercase tracking-wider block">
            Search Notes
          </label>
          <div className="relative">
            <input
              id="filterSearch"
              type="text"
              placeholder="Search details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0a0f0a] border border-[#1e2e1e] rounded-lg pl-8 pr-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22c55e] transition"
            />
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-textMuted">
              <Search size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-textMuted text-sm">Loading activity logs...</div>
          ) : filteredActivities.length === 0 ? (
            <div className="p-12 text-center text-textMuted text-sm">
              No matching activity logs found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0a0f0a] border-b border-[#1e2e1e] text-[10px] font-bold text-textMuted uppercase tracking-wider">
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Activity</th>
                  <th className="px-5 py-4">Quantity</th>
                  <th className="px-5 py-4 text-right">CO₂ (kg)</th>
                  <th className="px-5 py-4 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e1e]/60">
                {filteredActivities.map((act) => {
                  const label = EMISSION_FACTORS[act.category]?.[act.activity_type]?.label || act.activity_type;
                  return (
                    <tr key={act.id} className="hover:bg-[#1e2e1e]/20 transition-colors text-sm text-[#e2e8f0]">
                      <td className="px-5 py-4 whitespace-nowrap font-medium">{act.logged_at}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-[#0a0f0a] border border-[#1e2e1e] text-[#22c55e]">
                          {CATEGORY_LABELS[act.category]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-white">{label}</p>
                          {act.notes && <p className="text-xs text-textMuted mt-0.5 max-w-xs truncate">{act.notes}</p>}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-textMuted">
                        {act.quantity} <span className="text-xs">{act.unit}</span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right font-bold text-white">
                        {act.co2_kg.toFixed(2)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDelete(act.id)}
                          className="text-textMuted hover:text-dangerRed p-1 rounded hover:bg-dangerRed/10 transition"
                          title="Delete activity log"
                          aria-label={`Delete activity logged on ${act.logged_at}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
