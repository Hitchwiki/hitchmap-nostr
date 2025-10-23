<script lang="ts">
	import UserProfileModal from '$lib/components/UserProfileModal.svelte';
	import { EventProcessorWorkerManager } from '$lib/eventProcessor';
	import { availableRelays, ndk } from '$lib/ndk.svelte';
	import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
	import type { Feature, Geometry } from 'geojson';
	import { type GeoJSONSource } from 'maplibre-gl';
	import { onMount } from 'svelte';
	import {
		CircleLayer,
		GeoJSON,
		type LayerClickInfo,
		MapLibre,
		SymbolLayer
	} from 'svelte-maplibre';

	type SingleProperties = {
		id: string;
		pubkey: string;
		user: any;
		time: number;
		username?: string;
		content: string;
		geohash?: string;
		coordinates: [number, number];
		tags: any[];
		rating?: number;
	};

	let map: maplibregl.Map | undefined = $state();

	let isLoadingNotes = $state(true);

	const getRelayStatus = $derived.by(() => {
		const statusMap = new Map<string, string>();
		for (const relay of ndk.$pool.relays.values()) {
			// Store both with and without trailing slash to handle URL normalization
			statusMap.set(relay.url, relay.status);
			const urlWithoutSlash = relay.url.endsWith('/') ? relay.url.slice(0, -1) : relay.url;
			statusMap.set(urlWithoutSlash, relay.status);
		}
		return statusMap;
	});

	let notesOnMap = $state.raw({
		type: 'FeatureCollection' as const,
		features: [] as any[]
	});

	let clickedFeature: any | null | undefined = $state();

	let profileModalOpen = $state(false);
	let selectedUserProfile: (NDKUserProfile & { pubkey: string }) | null = $state(null);

	function openProfileModal(userProfile: NDKUserProfile, pubkey: string) {
		selectedUserProfile = { ...userProfile, pubkey };
		profileModalOpen = true;
	}

	const workerManager = new EventProcessorWorkerManager();
	const INITIAL_NOTE_COUNT = 1000; /** @todo Maybe make an environment variable. */
	let eventsToProcess = $state(0);
	let processedEvents = $state(0);
	let initialBatchCount = 0;

	let backgroundWorker: Worker | null = null;

	const processEvent = async (event: any) => {
		eventsToProcess++;

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

	$effect(() => {
		if (!isLoadingNotes && !backgroundWorker) {
			console.log('Starting background note loading worker in 10 seconds...');

			setTimeout(() => {
				backgroundWorker = new Worker(new URL('$lib/noteLoader.worker.ts', import.meta.url), {
					type: 'module'
				});

				backgroundWorker.onmessage = async (event) => {
					const { type, events } = event.data;
					if (type === 'batch') {
						console.log(`Background worker sent batch of ${events.length} events.`);
						for (const rawEvent of events) {
							await processEvent(rawEvent);
						}
					} else if (type === 'done') {
						console.log('Background note loading completed');
						backgroundWorker?.terminate();
						backgroundWorker = null;
					}
				};
			}, 10000);
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

<div class="absolute top-0 right-0 z-10 flex max-h-full w-1/3 flex-col gap-2 overflow-y-scroll p-4">
	<div
		class="bg-opacity-90 flex shrink-0 flex-row gap-2 overflow-x-scroll rounded bg-white p-4 text-xs shadow-md"
	>
		{#each availableRelays as relay (relay)}
			{@const status = getRelayStatus.get(relay)}
			<div class="flex flex-row gap-1 text-nowrap uppercase">
				<span>
					{#if status === 'connected'}
						🟢
					{:else if status === 'connecting'}
						🟡
					{:else if status === 'reconnecting'}
						🟡
					{:else}
						🔴
					{/if}
				</span>
				<span class="relay-url">{relay}</span>
			</div>
		{/each}
	</div>

	{#snippet note(entry: {
		pubkey?: string;
		username?: string;
		content: string;
		time?: number;
		user?: any;
	})}
		{@const username = entry.username ?? entry.user?.name ?? 'Anonymous'}
		<div class="space-y-1">
			<div>{entry.content}</div>
			{#if entry.time}
				<div class="text-xs text-gray-500">
					- {#if entry.pubkey}
						{#await ndk.fetchUser(entry.pubkey) then user}
							{#await user?.fetchProfile() then profile}
								{#if profile}
									<button
										class="text-blue-500 hover:underline"
										onclick={() => openProfileModal(profile, entry.pubkey!)}
									>
										{username ?? profile?.name ?? 'Anonymous'}
									</button>
								{:else}
									{username ?? 'Anonymous'}
								{/if}
							{/await}
						{/await}
					{/if},
					{new Date(entry.time * 1000).toLocaleString()}
				</div>
			{/if}
			<details>
				<summary class="cursor-pointer text-xs text-gray-400">Show raw data</summary>
				<pre class="text-xs whitespace-pre-wrap">{JSON.stringify(entry, null, 2)}</pre>
			</details>
		</div>
	{/snippet}

	{#if clickedFeature}
		<div class="bg-opacity-90 max-h-1/3 overflow-y-auto rounded bg-white p-4 text-sm shadow-md">
			{#if clickedFeature.cluster}
				<h2 class="mb-2 font-bold">Cluster ({clickedFeature.point_count} points)</h2>
				{#await (async () => {
					const source = map?.getSource('notes') as GeoJSONSource;
					let allChildren: any[] = [];
					let queue = [clickedFeature.cluster_id];
					const seen = new Set();

					while (queue.length > 0) {
						const clusterId = queue.pop();
						if (!clusterId || seen.has(clusterId)) continue;
						seen.add(clusterId);

						const children = await source.getClusterChildren(clusterId);
						for (const child of children) {
							if (child.properties?.cluster) {
								queue.push(child.properties.cluster_id);
							} else {
								allChildren.push(child);
							}
						}
					}

					return allChildren.sort((a, b) => b.properties.time - a.properties.time);
				})() then children}
					<div class="space-y-4">
						{#each children as child, i (child.properties?.id || i)}
							{#if child.properties?.content && child.properties.content.trim() !== ''}
								{@render note(child.properties as any)}
							{/if}
						{/each}
					</div>
					{#if children.length < clickedFeature.point_count}
						<p class="text-gray-600 italic">
							...{clickedFeature.point_count - children.length} more point{clickedFeature.point_count -
								children.length ===
							1
								? ''
								: 's'} (zoom in to see all)
						</p>
					{/if}
				{:catch error}
					<p class="text-red-500">Failed to load cluster children: {error.message}</p>
				{/await}
			{:else}
				{@render note({
					...clickedFeature,
					user:
						typeof clickedFeature.user === 'string'
							? JSON.parse(clickedFeature.user)
							: clickedFeature.user
				} as any)}
			{/if}
		</div>
	{/if}
</div>

{#if selectedUserProfile}
	<UserProfileModal bind:open={profileModalOpen} user={selectedUserProfile} />
{/if}

{#if isLoadingNotes}
	<div class="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="flex flex-col items-center gap-4 rounded-lg bg-white p-6 shadow-lg">
			<div
				class="size-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
			></div>
			<p class="text-lg font-medium">Processing notes ({processedEvents}/{eventsToProcess})...</p>
		</div>
	</div>
{/if}

<MapLibre
	bind:map
	center={[50, 20]}
	zoom={2}
	standardControls
	style="https://tiles.openfreemap.org/styles/liberty"
	onclick={() => (clickedFeature = null)}
	projection={{ type: 'globe' }}
>
	<GeoJSON
		id="notes"
		data={notesOnMap}
		cluster={{
			radius: 75,
			maxZoom: 14,
			properties: {
				point_count: ['+', ['get', 'point_count']]
			}
		}}
	>
		<CircleLayer
			id="cluster_circles"
			applyToClusters
			onclick={(e: LayerClickInfo<Feature<Geometry, any>>) =>
				(clickedFeature = e.features?.[0]?.properties)}
			hoverCursor="pointer"
			manageHoverState
			paint={{
				'circle-color': [
					'step',
					['get', 'point_count'],
					'#176a3c', // green for <50
					50,
					'#ff9800', // orange for 50-300
					300,
					'#9c2f2f' // red for >=300
				],
				'circle-radius': [
					'step',
					['get', 'point_count'],
					20, // small radius for small clusters
					100,
					30, // medium radius for medium clusters
					750,
					40 // large radius for large clusters
				]
			}}
		/>

		<SymbolLayer
			interactive={false}
			applyToClusters
			layout={{
				'text-font': ['Noto Sans Regular'], // Needs to match available fonts in map style
				'text-field': ['format', ['get', 'point_count_abbreviated']],
				'text-size': 12,
				'text-offset': [0, -0.1]
			}}
			paint={{
				'text-color': '#ffffff'
			}}
		/>

		<CircleLayer
			applyToClusters={false}
			onclick={(e: LayerClickInfo<Feature<Geometry, SingleProperties>>) =>
				(clickedFeature = e.features?.[0]?.properties)}
			hoverCursor="pointer"
			paint={{
				'circle-color': [
					'case',
					['has', 'rating'],
					[
						'interpolate',
						['linear'],
						['get', 'rating'],
						1,
						'#9c2f2f', // red for bad (rating 1)
						3,
						'#ff9800', // orange for medium (rating 3)
						5,
						'#2ecc40' // brighter green for good (rating 5)
					],
					'#11b4da' // default color if no rating
				],
				'circle-radius': 4,
				'circle-stroke-width': 1,
				'circle-stroke-color': '#fff'
			}}
		/>
	</GeoJSON>
</MapLibre>
