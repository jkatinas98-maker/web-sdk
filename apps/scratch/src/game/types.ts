import type config from './config';

export type SymbolName = keyof typeof config.symbols;
export type RawSymbol = {
	name: SymbolName;
	multiplier?: number;
	scatter?: boolean;
	wild?: boolean;
};
export type BetMode = keyof typeof config.betModes;
export type GameType = keyof typeof config.paddingReels;

// Panel index within the flat scratch grid (row-major: index = row * cols + col).
export type PanelPosition = number;
