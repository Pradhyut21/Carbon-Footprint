/**
 * Global Constants and Configuration Magic Numbers
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_PERIOD_DAYS = 30;
export const PERIOD_WEEK_DAYS = 7;
export const PERIOD_YEAR_DAYS = 365;
export const STREAK_LOOKBACK_DAYS = 29;
export const TONS_CONVERSION_FACTOR = 1000;

export const BENCHMARKS = {
  india: 1.9,
  global: 6.6,
  paris: 2.5
};

export const INSIGHTS_LIMIT_MS = 60 * 60 * 1000;
export const INSIGHTS_LIMIT_MAX = 5;

export const AI_CONVERSIONS = {
  tree_co2_kg_per_year: 22,
  phone_charge_co2_kg: 0.008,
  short_haul_flight_co2_kg: 500,
  petrol_car_co2_kg_per_km: 0.21
};

export const INSIGHTS_MOCK_TEXT = `🌱 **CarbonLens AI Assistant Insights (Demo Mode)**

### 1. Personalized Analysis
* **Transport Commute:** You drove 340km in a petrol car — that's **71.4kg CO₂**, equivalent to charging **8,925 smartphones** or driving from Mumbai to Pune.
* **Electricity:** Your home energy usage consumed 150 kWh — generating **35kg CO₂**, equivalent to **1.6 trees** needing a full year to absorb.
* **Dietary Footprint:** You logged 1.5kg of beef — contributing **40.5kg CO₂**, equivalent to a **short-haul flight** engine running for 20 minutes.

### 2. Contextual Action Plan
1. **Commute Smart:** Switching 2 days of car travel to the train cuts transport emissions by **38%** (saving 27kg CO₂).
2. **Plant-Based Substitute:** Swapping beef for chicken or vegetables just twice a week slashes food CO₂ by **40%** (saving 16kg CO₂).
3. **Power Down:** Unplugging devices standby and using LED lights will shave **5kg CO₂** off your electricity total.

### 3. Comparison
Your daily average is **16.2 kg/day**, which is **10% below the Global Average** (18.08 kg/day), but still **136% above the Paris Target** (6.85 kg/day). Keep pushing for the target!`;

export const FALLBACK_TEMPLATES = {
  food: [
    {
      title: 'Plant-Based 3-Day Challenge',
      target_reduction_kg: 81.0,
      duration_days: 3
    },
    {
      title: 'Dairy-Free Transition',
      target_reduction_kg: 10.0,
      duration_days: 5
    },
    {
      title: 'Zero Food Waste Week',
      target_reduction_kg: 15.0,
      duration_days: 7
    },
    {
      title: 'Local & Seasonal Diet',
      target_reduction_kg: 12.0,
      duration_days: 7
    }
  ],
  transport: [
    {
      title: 'Car-Free Commute Week',
      target_reduction_kg: 30.0,
      duration_days: 7
    },
    {
      title: 'Public Transit Switch',
      target_reduction_kg: 15.0,
      duration_days: 3
    },
    {
      title: 'Active Commute Weekend',
      target_reduction_kg: 8.0,
      duration_days: 2
    },
    {
      title: 'Ride-Share & Carpool',
      target_reduction_kg: 12.0,
      duration_days: 4
    }
  ],
  energy: [
    {
      title: 'Energy Saver Challenge',
      target_reduction_kg: 15.0,
      duration_days: 7
    },
    {
      title: 'Eco-Thermostat Week',
      target_reduction_kg: 10.0,
      duration_days: 5
    },
    {
      title: 'Unplugged Evening',
      target_reduction_kg: 3.5,
      duration_days: 1
    },
    {
      title: 'Cold Wash & Line Dry',
      target_reduction_kg: 6.0,
      duration_days: 7
    }
  ],
  default: [
    {
      title: 'Zero Waste Challenge',
      target_reduction_kg: 12.0,
      duration_days: 5
    },
    {
      title: 'No New Clothes Month',
      target_reduction_kg: 40.0,
      duration_days: 30
    },
    {
      title: 'Refuse Single-Use Plastic',
      target_reduction_kg: 8.0,
      duration_days: 7
    },
    {
      title: 'Digital Purchase Freeze',
      target_reduction_kg: 25.0,
      duration_days: 14
    }
  ]
};

export const PREDEFINED_CHALLENGES = [
  {
    title: 'Car-Free Week',
    description: 'Log 0 car or motorcycle trips for 7 days. Opt for public transit, bike, or walk!',
    target_reduction_kg: 15.0,
    duration_days: 7
  },
  {
    title: 'Plant-Based Week',
    description: 'Eat zero beef or lamb for 7 days. Try delicious vegetarian meals!',
    target_reduction_kg: 20.0,
    duration_days: 7
  },
  {
    title: 'Energy Saver',
    description: 'Reduce electricity logs by 20% compared to your previous week.',
    target_reduction_kg: 10.0,
    duration_days: 7
  },
  {
    title: 'Zero Waste Day',
    description: 'Only compost or recycle waste (0 landfill waste logs) for 1 full day.',
    target_reduction_kg: 5.0,
    duration_days: 1
  }
];
