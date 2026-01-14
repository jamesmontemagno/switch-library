/**
 * Manual test cases for game comparison utilities
 * Run with: node --loader ts-node/esm src/utils/gameComparison.test.ts
 * Or simply verify logic by reading the test cases
 */

import { normalizeGameTitle, gamesMatch } from './gameComparison';

// Test cases demonstrating the improved matching
const testCases = [
  {
    description: 'Exact ID match should work',
    game1: { id: 123, normalizedTitle: normalizeGameTitle('Super Mario Bros') },
    game2: { id: 123, normalizedTitle: normalizeGameTitle('Super Mario Brothers') },
    expectedMatch: true,
  },
  {
    description: 'Exact title match with different IDs',
    game1: { id: 123, normalizedTitle: normalizeGameTitle('Captain Toad: Treasure Tracker') },
    game2: { id: 456, normalizedTitle: normalizeGameTitle('Captain Toad: Treasure Tracker') },
    expectedMatch: true, // Title matches even with different IDs (handles different sources)
  },
  {
    description: 'Title match without IDs',
    game1: { normalizedTitle: normalizeGameTitle('Captain Toad: Treasure Tracker') },
    game2: { normalizedTitle: normalizeGameTitle('Captain Toad: Treasure Tracker') },
    expectedMatch: true,
  },
  {
    description: 'Title match with punctuation variations',
    game1: { normalizedTitle: normalizeGameTitle('Captain Toad: Treasure Tracker') },
    game2: { normalizedTitle: normalizeGameTitle('Captain Toad Treasure Tracker') },
    expectedMatch: true,
  },
  {
    description: 'Title match with trademark symbols',
    game1: { normalizedTitle: normalizeGameTitle('Mario Kart™ 8 Deluxe') },
    game2: { normalizedTitle: normalizeGameTitle('Mario Kart 8 Deluxe') },
    expectedMatch: true,
  },
  {
    description: 'Title match with different punctuation',
    game1: { normalizedTitle: normalizeGameTitle('Super Mario Bros.') },
    game2: { normalizedTitle: normalizeGameTitle('Super Mario Bros') },
    expectedMatch: true,
  },
  {
    description: 'Title match with special characters',
    game1: { normalizedTitle: normalizeGameTitle('Prince of Persia: The Lost Crown') },
    game2: { normalizedTitle: normalizeGameTitle('Prince of Persia - The Lost Crown') },
    expectedMatch: true,
  },
  {
    description: 'Different games should not match',
    game1: { normalizedTitle: normalizeGameTitle('Metroid Prime') },
    game2: { normalizedTitle: normalizeGameTitle('Metroid Dread') },
    expectedMatch: false,
  },
];

// Run tests
console.log('=== Game Comparison Test Cases ===\n');

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = gamesMatch(testCase.game1, testCase.game2);
  const success = result === testCase.expectedMatch;
  
  if (success) {
    passed++;
    console.log(`✓ ${testCase.description}`);
  } else {
    failed++;
    console.log(`✗ ${testCase.description}`);
    console.log(`  Expected: ${testCase.expectedMatch}, Got: ${result}`);
    console.log(`  Game1: ${JSON.stringify(testCase.game1)}`);
    console.log(`  Game2: ${JSON.stringify(testCase.game2)}`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

// Demonstrate normalization
console.log('\n=== Title Normalization Examples ===\n');
const titles = [
  'Super Mario Bros.',
  'Captain Toad: Treasure Tracker',
  'Mario Kart™ 8 Deluxe',
  'Prince of Persia: The Lost Crown',
  'The Legend of Zelda: Breath of the Wild',
  'Metroid Prime™ Remastered',
];

for (const title of titles) {
  console.log(`"${title}"`);
  console.log(`  → "${normalizeGameTitle(title)}"\n`);
}
