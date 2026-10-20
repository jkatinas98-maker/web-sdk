<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	import { symbolAssetKey } from '../game/assets';
	import type { SymbolName } from '../game/types';

	type Props = {
		name: SymbolName;
		// Edge length of the square box the art is fitted into. Every PNG is
		// square-padded, so width = height keeps its aspect ratio intact.
		size: number;
	};

	const { name, size }: Props = $props();
</script>

<Sprite key={symbolAssetKey(name)} anchor={0.5} width={size} height={size} />
