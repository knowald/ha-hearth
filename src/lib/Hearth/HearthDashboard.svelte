<script lang="ts">
	import { onMount } from 'svelte';
	import { lang } from '$lib/core/i18n';
	import { THEME_PRESETS, type HearthTheme } from '$lib/core/theme';
	import {
		currentRoom,
		hearthConfig,
		hearthEditMode,
		hearthLoadError,
		hearthNeedsSetup
	} from './store';
	import { railSlots } from './config';
	import ControlPopup from './ControlPopup.svelte';
	import Rail from './Rail.svelte';
	import RoomDetail from './RoomDetail.svelte';
	import Screensaver from './Screensaver.svelte';
	import SearchOverlay from './SearchOverlay.svelte';
	import SetupWizard from './SetupWizard.svelte';
	import ConfirmDialog from './shell/ConfirmDialog.svelte';
	import EditBar from './shell/EditBar.svelte';
	import Keyboard from './shell/Keyboard.svelte';
	import PhoneNav from './shell/PhoneNav.svelte';
	import ThemeStyle from './shell/ThemeStyle.svelte';
	import Toasts from './shell/Toasts.svelte';
	import { wakeLock } from './wakeLock';
	import ScrollEdge from '$lib/ui/ScrollEdge.svelte';
	import { scrollEdges, type ScrollEdges } from '$lib/ui/actions/scrollEdges';
	import { mediaQuery } from '$lib/ui/mediaQuery';
	import { FOLD_QUERY, SHORT_QUERY } from './breakpoints';

	let showSetupWizard = $state(false);
	let showSearch = $state(false);

	// the folded layout is a different tree, not a restyled one: the rail
	// splits into the run above the page and the run below it, so which one
	// to build has to be decided in script rather than in a media query
	const narrow = mediaQuery(FOLD_QUERY);

	// a phone held sideways has no height to spend before the page, so nothing
	// rides above it there unless a widget asked for that slot by name
	const shortScreen = mediaQuery(SHORT_QUERY);
	let leadingWidgets = $derived(
		railSlots($hearthConfig.rail, {
			includeHidden: $hearthEditMode,
			compact: $shortScreen
		}).top.length
	);

	// the columns hide their scrollbars, so a blurred edge is the only sign
	// that the list keeps going. Which column scrolls depends on the fold:
	// wide screens scroll the page column, narrow ones scroll the whole layout.
	const NOTHING_CUT: ScrollEdges = { top: false, bottom: false, left: false, right: false };
	let mainCut = $state<ScrollEdges>(NOTHING_CUT);
	let layoutCut = $state<ScrollEdges>(NOTHING_CUT);
	let edgeBlur = $derived($hearthConfig.scroll_edge_blur ?? true);

	// the selected page, or the first one when it was renamed away or deleted
	let activeRoomId = $derived(
		$hearthConfig.rooms.some((room) => room.id === $currentRoom)
			? $currentRoom
			: ($hearthConfig.rooms[0]?.id ?? '')
	);

	let activeRoom = $derived($hearthConfig.rooms.find((room) => room.id === activeRoomId));

	// a fill page clips whatever does not fit, which is invisible until you walk
	// to the tablet - so while editing, measure and say by how much
	let mainElement = $state<HTMLElement | undefined>();
	let overflowBy = $state(0);

	$effect(() => {
		if (!mainElement || !$hearthEditMode || !activeRoom?.fill_screen) {
			overflowBy = 0;
			return;
		}
		const element = mainElement;
		// the clipping happens per column, not on <main>, so <main> always looks
		// like it fits - measure the columns and report the worst one
		const measure = () => {
			// a column can overflow, and so can a filling card clipping its own
			// grid - report whichever is worse
			const clipped = [...element.querySelectorAll<HTMLElement>('.column, .card-slot')];
			overflowBy = clipped.reduce(
				(worst, node) => Math.max(worst, node.scrollHeight - node.clientHeight),
				Math.max(0, element.scrollHeight - element.clientHeight)
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		for (const node of element.querySelectorAll('.column, .card-slot')) observer.observe(node);
		return () => observer.disconnect();
	});

	// keep the selection on the page actually being rendered, so the rail
	// highlights it and editor targets resolve against it
	$effect(() => {
		if (activeRoomId && activeRoomId !== $currentRoom) currentRoom.set(activeRoomId);
	});

	// a page opens at its own top: whichever box scrolls, the offset left over
	// from the previous page means nothing on this one
	let layoutElement = $state<HTMLElement | undefined>();
	let scrolledRoom = '';

	$effect(() => {
		if (activeRoomId === scrolledRoom) return;
		scrolledRoom = activeRoomId;
		layoutElement?.scrollTo({ top: 0 });
		mainElement?.scrollTo({ top: 0 });
	});

	// display-only theme override via ?theme=<preset id>: the matched preset
	// entry (theme null = default look) replaces the stored theme without
	// touching the config or undo history
	let presetOverride = $state<{ theme: HearthTheme | null } | undefined>(undefined);

	// ?menu=false hides the edit-toggle pencil for kiosk frames; edit mode
	// stays reachable if already active, it just can't be entered from here
	let hideEditToggle = $state(false);

	onMount(() => {
		const params = new URLSearchParams(location.search);
		if ($hearthNeedsSetup && !$hearthLoadError) showSetupWizard = true;

		const presetId = params.get('theme');
		presetOverride = THEME_PRESETS.find((preset) => preset.id === presetId);

		const roomId = params.get('room');
		if (roomId && $hearthConfig.rooms.some((room) => room.id === roomId)) {
			currentRoom.set(roomId);
		}

		hideEditToggle = params.get('menu') === 'false';
	});

	// the override would mask theme edits, so drop it while editing
	$effect(() => {
		if ($hearthEditMode) presetOverride = undefined;
	});

	// the search overlay only opens outside edit mode; entering edit mode
	// while it happens to be open (not reachable via the UI today, but cheap
	// to guard) closes it rather than leaving it stranded above the edit bar
	$effect(() => {
		if ($hearthEditMode) showSearch = false;
	});
</script>

<Keyboard onsearch={() => (showSearch = true)} />
<ThemeStyle {presetOverride} />

{#snippet pageColumn()}
	<div class="main-wrap">
		<main
			class="main"
			class:fill={activeRoom?.fill_screen}
			bind:this={mainElement}
			use:scrollEdges={{ report: (edges) => (mainCut = edges) }}
		>
			<RoomDetail roomId={activeRoomId} fillScreen={activeRoom?.fill_screen ?? false} />
		</main>
		{#if edgeBlur}
			<ScrollEdge edge="top" size={96} active={mainCut.top} />
			<ScrollEdge edge="bottom" size={96} active={mainCut.bottom} />
		{/if}
	</div>
{/snippet}

<section class="frame" use:wakeLock={$hearthConfig.keep_screen_on ?? true}>
	<div
		class="layout"
		class:editing={$hearthEditMode}
		class:narrow={$narrow}
		bind:this={layoutElement}
		use:scrollEdges={{ report: (edges) => (layoutCut = edges) }}
	>
		<PhoneNav onsearch={() => (showSearch = true)} />
		{#if $narrow}
			{#if leadingWidgets > 0}
				<div class="rail-run">
					<Rail mobileSlot="top" compact={$shortScreen} onsearch={() => (showSearch = true)} />
				</div>
			{/if}
			{@render pageColumn()}
			<div class="rail-run trailing">
				<Rail mobileSlot="bottom" compact={$shortScreen} onsearch={() => (showSearch = true)} />
			</div>
		{:else}
			<div class="rail-scroll">
				<Rail onsearch={() => (showSearch = true)} />
			</div>
			{@render pageColumn()}
		{/if}
	</div>
	{#if edgeBlur}
		<ScrollEdge edge="top" size={96} active={layoutCut.top} />
		<ScrollEdge edge="bottom" size={96} active={layoutCut.bottom} />
	{/if}
	<ControlPopup />
	{#if $hearthEditMode}
		<!-- the edit sheets and their editors load with edit mode, not the dashboard -->
		{#await import('./edit/EditorHost.svelte') then EditorHost}
			<EditorHost.default />
		{:catch}
			<div class="edit-load-error" role="alert">
				{$lang('hearth_could_not_load_component')}
				<button type="button" onclick={() => hearthEditMode.set(false)}>
					{$lang('hearth_exit_edit_mode')}
				</button>
			</div>
		{/await}
	{/if}
	{#if showSearch}
		<SearchOverlay onclose={() => (showSearch = false)} />
	{/if}
	{#if ($hearthConfig.screensaver_minutes ?? 0) > 0}
		<Screensaver minutes={$hearthConfig.screensaver_minutes} />
	{/if}
	{#if showSetupWizard}
		<SetupWizard onclose={() => (showSetupWizard = false)} />
	{/if}
	<ConfirmDialog />
	<Toasts {overflowBy} />
	<EditBar {hideEditToggle} onsetup={() => (showSetupWizard = true)} />
</section>

<style>
	/* command sent, waiting for the entity to confirm */
	.frame :global(.pending) {
		animation: hearth-pending 1.1s ease-in-out infinite;
	}

	/* Theme changes animate only the composited dashboard backdrop. Descendant
	   tokens switch atomically instead of forcing a four-property repaint of
	   every node in the tree. */
	:global(html.theme-fade) .frame {
		transition:
			background-color var(--h-motion-theme) ease,
			color var(--h-motion-theme) ease;
	}

	/* scroll containers clip on both axes, which would crop the tiles' glow -
	   the padding/negative-margin pair moves the clip edge outward. The offset
	   matches the column gap so the widest glow (30px blur) fades out before
	   the clip edge without either box painting into its neighbour's content. */
	.rail-scroll {
		/* a grid item's min-content would widen the single narrow-screen track
		   past the viewport; let the rail shrink and its widgets wrap instead */
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: none;
		display: flex;
		flex-direction: column;
		padding: 32px;
		margin: -32px;
		/* room for the floating edit toggle over the rail's foot */
		padding-bottom: 80px; /* literal ok: toggle height plus margin */
	}

	/* Filling cards absorb leftover height, but unexpected runtime overflow
	   remains scrollable instead of making controls unreachable. */
	.main.fill {
		overflow-y: auto;
	}

	.frame :global(.pressable:active) {
		transform: scale(0.96);
		filter: drop-shadow(0 0 9px rgb(var(--h-accent-rgb) / calc(0.45 * var(--h-accent-scale))));
		transition:
			transform var(--h-motion-fast) ease,
			filter var(--h-motion-fast) ease;
	}

	@keyframes -global-hearth-pending {
		0%,
		100% {
			filter: drop-shadow(0 0 0 rgb(var(--h-accent-rgb) / calc(0 * var(--h-accent-scale))));
			opacity: 1;
		}
		50% {
			filter: drop-shadow(0 0 10px rgb(var(--h-accent-rgb) / calc(0.55 * var(--h-accent-scale))));
			opacity: 0.88;
		}
	}

	.frame {
		/* theme tokens are injected on:root via svelte:head (see rootCss) so
		   portaled modals resolve them too */
		width: 100%;
		height: 100dvh;
		position: relative;
		overflow: hidden;
		background:
			var(--h-bg-scrim), var(--h-bg-image),
			radial-gradient(1000px 700px at 14% -5%, var(--h-bg-0), var(--h-bg-1) 62%);
		background-size: cover;
		background-position: center;
		color: var(--h-text-1);
		font-family: var(--h-font-ui);
		/* inherited, so one declaration covers every string under the frame */
		text-shadow: var(--h-text-shadow);
	}

	.layout {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: 32px;
		padding: calc(40px + var(--h-pad-y)) calc(40px + var(--h-pad-x));
		height: 100%;
	}

	.rail-scroll::-webkit-scrollbar {
		display: none;
	}

	/* the bleed moves to the wrapper so the edge band can pin to the same box
	   the scroll container clips at; border-box makes the two coincide */
	.main-wrap {
		position: relative;
		min-width: 0;
		min-height: 0;
		margin: -32px;
	}

	.main {
		height: 100%;
		overflow-y: auto;
		scrollbar-width: none;
		padding: 32px;
	}

	.main::-webkit-scrollbar {
		display: none;
	}

	/* one ring for every keyboard-focused control; components never reset it */
	.frame :global(:focus-visible) {
		outline: var(--h-focus-ring);
		outline-offset: 2px;
	}

	/*
	 * A text field drawn as a framed row (search box, stepper, icon filter) is
	 * the frame, not the bare input inside it: a ring around the input traces a
	 * square box within a rounded one. The ring moves out to the frame, which
	 * is what the field looks like. Buttons sharing the row keep their own.
	 */
	.frame :global(.field-frame:has(:is(input, textarea):focus-visible)) {
		outline: var(--h-focus-ring);
		outline-offset: 2px;
	}

	.frame :global(.field-frame :is(input, textarea):focus-visible) {
		outline: none;
	}

	/*
	 * Folded layout (see breakpoints.ts). The rail leaves its column and
	 * becomes two runs in the page flow, so this is a different tree, not a
	 * restyled one - the class comes from the same query in script.
	 */
	.layout.narrow {
		display: flex;
		flex-direction: column;
		/* the same shape as the wide layout's padding: a base the user's own
		   padding adds to, plus the device's safe area, which a landscape notch
		   makes a horizontal concern too. Published so the page switcher can
		   bleed back out to the screen edge. */
		--h-fold-pad-left: calc(16px + var(--h-pad-x) + env(safe-area-inset-left));
		--h-fold-pad-right: calc(16px + var(--h-pad-x) + env(safe-area-inset-right));
		/* no padding above: the page switcher pins to the very top of this
		   scroller and carries the top inset itself, so nothing can scroll
		   through the strip of screen above it */
		padding: 0 var(--h-fold-pad-right) calc(16px + var(--h-pad-y) + env(safe-area-inset-bottom))
			var(--h-fold-pad-left);
		gap: 24px;
		overflow-y: auto;
		/* a dashboard never scrolls sideways: a tile glow or a widened hit area
		   reaching past the glass is a few stray pixels, not a second axis */
		overflow-x: hidden;
		/* the page switcher is sticky over this box; anything scrolled to would
		   otherwise land underneath it */
		scroll-padding-top: calc(
			72px + env(safe-area-inset-top)
		); /* literal ok: page switcher height plus margin */
		/* inside the Home Assistant app this scroller sits in a webview that
		   scrolls too - keep the rubber band here */
		overscroll-behavior-y: contain;
	}

	/* the edit bar floats over the scroll container; leave room under the
	   last widget so nothing hides behind it */
	.layout.narrow.editing {
		padding-bottom: calc(
			112px + var(--h-pad-y) + env(safe-area-inset-bottom)
		); /* literal ok: edit bar height plus margin */
	}

	/* the glow bleed shrinks to the layout's own padding so the columns end
	   at the viewport edge instead of 8px past it */
	.layout.narrow .main-wrap,
	.layout.narrow .main {
		overflow-y: visible;
		min-height: auto;
		height: auto;
		padding: 0;
		margin: 0;
	}

	.layout.narrow .main.fill {
		overflow-y: visible;
	}

	.rail-run {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	/* room for the floating edit toggle over the foot of the page */
	.rail-run.trailing {
		padding-bottom: 80px; /* literal ok: toggle height plus margin */
	}
</style>
