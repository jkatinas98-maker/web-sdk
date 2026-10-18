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
	let totalWin: number = $state(0);
	// The RGS result (including the win amount) arrives the instant the bet
	// resolves, but the player hasn't scratched anything yet — hold it here
	// and only surface it once they've revealed every panel themselves.
	let pendingWin: number | null = $state(null);

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
		pendingWin = null;
		context.stateGameDerived.reset();

		stateBet.activeBetModeKey = betMode;

		// No RGS backend to talk to during plain local dev (no rgs_url query
		// param, e.g. opening localhost directly instead of through Stake
		// Engine's platform or a local math-sdk RGS mock server) — fall back
		// to a locally-generated ticket so the UI can still be tested.
		if (!stateUrlDerived.rgsUrl()) {
			playBookEvents(createMockBet(betMode));
			return;
		}

		context.eventEmitter.broadcast({ type: 'bet' });
	}

	function revealPanel(index: number) {
		context.stateGameDerived.reveal(index);
	}

	// Once the player has scratched every panel, surface the result that was
	// already sitting in pendingWin.
	$effect(() => {
		const { panels, revealedCount } = context.stateGame;
		if (
			viewState === 'playing' &&
			pendingWin !== null &&
			panels.length > 0 &&
			revealedCount >= panels.length
		) {
			totalWin = pendingWin;
			viewState = 'revealed';
			isProcessing = false;
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
		{#if viewState === 'start'}
			<div class="mode-select">
				{#each Object.keys(config.betModes) as mode}
					<button class:selected={betMode === mode} onclick={() => (betMode = mode as BetMode)}>
						{mode} (max {config.betModes[mode as BetMode].max_win}x)
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="ui-bottom">
		{#if viewState === 'revealed'}
			<h2>{totalWin > 0 ? `You won ${totalWin}x!` : 'No win this time'}</h2>
		{/if}

		{#if viewState === 'start' || viewState === 'revealed'}
			<button class="play-style" onclick={playGame} disabled={isProcessing}>
				{viewState === 'start' ? 'Play' : 'Bet again?'}
			</button>
		{/if}
	</div>
</div>
