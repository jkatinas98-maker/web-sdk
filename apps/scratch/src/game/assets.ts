import type { SymbolName } from './types';

// Final illustrated symbol art (transparent, square-padded PNGs) — one file
// per symbol id, under apps/scratch/assets/symbols/<id>.png.
//
// Pulled in through Vite's import.meta.glob (eager, as URLs) rather than
// `new URL(path, import.meta.url)`: the glob is a real module import, so
// Vite resolves/serves it correctly in `dev` and fingerprints or inlines it
// in `build` (assetsInlineLimit is Infinity in config-vite, so production
// gets data: URIs — no extra requests, and no absolute paths that would
// break when Stake Engine serves the game from a sub-path).
const files = import.meta.glob('../../assets/symbols/*.png', {
	eager: true,
	query: '?url',
	import: 'default',
}) as Record<string, string>;

const urlFor = (name: SymbolName): string => {
	const url = files[`../../assets/symbols/${name}.png`];
	if (!url) console.error(`Missing symbol art: assets/symbols/${name}.png`);
	return url;
};

const SYMBOL_NAMES: SymbolName[] = [
	'skull',
	'bonus',
	'key',
	'mult1_5',
	'mult2',
	'mult4',
	'mult5',
	'mult6',
	'mult9',
	'mult16',
	'mult36',
	'mult41',
	'mult45',
	'mult110',
	'mult130',
	'mult1000',
];

// Same URL feeds both the Pixi sprite (via stateApp's asset loader) and the
// DOM paytable <img>, so there's exactly one source of truth per symbol.
export const SYMBOL_IMAGE_URL = Object.fromEntries(
	SYMBOL_NAMES.map((name) => [name, urlFor(name)]),
) as Record<SymbolName, string>;

export const symbolAssetKey = (name: SymbolName) => `symbol_${name}`;

// Preloaded so every sprite has its texture before the grid first renders
// (no empty-texture flash, no "key not found" console noise). Pixi detects
// the format either from the .png extension (dev) or the data:image/png
// mime prefix (inlined production build).
export default Object.fromEntries(
	SYMBOL_NAMES.map((name) => [
		symbolAssetKey(name),
		{ type: 'sprite' as const, src: SYMBOL_IMAGE_URL[name], preload: true },
	]),
);
