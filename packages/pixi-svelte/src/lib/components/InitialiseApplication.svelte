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

		const baseOptions = {
			autoDensity: true,
			backgroundAlpha: 0,
			hello: true,
			multiView: false,
			antialias: true,
			clearBeforeRender: true,
			powerPreference: 'high-performance' as const,
			resolution: devicePixelRatio.current,
			resizeTo: window,
		};

		context.stateApp.pixiApplication = new PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>();
		try {
			// Preferred path: WebGPU, where supported, for better performance.
			await context.stateApp.pixiApplication.init({ ...baseOptions, preference: 'webgpu' });
		} catch (webgpuError) {
			// PixiJS's own webgpu->webgl fallback doesn't catch every failure
			// mode (seen in the wild on Android Chrome, where WebGPU context
			// creation can reject outright instead of degrading gracefully).
			// Left uncaught, that rejection used to propagate all the way up
			// to the silent onMount catch below, which only logged it and
			// left `initialised` false forever -- the entire Pixi scene
			// (ticket card, cells, glow) never mounted while every HTML
			// overlay (header, controls, win modal) kept working fine, since
			// those don't depend on Pixi at all. Explicitly retrying on
			// WebGL here instead of trusting the implicit fallback fixes
			// that class of device dead in its tracks.
			console.warn('WebGPU init failed, falling back to WebGL:', webgpuError);
			context.stateApp.pixiApplication = new PIXI.Application<PIXI.Renderer<HTMLCanvasElement>>();
			await context.stateApp.pixiApplication.init({ ...baseOptions, preference: 'webgl' });
		}

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
