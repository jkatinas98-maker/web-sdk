<script lang="ts" module>
	import * as PIXI from 'pixi.js';

	import { ANIM_META, type AnimState } from '../game/assets';
	import type { SymbolName } from '../game/types';

	// Frame textures sliced out of each atlas, built once per symbol and
	// shared by every cell showing that symbol.
	const frameCache = new Map<SymbolName, PIXI.Texture[]>();

	const getFrames = (name: SymbolName, atlas: PIXI.Texture): PIXI.Texture[] => {
		const cached = frameCache.get(name);
		if (cached) return cached;
		const { cell, cols, symbols } = ANIM_META;
		const count = Math.max(...Object.values(symbols[name]).flat()) + 1;
		const frames = Array.from(
			{ length: count },
			(_, i) =>
				new PIXI.Texture({
					source: atlas.source,
					frame: new PIXI.Rectangle((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell),
				}),
		);
		frameCache.set(name, frames);
		return frames;
	};

	const FPS: Record<AnimState, number> = { reveal: 24, idle: 6, win: 16 };
</script>

<script lang="ts">
	import { BaseSprite } from 'pixi-svelte';

	import SymbolIcon from './SymbolIcon.svelte';
	import { getContext } from '../game/context';
	import { animAssetKey } from '../game/assets';

	type Props = {
		name: SymbolName;
		// Edge length the SYMBOL itself should occupy (same as SymbolIcon's
		// box); the frame is drawn larger so its glow/sparks spill around it.
		size: number;
		winning: boolean;
	};

	const { name, size, winning }: Props = $props();
	const context = getContext();

	const atlas = $derived(
		context.stateApp.loadedAssets?.[animAssetKey(name)] as PIXI.Texture | undefined,
	);
	const frames = $derived(atlas ? getFrames(name, atlas) : null);
	const frameSize = $derived(size / ANIM_META.symbolFraction);

	// Plays the reveal once when the cell first appears, then settles into
	// the idle loop; a winning cell switches to the win loop.
	let revealDone = $state(false);
	const animState: AnimState = $derived(winning ? 'win' : revealDone ? 'idle' : 'reveal');
	const sequence = $derived(ANIM_META.symbols[name][animState]);

	let step = $state(0);

	$effect(() => {
		const seq = sequence;
		const current = animState;
		if (!frames || seq.length === 0) {
			if (current === 'reveal') revealDone = true;
			return;
		}
		step = 0;
		let raf: number;
		const start = performance.now();
		const loop = (now: number) => {
			const n = Math.floor(((now - start) / 1000) * FPS[current]);
			if (current === 'reveal' && n >= seq.length) {
				revealDone = true;
				return;
			}
			step = n % seq.length;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const texture = $derived(frames ? frames[sequence[Math.min(step, sequence.length - 1)]] : null);
</script>

{#if texture}
	<BaseSprite {texture} anchor={0.5} width={frameSize} height={frameSize} />
{:else}
	<!-- Atlas still downloading: static icon until it arrives. -->
	<SymbolIcon {name} {size} />
{/if}
