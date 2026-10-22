<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoaderStakeEngine, LoadI18n } from 'components-shared';
	import Game from '../components/Game.svelte';
	import { setContext } from '../game/context';

	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };

	const props: Props = $props();

	// This gif lives in static/, which adapter-static copies verbatim
	// next to index.html — a plain relative path resolves correctly against
	// the deployed page's own URL no matter what subpath it's served under.
	// (The previous `new URL(..., import.meta.url)` form is for Vite-bundled
	// assets living under src/, not static/ files; it pointed two directories
	// too high, so the gif never loaded and the loading overlay never
	// cleared — the loader only clears via the gif's onload callback.)
	const loaderUrlStakeEngine = 'stake-engine-loader.gif';

	setContext();
</script>

<GlobalStyle>
	<Authenticate>
		<LoadI18n {messagesMap}>
			<Game />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

<!-- Stake Engine's "Powered by Stake Engine" intro (standard on Engine
     games); the game's own loading screen (Game.svelte) follows it. The
     template's generic spinner loader was removed. -->
<LoaderStakeEngine src={loaderUrlStakeEngine} />

{@render props.children()}