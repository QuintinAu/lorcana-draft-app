import {
  resolveCardType,
  hasKeyword,
  filterCards,
  matchesFilters,
  groupCardsByType,
  buildDisplayGroups,
  getSortComparator,
  __TYPE_ORDER,
} from './src/lib/deckUtils.js';

const baseCard = {
  images: {},
};

const sampleCards = [
  { ...baseCard, id: 1, fullName: 'Anna - Friendly Face', color: 'Amber', cost: 2, type: 'Character' },
  { ...baseCard, id: 2, fullName: 'Fire the Cannons!', color: 'Ruby', cost: 3, type: 'Action' },
  { ...baseCard, id: 3, fullName: 'Part of Your World', color: 'Sapphire', cost: 1, type: 'Song' },
  { ...baseCard, id: 4, fullName: 'Tinker Bell - Evasive Ally', color: 'Amethyst', cost: 4, type: 'Character', keywordAbilities: ['Evasive'] },
  { ...baseCard, id: 5, fullName: 'Mirror - Mystic Artifact', color: 'Emerald', cost: 5, type: 'Item' },
];

function assert(condition, message) {
  if (!condition) {
    console.error(`✖️  ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

function testResolveCardType() {
  assert(resolveCardType(sampleCards[0]) === 'Character', 'resolveCardType handles characters');
  assert(resolveCardType(sampleCards[1]) === 'Action', 'resolveCardType handles actions');
  assert(resolveCardType(sampleCards[2]) === 'Song', 'resolveCardType handles songs');
  assert(resolveCardType(sampleCards[4]) === 'Item', 'resolveCardType preserves unknown types');
  assert(resolveCardType({ ...baseCard, id: 6, fullName: 'Nameless', color: 'Steel' }) === 'Other', 'resolveCardType falls back to Other');
}

function testHasKeyword() {
  assert(hasKeyword(sampleCards[3], 'Evasive') === true, 'hasKeyword matches keyword');
  assert(hasKeyword(sampleCards[3], 'eVaSiVe') === true, 'hasKeyword is case-insensitive');
  assert(hasKeyword(sampleCards[1], 'Evasive') === false, 'hasKeyword returns false when missing');
}

function testFilterCards() {
  const byColor = filterCards(sampleCards, { colors: ['Ruby'] });
  assert(byColor.length === 1 && byColor[0].id === 2, 'filterCards filters by color');

  const byCost = filterCards(sampleCards, { costs: [2, 4] });
  assert(byCost.length === 2 && byCost.some(c => c.id === 1) && byCost.some(c => c.id === 4), 'filterCards filters by cost');

  const byType = filterCards(sampleCards, { types: ['Song'] });
  assert(byType.length === 1 && byType[0].id === 3, 'filterCards filters by type');

  const evasive = filterCards(sampleCards, { evasiveOnly: true });
  assert(evasive.length === 1 && evasive[0].id === 4, 'filterCards filters by evasive keyword');
}

function testMatchesFilters() {
  const card = sampleCards[3];
  assert(matchesFilters(card, { colors: ['Amethyst'] }) === true, 'matchesFilters validates color');
  assert(matchesFilters(card, { colors: ['Ruby'] }) === false, 'matchesFilters rejects mismatched color');
  assert(matchesFilters(card, { evasiveOnly: true }) === true, 'matchesFilters checks evasive keyword');
}

function testGroupCardsByType() {
  const groups = groupCardsByType(sampleCards);
  assert(groups.length === 4, 'groupCardsByType returns expected number of groups');
  assert(
    groups[0].type === __TYPE_ORDER[0] && groups[0].cards[0].id === 1,
    'groupCardsByType keeps Character group first'
  );
  assert(groups[0].cards.length === 2, 'groupCardsByType groups cards of same type together');
}

function testBuildDisplayGroups() {
  const { groups, filteredCards } = buildDisplayGroups(sampleCards, { colors: ['Amber', 'Amethyst'] }, 'cost-desc');
  assert(filteredCards.length === 2, 'buildDisplayGroups applies filters');
  assert(groups.length === 1 && groups[0].cards[0].cost === 4, 'buildDisplayGroups respects sort option within group');
}

function testGetSortComparator() {
  const comparator = getSortComparator('name');
  const sorted = [...sampleCards].sort(comparator);
  assert(sorted[0].fullName === 'Anna - Friendly Face', 'getSortComparator(name) sorts alphabetically');
}

testResolveCardType();
testHasKeyword();
testFilterCards();
testMatchesFilters();
testGroupCardsByType();
testBuildDisplayGroups();
testGetSortComparator();

if (!process.exitCode) {
  console.log('🎉 All deck utility tests passed');
}


