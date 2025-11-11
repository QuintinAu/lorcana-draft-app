import { Card, DraftState, Pack, RoundState, PickLogEntry } from '../types';
import { sampleWithoutReplacement, randomInt, deepClone } from './random';

/**
 * Get numeric rarity value for comparison (higher = rarer)
 */
function getRarityValue(rarity: string | undefined): number {
  if (!rarity) return 0; // Unknown rarity is treated as lowest
  
  const rarityMap: Record<string, number> = {
    'Common': 1,
    'Uncommon': 2,
    'Rare': 3,
    'Super Rare': 4,
    'Legendary': 5,
    'Epic': 6,
    'Iconic': 7,
    'Enchanted': 8,
    'Special': 9,
  };
  
  return rarityMap[rarity] || 0;
}

/**
 * Find the index of a rarest card in the pack
 * If multiple cards have the same highest rarity, returns a random one among them
 */
function findRarestCardIndex(cards: Card[]): number {
  if (cards.length === 0) return -1;
  
  // Find the highest rarity value
  let maxRarity = -1;
  const rarestIndices: number[] = [];
  
  cards.forEach((card, index) => {
    const rarityValue = getRarityValue(card.rarity);
    if (rarityValue > maxRarity) {
      maxRarity = rarityValue;
      rarestIndices.length = 0; // Clear previous indices
      rarestIndices.push(index);
    } else if (rarityValue === maxRarity) {
      rarestIndices.push(index);
    }
  });
  
  // If multiple cards have the same highest rarity, pick one randomly
  if (rarestIndices.length === 1) {
    return rarestIndices[0];
  } else {
    return rarestIndices[randomInt(rarestIndices.length)];
  }
}

/**
 * Create a new draft state with the first round initialized
 */
export function createNewDraft(masterCards: Card[]): DraftState {
  const round1 = createRound(1, masterCards);
  
  return {
    masterCards,
    rounds: [round1],
    currentRound: 1,
    currentTurn: 1,
    picks: [],
    log: [],
    isComplete: false,
    undoBuffer: null,
  };
}

/**
 * Create a new round with 6 packs of 12 cards each
 */
function createRound(roundNumber: number, masterCards: Card[]): RoundState {
  const packs: Pack[] = [];
  
  for (let i = 1; i <= 6; i++) {
    // Sample 12 cards with replacement across packs, without replacement within a pack
    const cards = sampleWithoutReplacement(masterCards, 12);
    packs.push({
      id: `R${roundNumber}P${i}`,
      cards,
      removedLog: [],
    });
  }
  
  return {
    roundNumber,
    packs,
    turn: 1,
  };
}

/**
 * Get the active pack index for the current turn (0-based)
 */
export function getActivePackIndex(turn: number): number {
  return ((turn - 1) % 6);
}

/**
 * Pick a card from the active pack
 */
export function pickCard(
  state: DraftState,
  cardIndex: number
): DraftState {
  // Save undo buffer
  const newState = deepClone(state);
  newState.undoBuffer = deepClone(state);
  
  const currentRound = newState.rounds[newState.rounds.length - 1];
  const packIndex = getActivePackIndex(newState.currentTurn);
  const activePack = currentRound.packs[packIndex];
  
  // Remove the picked card
  const [pickedCard] = activePack.cards.splice(cardIndex, 1);
  newState.picks.push(pickedCard);
  
  // Remove 1 card from each other non-empty pack
  // 50% chance: random removal
  // 50% chance: remove the rarest card
  let removedCount = 0;
  for (let i = 0; i < currentRound.packs.length; i++) {
    if (i === packIndex) continue;
    const pack = currentRound.packs[i];
    if (pack.cards.length > 0) {
      let removeIdx: number;
      if (Math.random() < 0.5) {
        // 50% chance: random removal
        removeIdx = randomInt(pack.cards.length);
      } else {
        // 50% chance: remove the rarest card
        removeIdx = findRarestCardIndex(pack.cards);
      }
      pack.cards.splice(removeIdx, 1);
      removedCount++;
    }
  }
  
  // Log the pick
  const logEntry: PickLogEntry = {
    round: newState.currentRound,
    turn: newState.currentTurn,
    packIndex,
    picked: pickedCard,
    removedCounts: removedCount,
  };
  newState.log.push(logEntry);
  
  // Advance turn
  newState.currentTurn++;
  
  // Check if round is complete
  if (newState.currentTurn > 12) {
    // Validate all packs are empty
    const allEmpty = currentRound.packs.every(p => p.cards.length === 0);
    if (!allEmpty) {
      console.warn('Round ended but not all packs are empty!');
    }
    
    // Start next round or finish draft
    if (newState.currentRound < 6) {
      newState.currentRound++;
      newState.currentTurn = 1;
      const nextRound = createRound(newState.currentRound, newState.masterCards);
      newState.rounds.push(nextRound);
    } else {
      newState.isComplete = true;
    }
  }
  
  return newState;
}

