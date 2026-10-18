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
	// The RGS result (including the win amount) arrives the instant the bet
	// resolves, but the player hasn't scratched anything yet — hold it here
	// and only surface it once they've revealed every panel themselves.
	let pendingWin: number | null = $state(null);

	const BET_CHIPS = [1, 5, 10, 25];

	function setBetAmount(value: number) {
		betAmount = Math.max(0.1, Math.round(value * 100) / 100);
	}

	// Space (in px) reserved above/below the pixi ticket canvas for the DOM
	// overlay (difficulty picker + bet controls) — Ticket.svelte uses these
	// to fit the grid between them instead of overlapping.
	const TOP_RESERVED = 150;
	const BOTTOM_RESERVED = 150;

	function playGame() {
		if (isProcessing) return;

		isProcessing = true;
		viewState = 'playing';
		totalWin = 0;
		showWinModal = false;
		pendingWin = null;
		context.stateGameDerived.reset();

		stateBet.activeBetModeKey = betMode;
		stateBet.betAmount = betAmount;

		// No RGS backend to talk to during plain local dev (no rgs_url query
		// param, e.g. opening localhost directly instead of through Stake
		// Engine's platform or a local math-sdk RGS mock server) — fall back
		// to a locally-generated ticket so the UI can still be tested.
		if (!stateUrlDerived.rgsUrl()) {
			playBookEvents(createMockBet(betMode, betAmount));
			return;
		}

		context.eventEmitter.broadcast({ type: 'bet' });
	}

	function revealPanel(index: number) {
		context.stateGameDerived.reveal(index);
	}

	function revealEverything() {
		context.stateGameDerived.revealAll();
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
			if (totalWin > 0) showWinModal = true;
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
			top={TOP_RESERVED}
			bottom={BOTTOM_RESERVED}
			interactive={viewState === 'playing'}
			onRevealIndex={revealPanel}
		/>
	</App>
</div>

<div class="ui-layer">
	<div class="ui-top">
		{#if viewState !== 'playing'}
			<div class="mode-select">
				{#each Object.keys(config.betModes) as mode}
					<button class:selected={betMode === mode} onclick={() => (betMode = mode as BetMode)}>
						{mode} (max {config.betModes[mode as BetMode].max_win}x)
					</button>
				{/each}
			</div>
		{/if}

		{#if viewState === 'playing'}
			<button class="reveal-all-style" onclick={revealEverything}>Reveal all</button>
		{/if}
	</div>

	<div class="ui-bottom">
		{#if viewState === 'revealed' && totalWin === 0}
			<h2>No win this time</h2>
		{/if}

		{#if viewState === 'start' || viewState === 'revealed'}
			<div class="bet-row">
				<button class="chip-style" onclick={() => setBetAmount(betAmount - 1)}>−</button>
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
				<button class="chip-style" onclick={() => setBetAmount(betAmount + 1)}>+</button>
			</div>
			<div class="chip-row">
				{#each BET_CHIPS as chip}
					<button class="chip-style" onclick={() => setBetAmount(chip)}>${chip}</button>
				{/each}
			</div>

			<button class="play-style" onclick={playGame} disabled={isProcessing}>
				{viewState === 'start' ? 'Play' : 'Bet again?'}
			</button>
		{/if}
	</div>
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
