```markdown
**Build a mini Lorcana sealed draft selection app**

**Goal**
Create a web app that simulates my sealed draft flow and outputs my final picks as copy-ready lines in the format:
`{{numberOfThisCard}} - {{fullName}} - {{color}}`  
(one line per unique card, sorted by highest count, then by `fullName` A–Z).

**Tech**
- Vite + React + TypeScript
- Tailwind CSS
- No backend; all state in browser (localStorage)
- One page app with clean, mobile-friendly UI

**Data**
- The card data file will be named **setdata.10.json** and shaped like:
```json
{
  "cards": [
    {
      "id": 2190,
      "fullName": "Baloo - Friend and Guardian",
      "name": "Baloo",
      "version": "Friend and Guardian",
      "color": "Amber",
      "code": "zk",
      "number": 1,
      "type": "Character",
      "rarity": "Rare",
      "images": {
        "thumbnail": "…",
        "full": "https://api.lorcana.ravensburger.com/images/en/set10/1_cb1a0b5d95157e7641ce5e77b22e824bbca3981a.jpg",
        "foilMask": "…"
      },
      "fullText": "…",
      "keywordAbilities": ["Bodyguard","Support"],
      "cost": 6,
      "lore": 2,
      "strength": 3,
      "willpower": 8
    }
  ]
}
```
- Use only fields you need: at minimum `id`, `fullName`, `color`, and `images.full` for the card art.

**Images**
- For card tiles, display the image from `images.full` (a JPG URL like `https://api.lorcana.ravensburger.com/images/en/set10/2_578e7dda619dc0479e37b3cb09c5ecf37b15a79a.jpg`). 
- If `images.full` is missing, fall back to a text-only tile.

**Draft Rules (must match exactly)**
- 6 rounds total.
- Each round has 6 booster packs.
- Each booster pack begins with 12 cards sampled *without replacement* from the master `cards` list.
- Each round has 12 turns. On turn `t` (1..12):
  1) I pick **1** card from **Booster Pack #k**, where `k = ((t-1) % 6) + 1` (i.e., Turn 1 → Pack 1, Turn 2 → Pack 2, … Turn 6 → Pack 6, Turn 7 → Pack 1, etc.).
  2) Immediately after my pick, randomly remove **1** card from **every other** non-empty pack in that round.
- After 12 turns, all 6 packs must be empty.
- Then start the next round and repeat.
- After all 6 rounds, show the final tally list (spec below) and a “Copy All” button.

**Determinism / Seed**
- **Remove** any seed/replay functionality. Do **not** expose a seed input and do **not** implement a seeded PRNG. Use the platform default randomness (e.g., `Math.random()`), and it’s okay if a draft cannot be replayed identically.

**UI**
Top bar:
- “Load Cards” section: file input that expects **setdata.10.json** and a textarea alternative with “Parse JSON.”
- “New Draft” button (disabled until cards are loaded).
- “Resume Last Draft” button (if saved state exists in localStorage).

Main panel (when drafting):
- Header: `Round X of 6 — Turn Y of 12 — Picking from Pack #K`
- Six pack columns (responsive grid). Highlight the active pack. Each pack shows current remaining card count.
- Active pack shows a card grid with:
  - Card tile: image (`images.full`) above, then `fullName`, `color`, and a small “Pick” button.
- Under the packs: a compact log like “Turn 5: Picked Gaston — Amber. Removed 1 from all other packs.”
- Buttons: “Undo Last Pick” (one-step undo across turn), “Reset Round” (confirm), “Reset Draft” (confirm).

Results panel (after 6 rounds complete):
- Table of unique picks with:
  - Count | fullName | color
- “Copy All Lines” button. Copy payload must be a newline-separated list exactly like:
  ```
  3 - Gaston - Amber
  2 - Baloo - Amber
  1 - {NextCard} - {Color}
  ```
- Also show total cards picked.

**Types**
```ts
type Card = {
  id: number | string;
  fullName: string;
  color: string;
  images?: { full?: string };
};

type Pack = {
  id: string;              // e.g., "R1P1"
  cards: Card[];           // remaining cards
  removedLog: number[];    // indexes/ids removed by randomness (optional debug)
};

type RoundState = {
  roundNumber: number;     // 1..6
  packs: Pack[];           // length = 6
  turn: number;            // 1..12
};

type PickLogEntry = {
  round: number;
  turn: number;
  packIndex: number;       // 0..5
  picked: Card;
  removedCounts: number;   // how many cards randomly removed across other packs this turn
};

type DraftState = {
  masterCards: Card[];
  rounds: RoundState[];    // current/active round is last element
  currentRound: number;    // 1..6
  currentTurn: number;     // 1..12 (within current round)
  picks: Card[];           // all picks across all rounds
  log: PickLogEntry[];
  isComplete: boolean;
};
```

