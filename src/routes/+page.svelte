<script lang="ts">
	import MapLibre from '$lib/components/MapLibre.svelte';
	import MapOverlays from '$lib/components/MapOverlays.svelte';
	import { EventProcessorWorkerManager } from '$lib/eventProcessor';
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent, NDKRawEvent } from '@nostr-dev-kit/ndk';
	import { onMount } from 'svelte';

	let map = $state<maplibregl.Map | undefined>(undefined);

	const INITIAL_NOTE_COUNT = 1000; /** @todo Maybe make an environment variable. */

	const defaultFilters = {
		limit: INITIAL_NOTE_COUNT,
		kinds: [1, 36820] as any[],
		'#t': ['hitchmap']
		// This will result in too few results.
		// '#g': [...'0123456789bcdefghjkmnpqrstuvwxyz']
	};

	let loadingState = $state<'loading' | 'background' | null>('loading');

	const INITIAL_NOTES_STATE = {
		type: 'FeatureCollection' as const,
		features: [] as any[]
	};

	let notesOnMap = $state.raw(INITIAL_NOTES_STATE);

	let clickedFeature: any | null | undefined = $state();

	const workerManager = new EventProcessorWorkerManager();
	let eventsToProcess = $state(0);
	let processedEvents = $state(0);

	let backgroundWorker: Worker | null = null;
	let hasBackgroundWorkerFinished = $state(false);
	let collectedBackgroundEvents = $state([] as any[]);

	let debounceTimeout: any;
	let debouncedNotes: typeof notesOnMap = INITIAL_NOTES_STATE;

	const processEvent = async (
		event: NDKEvent | NDKRawEvent,
		{ count, deduplicate }: { count?: boolean; deduplicate?: boolean } = {}
	) => {
		if (count ?? true) eventsToProcess++;
		const processedEvent = await workerManager.processWithWorker(event);
		processedEvents++;

		const isDuplicate =
			(deduplicate ?? false)
				? notesOnMap.features.some((f: any) => f.properties?.id === processedEvent?.properties?.id)
				: false;

		if (processedEvent && !isDuplicate) {
			debouncedNotes = {
				...debouncedNotes,
				features: [...debouncedNotes.features, processedEvent]
			};
		}

		if (debounceTimeout) clearTimeout(debounceTimeout);
		debounceTimeout = setTimeout(() => {
			if (loadingState === 'loading' && processedEvents >= eventsToProcess) {
				loadingState = null;
				notesOnMap = debouncedNotes;
			}
		}, 1000);
	};

	const BACKGROUND_WORKER_DELAY_MS = 1000;

	$effect(() => {
		if (
			!localStorage.getItem('initialLoadDone') &&
			loadingState !== 'loading' &&
			!backgroundWorker &&
			!hasBackgroundWorkerFinished
		) {
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
					data: { type: 'log' | 'batch' | 'done'; message?: string; items?: string };
				}) => {
					if (type === 'log') {
						console.log(event.message);
						return;
					}

					if (type === 'batch' && event.items) {
						collectedBackgroundEvents.push(...(JSON.parse(event.items) as NDKRawEvent[]));
						return;
					}

					if (type === 'done') {
						console.log('Background note loading completed');
						processedEvents = 0;
						eventsToProcess = collectedBackgroundEvents.length;
						loadingState = 'loading';

						for (const rawEvent of $state.snapshot(collectedBackgroundEvents)) {
							await processEvent(rawEvent, { count: false, deduplicate: true });
						}

						collectedBackgroundEvents = [];
						backgroundWorker?.terminate();
						backgroundWorker = null;
						hasBackgroundWorkerFinished = true;
						loadingState = null;
						localStorage.setItem('initialLoadDone', 'true');
					}
				};
			}, BACKGROUND_WORKER_DELAY_MS);
		}
	});

	onMount(async () => {
		ndk.subscribe(
			defaultFilters,
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
</script>

<MapOverlays
	isLoadingNotes={loadingState === 'loading'}
	isLoadingInBackground={loadingState === 'background'}
	{processedEvents}
	{eventsToProcess}
	{collectedBackgroundEvents}
	{clickedFeature}
	{map}
/>

<MapLibre data={notesOnMap} onClick={(feature) => (clickedFeature = feature)} bind:map />
