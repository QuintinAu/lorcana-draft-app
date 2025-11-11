export type Card = {
  id: number | string;
  fullName: string;
  color: string;
  cost?: number;
  images?: { full?: string };
  type?: string;
  keywordAbilities?: string[];
  baseCard?: boolean; // true for base cards used in RNG, false for duplicates
  rarity?: string; // Card rarity (Common, Uncommon, Rare, Super Rare, Legendary, Epic, Iconic, Enchanted, Special)
};

export type Pack = {
  id: string;              // e.g., "R1P1"
  cards: Card[];           // remaining cards
  removedLog: number[];    // indexes/ids removed by randomness (optional debug)
};

export type RoundState = {
  roundNumber: number;     // 1..6
  packs: Pack[];           // length = 6
  turn: number;            // 1..12
};

export type PickLogEntry = {
  round: number;
  turn: number;
  packIndex: number;       // 0..5
  picked: Card;
  removedCounts: number;   // how many cards randomly removed across other packs this turn
};

export type DraftState = {
  masterCards: Card[];
  rounds: RoundState[];    // current/active round is last element
  currentRound: number;    // 1..6
  currentTurn: number;     // 1..12 (within current round)
  picks: Card[];           // all picks across all rounds
  log: PickLogEntry[];
  isComplete: boolean;
  undoBuffer: DraftState | null; // snapshot before last pick
};

