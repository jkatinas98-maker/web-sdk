<script lang="ts">
	import './app.css';
	import { App } from 'pixi-svelte';
	import { getContext } from '../game/context';
	import { stateBet, stateUrlDerived } from 'state-shared';
	import config from '../game/config';
	import type { BetMode } from '../game/types';
	import type { BookEventOfType } from '../game/typesBookEvent';
	import { createMockBet } from '../game/mockBet';
	import { playBookEvents } from '../game/utils';
	import { playSound, setSoundEnabled } from '../game/sound';
	import { SYMBOL_COLORS } from '../game/symbolIcons';
	import type { SymbolName } from '../game/types';
	import EnableGameActor from './EnableGameActor.svelte';
	import Ticket from './Ticket.svelte';
	import Paytable from './Paytable.svelte';

	// Desktop's right-side paytable panel, highest prize first (plain DOM —
	// it sits behind an opaque glass panel, where the pixi-rendered strip
	// used on mobile would be hidden).
	const payEntries = (Object.entries(config.symbols) as [SymbolName, { mult: number }][])
		.filter(([, sym]) => sym.mult > 0)
		.sort((a, b) => b[1].mult - a[1].mult);

	const swatch = (name: SymbolName) => `#${SYMBOL_COLORS[name].fill.toString(16).padStart(6, '0')}`;

	const context = getContext();

	type ViewState = 'start' | 'playing' | 'revealed';

	let viewState: ViewState = $state('start');
	let isProcessing = $state(false);
	let betMode: BetMode = $state('easy');
	let betAmount = $state(1);
	let totalWin: number = $state(0);
	let showWinModal = $state(false);
	let winningSymbol: SymbolName | null = $state(null);
	// The RGS result (including the win amount) arrives the instant the bet
	// resolves, but the player hasn't scratched anything yet — hold it here
	// and only surface it once they've revealed every panel themselves.
	let pendingWin: number | null = $state(null);

	// Local demo wallet, used only while there's no RGS backend to talk to
	// (see playGame below) so the footer stat bar has something real to show
	// during dev. Once rgs_url is present, the real balance from stateBet
	// (populated by the actual wallet/play + wallet/end-round responses)
	// is shown instead.
	let mockBalance = $state(1000);
	let mockLastWin = $state(0);

	const isMockMode = !stateUrlDerived.rgsUrl();
	const displayBalance = $derived(isMockMode ? mockBalance : stateBet.balanceAmount);
	const displayLastWin = $derived(isMockMode ? mockLastWin : stateBet.winBookEventAmount);

	const BET_CHIPS = [1, 5, 10, 25];

	let soundOn = $state(true);
	function toggleSound() {
		soundOn = !soundOn;
		setSoundEnabled(soundOn);
		if (soundOn) playSound('click');
	}

	function setBetAmount(value: number) {
		betAmount = Math.max(0.1, Math.round(value * 100) / 100);
	}

	// Separate from setBetAmount so typing in the amount field doesn't fire a
	// click sound per keystroke — only the +/- and preset chip buttons do.
	function setBetAmountWithSound(value: number) {
		setBetAmount(value);
		playSound('click');
	}

	function selectMode(mode: BetMode) {
		betMode = mode;
		playSound('click');
	}

	// Desktop gets a 3-panel layout (controls | ticket | paytable) with fixed
	// side columns; mobile stacks everything vertically instead. Driven off
	// the same canvasSizes() the pixi canvas already reacts to, so the DOM
	// chrome and the card's own positioning never disagree about the layout.
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const isDesktop = $derived(canvas.width >= 760);

	const HEADER_H = 48;
	const FOOTER_H = 52;
	const SIDE_PANEL_W = 230;

	const topReserved = $derived(isDesktop ? HEADER_H + 20 : HEADER_H + 90);
	const bottomReserved = $derived(isDesktop ? FOOTER_H + 20 : FOOTER_H + 215);
	const leftReserved = $derived(isDesktop ? SIDE_PANEL_W : 0);
	const rightReserved = $derived(isDesktop ? SIDE_PANEL_W : 0);

	const statusText = $derived(
		viewState === 'playing'
			? 'SCRATCH TO REVEAL'
			: viewState === 'revealed'
				? totalWin > 0
					? `WINNER! ${(totalWin / betAmount).toFixed(1)}X`
					: 'NO MATCH — TRY AGAIN'
				: 'MATCH 3 SYMBOLS TO WIN',
	);

	function playGame() {
		if (isProcessing) return;
		if (isMockMode && mockBalance < betAmount) return;

		playSound('click');
		isProcessing = true;
		viewState = 'playing';
		totalWin = 0;
		showWinModal = false;
		winningSymbol = null;
		pendingWin = null;
		context.stateGameDerived.reset();

		stateBet.activeBetModeKey = betMode;
		stateBet.betAmount = betAmount;

		if (isMockMode) {
			mockBalance = Math.round((mockBalance - betAmount) * 100) / 100;
			playBookEvents(createMockBet(betMode, betAmount));
			return;
		}

		context.eventEmitter.broadcast({ type: 'bet' });
	}

	function revealPanel(index: number) {
		context.stateGameDerived.reveal(index);
	}

	function revealEverything() {
		playSound('click');
		// Stagger each panel's reveal instead of flipping them all in the same
		// frame — reuses the same per-index reveal() action a manual tap
		// uses, so each tile still gets its own pop-in + reveal sound, just
		// cascading left-to-right/top-to-bottom instead of all at once.
		const { panels, revealed } = context.stateGame;
		let delay = 0;
		for (let i = 0; i < panels.length; i++) {
			if (revealed.has(i)) continue;
			setTimeout(() => context.stateGameDerived.reveal(i), delay);
			delay += 45;
		}
	}

	// Once the player has scratched every panel, surface the result that was
	// already sitting in pendingWin.
	$effect(() => {
		const { panels, revealed } = context.stateGame;
		if (
			viewState === 'playing' &&
			pendingWin !== null &&
			panels.length > 0 &&
			revealed.size >= panels.length
		) {
			totalWin = pendingWin;
			viewState = 'revealed';
			isProcessing = false;
			if (isMockMode) {
				mockBalance = Math.round((mockBalance + totalWin) * 100) / 100;
				mockLastWin = totalWin;
			}
			if (totalWin > 0) {
				// Re-derive which symbol actually won from the resolved panels
				// and payout — the book doesn't carry a dedicated "winning
				// symbol" field, but matching totalWin back to a paytable
				// entry is unambiguous since every symbol's multiplier is
				// distinct.
				const match = (Object.entries(config.symbols) as [SymbolName, { mult: number }][]).find(
					([, sym]) => Math.abs(sym.mult * betAmount - totalWin) < 0.005,
				);
				winningSymbol = match ? match[0] : null;
				showWinModal = true;
				playSound('win');
			}
		}
	});

	context.eventEmitter.subscribeOnMount({
		finalWin: ({ data }: { data: BookEventOfType<'finalWin'> }) => {
			pendingWin = data.amount;
		},
	});
