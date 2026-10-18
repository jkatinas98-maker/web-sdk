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
	import { SYMBOL_EMOJI, SYMBOL_LABEL } from '../game/symbolIcons';
	import type { SymbolName } from '../game/types';
	import EnableGameActor from './EnableGameActor.svelte';
	import Ticket from './Ticket.svelte';

	const context = getContext();

	type ViewState = 'start' | 'playing' | 'revealed';

	let viewState: ViewState = $state('start');
	let isProcessing = $state(false);
	let betMode: BetMode = $state('easy');
	let betAmount = $state(1);
	let totalWin: number = $state(0);
	let showWinModal = $state(false);
	let showPaytable = $state(false);
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

	const MIN_BET = 0.5;
	const BET_STEP = 0.5;

	let soundOn = $state(true);
	function toggleSound() {
		soundOn = !soundOn;
		setSoundEnabled(soundOn);
		if (soundOn) playSound('click');
	}

	function setBetAmount(value: number) {
		const maxBet = Math.min(100, displayBalance || 100);
		betAmount = Math.min(maxBet, Math.max(MIN_BET, Math.round(value * 100) / 100));
		playSound('click');
	}

	function selectMode(mode: BetMode) {
		if (mode === betMode) return;
		betMode = mode;
		playSound('click');
		// Clear the previous round's panels — otherwise the last mode's
		// (wrong-sized, wrong-symbol-set) grid stays on screen, stale, until
		// the next bet is placed. The difficulty buttons are disabled while
		// viewState === 'playing' so this never interrupts a live round.
		viewState = 'start';
		totalWin = 0;
		showWinModal = false;
		winningSymbol = null;
		pendingWin = null;
		context.stateGameDerived.reset();
	}

	function togglePaytable() {
		playSound('click');
		showPaytable = !showPaytable;
	}

	// Single-column mobile layout, always — no separate desktop panels. The
	// board frame (ticket) fills whatever space is left between the header
	// pill/banner at the top and the controls stack + footer bar at the
	// bottom, same as the reference layout.
	const HEADER_H = 64;
	const FOOTER_H = 52;
	// Difficulty row + bet stepper (amount line + quick-button line) + play
	// button, each an .option-card with its own padding/gap — taller than it
	// looks added up in a glance, so this is measured against the actual
	// rendered controls-stack height rather than guessed.
	const CONTROLS_H = 238;

	const topReserved = HEADER_H + 10;
	const bottomReserved = FOOTER_H + CONTROLS_H;

	const maxWin = $derived(config.betModes[betMode].max_win);

	// Paytable modal list for the CURRENT difficulty only — each mode has
	// its own fully distinct 6 symbols/mults now, so this can't be a single
	// shared list anymore, it has to follow betMode.
	const payEntries = $derived(
		(config.betModes[betMode].symbols as SymbolName[])
			.map((name) => [name, config.symbols[name]] as [SymbolName, { mult: number }])
			.sort((a, b) => b[1].mult - a[1].mult),
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

	// One main action button, like the reference: it plays a round while
	// idle/done, and becomes "Reveal all" while a round is in progress.
	function handleMainAction() {
		if (viewState === 'playing') {
			revealEverything();
		} else {
			playGame();
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
				// Re-derive which symbol actually won by scanning the resolved
				// panels for the first paying symbol to reach 3 occurrences —
				// the same rule the book itself resolves by. (Matching
				// totalWin back against a paytable entry instead would be
				// ambiguous: several ids are shared across difficulties, e.g.
				// mult2 is "2x" in every mode, so a win amount alone can't
				// tell you which actual symbol hit.)
				const counts: Partial<Record<SymbolName, number>> = {};
				let winner: SymbolName | null = null;
				for (const panel of panels) {
					if (!panel || config.symbols[panel.name].mult <= 0) continue;
					counts[panel.name] = (counts[panel.name] ?? 0) + 1;
					if (!winner && counts[panel.name]! >= 3) winner = panel.name;
				}
				winningSymbol = winner;
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
		<Ticket
			{betMode}
			top={topReserved}
			bottom={bottomReserved}
			interactive={viewState === 'playing'}
			{winningSymbol}
			onRevealIndex={revealPanel}
		/>
	</App>
</div>

<div class="ui-layer">
	<!-- HEADER: logo pill + max-win banner, centered -->
	<header class="header-bar">
		<div class="logo-pill">
			<span class="logo-emoji">😜</span>
			<span class="logo-title">Emoji Scratch</span>
		</div>
		<div class="max-win-banner">Win up to {maxWin}x bet</div>
		<button class="sound-toggle" onclick={toggleSound} aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}>
			{soundOn ? '🔊' : '🔇'}
		</button>
	</header>

	<!-- CONTROLS STACK (above the footer bar) -->
	<div class="controls-stack">
		<div class="option-card">
			<span class="option-title">Difficulty</span>
			<div class="diff-row">
				{#each Object.keys(config.betModes) as mode}
					{@const m = config.betModes[mode as BetMode]}
					<button
						class="diff-btn"
						class:active={betMode === mode}
						disabled={viewState === 'playing'}
						onclick={() => selectMode(mode as BetMode)}
					>
						{mode} ({m.rows}x{m.cols})
					</button>
				{/each}
			</div>
		</div>

		<div class="option-card">
			<span class="option-title">Bet amount</span>
			<div class="bet-stepper">
				<button class="step-btn" disabled={viewState === 'playing'} onclick={() => setBetAmount(betAmount - BET_STEP)}>−</button>
				<div class="bet-display">${betAmount.toFixed(2)}</div>
				<button class="step-btn" disabled={viewState === 'playing'} onclick={() => setBetAmount(betAmount + BET_STEP)}>+</button>
				<div class="quick-row">
					<button class="q-btn" disabled={viewState === 'playing'} onclick={() => setBetAmount(betAmount / 2)}>½</button>
					<button class="q-btn" disabled={viewState === 'playing'} onclick={() => setBetAmount(betAmount * 2)}>2×</button>
					<button class="q-btn" disabled={viewState === 'playing'} onclick={() => setBetAmount(MIN_BET)}>Min</button>
					<button class="q-btn" disabled={viewState === 'playing'} onclick={() => setBetAmount(100)}>Max</button>
				</div>
			</div>
		</div>

		<button
			class="main-btn"
			class:reveal-mode={viewState === 'playing'}
			onclick={handleMainAction}
			disabled={viewState !== 'playing' && isProcessing}
		>
			{viewState === 'playing' ? 'Reveal all' : `Buy card ($${betAmount.toFixed(2)})`}
		</button>
	</div>

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
		<div class="icon-actions">
			<button class="icon-btn" onclick={togglePaytable} aria-label="Paytable">ℹ️</button>
		</div>
	</footer>
</div>

{#if showPaytable}
	<div
		class="paytable-backdrop"
		role="button"
		tabindex="0"
		onclick={togglePaytable}
		onkeydown={(e) => e.key === 'Enter' && togglePaytable()}
	>
		<div class="paytable-modal" role="dialog" onclick={(e) => e.stopPropagation()}>
			<div class="paytable-modal-header">
				<span class="paytable-modal-title">Emoji paytable</span>
				<button class="close-btn" onclick={togglePaytable} aria-label="Close">✕</button>
			</div>
			<div class="paytable-modal-list">
				{#each payEntries as [name, sym] (name)}
					<div class="pay-item">
						<span class="pay-item-icon">{SYMBOL_EMOJI[name]}</span>
						<span class="pay-item-name">{SYMBOL_LABEL[name]}</span>
						<span class="pay-item-mult">×{sym.mult}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

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
