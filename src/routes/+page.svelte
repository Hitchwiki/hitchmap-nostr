<script lang="ts">
	import UserProfileModal from '$lib/components/UserProfileModal.svelte';
	import { decodeGeoHash } from '$lib/geohash';
	import { availableRelays, ndk } from '$lib/ndk.svelte';
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

	let notesOnMap = $state({
		type: 'FeatureCollection' as const,
		features: [] as any[]
	});

	function extractLocation(note: any) {
		const gTags = note.tags.filter((tag: any) => tag[0] === 'g' && tag[1]);
		const longestGTag = gTags.reduce(
			(longest: string, tag: any) => (tag[1].length > (longest?.length ?? 0) ? tag[1] : longest),
			''
		);

		// Check if longestGTag is in "lat,lng" format
		const latLngMatch = longestGTag.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
		if (latLngMatch) {
			const lat = parseFloat(latLngMatch[1]);
			const lng = parseFloat(latLngMatch[3]);
			if (isFinite(lat) && isFinite(lng)) {
				return { lngLat: [lng, lat], geohash: null };
			}
			return null;
		}

		const location = decodeGeoHash(longestGTag);
		if (!location) return null;
		return { lngLat: [location.longitude[2], location.latitude[2]], geohash: longestGTag };
	}

	async function eventToFeature(note: any) {
		const coordinates = extractLocation(note);
		if (!coordinates) return null;

		let username: string | null = null;
		let content = note.content;
		let time = note.created_at;
		let rating = note.rating;

		if (note.kind === 36820) {
			try {
				const data = JSON.parse(content);

				username = data?.hitchhikers?.[0]?.nickname ?? null;
				content = data.comment || content;
				if (data.submission_time) {
					const date = new Date(data.submission_time);
					if (!isNaN(date.getTime())) time = Math.floor(date.getTime() / 1000);
				}
				if (typeof data.rating !== 'undefined') rating = data.rating;
			} catch (error) {
				console.error('Failed to parse JSON for kind 36820 event:', error);
				return null;
			}
		} else {
			const match = content.match(/^hitchmap\.com\s*(.*?):\s*/);
			if (match) {
				username = match[1]?.trim() || null;
				content = content.slice(match[0].length);
			}
			content = content.replace(/\s*#hitchhiking\s*$/i, '').trim();
		}

		const user = await ndk.fetchUser(note.pubkey);
		const userProfile = await user?.fetchProfile();
		const { profileEvent, ...profile } = userProfile ?? {};

		return {
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates: coordinates.lngLat
			},
			properties: {
				id: note.id,
				pubkey: note.pubkey,
				user: profile,
				time,
				username,
				content,
				geohash: coordinates.geohash,
				coordinates: coordinates.lngLat,
				tags: note.tags,
				rating
			}
		};
	}

	let clickedFeature: any | null | undefined = $state();

	let eventBuffer: any[] = $state([]);

	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	let profileModalOpen = $state(false);
	let selectedUserProfile: any = $state(null);

	$effect(() => {
		if (eventBuffer.length === 0) return;
		if (debounceTimeout) return; // Do not clear or reschedule if already pending

		console.log(`Scheduling processing of ${eventBuffer.length} new notes (debounced).`);

		debounceTimeout = setTimeout(() => {
			const bufferSnapshot = eventBuffer.slice();
			console.log(`Processing buffer of ${bufferSnapshot.length} new notes (debounced).`);
			notesOnMap = {
				...notesOnMap,
				features: [...notesOnMap.features, ...bufferSnapshot]
			};
			eventBuffer = [];
			debounceTimeout = null;
		}, 1000); // process every 1 second
	});

	function openProfileModal(userProfile: any) {
		selectedUserProfile = userProfile;
		profileModalOpen = true;
	}

	const processEvent = async (event: any) => {
		const feature = await eventToFeature(event);
		if (feature) {
			eventBuffer.push(feature);
		}
	};

	onMount(async () => {
		const sub = ndk.subscribe(
			{
				limit: 10000,
				kinds: [1, 36820] as any[],
				'#t': ['hitchmap']
				// This will result in too few results.
				// '#g': [...'0123456789bcdefghjkmnpqrstuvwxyz']
			},
			{ closeOnEose: false, cacheUnconstrainFilter: ['limit'] },
			{
				onEvents: (events) => {
					console.log(`Received batch of ${events.length} notes from cache.`);
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
			isLoadingNotes = false;
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

	<div class="bg-opacity-90 rounded bg-white p-4 text-sm shadow-md">
		{notesOnMap.features.length} notes loaded
	</div>

	{#snippet note(entry: {
		username?: string;
		profile?: { name?: string };
		content: string;
		time?: number;
		user?: any;
	})}
		{@const username = entry.username ?? entry.user?.name ?? entry.profile?.name ?? 'Anonymous'}
		<div class="space-y-1">
			<div>{entry.content}</div>
			{#if entry.time}
				<div class="text-xs text-gray-500">
					– {#if entry.user}
						<button
							class="text-blue-500 hover:underline"
							onclick={() => openProfileModal(entry.user)}
						>
							{username}
						</button>
					{:else}
						{username}
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

<UserProfileModal bind:open={profileModalOpen} user={selectedUserProfile} />

{#if isLoadingNotes}
	<div class="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="flex flex-col items-center gap-4 rounded-lg bg-white p-6 shadow-lg">
			<div
				class="size-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
			></div>
			<p class="text-lg font-medium">Loading notes...</p>
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
				'text-field': [
					'format',
					['get', 'point_count_abbreviated'],
				],
				'text-size': 12,
				'text-offset': [0, -0.1],
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
				'circle-color': '#11b4da',
				'circle-radius': 4,
				'circle-stroke-width': 1,
				'circle-stroke-color': '#fff'
			}}
		/>
	</GeoJSON>
</MapLibre>
