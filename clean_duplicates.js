import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rarity hierarchy (lowest to highest)
const RARITY_ORDER = {
  'Common': 1,
  'Uncommon': 2,
  'Rare': 3,
  'Super Rare': 4,
  'Legendary': 5
};

function getRarityValue(rarity) {
  return RARITY_ORDER[rarity] || 999; // Unknown rarities go to the end
}

function compareRarity(rarity1, rarity2) {
  return getRarityValue(rarity1) - getRarityValue(rarity2);
}

// Read the JSON file
const inputPath = path.join(__dirname, 'setdata.10.json');
const outputPath = path.join(__dirname, 'setdata.10.cleaned.json');

console.log('Reading setdata.10.json...');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

if (!data.cards || !Array.isArray(data.cards)) {
  throw new Error('Invalid JSON format: missing cards array');
}

console.log(`Processing ${data.cards.length} cards...`);

// Group cards by fullName
const cardsByFullName = new Map();

data.cards.forEach((card, index) => {
  const fullName = card.fullName;
  if (!fullName) {
    console.warn(`Card at index ${index} missing fullName, skipping`);
    return;
  }
  
  if (!cardsByFullName.has(fullName)) {
    cardsByFullName.set(fullName, []);
  }
  cardsByFullName.get(fullName).push({ card, index });
});

// Find duplicates and mark them
let duplicateCount = 0;
const processedCards = data.cards.map(card => ({ ...card }));

cardsByFullName.forEach((cardEntries, fullName) => {
  if (cardEntries.length > 1) {
    duplicateCount++;
    console.log(`Found ${cardEntries.length} duplicates for: ${fullName}`);
    
    // Sort by rarity (lower rarity first)
    cardEntries.sort((a, b) => {
      const rarityA = a.card.rarity || 'Common';
      const rarityB = b.card.rarity || 'Common';
      return compareRarity(rarityA, rarityB);
    });
    
    // Mark the first one (lowest rarity) as baseCard: true
    const baseCardIndex = cardEntries[0].index;
    processedCards[baseCardIndex].baseCard = true;
    console.log(`  - Index ${baseCardIndex}: ${cardEntries[0].card.rarity} -> baseCard: true`);
    
    // Mark all others as baseCard: false
    for (let i = 1; i < cardEntries.length; i++) {
      const otherIndex = cardEntries[i].index;
      processedCards[otherIndex].baseCard = false;
      console.log(`  - Index ${otherIndex}: ${cardEntries[i].card.rarity} -> baseCard: false`);
    }
  } else {
    // Single card - mark as baseCard: true (no duplicates)
    const index = cardEntries[0].index;
    processedCards[index].baseCard = true;
  }
});

// Create the cleaned data structure
const cleanedData = {
  ...data,
  cards: processedCards
};

// Write the cleaned JSON file
console.log(`\nWriting cleaned data to ${outputPath}...`);
fs.writeFileSync(outputPath, JSON.stringify(cleanedData, null, 2), 'utf8');

console.log(`\nDone!`);
console.log(`- Total cards: ${data.cards.length}`);
console.log(`- Unique fullNames: ${cardsByFullName.size}`);
console.log(`- Duplicate groups found: ${duplicateCount}`);
console.log(`- Output written to: ${outputPath}`);