</script>

<div class="pixi-layer">
	<App>
		<EnableGameActor />
		{#if !isDesktop && viewState !== 'playing'}
			<Paytable x={canvas.width / 2} y={HEADER_H + 55} />
		{/if}
		<Ticket
			{betMode}
			top={topReserved}
			bottom={bottomReserved}
			left={leftReserved}
			right={rightReserved}
			interactive={viewState === 'playing'}
			{winningSymbol}
			onRevealIndex={revealPanel}
		/>
	</App>
</div>

<div class="ui-layer" class:desktop={isDesktop}>
	<!-- HEADER BAR -->
	<header class="header-bar">
		<span class="header-title">NEON ALCHEMY</span>
		<span class="header-status">{statusText}</span>
		<button class="sound-toggle" onclick={toggleSound} aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}>
			{soundOn ? '🔊' : '🔇'}
		</button>
	</header>

	{#if isDesktop}
		<!-- DESKTOP: fixed left controls panel -->
		<aside class="side-panel side-panel-left">
			<div class="side-panel-content">
				<div>
					<div class="panel-label-row">
						<span class="panel-label">Difficulty</span>
					</div>
					<div class="mode-select vertical">
						{#each Object.keys(config.betModes) as mode}
							<button class:selected={betMode === mode} disabled={viewState === 'playing'} onclick={() => selectMode(mode as BetMode)}>
								{mode} (max {config.betModes[mode as BetMode].max_win}x)
							</button>
						{/each}
					</div>
				</div>

				<div>
					<span class="panel-label">Bet amount</span>
					<div class="bet-row">
						<button class="chip-style wide" disabled={viewState === 'playing'} onclick={() => setBetAmountWithSound(betAmount / 2)}>÷2</button>
						<div class="bet-amount-wrap">
							<span class="cur">$</span>
							<input
								class="bet-amount-input"
								type="number"
								min="0.1"
								step="0.1"
								disabled={viewState === 'playing'}
								value={betAmount}
								oninput={(e) => setBetAmount(Number((e.target as HTMLInputElement).value) || 0.1)}
							/>
						</div>
						<button class="chip-style wide" disabled={viewState === 'playing'} onclick={() => setBetAmountWithSound(betAmount * 2)}>×2</button>
					</div>
					<div class="chip-row">
						{#each BET_CHIPS as chip}
							<button class="chip-style" disabled={viewState === 'playing'} onclick={() => setBetAmountWithSound(chip)}>${chip}</button>
						{/each}
					</div>
				</div>
			</div>

			<button class="play-style" onclick={playGame} disabled={isProcessing || viewState === 'playing'}>
				{viewState === 'start' ? `Play ($${betAmount.toFixed(2)})` : 'Bet again?'}
			</button>
		</aside>

		<!-- DESKTOP: fixed right paytable panel -->
		<aside class="side-panel side-panel-right">
			<div class="panel-label-row justify-center">
				<span class="panel-label">Paytable</span>
			</div>
			<div class="paytable-list">
				{#each payEntries as [name, sym] (name)}
					<div class="paytable-row">
						<span class="paytable-swatch" style="background:{swatch(name)}"></span>
						<span class="paytable-name">{name}</span>
						<span class="paytable-mult">×{sym.mult}</span>
					</div>
				{/each}
			</div>
			{#if viewState === 'playing'}
				<button class="reveal-all-style wide" onclick={revealEverything}>Reveal all</button>
			{/if}
		</aside>
	{:else}
		<!-- MOBILE: stacked bottom controls -->
		<div class="mobile-bottom">
			{#if viewState !== 'playing'}
				<div class="mode-select">
					{#each Object.keys(config.betModes) as mode}
						<button class:selected={betMode === mode} onclick={() => selectMode(mode as BetMode)}>
							{mode} (max {config.betModes[mode as BetMode].max_win}x)
						</button>
					{/each}
				</div>
			{/if}

			{#if viewState === 'playing'}
				<button class="reveal-all-style" onclick={revealEverything}>Reveal all</button>
			{/if}

			{#if viewState === 'start' || viewState === 'revealed'}
				<div class="bet-row">
					<button class="chip-style wide" onclick={() => setBetAmountWithSound(betAmount / 2)}>÷2</button>
					<div class="bet-amount-wrap">
						<span class="cur">$</span>
						<input
							class="bet-amount-input"
							type="number"
							min="0.1"
							step="0.1"
							value={betAmount}
							oninput={(e) => setBetAmount(Number((e.target as HTMLInputElement).value) || 0.1)}
						/>
					</div>
					<button class="chip-style wide" onclick={() => setBetAmountWithSound(betAmount * 2)}>×2</button>
				</div>
				<div class="chip-row">
					{#each BET_CHIPS as chip}
						<button class="chip-style" onclick={() => setBetAmountWithSound(chip)}>${chip}</button>
					{/each}
				</div>

				<button class="play-style" onclick={playGame} disabled={isProcessing}>
					{viewState === 'start' ? 'Play' : 'Bet again?'}
				</button>
			{/if}
		</div>
	{/if}

	<!-- FOOTER STAT BAR -->
	<footer class="footer-bar">
		<div class="footer-stat">
			<span class="footer-stat-label">Balance</span>
			<span class="footer-stat-value balance">${displayBalance.toFixed(2)}</span>
		</div>
		<div class="footer-stat">
			<span class="footer-stat-label">Last win</span>
			<span class="footer-stat-value win">${displayLastWin.toFixed(2)}</span>
		</div>
		<div class="footer-stat">
			<span class="footer-stat-label">Bet</span>
			<span class="footer-stat-value bet">${betAmount.toFixed(2)}</span>
		</div>
	</footer>
</div>

{#if showWinModal}
	<div
		class="win-backdrop"
		role="button"
		tabindex="0"
		onclick={() => (showWinModal = false)}
		onkeydown={(e) => e.key === 'Enter' && (showWinModal = false)}
	>
		<div class="win-modal">
			<div class="win-modal-title">You won!</div>
			<div class="win-modal-amount">${totalWin.toFixed(2)}</div>
			<div class="win-modal-mult">{(totalWin / betAmount).toFixed(1)}x</div>
			<div class="win-modal-hint">Tap anywhere to continue</div>
		</div>
	</div>
{/if}
