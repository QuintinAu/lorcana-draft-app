// @ts-check

const TYPE_ORDER = ['Character', 'Action', 'Song'];

/**
 * @typedef {import('../types').Card} Card
 */

/**
 * Normalize the Lorcana card type into one of the primary groups.
 * @param {Card} card
 * @returns {string}
 */
export function resolveCardType(card) {
  const baseType = (card.type || '').trim();
  if (!baseType) {
    return 'Other';
  }

  const normalized = baseType.toLowerCase();

  if (normalized === 'character') return 'Character';
  if (normalized === 'action') return 'Action';
  if (normalized === 'song') return 'Song';

  return baseType;
}

/**
 * Check if a card has a specific keyword (case-insensitive).
 * @param {Card} card
 * @param {string} keyword
 * @returns {boolean}
 */
export function hasKeyword(card, keyword) {
  if (!card.keywordAbilities || card.keywordAbilities.length === 0) {
    return false;
  }
  const target = keyword.toLowerCase();
  return card.keywordAbilities.some(k => k.toLowerCase() === target);
}

/**
 * @typedef {Object} CardFilters
 * @property {string[]} [colors]
 * @property {number[]} [costs]
 * @property {string[]} [types]
 * @property {boolean} [evasiveOnly]
 */

/**
 * Check whether a card matches the provided filters.
 * @param {Card} card
 * @param {CardFilters} [filters]
 * @returns {boolean}
 */
export function matchesFilters(card, filters = {}) {
  const {
    colors = [],
    costs = [],
    types = [],
    evasiveOnly = false,
  } = filters;

  if (colors.length > 0 && !colors.includes(card.color)) {
    return false;
  }

  const cost = typeof card.cost === 'number' ? card.cost : -1;
  if (costs.length > 0 && !costs.includes(cost)) {
    return false;
  }

  const cardType = resolveCardType(card);
  if (types.length > 0 && !types.includes(cardType)) {
    return false;
  }

  if (evasiveOnly && !hasKeyword(card, 'Evasive')) {
    return false;
  }

  return true;
}

export function filterCards(cards, filters = {}) {
  return cards.filter(card => matchesFilters(card, filters));
}

/**
 * Build a comparator for sorting cards based on the selected option.
 * @param {'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'} sortOption
 * @returns {(a: Card, b: Card) => number}
 */
export function getSortComparator(sortOption = 'default') {
  const getCost = (card) => (typeof card.cost === 'number' ? card.cost : Number.MAX_SAFE_INTEGER);

  const comparators = {
    'default': (a, b) => {
      const costDiff = getCost(a) - getCost(b);
      if (costDiff !== 0) return costDiff;
      return a.fullName.localeCompare(b.fullName);
    },
    'cost-asc': (a, b) => {
      const costDiff = getCost(a) - getCost(b);
      if (costDiff !== 0) return costDiff;
      return a.fullName.localeCompare(b.fullName);
    },
    'cost-desc': (a, b) => {
      const costDiff = getCost(b) - getCost(a);
      if (costDiff !== 0) return costDiff;
      return a.fullName.localeCompare(b.fullName);
    },
    'name': (a, b) => a.fullName.localeCompare(b.fullName),
    'color': (a, b) => {
      const colorDiff = a.color.localeCompare(b.color);
      if (colorDiff !== 0) return colorDiff;
      return comparators['default'](a, b);
    },
  };

  return comparators[sortOption] || comparators['default'];
}

export function sortCards(cards, sortOption = 'default') {
  const option =
    /** @type {'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'} */ (sortOption);
  const comparator = getSortComparator(option);
  return [...cards].sort(comparator);
}

/**
 * Group cards by type while preserving the primary Lorcana order.
 * @param {Card[]} cards
 * @param {'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'} [sortOption='default']
 * @returns {{ type: string, cards: Card[] }[]}
 */
export function groupCardsByType(
  cards,
  /**
   * @type {'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'}
   */
  sortOption = 'default'
) {
  const buckets = new Map();
  const typedSortOption =
    /** @type {'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'} */ (sortOption);

  cards.forEach(card => {
    const type = resolveCardType(card);
    if (!buckets.has(type)) {
      buckets.set(type, []);
    }
    buckets.get(type).push(card);
  });

  const orderedGroups = [];

  TYPE_ORDER.forEach(type => {
    if (buckets.has(type)) {
      orderedGroups.push({
        type,
        cards: sortCards(buckets.get(type), /** @type {any} */ (typedSortOption)),
      });
      buckets.delete(type);
    }
  });

  const remainingTypes = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b));
  remainingTypes.forEach(type => {
    orderedGroups.push({
      type,
      cards: sortCards(buckets.get(type), /** @type {any} */ (typedSortOption)),
    });
  });

  return orderedGroups;
}

/**
 * Build grouped and filtered card data for UI display.
 * @param {Card[]} cards
 * @param {CardFilters} filters
 * @param {'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'} sortOption
 * @returns {{ groups: { type: string, cards: Card[] }[], filteredCards: Card[] }}
 */
export function buildDisplayGroups(cards, filters = {}, sortOption = 'default') {
  const filtered = filterCards(cards, filters);
  return {
    filteredCards: filtered,
    groups: groupCardsByType(filtered, sortOption),
  };
}

export const __TYPE_ORDER = TYPE_ORDER;


