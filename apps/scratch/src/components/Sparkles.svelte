<script lang="ts">
	// Lightweight CSS particles: twinkling star sparkles and/or gold coins
	// that burst outward. Pure DOM + CSS (no canvas), sized relative to the
	// parent, so it can be dropped into any banner. Each particle gets random
	// position / timing once, on mount.
	type Props = {
		count?: number;
		coins?: number; // coin burst particles (fly out once, then loop slowly)
		spread?: number; // how far coins fly, in % of the parent's size
		color?: string;
		loop?: boolean;
	};
	const { count = 14, coins = 0, spread = 70, color = '#ffe9a0', loop = true }: Props = $props();

	const rnd = (a: number, b: number) => a + Math.random() * (b - a);
	const stars = Array.from({ length: count }, () => ({
		x: rnd(2, 98),
		y: rnd(5, 95),
		s: rnd(0.5, 1.25),
		d: rnd(0, 2.4),
		t: rnd(1.1, 2.2),
	}));
	const coinList = Array.from({ length: coins }, () => {
		const ang = rnd(0, Math.PI * 2);
		const dist = rnd(spread * 0.45, spread);
		return {
			dx: Math.cos(ang) * dist,
			dy: Math.sin(ang) * dist * 0.75 - rnd(5, 20),
			r: rnd(-540, 540),
			d: rnd(0, 0.35),
			t: rnd(0.9, 1.5),
			s: rnd(0.6, 1.1),
		};
	});
</script>

<div class="sparkles" class:loop aria-hidden="true">
	{#each stars as p, i (i)}
		<i
			class="sparkle"
			style={`left:${p.x}%;top:${p.y}%;--s:${p.s};--c:${color};animation-delay:${p.d}s;animation-duration:${p.t}s;`}
		></i>
	{/each}
	{#each coinList as c, i (i)}
		<i
			class="coin"
			style={`--dx:${c.dx.toFixed(1)};--dy:${c.dy.toFixed(1)};--r:${c.r}deg;--s:${c.s};animation-delay:${c.d}s;animation-duration:${c.t}s;`}
		></i>
	{/each}
</div>
