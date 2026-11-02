import { describe, it, expect } from 'vitest';
import { getEmojiForItem, formatDate, debounce, generateId, getTimingClass } from '@/utils/helpers';

describe('helpers', () => {
  describe('getEmojiForItem', () => {
    it('should return correct emoji for exact matches', () => {
      expect(getEmojiForItem('apple')).toBe('🍎');
      expect(getEmojiForItem('banana')).toBe('🍌');
      expect(getEmojiForItem('rice')).toBe('🍚');
    });

    it('should return correct emoji for partial matches', () => {
      expect(getEmojiForItem('green apple')).toBe('🍎');
      expect(getEmojiForItem('sweet potato')).toBe('🍠');
    });

    it('should be case insensitive', () => {
      expect(getEmojiForItem('APPLE')).toBe('🍎');
      expect(getEmojiForItem('Apple')).toBe('🍎');
    });

    it('handles plural and descriptive names', () => {
      expect(getEmojiForItem('strawberries')).toBe('🍓');
      expect(getEmojiForItem('Organic baby kale mix')).toBe('🥬');
      expect(getEmojiForItem('canned black beans')).toBe('🥫');
      expect(getEmojiForItem('Half & Half')).toBe('🥛');
      expect(getEmojiForItem('celery')).toBe('🥬');
    });

    it('maps common pantry supplies and prepared foods', () => {
      expect(getEmojiForItem('Spaghetti')).toBe('🍝');
      expect(getEmojiForItem('cup noodles')).toBe('🍜');
      expect(getEmojiForItem('protein powder')).toBe('🥤');
      expect(getEmojiForItem('veggie tray')).toBe('🥦');
      expect(getEmojiForItem('ice packs')).toBe('🧊');
      expect(getEmojiForItem('takeout containers')).toBe('🥡');
      expect(getEmojiForItem('tables')).toBe('🪑');
    });

    it('should return default emoji for unknown items', () => {
      expect(getEmojiForItem('unknown item')).toBe('🍽️');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      // Use a specific date and time to avoid timezone issues
      const date = new Date(2023, 11, 25); // December 25, 2023 (month is 0-indexed)
      const formatted = formatDate(date);
      // Check that the format is correct (weekday, month day, year)
      expect(formatted).toMatch(/\w+, December 25, 2023/);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', (done: any) => {
      let callCount = 0;
      const debouncedFn = debounce(() => {
        callCount++;
      }, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      // Should not have been called immediately
      expect(callCount).toBe(0);

      // Should be called once after delay
      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 150);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('getTimingClass', () => {
    it('should return correct specific timing classes', () => {
      expect(getTimingClass('Friday AM')).toBe('friday-am');
      expect(getTimingClass('Friday noon')).toBe('friday-noon');
      expect(getTimingClass('Friday pm')).toBe('friday-pm');
      expect(getTimingClass('Saturday noon')).toBe('saturday-noon');
      expect(getTimingClass('Saturday PM')).toBe('saturday-pm');
      expect(getTimingClass('Sunday')).toBe('sunday');
    });

    it('should use fallback for generic timing', () => {
      expect(getTimingClass('Friday')).toBe('friday-am');
      expect(getTimingClass('Saturday')).toBe('saturday-noon');
      expect(getTimingClass('Unknown')).toBe('friday-am'); // default
    });

    it('should handle invalid input', () => {
      expect(getTimingClass('')).toBe('friday-am');
      expect(getTimingClass(null as any)).toBe('friday-am');
      expect(getTimingClass(undefined as any)).toBe('friday-am');
    });
  });
});
