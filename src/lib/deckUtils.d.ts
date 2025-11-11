import type { Card } from '../types';

export declare function resolveCardType(card: Card): string;
export declare function hasKeyword(card: Card, keyword: string): boolean;
export declare function matchesFilters(card: Card, filters?: CardFilters): boolean;

export type CardFilters = {
  colors?: string[];
  costs?: number[];
  types?: string[];
  evasiveOnly?: boolean;
};

export declare function filterCards(cards: Card[], filters?: CardFilters): Card[];

export declare function sortCards(
  cards: Card[],
  sortOption?: 'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'
): Card[];

export declare function getSortComparator(
  sortOption?: 'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'
): (a: Card, b: Card) => number;

export declare function groupCardsByType(
  cards: Card[],
  sortOption?: 'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'
): Array<{ type: string; cards: Card[] }>;

export declare function buildDisplayGroups(
  cards: Card[],
  filters?: CardFilters,
  sortOption?: 'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color'
): {
  groups: Array<{ type: string; cards: Card[] }>;
  filteredCards: Card[];
};

export declare const __TYPE_ORDER: readonly string[];


