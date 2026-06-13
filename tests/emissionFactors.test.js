import { EMISSION_FACTORS } from '../server/constants/emissionFactors.js';

describe('CO2 Calculation Logic via Emission Factors', () => {
  test('should calculate transport emissions correctly for car_petrol', () => {
    const qty = 100;
    const factor = EMISSION_FACTORS.transport.car_petrol.factor;
    expect(qty * factor).toBeCloseTo(21.0);
  });

  test('should calculate transport emissions correctly for car_diesel', () => {
    const qty = 50;
    const factor = EMISSION_FACTORS.transport.car_diesel.factor;
    expect(qty * factor).toBeCloseTo(8.5);
  });

  test('should calculate zero emissions for bicycle transport', () => {
    const qty = 25;
    const factor = EMISSION_FACTORS.transport.bicycle.factor;
    expect(qty * factor).toBe(0);
  });

  test('should calculate food emissions correctly for beef', () => {
    const qty = 2.5;
    const factor = EMISSION_FACTORS.food.beef.factor;
    expect(qty * factor).toBeCloseTo(67.5);
  });

  test('should calculate food emissions correctly for vegetables', () => {
    const qty = 3;
    const factor = EMISSION_FACTORS.food.vegetables.factor;
    expect(qty * factor).toBeCloseTo(6.0);
  });

  test('should calculate energy emissions correctly for electricity', () => {
    const qty = 120;
    const factor = EMISSION_FACTORS.energy.electricity.factor;
    expect(qty * factor).toBeCloseTo(27.96);
  });

  test('should calculate waste emissions correctly for landfill', () => {
    const qty = 15;
    const factor = EMISSION_FACTORS.waste.landfill.factor;
    expect(qty * factor).toBeCloseTo(8.55);
  });
});
