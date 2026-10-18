<script lang="ts">
	import { Container, Graphics } from 'pixi-svelte';

	import { drawSymbolIcon } from '../game/symbolIcons';
	import type { SymbolName } from '../game/types';

	type Props = {
		name: SymbolName;
		size: number;
	};

	const { name, size }: Props = $props();

	// Icons are drawn in a fixed 100x100 local box (see symbolIcons.ts); scale
	// that box down to whatever pixel size this cell needs.
	const scale = $derived(size / 100);
</script>

<Container x={-size / 2} y={-size / 2} {scale}>
	<Graphics draw={(graphics) => drawSymbolIcon(graphics, name)} />
</Container>