/**
 * Undo the last pick
 */
export function undoLastPick(state: DraftState): DraftState | null {
  if (!state.undoBuffer) return null;
  return deepClone(state.undoBuffer);
}

/**
 * Reset the current round
 */
export function resetRound(state: DraftState): DraftState {
  const newState = deepClone(state);
  
  // Remove all picks from the current round
  const currentRoundStartIdx = newState.log.findIndex(
    entry => entry.round === newState.currentRound
  );
  
  if (currentRoundStartIdx !== -1) {
    newState.picks.splice(currentRoundStartIdx);
    newState.log.splice(currentRoundStartIdx);
  }
  
  // Recreate the current round
  const newRound = createRound(newState.currentRound, newState.masterCards);
  newState.rounds[newState.rounds.length - 1] = newRound;
  newState.currentTurn = 1;
  newState.undoBuffer = null;
  
  return newState;
}

/**
 * Reset the entire draft
 */
export function resetDraft(masterCards: Card[]): DraftState {
  return createNewDraft(masterCards);
}

/**
 * Get the tally of all picks for the results table
 */
export function getTally(picks: Card[]): Array<{ count: number; fullName: string; color: string }> {
  const map = new Map<string, { count: number; fullName: string; color: string }>();
  
  for (const card of picks) {
    const key = `${card.fullName}|${card.color}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, { count: 1, fullName: card.fullName, color: card.color });
    }
  }
  
  const tally = Array.from(map.values());
  
  // Sort by count desc, then fullName asc
  tally.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.fullName.localeCompare(b.fullName);
  });
  
  return tally;
}

/**
 * Generate copy-ready text for all picks (new format: without color, without first dash)
 */
export function generateCopyTextWithoutColor(picks: Card[]): string {
  const tally = getTally(picks);
  return tally.map(t => `${t.count} ${t.fullName}`).join('\n');
}

/**
 * Enrich a card with baseCard data from master cards lookup
 */
function enrichCardWithBaseCard(card: Card, masterCardLookup: Map<string | number, Card>): Card {
  // Try to find by id first (most reliable)
  const masterCard = masterCardLookup.get(card.id);
  if (masterCard && masterCard.baseCard !== undefined) {
    return { ...card, baseCard: masterCard.baseCard };
  }
  
  // Fallback: if baseCard is already set, keep it
  if (card.baseCard !== undefined) {
    return card;
  }
  
  // Default to true if not found (backwards compatibility)
  return { ...card, baseCard: true };
}

/**
 * Enrich a DraftState with baseCard data for all cards
 */
export function enrichDraftStateWithBaseCard(state: DraftState, masterCards: Card[]): DraftState {
  // Create lookup map by id
  const lookup = new Map<string | number, Card>();
  masterCards.forEach(card => {
    lookup.set(card.id, card);
  });
  
  // Enrich masterCards
  const enrichedMasterCards = state.masterCards.map(card => 
    enrichCardWithBaseCard(card, lookup)
  );
  
  // Enrich picks
  const enrichedPicks = state.picks.map(card => 
    enrichCardWithBaseCard(card, lookup)
  );
  
  // Enrich rounds (packs and log entries)
  const enrichedRounds = state.rounds.map(round => ({
    ...round,
    packs: round.packs.map(pack => ({
      ...pack,
      cards: pack.cards.map(card => enrichCardWithBaseCard(card, lookup))
    }))
  }));
  
  // Enrich log entries
  const enrichedLog = state.log.map(entry => ({
    ...entry,
    picked: enrichCardWithBaseCard(entry.picked, lookup)
  }));
  
  return {
    ...state,
    masterCards: enrichedMasterCards,
    picks: enrichedPicks,
    rounds: enrichedRounds,
    log: enrichedLog,
    undoBuffer: state.undoBuffer ? enrichDraftStateWithBaseCard(state.undoBuffer, masterCards) : null,
  };
}

