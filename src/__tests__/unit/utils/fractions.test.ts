import { describe, it, expect } from 'vitest';
import { formatQuantityParts, formatQuantityLabel, toFraction } from '@/app/utils/fractions';

describe('fractions utils', () => {
  // -------------------------------------------------------------------
  // formatQuantityParts
  // -------------------------------------------------------------------
  describe('formatQuantityParts', () => {
    it('returns integer only for whole numbers', () => {
      expect(formatQuantityParts(5)).toEqual({ int: '5', fraction: null });
    });

    it('returns "0" for zero', () => {
      expect(formatQuantityParts(0)).toEqual({ int: '0', fraction: null });
    });

    it('returns "0" for NaN', () => {
      expect(formatQuantityParts(NaN)).toEqual({ int: '0', fraction: null });
    });

    it('returns "0" for Infinity', () => {
      expect(formatQuantityParts(Infinity)).toEqual({ int: '0', fraction: null });
    });

    it('returns fraction only for 0.5', () => {
      const result = formatQuantityParts(0.5);
      expect(result.int).toBe('');
      expect(result.fraction).toBe('½');
    });

    it('returns fraction only for 0.25', () => {
      const result = formatQuantityParts(0.25);
      expect(result.fraction).toBe('¼');
    });

    it('returns fraction only for 0.75', () => {
      const result = formatQuantityParts(0.75);
      expect(result.fraction).toBe('¾');
    });

    it('returns ⅕ for 0.2', () => {
      const result = formatQuantityParts(0.2);
      expect(result.fraction).toBe('⅕');
    });

    it('returns ⅓ for 0.3333', () => {
      const result = formatQuantityParts(0.3333);
      expect(result.fraction).toBe('⅓');
    });

    it('returns ⅔ for 0.6667', () => {
      const result = formatQuantityParts(0.6667);
      expect(result.fraction).toBe('⅔');
    });

    it('returns mixed integer and fraction for 2.5', () => {
      expect(formatQuantityParts(2.5)).toEqual({ int: '2', fraction: '½' });
    });

    it('returns mixed integer and fraction for 3.25', () => {
      expect(formatQuantityParts(3.25)).toEqual({ int: '3', fraction: '¼' });
    });

    it('returns decimal string for non-standard fractions', () => {
      const result = formatQuantityParts(1.43);
      expect(result.fraction).toBeNull();
      expect(result.int).toBe('1.43');
    });

    it('handles all supported fractions', () => {
      const expected: Array<[number, string]> = [
        [0.125, '⅛'],
        [0.1667, '⅙'],
        [0.2, '⅕'],
        [0.25, '¼'],
        [0.3333, '⅓'],
        [0.375, '⅜'],
        [0.5, '½'],
        [0.625, '⅝'],
        [0.6667, '⅔'],
        [0.75, '¾'],
        [0.875, '⅞'],
      ];

      for (const [value, symbol] of expected) {
        const result = formatQuantityParts(value);
        expect(result.fraction).toBe(symbol);
      }
    });
  });

  // -------------------------------------------------------------------
  // formatQuantityLabel
  // -------------------------------------------------------------------
  describe('formatQuantityLabel', () => {
    it('returns "—" for null', () => {
      expect(formatQuantityLabel(null)).toBe('—');
    });

    it('returns "—" for undefined', () => {
      expect(formatQuantityLabel(undefined)).toBe('—');
    });

    it('returns numeric string when no unit', () => {
      expect(formatQuantityLabel(5)).toBe('5');
    });

    it('returns numeric string when unit is empty', () => {
      expect(formatQuantityLabel(5, '')).toBe('5');
    });

    it('hides case unit', () => {
      expect(formatQuantityLabel(5, 'cases')).toBe('5');
    });

    it('hides case unit (singular)', () => {
      expect(formatQuantityLabel(1, 'case')).toBe('1');
    });

    it('appends non-case unit in singular', () => {
      expect(formatQuantityLabel(1, 'bag')).toBe('1 bag');
    });

    it('appends non-case unit in plural', () => {
      expect(formatQuantityLabel(3, 'bag')).toBe('3 bags');
    });

    it('keeps already-plural unit for non-1 value', () => {
      expect(formatQuantityLabel(3, 'bags')).toBe('3 bags');
    });

    it('singularises plural unit for value = 1', () => {
      expect(formatQuantityLabel(1, 'bags')).toBe('1 bag');
    });

    it('displays fractions with unit', () => {
      expect(formatQuantityLabel(2.5, 'lb')).toBe('2½ lbs');
    });

    it('displays fraction-only with unit', () => {
      expect(formatQuantityLabel(0.5, 'lb')).toBe('½ lbs');
    });

    it('returns "0" for zero value without unit', () => {
      expect(formatQuantityLabel(0)).toBe('0');
    });
  });

  // -------------------------------------------------------------------
  // toFraction
  // -------------------------------------------------------------------
  describe('toFraction', () => {
    it('returns integer string for whole numbers', () => {
      expect(toFraction(3)).toBe('3');
    });

    it('returns "0" for zero', () => {
      expect(toFraction(0)).toBe('0');
    });

    it('returns fraction symbol for pure fractions', () => {
      expect(toFraction(0.5)).toBe('½');
      expect(toFraction(0.25)).toBe('¼');
      expect(toFraction(0.75)).toBe('¾');
      expect(toFraction(0.2)).toBe('⅕');
    });

    it('returns mixed number for integer + fraction', () => {
      expect(toFraction(2.5)).toBe('2½');
      expect(toFraction(1.25)).toBe('1¼');
      expect(toFraction(5.75)).toBe('5¾');
    });

    it('returns decimal for non-standard fractions', () => {
      expect(toFraction(1.43)).toBe('1.43');
    });
  });
});
