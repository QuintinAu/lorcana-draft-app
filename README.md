# Lorcana Sealed Draft App

A web app for simulating Lorcana sealed draft with a clean, modern dark UI.

## Features

- Load card data from setdata.10.json or paste JSON directly
- Simulate 6 rounds of sealed draft with 6 packs per round
- Pick cards with automatic removal from other packs
- View pick history and final tally
- Copy results in standardized format
- Resume drafts from localStorage
- Undo, reset round, and reset draft functionality
- Quick Sim for testing (auto-completes draft)

## Tech Stack

- Vite + React + TypeScript 3.9.10
- Tailwind CSS v4.1
- No backend - all state in localStorage

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the dev server:
```bash
npm run dev
```

3. Load your setdata.10.json file or paste the JSON data

4. Click "New Draft" to begin!

## Draft Rules

- 6 rounds total, 6 packs per round, 12 cards per pack
- 12 turns per round
- Each turn: pick 1 card from the active pack, then 1 card is randomly removed from each other non-empty pack
- Active pack rotates: Turn 1-6 → Packs 1-6, Turn 7-12 → Packs 1-6 again
- After all rounds complete, view your final picks sorted by count

## Output Format

The "Copy All Lines" button produces text like:
```
3 - Gaston - Amber
2 - Baloo - Amber
1 - Mickey Mouse - Steel
```

Sorted by count (descending), then card name (ascending).

