import React, { useEffect, useMemo, useState } from 'react';
import { useStats } from '../hooks/useStats.js';
import { 
  GLOBAL_AVERAGE_CO2_PER_DAY_KG, 
  PARIS_TARGET_CO2_PER_DAY_KG 
} from '../constants/emissionFactors.js';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Flame, ShieldAlert, Calendar, Share2, Check } from 'lucide-react';

const CATEGORY_COLORS = {
  transport: '#3b82f6', // blue
  food: '#eab308',      // yellow
  energy: '#f97316',    // orange
  shopping: '#a855f7',  // purple
  waste: '#10b981'      // emerald
};

const CATEGORY_LABELS = {
  transport: 'Transport',
  food: 'Food',
  energy: 'Energy',
  shopping: 'Shopping',
  waste: 'Waste'
};

const DailyChart = React.memo(({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
      <CartesianGrid stroke="#1e2e1e" strokeDasharray="3 3" />
      <XAxis 
        dataKey="displayDate" 
        stroke="#94a3b8" 
        fontSize={11}
        tickLine={false}
      />
      <YAxis 
        stroke="#94a3b8" 
        fontSize={11}
        tickLine={false}
        axisLine={false}
      />
      <Tooltip 
        contentStyle={{ backgroundColor: '#111811', borderColor: '#1e2e1e', color: '#e2e8f0', borderRadius: 8 }}
        labelClassName="text-white font-bold text-xs"
        formatter={(value) => [`${value} kg CO₂`, 'Emissions']}
      />
      <ReferenceLine 
        y={PARIS_TARGET_CO2_PER_DAY_KG} 
        stroke="#ef4444" 
        strokeDasharray="5 5" 
        strokeWidth={1.5}
      />
      <ReferenceLine 
        y={GLOBAL_AVERAGE_CO2_PER_DAY_KG} 
        stroke="#f59e0b" 
        strokeDasharray="5 5" 
        strokeWidth={1.5}
      />
      <Line 
        type="monotone" 
        dataKey="co2" 
        stroke="#22c55e" 
        strokeWidth={2.5} 
        dot={{ r: 3, stroke: '#111811', strokeWidth: 1 }}
        activeDot={{ r: 5, stroke: '#111811', strokeWidth: 1 }}
      />
    </LineChart>
  </ResponsiveContainer>
));

const CategoryChart = React.memo(({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={65}
        outerRadius={85}
        paddingAngle={3}
        dataKey="value"
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || '#94a3b8'} />
        ))}
      </Pie>
      <Tooltip 
        contentStyle={{ backgroundColor: '#111811', borderColor: '#1e2e1e', color: '#e2e8f0', borderRadius: 8 }}
        formatter={(value) => [`${value} kg CO₂`, 'Emissions']}
      />
    </PieChart>
  </ResponsiveContainer>
));

const BenchmarkChart = React.memo(({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
      <CartesianGrid stroke="#1e2e1e" strokeDasharray="3 3" />
      <XAxis 
        dataKey="name" 
        stroke="#94a3b8" 
        fontSize={10} 
        tickLine={false} 
      />
      <YAxis 
        stroke="#94a3b8" 
        fontSize={10} 
        tickLine={false} 
        axisLine={false} 
      />
      <Tooltip 
        contentStyle={{ backgroundColor: '#111811', borderColor: '#1e2e1e', color: '#e2e8f0', borderRadius: 8 }}
        labelClassName="text-white font-bold text-xs"
        formatter={(value) => [`${value} tons/yr`, 'Footprint']}
      />
      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.fill} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
));

/**
 * Dashboard View.
 * @param {Object} props
 * @param {Object} props.user
 */