**Algorithm**
1) **Load cards**: accept JSON from file input (prefer **setdata.10.json**) or textarea, validate `cards` array and minimal fields.
2) **New Draft**:
   - Build Round 1:
     - For each of 6 packs: draw 12 distinct cards from `masterCards` using randomness (sample without replacement). Cards may repeat across packs if you sample *with replacement at deck level*—make it a parameter. Default: sample *with* replacement across packs, *without* within a pack.
   - Set `currentRound=1`, `currentTurn=1`.
3) **On each turn**:
   - Determine `packIndex = (currentTurn-1) % 6`.
   - Show that pack’s remaining cards.
   - When I click “Pick” on a card:
     - Remove that card from the active pack.
     - For every other pack that still has ≥1 card, randomly remove exactly 1 card.
     - Append to `picks` and `log`.
     - Increment `currentTurn`. If `currentTurn > 12`:
       - Mark round complete. Assert all packs are empty.
       - If `currentRound < 6`, construct the next round’s 6 packs the same way and set `currentRound++`, `currentTurn=1`.
       - Else set `isComplete=true` and show the Results panel.
   - Save `DraftState` to localStorage after every pick.
4) **Undo Last Pick**:
   - Rewind one `PickLogEntry`:
     - Put the picked card back into its pack at a sensible place (end).
     - Restore 1 randomly removed card to each affected pack by restoring from an undo buffer captured every turn (store the exact removed `Card` ids). Keep this simple: record the snapshot of all packs before each turn and restore it.
5) **Copy All Lines**:
   - Build a frequency map by `fullName + color`.
   - Sort by count desc, then `fullName` asc.
   - Join into newline-separated string and write to clipboard.
   - Show “Copied!” toast.

**Components**
- `CardLoader`: file input (expects **setdata.10.json**) + textarea; returns `Card[]`.
- `DraftBoard`: shows 6 packs, active pack contents (with `images.full`), and pick actions.
- `PackView`: pack header + remaining count + grid of cards (buttons to pick).
- `TurnLog`: rolling text list.
- `ResultsTable`: summary + Copy button.
- `Toast` (simple).

**Utilities**
- `randomInt(n: number)`: returns an integer in `[0,n)` using `Math.random()`.
- `sampleWithoutReplacement<T>(arr, k)`.
- `shuffle<T>(arr)`.
- `deepClone<T>(x)`.
- `saveState(state) / loadState() / clearState()` (localStorage key: `lorcana-sealed-v2`).

**Edge Cases**
- Prevent picking when active pack is empty (shouldn’t happen if logic is correct).
- If a pack has 0 when removing from “other packs,” just skip that pack.
- Validate that after 12 turns of a round, all packs are 0.
- If JSON is invalid, show friendly error.
- Large card pools: render virtualized grid if >200 visible (optional).

**Styling**
- Tailwind; simple, high-contrast; focus states on buttons; responsive grid 1–2 cols on mobile, 3–6 on desktop.
- Card tile: image (object-cover, rounded-lg, shadow), name and color below.

**Testing hooks (simple)**
- A “Quick Sim” button (dev-only) to auto-pick the first card each turn to finish a full draft quickly and verify counts.

**Deliverables**
- `index.html`, `src/main.tsx`, `src/App.tsx`
- `src/components/*` per above
- `src/lib/random.ts`, `src/lib/draft.ts`, `src/lib/storage.ts`
- `tailwind` configured
- The app should run with `pnpm i && pnpm dev`

**Acceptance Criteria**
- I can load **setdata.10.json**, start a new draft, and proceed through 6 rounds × 12 turns with the exact pick/remove pattern.
- During drafting, each card tile shows the art from `images.full` when available.
- After finishing, I see a table of unique cards with counts and a working “Copy All Lines” button producing the specified newline format.
- Reloading the page lets me resume the in-progress draft.

---

**Jargon, briefly explained (for clarity)**
- *Sample without replacement*: once a card is drawn from a pack, it isn’t drawn again from that same pack.
```