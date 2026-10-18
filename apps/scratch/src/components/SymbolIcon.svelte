<script lang="ts">
	import { Text } from 'pixi-svelte';

	import { SYMBOL_EMOJI, SYMBOL_COLORS } from '../game/symbolIcons';
	import type { SymbolName } from '../game/types';

	type Props = {
		name: SymbolName;
		size: number;
	};

	const { name, size }: Props = $props();

	const glow = $derived(SYMBOL_COLORS[name].glow);
</script>

<Text
	anchor={0.5}
	text={SYMBOL_EMOJI[name]}
	style={{
		fontSize: size,
		dropShadow: {
			color: glow,
			blur: size * 0.18,
			distance: 0,
			alpha: 0.75,
		},
	}}
/>
