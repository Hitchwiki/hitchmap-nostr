<script lang="ts">
	import MapLibre from '$lib/components/MapLibre.svelte';
	import MapOverlays from '$lib/components/MapOverlays.svelte';
	import { EventProcessorWorkerManager } from '$lib/eventProcessor';
	import { ndk } from '$lib/ndk.svelte';
	import { onMount } from 'svelte';

	let map = $state<maplibregl.Map | undefined>(undefined);

	let isLoadingNotes = $state(true);
	let isLoadingInBackground = $state(false);

	let notesOnMap = $state.raw({
		type: 'FeatureCollection' as const,
		features: [] as any[]
	});

	let clickedFeature: any | null | undefined = $state();

	const workerManager = new EventProcessorWorkerManager();
	const INITIAL_NOTE_COUNT = 1000; /** @todo Maybe make an environment variable. */
	let eventsToProcess = $state(0);
	let processedEvents = $state(0);
	let initialBatchCount = 0;

	let backgroundWorker: Worker | null = null;
	let hasBackgroundWorkerFinished = $state(false);

	let collectedBackgroundEvents = $state([] as any[]);

	const processEvent = async (event: any, opts: { background?: boolean } = {}) => {
		if (!opts.background) eventsToProcess++;

		const processedEvent = await workerManager.processWithWorker(event);
		processedEvents++;

		if (
			processedEvent &&
			!notesOnMap.features.some((f: any) => f.properties?.id === processedEvent.properties?.id)
		) {
			notesOnMap = {
				...notesOnMap,
				features: [...notesOnMap.features, processedEvent]
			};
			initialBatchCount++;

			if (initialBatchCount === INITIAL_NOTE_COUNT) {
				isLoadingNotes = false;
			}
		}
	};

	const BACKGROUND_WORKER_DELAY_MS = 1000;

	$effect(() => {
		if (
			!localStorage.getItem('initialLoadDone') &&
			!isLoadingNotes &&
			!backgroundWorker &&
			!hasBackgroundWorkerFinished
		) {
			console.log(
				`Starting background note loading worker in ${BACKGROUND_WORKER_DELAY_MS / 1000} seconds...`
			);

			setTimeout(() => {
				isLoadingInBackground = true;

				backgroundWorker = new Worker(new URL('$lib/noteLoader.worker.ts', import.meta.url), {
					type: 'module'
				});

				backgroundWorker.onmessage = async (event) => {
					const { type, events } = event.data;
					if (type === 'batch') {
						console.log(`Background worker sent batch of ${events.length} events.`);
						collectedBackgroundEvents.push(...events);
					} else if (type === 'done') {
						processedEvents = 0;
						eventsToProcess = collectedBackgroundEvents.length;
						isLoadingNotes = true;
						console.log('Background note loading completed');
						for (const rawEvent of $state.snapshot(collectedBackgroundEvents)) {
							await processEvent(rawEvent, { background: true });
						}
						collectedBackgroundEvents = [];
						backgroundWorker?.terminate();
						backgroundWorker = null;
						hasBackgroundWorkerFinished = true;
						isLoadingInBackground = false;
						isLoadingNotes = false;
						localStorage.setItem('initialLoadDone', 'true');
					}
				};
			}, BACKGROUND_WORKER_DELAY_MS);
		}
	});

	onMount(async () => {
		const sub = ndk.subscribe(
			{
				limit: INITIAL_NOTE_COUNT,
				kinds: [1, 36820] as any[],
				'#t': ['hitchmap']
				// This will result in too few results.
				// '#g': [...'0123456789bcdefghjkmnpqrstuvwxyz']
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
				onEvent: (event) => {
					processEvent(event);
				}
			}
		);

		sub.on('eose', (relay: any) => {
			console.log('Finished loading notes – listening...');
		});
	});
</script>

<MapOverlays
	{isLoadingNotes}
	{processedEvents}
	{eventsToProcess}
	{isLoadingInBackground}
	{collectedBackgroundEvents}
	{clickedFeature}
	{map}
/>

<MapLibre data={notesOnMap} onClick={(feature) => (clickedFeature = feature)} bind:map />
