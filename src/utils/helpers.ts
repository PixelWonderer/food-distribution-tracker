import { EMOJI_MAP } from './constants';
import type { PantrySubcategory } from '@/types';

const DEFAULT_EMOJI = EMOJI_MAP.food || '🍽️';
const EMOJI_ENTRIES = Object.entries(EMOJI_MAP);
const STOP_WORDS = new Set(['and', 'the', 'with', 'for', 'of', 'in', 'a', 'an', 'to', 'by', 'on', 'at', 'from']);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
}

function singularize(word: string): string {
  if (word.length <= 3) {
    return word;
  }
  if (word.endsWith('ies')) {
    return word.slice(0, -3) + 'y';
  }
  if (word.endsWith('ves')) {
    return word.slice(0, -3) + 'f';
  }
  if (word.endsWith('oes')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('ses') && !word.endsWith('ases')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('xes') || word.endsWith('zes') || word.endsWith('ches') || word.endsWith('shes')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

export function getEmojiForItem(itemName: string): string {
  if (!itemName || typeof itemName !== 'string') {
    return DEFAULT_EMOJI;
  }

  const rawName = itemName.toLowerCase().trim();
  if (!rawName) {
    return DEFAULT_EMOJI;
  }

  if (EMOJI_MAP[rawName]) {
    return EMOJI_MAP[rawName];
  }

  const normalizedName = normalize(rawName);
  if (!normalizedName) {
    return DEFAULT_EMOJI;
  }

  if (EMOJI_MAP[normalizedName]) {
    return EMOJI_MAP[normalizedName];
  }

  const nameTokens = tokenize(normalizedName);
  const tokenVariants = new Set<string>(nameTokens);
  for (const token of nameTokens) {
    const singular = singularize(token);
    if (singular && singular !== token) {
      tokenVariants.add(singular);
    }
  }
  tokenVariants.add(normalizedName);

  let bestEmoji = '';
  let bestScore = 0;
  let bestKeyLength = 0;

  for (const [key, emoji] of EMOJI_ENTRIES) {
    if (key === rawName || key === normalizedName) {
      return emoji;
    }

    const normalizedKey = normalize(key);
    if (!normalizedKey) {
      continue;
    }

    if (tokenVariants.has(normalizedKey)) {
      const isSingleToken = !normalizedKey.includes(' ');
      const directScore = normalizedKey.length + (isSingleToken ? 10 : 30);
      if (directScore > bestScore || (directScore === bestScore && normalizedKey.length > bestKeyLength)) {
        bestScore = directScore;
        bestKeyLength = normalizedKey.length;
        bestEmoji = emoji;
      }
      continue;
    }

    if (normalizedName === normalizedKey) {
      return emoji;
    }

    const keyTokens = tokenize(normalizedKey);
    const keyVariants = new Set<string>(keyTokens);
    for (const token of keyTokens) {
      const singular = singularize(token);
      if (singular && singular !== token) {
        keyVariants.add(singular);
      }
    }

    let score = 0;

    if (keyVariants.size) {
      let matchWeight = 0;
      let matchedCount = 0;
      for (const token of keyVariants) {
        if (tokenVariants.has(token)) {
          matchWeight += token.length;
          matchedCount += 1;
        }
      }
      if (matchWeight > 0) {
        score = matchWeight + matchedCount * 2;
      }
    }

    if (score === 0) {
      if (normalizedName.includes(normalizedKey) || normalizedKey.includes(normalizedName)) {
        score = normalizedKey.length;
      } else {
        for (const variant of tokenVariants) {
          if (variant.length > 2 && normalizedKey.includes(variant)) {
            score = Math.max(score, variant.length);
          }
        }
      }
    }

    if (score > bestScore || (score > 0 && score === bestScore && normalizedKey.length > bestKeyLength)) {
      bestScore = score;
      bestKeyLength = normalizedKey.length;
      bestEmoji = emoji;
    }
  }

  return bestEmoji || DEFAULT_EMOJI;
}

// Keyword patterns for subcategory detection - order matters (specific patterns first)
const SUBCATEGORY_PATTERNS: Array<{ pattern: string; category: PantrySubcategory }> = [
  // Condiments & Sauces - check specific multi-word patterns first to avoid false matches
  { pattern: 'peanut butter', category: 'Condiments & Sauces' },
  { pattern: 'hot sauce', category: 'Condiments & Sauces' },
  { pattern: 'chili sauce', category: 'Condiments & Sauces' },
  { pattern: 'sriracha', category: 'Condiments & Sauces' },
  { pattern: 'ketchup', category: 'Condiments & Sauces' },
  { pattern: 'mustard', category: 'Condiments & Sauces' },
  { pattern: 'mayo', category: 'Condiments & Sauces' },
  { pattern: 'vinegar', category: 'Condiments & Sauces' },
  { pattern: 'salsa', category: 'Condiments & Sauces' },
  { pattern: 'dressing', category: 'Condiments & Sauces' },

  // Beans & Legumes - check "black eyed pea" before generic "pea"
  { pattern: 'black eyed pea', category: 'Beans & Legumes' },
  { pattern: 'bean', category: 'Beans & Legumes' },
  { pattern: 'lentil', category: 'Beans & Legumes' },
  { pattern: 'garbanzo', category: 'Beans & Legumes' },
  { pattern: 'chickpea', category: 'Beans & Legumes' },
  { pattern: 'legume', category: 'Beans & Legumes' },

  // Grains & Pasta
  { pattern: 'rice', category: 'Grains & Pasta' },
  { pattern: 'pasta', category: 'Grains & Pasta' },
  { pattern: 'spaghetti', category: 'Grains & Pasta' },
  { pattern: 'fideo', category: 'Grains & Pasta' },
  { pattern: 'macaroni', category: 'Grains & Pasta' },
  { pattern: 'noodle', category: 'Grains & Pasta' },
  { pattern: 'oat', category: 'Grains & Pasta' },
  { pattern: 'flour', category: 'Grains & Pasta' },
  { pattern: 'masa', category: 'Grains & Pasta' },
  { pattern: 'grain', category: 'Grains & Pasta' },
  { pattern: 'quinoa', category: 'Grains & Pasta' },
  { pattern: 'elbow', category: 'Grains & Pasta' },

  // Canned Goods - check "sauce" after condiments patterns
  { pattern: 'canned', category: 'Canned Goods' },
  { pattern: 'soup', category: 'Canned Goods' },
  { pattern: 'tomato', category: 'Canned Goods' },
  { pattern: 'hominy', category: 'Canned Goods' },
  { pattern: 'corn', category: 'Canned Goods' },

  // Snacks & Other - explicit patterns (everything else falls through to default)
  { pattern: 'candy', category: 'Snacks & Other' },
  { pattern: 'snack', category: 'Snacks & Other' },
  { pattern: 'cookie', category: 'Snacks & Other' },
  { pattern: 'cracker', category: 'Snacks & Other' },
  { pattern: 'chip', category: 'Snacks & Other' },
  { pattern: 'applesauce', category: 'Snacks & Other' },
  { pattern: 'stroopwafel', category: 'Snacks & Other' },
  { pattern: 'waffle', category: 'Snacks & Other' },
  { pattern: 'coffee', category: 'Snacks & Other' },
  { pattern: 'keurig', category: 'Snacks & Other' },
];

/**
 * Determines the pantry subcategory for an item based on its name.
 * Uses keyword matching with specific multi-word patterns checked first.
 */
export function getSubcategoryForItem(itemName: string): PantrySubcategory {
  if (!itemName || typeof itemName !== 'string') {
    return 'Snacks & Other';
  }

  const normalizedName = itemName.toLowerCase().trim();
  if (!normalizedName) {
    return 'Snacks & Other';
  }

  // Check patterns in order (specific multi-word patterns are listed first)
  for (const { pattern, category } of SUBCATEGORY_PATTERNS) {
    if (normalizedName.includes(pattern)) {
      return category;
    }
  }

  return 'Snacks & Other';
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function getTimingClass(timing: string): string {
  if (!timing || typeof timing !== 'string') {
    console.warn('⚠️ getTimingClass received invalid timing:', timing);
    return 'friday-am'; // default for invalid input
  }
  const lowerTiming = timing.toLowerCase();

  // Specific timing class mapping for distinct colors
  if (lowerTiming.includes('friday') && lowerTiming.includes('am')) return 'friday-am';
  if (lowerTiming.includes('friday') && lowerTiming.includes('noon')) return 'friday-noon';
  if (lowerTiming.includes('friday') && lowerTiming.includes('pm')) return 'friday-pm';
  if (lowerTiming.includes('saturday') && lowerTiming.includes('noon')) return 'saturday-noon';
  if (lowerTiming.includes('saturday') && lowerTiming.includes('pm')) return 'saturday-pm';
  if (lowerTiming.includes('sunday')) return 'sunday';

  // Fallback for generic timing
  if (lowerTiming.includes('friday')) return 'friday-am';
  if (lowerTiming.includes('saturday')) return 'saturday-noon';
  return 'friday-am'; // default
}
