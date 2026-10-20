import type { SymbolName } from './types';

// Final illustrated symbol art (transparent, square-padded PNGs) — one file
// per symbol id, under apps/scratch/assets/symbols/<id>.png. The same URL
// feeds both the Pixi sprite (via stateApp's asset loader) and the DOM
// paytable <img>, so there's exactly one source of truth per symbol.
export const SYMBOL_IMAGE_URL: Record<SymbolName, string> = {
	skull: new URL('../../assets/symbols/skull.png', import.meta.url).href,
	bonus: new URL('../../assets/symbols/bonus.png', import.meta.url).href,
	key: new URL('../../assets/symbols/key.png', import.meta.url).href,
	mult1_5: new URL('../../assets/symbols/mult1_5.png', import.meta.url).href,
	mult2: new URL('../../assets/symbols/mult2.png', import.meta.url).href,
	mult4: new URL('../../assets/symbols/mult4.png', import.meta.url).href,
	mult5: new URL('../../assets/symbols/mult5.png', import.meta.url).href,
	mult6: new URL('../../assets/symbols/mult6.png', import.meta.url).href,
	mult9: new URL('../../assets/symbols/mult9.png', import.meta.url).href,
	mult16: new URL('../../assets/symbols/mult16.png', import.meta.url).href,
	mult36: new URL('../../assets/symbols/mult36.png', import.meta.url).href,
	mult41: new URL('../../assets/symbols/mult41.png', import.meta.url).href,
	mult45: new URL('../../assets/symbols/mult45.png', import.meta.url).href,
	mult110: new URL('../../assets/symbols/mult110.png', import.meta.url).href,
	mult130: new URL('../../assets/symbols/mult130.png', import.meta.url).href,
	mult1000: new URL('../../assets/symbols/mult1000.png', import.meta.url).href,
};

export const symbolAssetKey = (name: SymbolName) => `symbol_${name}`;

// Preloaded so every sprite has its texture before the grid first renders
// (no empty-texture flash, no "key not found" console noise).
export default Object.fromEntries(
	(Object.keys(SYMBOL_IMAGE_URL) as SymbolName[]).map((name) => [
		symbolAssetKey(name),
		{ type: 'sprite' as const, src: SYMBOL_IMAGE_URL[name], preload: true },
	]),
);