export default function Dashboard({ user }) {
  const { stats, comparison, loading, error, fetchStats } = useStats();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchStats(user.id);
    }
  }, [user, fetchStats]);

  const { todayCo2 = 0, thisMonthCo2 = 0, streak = 0, dailyCo2 = [], categoryCo2 = [] } = stats || {};

  // Compare monthly average daily emission vs global daily average
  const daysInMonth = useMemo(() => new Date().getDate(), []);
  
  const dailyAvgThisMonth = useMemo(() => {
    return thisMonthCo2 / Math.max(1, daysInMonth);
  }, [thisMonthCo2, daysInMonth]);

  const diffPercent = useMemo(() => {
    return ((dailyAvgThisMonth - GLOBAL_AVERAGE_CO2_PER_DAY_KG) / GLOBAL_AVERAGE_CO2_PER_DAY_KG) * 100;
  }, [dailyAvgThisMonth]);
  
  const isBelowGlobal = diffPercent <= 0;
  const comparisonText = useMemo(() => {
    return isBelowGlobal
      ? `${Math.abs(Math.round(diffPercent))}% below global average`
      : `${Math.round(diffPercent)}% above global average`;
  }, [isBelowGlobal, diffPercent]);

  const todayIsExcessive = todayCo2 > PARIS_TARGET_CO2_PER_DAY_KG;

  // Memoize donut data processing
  const processedCategoryData = useMemo(() => {
    return categoryCo2.map(item => ({
      name: CATEGORY_LABELS[item.category] || item.category,
      value: item.co2,
      category: item.category
    })).filter(item => item.value > 0);
  }, [categoryCo2]);

  // Memoize line chart dates formatting
  const processedDailyData = useMemo(() => {
    return dailyCo2.map(item => {
      const d = new Date(item.date);
      return {
        ...item,
        displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      };
    });
  }, [dailyCo2]);

  // Memoize comparison chart data processing
  const processedBenchmarkData = useMemo(() => {
    if (!comparison) return [];
    return [
      { name: 'You (Annualized)', value: comparison.user, fill: comparison.user > comparison.paris ? '#ef4444' : '#22c55e' },
      { name: 'India Average', value: comparison.india, fill: '#3b82f6' },
      { name: 'Global Average', value: comparison.global, fill: '#f59e0b' },
      { name: 'Paris Target', value: comparison.paris, fill: '#10b981' }
    ];
  }, [comparison]);

  // Share Card metrics
  const monthlySaved = useMemo(() => {
    return Math.max(0, (GLOBAL_AVERAGE_CO2_PER_DAY_KG - dailyAvgThisMonth) * daysInMonth);
  }, [dailyAvgThisMonth, daysInMonth]);

  const reductionVsGlobal = useMemo(() => {
    return Math.max(0, Math.round(((GLOBAL_AVERAGE_CO2_PER_DAY_KG - dailyAvgThisMonth) / GLOBAL_AVERAGE_CO2_PER_DAY_KG) * 100));
  }, [dailyAvgThisMonth]);

  const treesPlanted = useMemo(() => {
    return (monthlySaved / 22).toFixed(1);
  }, [monthlySaved]);

  const handleCopyShare = () => {
    const shareText = `🌱 CarbonLens Progress Update! This month I reduced my carbon emissions by ${reductionVsGlobal}% compared to the global average, saving ${monthlySaved.toFixed(1)}kg CO₂ (equivalent to planting ${treesPlanted} trees! 🌳). Track and reduce your footprint on CarbonLens.`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-[#111811] border border-[#1e2e1e] rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-[#111811] border border-[#1e2e1e] rounded-xl" />
        <div className="h-96 bg-[#111811] border border-[#1e2e1e] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-xl text-red-400">
        <p className="font-semibold">Error loading dashboard stats</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Environmental Dashboard</h2>
        <p className="text-sm text-textMuted mt-1">Real-time footprint tracking and analytics overview.</p>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI 1: Today's CO2 */}
        <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-5 flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-textMuted uppercase tracking-wider block">Today's CO₂</span>
            <h3 className={`text-3xl font-bold ${todayIsExcessive ? 'text-dangerRed' : 'text-primaryGreen'}`}>
              {todayCo2.toFixed(2)} <span className="text-lg font-medium text-[#94a3b8]">kg</span>
            </h3>
            <p className="text-xs text-textMuted flex items-center space-x-1">
              <span>Paris Target: {PARIS_TARGET_CO2_PER_DAY_KG} kg</span>
            </p>
          </div>
          <div className={`p-2.5 rounded-lg ${todayIsExcessive ? 'bg-dangerRed/10 text-dangerRed' : 'bg-primaryGreen/10 text-primaryGreen'}`}>
            <ShieldAlert size={20} />
          </div>
        </div>

        {/* KPI 2: This Month's CO2 */}
        <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-5 flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-textMuted uppercase tracking-wider block">This Month</span>
            <h3 className="text-3xl font-bold text-white">
              {thisMonthCo2.toFixed(1)} <span className="text-lg font-medium text-[#94a3b8]">kg</span>
            </h3>
            <p className={`text-xs font-medium ${isBelowGlobal ? 'text-primaryGreen' : 'text-warningGold'}`}>
              {comparisonText}
            </p>
          </div>
          <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-lg">
            <Calendar size={20} />
          </div>
        </div>

        {/* KPI 3: Streak */}
        <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-5 flex items-start justify-between">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-textMuted uppercase tracking-wider block">Log Streak</span>
            <h3 className="text-3xl font-bold text-warningGold">
              {streak} <span className="text-lg font-medium text-[#94a3b8]">days</span>
            </h3>
            <p className="text-xs text-textMuted">
              {streak > 0 ? 'Keep logging daily to build your streak!' : 'Log an activity today to start a streak!'}
            </p>
          </div>
          <div className="bg-warningGold/10 text-warningGold p-2.5 rounded-lg">
            <Flame size={20} className={streak > 0 ? 'animate-bounce' : ''} />
          </div>
        </div>
      </div>

      {/* Middle Section: Line Chart */}
      <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h4 className="font-semibold text-white text-base">Carbon Footprint Trend</h4>
            <p className="text-xs text-textMuted mt-0.5">Daily CO₂ emissions tracked over the past 30 days.</p>
          </div>
          <div className="flex flex-wrap gap-4 mt-3 md:mt-0 text-[10px] uppercase font-semibold tracking-wider text-textMuted bg-[#0a0f0a] px-3 py-1.5 rounded-lg border border-[#1e2e1e]">
            <div className="flex items-center space-x-1">
              <span className="w-3 h-0.5 bg-[#22c55e]" />
              <span>Your Log</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-0.5 border-t border-dashed border-[#ef4444]" />
              <span>Paris Target ({PARIS_TARGET_CO2_PER_DAY_KG} kg)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-3 h-0.5 border-t border-dashed border-[#f59e0b]" />
              <span>Global Avg ({GLOBAL_AVERAGE_CO2_PER_DAY_KG} kg)</span>
            </div>
          </div>
        </div>
        <div className="h-[320px] w-full">
          <DailyChart data={processedDailyData} />
        </div>
      </div>

      {/* Bottom Section: Side-by-side charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Category Breakdown (Donut) */}
        <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-5 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-white text-base">Category Breakdown</h4>
            <p className="text-xs text-textMuted mt-0.5">Emissions distributed by activity type this month.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center mt-4">
            {processedCategoryData.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-textMuted text-sm">
                No emissions logged yet for this calendar month. Go to the "Log Activity" tab to start!
              </div>
            ) : (
              <>
                <div className="h-[180px] flex justify-center items-center">
                  <CategoryChart data={processedCategoryData} />
                </div>

                {/* Legend List */}
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {processedCategoryData.map((item) => {
                    const total = processedCategoryData.reduce((acc, curr) => acc + curr.value, 0);
                    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between p-2 rounded bg-[#0a0f0a]/40 border border-[#1e2e1e]/40">
                        <div className="flex items-center space-x-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: CATEGORY_COLORS[item.category] }} 
                          />
                          <span className="text-xs font-medium text-[#e2e8f0] truncate max-w-[80px]">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-white">{item.value.toFixed(1)} kg</span>
                          <span className="text-[10px] text-textMuted ml-1">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Peer Comparison Benchmark (Bar) */}
        <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-5 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-white text-base">Peer Comparison</h4>
            <p className="text-xs text-textMuted mt-0.5">Your annualized footprint compared to global benchmarks (tons CO₂/yr).</p>
          </div>
          <div className="h-[200px] w-full mt-4 flex items-center justify-center">
            {processedBenchmarkData.length > 0 ? (
              <BenchmarkChart data={processedBenchmarkData} />
            ) : (
              <div className="text-center text-textMuted text-xs py-12">
                Log activities to generate peer comparison benchmark.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share My Progress Card */}
      <div className="rounded-xl border border-[#1e2e1e] bg-gradient-to-r from-[#111811] to-[#142314] p-5 flex flex-col sm:flex-row justify-between items-center gap-4 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e]/5 rounded-full blur-2xl pointer-events-none" />
        <div className="space-y-1 relative">
          <h4 className="font-semibold text-white text-base flex items-center space-x-2">
            <span>✨ Share My Progress Card</span>
          </h4>
          <p className="text-xs text-textMuted">Spread the word about your sustainable achievements!</p>
          <div className="mt-3 bg-[#0a0f0a]/60 border border-[#1e2e1e] rounded-lg p-3 text-xs text-[#e2e8f0] max-w-lg leading-relaxed">
            <div className="flex items-center space-x-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-primaryGreen">
              <span>Status Card Preview</span>
            </div>
            <p className="italic">
              🌱 This month I reduced <strong className="text-primaryGreen">{reductionVsGlobal}%</strong> vs the global average.
            </p>
            <p className="italic mt-1">
              📊 Saved <strong className="text-white">{monthlySaved.toFixed(1)}kg CO₂</strong> — equivalent to <strong className="text-primaryGreen">{treesPlanted}</strong> trees planted! 🌳
            </p>
          </div>
        </div>

        <button
          onClick={handleCopyShare}
          className="bg-primaryGreen text-darkBg hover:bg-[#1db053] px-5 py-3 rounded-lg text-xs font-bold tracking-wide transition flex items-center space-x-2 shadow-lg shadow-primaryGreen/15 self-stretch sm:self-auto justify-center"
          aria-label="Copy share text to clipboard"
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Copied Link!</span>
            </>
          ) : (
            <>
              <Share2 size={14} />
              <span>Share Footprint</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
