<script lang="ts">
	import MapLibre from '$lib/components/MapLibre.svelte';
	import MapOverlays from '$lib/components/MapOverlays.svelte';
	import { EventProcessorWorkerManager } from '$lib/eventProcessor';
	import { ndk } from '$lib/ndk.svelte';
	import { type NDKEvent, type NDKRawEvent } from '@nostr-dev-kit/ndk';
	import { onMount } from 'svelte';
	import { DEFAULT_FILTERS } from '$lib/constants';

	let map = $state<maplibregl.Map | undefined>(undefined);

	const INITIAL_NOTE_COUNT = 250; /** @todo Maybe make an environment variable. */

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
					? notesOnMap.features.some(
							(f: any) => f.properties?.id === processedEvent?.properties?.id
						)
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

						for (const rawEvent of JSON.parse(event.items) as NDKRawEvent[]) {
							await processEvent(rawEvent, { deduplicate: true });
						}

						backgroundWorker?.terminate();
						backgroundWorker = null;
						hasBackgroundWorkerFinished = true;
						localStorage.setItem('initialLoadDone', 'true');
					}
				};
			}, BACKGROUND_WORKER_DELAY_MS);
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
</script>

<MapOverlays
	isLoadingNotes={loadingState === 'loading'}
	isLoadingInBackground={loadingState === 'background'}
	{processedEvents}
	{eventsToProcess}
	{clickedFeature}
	{map}
/>

<MapLibre data={notesOnMap} onClick={(feature) => (clickedFeature = feature)} bind:map />
