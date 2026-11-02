import { describe, it, expect } from 'vitest';
import { formatQuantity, formatQuantityRatio } from '@/app/utils/quantity';

describe('quantity utils', () => {
  // -------------------------------------------------------------------
  // formatQuantity — basic values
  // -------------------------------------------------------------------
  describe('formatQuantity', () => {
    it('formats integer values', () => {
      const result = formatQuantity(5);
      expect(result.display).toBe('5');
      expect(result.integer).toBe('5');
      expect(result.fraction).toBeNull();
      expect(result.raw).toBe(5);
    });

    it('formats zero', () => {
      const result = formatQuantity(0);
      expect(result.display).toBe('0');
      expect(result.integer).toBe('0');
      expect(result.fraction).toBeNull();
    });

    it('handles NaN as 0', () => {
      const result = formatQuantity(NaN);
      expect(result.display).toBe('0');
      expect(result.raw).toBe(0);
    });

    it('handles Infinity as 0', () => {
      const result = formatQuantity(Infinity);
      expect(result.display).toBe('0');
      expect(result.raw).toBe(0);
    });

    it('handles negative Infinity as 0', () => {
      const result = formatQuantity(-Infinity);
      expect(result.display).toBe('0');
    });

    // -------------------------------------------------------------------
    // Fraction display
    // -------------------------------------------------------------------
    it('displays ½ for 0.5', () => {
      const result = formatQuantity(0.5);
      expect(result.display).toBe('½');
      expect(result.fraction).toBe('½');
      expect(result.integer).toBe('');
    });

    it('displays ¼ for 0.25', () => {
      const result = formatQuantity(0.25);
      expect(result.fraction).toBe('¼');
    });

    it('displays ¾ for 0.75', () => {
      const result = formatQuantity(0.75);
      expect(result.fraction).toBe('¾');
    });

    it('displays ⅓ for 0.3333', () => {
      const result = formatQuantity(0.3333);
      expect(result.fraction).toBe('⅓');
    });

    it('displays ⅔ for 0.6667', () => {
      const result = formatQuantity(0.6667);
      expect(result.fraction).toBe('⅔');
    });

    it('displays ⅕ for 0.2', () => {
      const result = formatQuantity(0.2);
      expect(result.fraction).toBe('⅕');
    });

    it('displays ⅛ for 0.125', () => {
      const result = formatQuantity(0.125);
      expect(result.fraction).toBe('⅛');
    });

    it('displays ⅞ for 0.875', () => {
      const result = formatQuantity(0.875);
      expect(result.fraction).toBe('⅞');
    });

    // -------------------------------------------------------------------
    // Mixed integer + fraction
    // -------------------------------------------------------------------
    it('displays mixed number 2½ for 2.5', () => {
      const result = formatQuantity(2.5);
      expect(result.display).toBe('2½');
      expect(result.integer).toBe('2');
      expect(result.fraction).toBe('½');
    });

    it('displays mixed number 10¼ for 10.25', () => {
      const result = formatQuantity(10.25);
      expect(result.display).toBe('10¼');
    });

    // -------------------------------------------------------------------
    // preferFractions option
    // -------------------------------------------------------------------
    it('shows decimal when preferFractions is false', () => {
      const result = formatQuantity(2.5, { preferFractions: false });
      expect(result.display).toBe('2.5');
      expect(result.fraction).toBeNull();
    });

    // -------------------------------------------------------------------
    // Unit handling
    // -------------------------------------------------------------------
    it('pluralises "case" → "cases" for quantity > 1', () => {
      const result = formatQuantity(3, { unit: 'case' });
      expect(result.unit).toBe('cases');
    });

    it('singularises "cases" → "case" for quantity = 1', () => {
      const result = formatQuantity(1, { unit: 'cases' });
      expect(result.unit).toBe('case');
    });

    it('pluralises "loaf" → "loaves"', () => {
      const result = formatQuantity(2, { unit: 'loaf' });
      expect(result.unit).toBe('loaves');
    });

    it('singularises "loaves" → "loaf"', () => {
      const result = formatQuantity(1, { unit: 'loaves' });
      expect(result.unit).toBe('loaf');
    });

    it('pluralises "lb" → "lbs"', () => {
      const result = formatQuantity(5, { unit: 'lb' });
      expect(result.unit).toBe('lbs');
    });

    it('singularises "lbs" → "lb"', () => {
      const result = formatQuantity(1, { unit: 'lbs' });
      expect(result.unit).toBe('lb');
    });

    it('pluralises "person" → "people"', () => {
      const result = formatQuantity(3, { unit: 'person' });
      expect(result.unit).toBe('people');
    });

    it('singularises "people" → "person"', () => {
      const result = formatQuantity(1, { unit: 'people' });
      expect(result.unit).toBe('person');
    });

    it('pluralises "unit" → "units"', () => {
      const result = formatQuantity(2, { unit: 'unit' });
      expect(result.unit).toBe('units');
    });

    it('pluralises box → boxes', () => {
      const result = formatQuantity(2, { unit: 'box' });
      expect(result.unit).toBe('boxes');
    });

    it('hides unit when hideCaseUnit is true and unit starts with "case"', () => {
      const result = formatQuantity(2, { unit: 'cases', hideCaseUnit: true });
      expect(result.unit).toBe('');
    });

    it('uses fallbackUnit when unit is empty', () => {
      const result = formatQuantity(2, { unit: '', fallbackUnit: 'items' });
      expect(result.unit).toBe('items');
    });

    it('uses fallbackUnit when unit is null', () => {
      const result = formatQuantity(2, { unit: null, fallbackUnit: 'items' });
      expect(result.unit).toBe('items');
    });

    it('returns empty string when no unit and no fallback', () => {
      const result = formatQuantity(2);
      expect(result.unit).toBe('');
    });
  });

  // -------------------------------------------------------------------
  // formatQuantityRatio
  // -------------------------------------------------------------------
  describe('formatQuantityRatio', () => {
    it('formats simple integer ratio', () => {
      expect(formatQuantityRatio(5, 10)).toBe('5/10');
    });

    it('formats ratio with fractions', () => {
      expect(formatQuantityRatio(2.5, 5)).toBe('2½/5');
    });

    it('formats ratio when both have fractions', () => {
      expect(formatQuantityRatio(0.5, 1.5)).toBe('½/1½');
    });

    it('handles zero received', () => {
      expect(formatQuantityRatio(0, 10)).toBe('0/10');
    });

    it('handles equal values', () => {
      expect(formatQuantityRatio(10, 10)).toBe('10/10');
    });
  });
});
