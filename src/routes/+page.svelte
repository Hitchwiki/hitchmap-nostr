<script lang="ts">
	import MapLibre from '$lib/components/MapLibre.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import UserOverview from '$lib/components/UserOverview.svelte';
	import { DEFAULT_FILTERS } from '$lib/constants';
	import { EventProcessorWorkerManager } from '$lib/eventProcessor';
	import {
		closeSidebar,
		mapStore,
		openSidebar,
		setSelectedFeature,
		toggleSidebar
	} from '$lib/mapStore.svelte';
	import { ndk } from '$lib/ndk.svelte';
	import { type NDKEvent, type NDKRawEvent } from '@nostr-dev-kit/ndk';
	import { onMount } from 'svelte';

	let map = $state<maplibregl.Map | undefined>(undefined);

	let searchParams = $derived(
		new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
	);

	const INITIAL_NOTE_COUNT = $derived(
		Number(searchParams.get('limit') || 250)
	); /** @todo Maybe make an environment variable. */

	let loadingState = $state<'loading' | 'background' | null>('loading');

	const INITIAL_NOTES_STATE = {
		type: 'FeatureCollection' as const,
		features: [] as any[]
	};

	let notesOnMap = $state.raw(INITIAL_NOTES_STATE);

	const workerManager = new EventProcessorWorkerManager();
	let eventsToProcess = $state(0);
	let processedEvents = $state(0);

	let backgroundWorker: Worker | null = null;
	let hasBackgroundWorkerFinished = $state(false);

	let debounceTimeout: any;
	let debouncedNotes: typeof notesOnMap = INITIAL_NOTES_STATE;

	const processEvent = async (
		event: NDKEvent | NDKRawEvent,
		{ deduplicate }: { deduplicate?: boolean } = {}
	) => {
		eventsToProcess++;
		const processedEvent = await workerManager.processWithWorker(event);
		processedEvents++;

		if (processedEvent) {
			const isDuplicate =
				(deduplicate ?? false)
					? notesOnMap.features.some((f: any) => f.properties?.id === processedEvent.properties?.id)
					: false;

			if (!isDuplicate) {
				debouncedNotes = {
					...debouncedNotes,
					features: [...debouncedNotes.features, processedEvent]
				};
			}
		}

		if (debounceTimeout) clearTimeout(debounceTimeout);
		debounceTimeout = setTimeout(() => {
			if (loadingState === 'loading' && processedEvents >= eventsToProcess) {
				loadingState = null;
				notesOnMap = debouncedNotes;
			}
			debounceTimeout = null;
		}, 1000);
	};

	const BACKGROUND_WORKER_DELAY_MS = 1000;

	const loadAll = () => {
		console.log(
			`Starting background note loading worker in ${BACKGROUND_WORKER_DELAY_MS / 1000} seconds...`
		);

		setTimeout(() => {
			loadingState = 'background';

			backgroundWorker = new Worker(new URL('$lib/noteLoader.worker.ts', import.meta.url), {
				type: 'module'
			});

			backgroundWorker.onmessage = async ({
				data: { type, ...event }
			}: {
				data: { type: 'log' | 'done'; message?: string; items?: string };
			}) => {
				if (type === 'log') {
					console.log(event.message);
					return;
				}

				if (type === 'done' && event.items) {
					console.log('Background note loading completed');
					loadingState = 'loading';
					eventsToProcess = 0;
					processedEvents = 0;

					// @todo Consider catching and logging errors
					await Promise.allSettled(
						JSON.parse(event.items).map((rawEvent: NDKRawEvent) =>
							processEvent(rawEvent, { deduplicate: true })
						)
					);

					backgroundWorker?.terminate();
					backgroundWorker = null;
					hasBackgroundWorkerFinished = true;
					localStorage.setItem('initialLoadDone', 'true');
				}
			};
		}, BACKGROUND_WORKER_DELAY_MS);
	};

	$effect(() => {
		if (
			!localStorage.getItem('initialLoadDone') &&
			loadingState !== 'loading' &&
			!backgroundWorker &&
			!hasBackgroundWorkerFinished
		) {
			loadAll();
		}
	});

	/** @todo Remove this stupid variable and fix the effect or do it onMount or something. */
	let hasMatchedOnLoad = false;

	$effect(() => {
		// Only run this effect once after loading completes
		if (!hasMatchedOnLoad && loadingState === null && notesOnMap.features.length > 0) {
			const [lng, lat] = mapStore.currentCoords || [];
			if (lat != null && lng != null) {
				const match = notesOnMap.features.find((f) => {
					const [featureLng, featureLat] = f.geometry?.coordinates || [];
					const epsilon = 0.0001;
					return Math.abs(featureLat - lat) < epsilon && Math.abs(featureLng - lng) < epsilon;
				});
				if (match) {
					setSelectedFeature(match.properties);
					openSidebar();
				}
			}
			hasMatchedOnLoad = true;
		}
	});

	onMount(async () => {
		ndk.subscribe(
			{
				...DEFAULT_FILTERS,
				limit: INITIAL_NOTE_COUNT
			},
			{
				closeOnEose: false,
				cacheUnconstrainFilter: ['limit']
			},
			{
				onEvents: (events) => {
					for (const event of events) {
						processEvent(event);
					}
				},
				onEvent: (event, relay) => {
					processEvent(event);
				}
			}
		);
	});

	const showSidebar = $derived(mapStore.sidebarOpen);
</script>

<main class="flex h-full max-h-full w-full flex-col p-2 md:flex-row">
	<div class="relative h-full max-h-full w-full flex-1 overflow-hidden rounded-2xl">
		{#if loadingState === 'loading'}
			<Modal open>
				<div class="flex flex-col items-center gap-4">
					<div
						class="size-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600 dark:border-blue-900 dark:border-t-blue-400"
					></div>
					<p class="text-lg font-medium text-gray-900 dark:text-gray-100">
						Processing notes ({processedEvents}/{eventsToProcess})...
					</p>
				</div>
			</Modal>
		{/if}

		<UserOverview
			class="absolute top-2 right-2 z-20"
			{toggleSidebar}
			{loadAll}
			isLoadingInBackground={loadingState === 'background'}
		/>

		<Notice class="absolute right-2 bottom-2 z-20" />

		<MapLibre
			class="relative h-full w-full bg-gray-200 dark:bg-gray-800"
			data={notesOnMap}
			onClick={(feature) => {
				if (!feature) {
					closeSidebar();
					return;
				}

				setSelectedFeature(feature);
				openSidebar();
			}}
			bind:map
		/>
	</div>

	{#if showSidebar}
		<section class={['max-h-1/2 overflow-hidden overflow-y-auto p-6 py-8 md:max-h-full md:w-1/3']}>
			<Sidebar {map} />
		</section>
	{/if}
</main>
