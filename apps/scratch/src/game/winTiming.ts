// Shared timing for the win reveal so the tiles (Cell.svelte) and the tally
// pill (Game.svelte) stay in step:
//   the 3 matching tiles tick in MATCH_GAP_MS apart (silver/blue),
//   then each extra tile (4th, 5th, ...) bursts EXTRA_GAP_MS apart (gold).
export const MATCH_GAP_MS = 260;
export const MATCH_DONE_MS = 150 + 2 * MATCH_GAP_MS + 200;
export const EXTRA_START_MS = MATCH_DONE_MS + 450;
export const EXTRA_GAP_MS = 550;
