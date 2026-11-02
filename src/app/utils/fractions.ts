/**
 * Fraction display utility for food quantities
 * Converts decimals to common fraction symbols (e.g., 0.5 → "½", 2.5 → "2½")
 */

const FRACTION_MAP: Array<{ value: number; symbol: string }> = [
  { value: 0.125, symbol: '⅛' },
  { value: 0.1667, symbol: '⅙' },
  { value: 0.2, symbol: '⅕' },
  { value: 0.25, symbol: '¼' },
  { value: 0.3333, symbol: '⅓' },
  { value: 0.375, symbol: '⅜' },
  { value: 0.5, symbol: '½' },
  { value: 0.625, symbol: '⅝' },
  { value: 0.6667, symbol: '⅔' },
  { value: 0.75, symbol: '¾' },
  { value: 0.875, symbol: '⅞' },
];

/**
 * Convert a numeric quantity to integer and fraction parts
 * @param value - The numeric value to convert
 * @returns Object with integer part and optional fraction symbol
 */
export const formatQuantityParts = (value: number): { int: string; fraction: string | null } => {
  if (!Number.isFinite(value)) {
    return { int: '0', fraction: null };
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const integerPortion = Math.trunc(rounded);
  const fractionPortion = Math.abs(rounded - integerPortion);

  const tolerance = 0.02;
  const match = FRACTION_MAP.find((entry) => Math.abs(fractionPortion - entry.value) <= tolerance);

  if (match) {
    const intPart = integerPortion !== 0 ? integerPortion.toString() : '';
    return { int: intPart, fraction: match.symbol };
  }

  return {
    int: rounded.toFixed(2).replace(/\.?0+$/, ''),
    fraction: null,
  };
};

/**
 * Format a quantity with its unit label
 * @param value - The numeric quantity
 * @param unit - Optional unit string (e.g., "case", "bag")
 * @returns Formatted string with quantity and unit
 */
export const formatQuantityLabel = (value: number | null | undefined, unit?: string | null): string => {
  if (value === null || value === undefined) {
    return '—';
  }

  const parts = formatQuantityParts(value);
  const numeric = parts.fraction ? `${parts.int || ''}${parts.fraction}` || parts.fraction : parts.int || '0';

  if (!unit || unit.trim().length === 0 || unit.trim().toLowerCase().startsWith('case')) {
    return numeric;
  }

  const trimmed = unit.trim();
  const isPlural = trimmed.endsWith('s');
  const singular = isPlural ? trimmed.slice(0, -1) : trimmed;
  const label =
    Math.abs(value - 1) < 0.000001
      ? singular
      : isPlural
        ? trimmed
        : `${trimmed}s`;

  return `${numeric} ${label}`;
};

/**
 * Convert decimal to fraction display (Figma spec)
 * @param decimal - The decimal value to convert
 * @returns Formatted fraction string
 * @example
 * toFraction(0.5)   // "½"
 * toFraction(2.5)   // "2½"
 * toFraction(3.0)   // "3"
 */
export const toFraction = (decimal: number): string => {
  const parts = formatQuantityParts(decimal);
  if (parts.fraction) {
    return parts.int ? `${parts.int}${parts.fraction}` : parts.fraction;
  }
  return parts.int;
};
