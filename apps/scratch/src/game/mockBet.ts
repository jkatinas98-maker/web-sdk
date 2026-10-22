// DEV-ONLY: without an rgs_url there's no backend, so the local demo makes
// its own round books with the exact same rules as the certified math
// (see rules.ts / math-sdk games/scratch/rules.py). The real game plays
// books from the RGS through the same code path.
export * from './rules';
export { playRound as createMockRound } from './rules';
