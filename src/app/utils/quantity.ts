export type QuantityFormatOptions = {
  unit?: string | null;
  fallbackUnit?: string;
  hideCaseUnit?: boolean;
  preferFractions?: boolean;
};

export type QuantityParts = {
  display: string;
  integer: string;
  fraction: string | null;
  unit: string;
  raw: number;
};

const FRACTIONS: Array<{ value: number; symbol: string }> = [
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

const clampToStep = (value: number, step = 0.125) => Math.round(value / step) * step;

const findFractionSymbol = (decimal: number): string | null => {
  if (decimal < 0.01 || decimal > 0.99) {
    return null;
  }

  const tolerance = 0.02;
  for (const entry of FRACTIONS) {
    if (Math.abs(decimal - entry.value) <= tolerance) {
      return entry.symbol;
    }
  }

  return null;
};

const normalizeUnit = (quantity: number, unit: string | null | undefined, options: QuantityFormatOptions): string => {
  if (!unit) {
    return options.fallbackUnit ?? '';
  }

  const normalized = unit.trim();
  if (normalized.length === 0) {
    return options.fallbackUnit ?? '';
  }

  const lowerUnit = normalized.toLowerCase();

  if (options.hideCaseUnit && lowerUnit.startsWith('case')) {
    return '';
  }

  // Custom pluralisation rules
  if (lowerUnit === 'case' || lowerUnit === 'cases') {
    return quantity === 1 ? 'case' : 'cases';
  }

  if (lowerUnit.endsWith('box')) {
    return quantity === 1 ? normalized : `${normalized}es`;
  }

  if (lowerUnit === 'loaf' || lowerUnit === 'loaves') {
    return quantity === 1 ? 'loaf' : 'loaves';
  }

  if (lowerUnit === 'lb' || lowerUnit === 'lbs') {
    return quantity === 1 ? 'lb' : 'lbs';
  }

  if (lowerUnit === 'unit' || lowerUnit === 'units') {
    return quantity === 1 ? 'unit' : 'units';
  }

  if (lowerUnit === 'person' || lowerUnit === 'people') {
    return quantity === 1 ? 'person' : 'people';
  }

  return normalized;
};

export const formatQuantity = (
  value: number,
  options: QuantityFormatOptions = {}
): QuantityParts => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const rounded = clampToStep(safeValue, 0.01);
  const integerPortion = Math.trunc(rounded);
  const decimal = Math.abs(rounded - integerPortion);

  const preferFractions = options.preferFractions ?? true;
  const fractionSymbol = preferFractions ? findFractionSymbol(decimal) : null;

  let integerDisplay = '';
  let fractionDisplay: string | null = null;

  if (fractionSymbol) {
    fractionDisplay = fractionSymbol;
    if (integerPortion !== 0) {
      integerDisplay = integerPortion.toString();
    }
  } else {
    integerDisplay = rounded.toFixed(2).replace(/\.?0+$/, '');
  }

  if (integerPortion !== 0 && !integerDisplay) {
    integerDisplay = integerPortion.toString();
  }

  const unit = normalizeUnit(rounded, options.unit ?? null, options);

  const display = fractionDisplay ? `${integerDisplay}${fractionDisplay}` : integerDisplay || '0';

  return {
    display,
    integer: integerDisplay,
    fraction: fractionDisplay,
    unit,
    raw: rounded,
  };
};

export const formatQuantityRatio = (
  received: number,
  expected: number,
  options: QuantityFormatOptions = {}
) => {
  const receivedParts = formatQuantity(received, options);
  const expectedParts = formatQuantity(expected, options);

  const receivedText = receivedParts.fraction
    ? `${receivedParts.integer}${receivedParts.fraction}`
    : receivedParts.integer || '0';
  const expectedText = expectedParts.fraction
    ? `${expectedParts.integer}${expectedParts.fraction}`
    : expectedParts.integer || '0';

  return `${receivedText}/${expectedText}`;
};
