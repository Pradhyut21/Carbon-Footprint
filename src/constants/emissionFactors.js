export const EMISSION_FACTORS = {
  transport: {
    car_petrol: { factor: 0.21, unit: 'km', label: 'Car (Petrol)' },
    car_diesel: { factor: 0.17, unit: 'km', label: 'Car (Diesel)' },
    car_electric: { factor: 0.05, unit: 'km', label: 'Car (Electric)' },
    bus: { factor: 0.089, unit: 'km', label: 'Bus' },
    train: { factor: 0.041, unit: 'km', label: 'Train' },
    flight_short: { factor: 0.255, unit: 'km', label: 'Flight (<3hr)' },
    flight_long: { factor: 0.195, unit: 'km', label: 'Flight (>3hr)' },
    motorcycle: { factor: 0.113, unit: 'km', label: 'Motorcycle' },
    bicycle: { factor: 0.0, unit: 'km', label: 'Bicycle' },
    walking: { factor: 0.0, unit: 'km', label: 'Walking' }
  },
  food: {
    beef: { factor: 27.0, unit: 'kg', label: 'Beef' },
    lamb: { factor: 24.0, unit: 'kg', label: 'Lamb' },
    pork: { factor: 12.1, unit: 'kg', label: 'Pork' },
    chicken: { factor: 6.9, unit: 'kg', label: 'Chicken' },
    fish: { factor: 6.1, unit: 'kg', label: 'Fish' },
    dairy: { factor: 3.2, unit: 'kg', label: 'Dairy' },
    eggs: { factor: 4.8, unit: 'kg', label: 'Eggs' },
    vegetables: { factor: 2.0, unit: 'kg', label: 'Vegetables' },
    fruits: { factor: 1.1, unit: 'kg', label: 'Fruits' },
    grains: { factor: 1.4, unit: 'kg', label: 'Grains' }
  },
  energy: {
    electricity: { factor: 0.233, unit: 'kWh', label: 'Electricity' },
    natural_gas: { factor: 2.04, unit: 'cubic_meter', label: 'Natural Gas' },
    heating_oil: { factor: 2.96, unit: 'liter', label: 'Heating Oil' }
  },
  shopping: {
    clothing: { factor: 20.0, unit: 'item', label: 'Clothing item' },
    electronics_small: { factor: 70.0, unit: 'item', label: 'Small Electronics' },
    electronics_large: { factor: 300.0, unit: 'item', label: 'Large Electronics' },
    furniture: { factor: 100.0, unit: 'item', label: 'Furniture item' }
  },
  waste: {
    landfill: { factor: 0.57, unit: 'kg', label: 'Landfill Waste' },
    recycled: { factor: 0.021, unit: 'kg', label: 'Recycled Waste' },
    composted: { factor: 0.0, unit: 'kg', label: 'Composted' }
  }
};

export const GLOBAL_AVERAGE_CO2_PER_DAY_KG = 18.08; // 6.6 tons/year ÷ 365
export const PARIS_TARGET_CO2_PER_DAY_KG = 6.85;    // 2.5 tons/year ÷ 365
