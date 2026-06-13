import React, { useState, useEffect } from 'react';
import { useActivities } from '../hooks/useActivities.js';
import { EMISSION_FACTORS } from '../constants/emissionFactors.js';
import { 
  Car, 
  Utensils, 
  Zap, 
  ShoppingBag, 
  Trash2, 
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

const CATEGORY_TABS = [
  { id: 'transport', name: 'Transport', icon: Car },
  { id: 'food', name: 'Food', icon: Utensils },
  { id: 'energy', name: 'Energy', icon: Zap },
  { id: 'shopping', name: 'Shopping', icon: ShoppingBag },
  { id: 'waste', name: 'Waste', icon: Trash2 }
];

/**
 * Log Activity View.
 * @param {Object} props
 * @param {Object} props.user
 */
export default function LogActivity({ user }) {
  const { logActivity } = useActivities();
  const [category, setCategory] = useState('transport');
  const [activityType, setActivityType] = useState('car_petrol');
  const [quantity, setQuantity] = useState('');
  const [loggedAt, setLoggedAt] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  // Toast and validation states
  const [toast, setToast] = useState({ show: false, message: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default activity type when tab changes
  useEffect(() => {
    const defaultTypes = Object.keys(EMISSION_FACTORS[category]);
    setActivityType(defaultTypes[0]);
    setQuantity('');
    setFormError('');
  }, [category]);

  const activeCategoryConfig = EMISSION_FACTORS[category] || {};
  const activeTypeConfig = activeCategoryConfig[activityType] || { factor: 0, unit: '', label: '' };

  // Calculate preview value in real-time
  const qtyNum = parseFloat(quantity) || 0;
  const co2Preview = qtyNum * activeTypeConfig.factor;

  const handleToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!user?.id) {
      setFormError('No logged-in user session found. Please switch user.');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Please enter a quantity greater than 0.');
      return;
    }

    if (qty > 100000) {
      setFormError('Quantity exceeds maximum limit of 100,000.');
      return;
    }

    setIsSubmitting(true);
    try {
      await logActivity(user.id, {
        category,
        activityType,
        quantity: qty,
        loggedAt,
        notes: notes.trim()
      });

      // Clear input fields
      setQuantity('');
      setNotes('');
      handleToast(`Successfully logged: ${activeTypeConfig.label} (${qty} ${activeTypeConfig.unit})`);
    } catch (err) {
      setFormError(err.message || 'Failed to save activity log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Log Carbon Activity</h2>
        <p className="text-sm text-textMuted mt-1">Record your daily carbon impact to recalculate insights.</p>
      </div>

      {/* Category Tabs */}
      <div className="flex space-x-1.5 bg-[#111811] p-1 rounded-xl border border-[#1e2e1e] overflow-x-auto">
        {CATEGORY_TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = category === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setCategory(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                isActive 
                  ? 'bg-[#22c55e] text-[#0a0f0a] shadow-lg shadow-[#22c55e]/15 font-semibold' 
                  : 'text-textMuted hover:text-[#e2e8f0] hover:bg-[#1e2e1e]/50'
              }`}
            >
              <TabIcon size={16} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Form Card */}
      <div className="rounded-xl border border-[#1e2e1e] bg-[#111811] p-6 shadow-xl relative">
        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="p-4 bg-dangerRed/10 border border-dangerRed/30 rounded-lg text-dangerRed text-xs flex items-center space-x-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Activity Sub-type Dropdown */}
          <div className="space-y-2">
            <label htmlFor="activityType" className="text-xs font-semibold text-textMuted uppercase tracking-wider block">
              Activity Type
            </label>
            <select
              id="activityType"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full bg-[#0a0f0a] border border-[#1e2e1e] rounded-lg px-4 py-3 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22c55e] transition"
            >
              {Object.keys(activeCategoryConfig).map((key) => (
                <option key={key} value={key}>
                  {activeCategoryConfig[key].label}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Input with Autopopulated Unit */}
          <div className="space-y-2">
            <label htmlFor="quantity" className="text-xs font-semibold text-textMuted uppercase tracking-wider block">
              Quantity ({activeTypeConfig.unit})
            </label>
            <div className="relative">
              <input
                id="quantity"
                type="number"
                step="any"
                min="0.0001"
                placeholder={`Enter amount in ${activeTypeConfig.unit}`}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[#0a0f0a] border border-[#1e2e1e] rounded-lg pl-4 pr-16 py-3 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22c55e] transition"
                required
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <span className="text-xs font-medium text-textMuted select-none bg-[#111811] px-2 py-1 rounded border border-[#1e2e1e]">
                  {activeTypeConfig.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <label htmlFor="loggedAt" className="text-xs font-semibold text-textMuted uppercase tracking-wider block">
              Date
            </label>
            <input
              id="loggedAt"
              type="date"
              value={loggedAt}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setLoggedAt(e.target.value)}
              className="w-full bg-[#0a0f0a] border border-[#1e2e1e] rounded-lg px-4 py-3 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22c55e] transition"
              required
            />
          </div>

          {/* Optional Notes */}
          <div className="space-y-2">
            <label htmlFor="notes" className="text-xs font-semibold text-textMuted uppercase tracking-wider block">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              rows="3"
              placeholder="Add details, e.g. 'Air conditioner kept on Eco mode'"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#0a0f0a] border border-[#1e2e1e] rounded-lg px-4 py-3 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#22c55e] transition resize-none"
            />
          </div>

          {/* Live CO2 Preview Display */}
          <div className="p-4 bg-[#0a0f0a] border border-[#1e2e1e] rounded-lg flex items-center justify-between">
            <div>
              <p className="text-xs text-textMuted font-medium uppercase tracking-wide">Instant Preview</p>
              <p className="text-xs text-textMuted mt-0.5">Factor: {activeTypeConfig.factor} kg CO₂ per {activeTypeConfig.unit}</p>
            </div>
            <div className="text-right">
              <span className={`text-xl font-bold ${co2Preview > 15 ? 'text-warningGold' : 'text-primaryGreen'}`}>
                +{co2Preview.toFixed(2)}
              </span>
              <span className="text-xs text-textMuted font-medium ml-1">kg CO₂</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="btn-submit-activity"
            disabled={isSubmitting}
            className="w-full bg-[#22c55e] hover:bg-[#1db053] disabled:opacity-50 text-[#0a0f0a] py-3.5 rounded-lg text-sm font-bold tracking-wide transition shadow-lg shadow-[#22c55e]/15 flex items-center justify-center space-x-2"
          >
            {isSubmitting ? 'Saving Activity...' : 'Log Activity'}
          </button>
        </form>
      </div>

      {/* Floating Success Toast notification */}
      {toast.show && (
        <div 
          id="toast-success"
          role="status"
          className="fixed bottom-6 right-6 bg-[#111811] border border-primaryGreen/30 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center space-x-3 animate-bounce z-50 max-w-sm"
        >
          <CheckCircle size={22} className="text-primaryGreen shrink-0" />
          <div className="text-sm font-medium">{toast.message}</div>
        </div>
      )}
    </div>
  );
}
