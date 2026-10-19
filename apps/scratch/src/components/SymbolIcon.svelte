<script lang="ts">
	import { Text } from 'pixi-svelte';

	import { SYMBOL_PLACEHOLDER_GLYPH, SYMBOL_COLORS } from '../game/symbolIcons';
	import type { SymbolName } from '../game/types';

	type Props = {
		name: SymbolName;
		size: number;
	};

	const { name, size }: Props = $props();

	const glow = $derived(SYMBOL_COLORS[name].glow);
	const fill = $derived(SYMBOL_COLORS[name].fill);
</script>

<Text
	anchor={0.5}
	text={SYMBOL_PLACEHOLDER_GLYPH[name]}
	style={{
		fontSize: size,
		fill,
		dropShadow: {
			color: glow,
			blur: size * 0.18,
			distance: 0,
			alpha: 0.75,
		},
	}}
/>
