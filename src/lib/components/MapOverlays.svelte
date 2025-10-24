<script lang="ts">
	import { availableRelays, ndk } from '$lib/ndk.svelte';
	import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
	import { type GeoJSONSource } from 'maplibre-gl';
	import UserProfileModal from './UserProfileModal.svelte';

	const {
		isLoadingNotes,
		processedEvents,
		eventsToProcess,
		isLoadingInBackground,
		collectedBackgroundEvents,
		clickedFeature,
		map
	}: {
		isLoadingNotes: boolean;
		processedEvents: number;
		eventsToProcess: number;
		isLoadingInBackground: boolean;
		collectedBackgroundEvents: any[];
		clickedFeature: any;
		map: maplibregl.Map | undefined;
	} = $props();

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

	let profileModalOpen = $state(false);
	let selectedUserProfile: (NDKUserProfile & { pubkey: string }) | null = $state(null);

	function openProfileModal(userProfile: NDKUserProfile, pubkey: string) {
		selectedUserProfile = { ...userProfile, pubkey };
		profileModalOpen = true;
	}
</script>

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

<UserProfileModal bind:open={profileModalOpen} user={selectedUserProfile} />

<div
	class="absolute right-0 bottom-0 z-10 flex h-1/2 max-h-full w-full flex-col-reverse gap-2 overflow-y-scroll p-4 lg:top-0 lg:bottom-auto lg:left-auto lg:h-full lg:w-1/3 lg:flex-col"
>
	<div
		class="flex shrink-0 flex-row gap-2 overflow-x-scroll rounded bg-white p-4 text-xs shadow-md"
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

	{#if isLoadingInBackground}
		<div
			class="flex shrink-0 flex-row items-center gap-2 overflow-x-scroll rounded bg-gray-950 p-4 text-xs text-white shadow-md"
		>
			<span class="size-2 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"
			></span>
			<span
				>Loading more notes... {@html collectedBackgroundEvents.length > 0
					? `<span class="opacity-50">${collectedBackgroundEvents.length}...</span>`
					: ''}</span
			>
		</div>
	{/if}

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
				<pre class="bg-gray-100 p-2 text-xs whitespace-pre-wrap">{JSON.stringify(
						entry,
						null,
						2
					)}</pre>
			</details>
		</div>
	{/snippet}

	{#if clickedFeature}
		<div class="overflow-y-auto rounded bg-white p-4 text-sm shadow-md">
			{#if clickedFeature.cluster}
				<h2 class="font-bold">Cluster ({clickedFeature.point_count} points)</h2>
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
				})()}
					<p>Loading...</p>
				{:then children}
					<details class="mb-4">
						<summary class="cursor-pointer text-xs text-gray-400">Show raw data</summary>
						<pre class="bg-gray-100 p-2 text-xs whitespace-pre-wrap">{JSON.stringify(
								{ ...clickedFeature, children },
								null,
								2
							)}</pre>
					</details>
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
