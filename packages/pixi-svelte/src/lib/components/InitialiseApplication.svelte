<script lang="ts">
	import * as PIXI from 'pixi.js';
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import { devicePixelRatio } from 'svelte/reactivity/window';

	import { getContextApp } from '../context.svelte';
	import { preloadFont } from '../utils.svelte';

	type Props = { children: Snippet };

	const props: Props = $props();
	const context = getContextApp();

	let wrap: HTMLDivElement;
	let initialised = $state(false);

	const initialiseApplication = async () => {
		PIXI.Assets.reset();

		await preloadFont();

		// Forced to WebGL, never WebGPU. This game is simple 2D content that
		// gains nothing from WebGPU's extra performance, and WebGPU support
		// on Android Chrome is still immature enough that it can silently
		// come up "initialised" with no thrown error at all, yet never
		// actually paint anything to the canvas -- confirmed on a real
		// Android Chrome device: the entire Pixi scene (ticket card, cells,
		// glow) stayed blank while every HTML overlay (header, controls, win
		// modal) rendered fine, with nothing in the console to catch, while
		// Firefox/Samsung Internet on the same phone (neither attempts
		// WebGPU) worked immediately. A try/catch around a 'webgpu' attempt
		// can't defend against a silent black canvas, so the only reliable
		// fix is to never ask for WebGPU in the first place.
		// Older / low-memory phones can refuse a high-performance,
		// antialiased context at full device resolution. Try that first,
		// then fall back to a lighter context instead of leaving the canvas
		// blank. Resolution is capped at 2 either way (a 3x canvas costs a lot
		// of GPU memory for no visible gain).
		const dpr = Math.min(devicePixelRatio.current ?? 1, 2);
		const attempts = [
			{ antialias: true, powerPreference: 'high-performance' as const, resolution: dpr },
			{ antialias: false, powerPreference: 'default' as const, resolution: Math.min(dpr, 1.5) },
			{ antialias: false, powerPreference: 'low-power' as const, resolution: 1 },
		];
		let lastError: unknown;
		for (const opts of attempts) {
			const app = new PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>();
			try {
				await app.init({
					autoDensity: true,
					backgroundAlpha: 0,
					hello: true,
					multiView: false,
					clearBeforeRender: true,
					preference: 'webgl',
					resizeTo: window,
					// accept a slower (e.g. blocklisted-GPU) WebGL rather than none
					failIfMajorPerformanceCaveat: false,
					...opts,
				});
				context.stateApp.pixiApplication = app;
				lastError = undefined;
				break;
			} catch (error) {
				lastError = error;
				console.warn('Pixi init failed, retrying lighter', opts, error);
				try { app.destroy(); } catch { /* ignore */ }
			}
		}
		if (lastError) throw lastError;

		wrap.appendChild(context.stateApp.pixiApplication.canvas);

		// to prevent that you can't scroll the page with touch on the canvas. https://github.com/pixijs/pixijs/issues/4824
		context.stateApp.pixiApplication.renderer.events.autoPreventDefault = false;
		context.stateApp.pixiApplication.renderer.canvas.style.touchAction = 'auto';
	};

	onMount(async () => {
		try {
			if (!initialised) await initialiseApplication();
			initialised = true;
		} catch (error) {
			console.error(error);
		}
	});

	onDestroy(() => {
		if (context.stateApp.pixiApplication) {
			context.stateApp.pixiApplication.destroy();
		}
	});
</script>

<div bind:this={wrap}>
	{#if initialised}
		{@render props.children()}
	{/if}
</div>
