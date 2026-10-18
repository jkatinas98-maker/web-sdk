<script lang="ts">
	import './app.css';
	import { getContext } from '../game/context';
	import { stateBet } from 'state-shared';
	import config from '../game/config';
	import type { BetMode } from '../game/types';
	import type { BookEventOfType } from '../game/typesBookEvent';
	import EnableGameActor from './EnableGameActor.svelte';

	const context = getContext();

	type ViewState = 'start' | 'playing' | 'revealed';

	let viewState: ViewState = 'start';
	let isProcessing = false;
	let betMode: BetMode = 'easy';
	let totalWin: number = 0;

	// placeholder scratch-ticket grid: this renders the panels as plain DOM
	// cells (name + multiplier) so the scaffold builds and plays end-to-end.
	// The real pixi ticket/foil-scratch visuals (see gem-scratch.html) come
	// in a follow-up pass.
	function playGame() {
		if (isProcessing) return;

		isProcessing = true;
		viewState = 'playing';
		totalWin = 0;
		context.stateGameDerived.reset();

		stateBet.activeBetModeKey = betMode;
		context.eventEmitter.broadcast({ type: 'bet' });
	}

	function revealPanel(index: number) {
		context.stateGameDerived.reveal(index);
	}

	function revealAll() {
		context.stateGameDerived.revealAll();
	}

	context.eventEmitter.subscribeOnMount({
		revealPanels: () => {
			viewState = 'revealed';
		},
		finalWin: ({ data }: { data: BookEventOfType<'finalWin'> }) => {
			totalWin = data.amount;
			isProcessing = false;
		},
	});

	const cols = () => config.betModes[betMode].cols;
	const rows = () => config.betModes[betMode].rows;
</script>

<EnableGameActor />

{#if viewState === 'start'}
	<h1>Scratch</h1>

	<div class="mode-select">
		{#each Object.keys(config.betModes) as mode}
			<button
				class:selected={betMode === mode}
				onclick={() => (betMode = mode as BetMode)}
			>
				{mode} (max {config.betModes[mode as BetMode].max_win}x)
			</button>
		{/each}
	</div>

	<button class="play-style" onclick={playGame}>Play</button>
{/if}

{#if viewState === 'playing' || viewState === 'revealed'}
	<div
		class="ticket-grid"
		style="grid-template-columns: repeat({cols()}, 1fr);"
	>
		{#each context.stateGame.panels as panel, index}
			<button
				class="panel"
				class:revealed={index < context.stateGame.revealedCount}
				onclick={() => revealPanel(index)}
			>
				{#if index < context.stateGame.revealedCount}
					<span class="panel-name">{panel.name}</span>
				{:else}
					<span class="panel-cover">?</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if context.stateGame.revealedCount < context.stateGame.panels.length}
		<button class="play-style" onclick={revealAll}>Reveal all</button>
	{/if}

	{#if viewState === 'revealed'}
		<h2>{totalWin > 0 ? `You won ${totalWin}x!` : 'No win this time'}</h2>
		<button class="play-style" onclick={playGame} disabled={isProcessing}>
			Bet again?
		</button>
	{/if}
{/if}
