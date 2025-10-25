<script lang="ts">
	import {
		availableRelays,
		initializeSigner,
		ndk,
		resetSigner,
		signer as signerState
	} from '$lib/ndk.svelte';
	import { NDKSubscriptionCacheUsage, type NDKUserProfile } from '@nostr-dev-kit/ndk';
	import { type GeoJSONSource } from 'maplibre-gl';
	import { onMount } from 'svelte';
	import UserProfileModal from './UserProfileModal.svelte';

	const {
		isLoadingNotes,
		processedEvents,
		eventsToProcess,
		isLoadingInBackground,
		clickedFeature,
		map
	}: {
		isLoadingNotes: boolean;
		processedEvents: number;
		eventsToProcess: number;
		isLoadingInBackground: boolean;
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

	const { instance: signer } = $derived(signerState);
	let profile = $state<NDKUserProfile | undefined>();

	const onResetSigner = async () => {
		profile = undefined;
		resetSigner();
	};

	onMount(async () => {
		await initializeSigner();
		if (signer) {
			const signerUser = await signer.user();
			if (!signerUser?.profile)
				await signerUser.fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY });
			profile = signerUser.profile;
		}
	});
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

<UserProfileModal
	bind:open={profileModalOpen}
	user={selectedUserProfile}
	isCurrentUser={signer?.pubkey === selectedUserProfile?.pubkey}
	onUsernameChange={async (newName: string) => {
		const user = await signer?.user();
		if (user) {
			user.profile = { name: newName };
			await user.publish();
			profile = user.profile;
		}
	}}
/>

<div
	class="absolute right-0 bottom-0 z-30 flex max-h-full w-full flex-col-reverse gap-2 overflow-y-scroll p-4 lg:top-0 lg:bottom-auto lg:left-auto lg:max-h-full lg:w-1/3 lg:flex-col"
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

	<div
		class="flex shrink-0 flex-row gap-2 overflow-x-scroll rounded bg-white p-4 text-xs shadow-md"
	>
		{#if profile || signer}
			<div class="flex flex-row items-center gap-3 text-nowrap">
				<!-- User avatar -->
				{#if profile?.picture}
					<img
						src={profile.picture}
						alt="User avatar"
						class="h-8 w-8 rounded-full border border-gray-300 object-cover"
					/>
				{:else}
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-400"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5.121 17.804A9 9 0 1112 21a9 9 0 01-6.879-3.196z"
							/>
						</svg>
					</div>
				{/if}
				<div class="flex flex-col">
					<span class="font-semibold">
						{profile?.name ?? 'Anonymous'}
					</span>
					<span class="font-mono text-xs text-gray-500">
						{#await signer?.user() then user}
							{user?.npub.slice(0, 16)}...
						{/await}
					</span>
				</div>
				<!-- Edit profile button -->
				<button
					class="ml-2 rounded border border-blue-500 px-2 py-1 text-blue-500 hover:bg-blue-50"
					onclick={() => openProfileModal(profile ?? {}, signer?.pubkey ?? '')}
				>
					Edit Profile
				</button>
				<!-- Reset/Sign out -->
				<button class="ml-2 text-red-500 hover:underline" onclick={onResetSigner}>
					Sign out
				</button>
			</div>
		{:else}
			<div class="flex flex-row gap-1 text-nowrap">
				<span>Not signed in</span>
			</div>
		{/if}
	</div>

	{#if isLoadingInBackground}
		<div
			class="flex shrink-0 flex-row items-center gap-2 overflow-x-scroll rounded bg-gray-950 p-4 text-xs text-white shadow-md"
		>
			<span class="size-2 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"
			></span>
			<span>Loading more notes... </span>
		</div>
	{/if}

	{#snippet overview(rating?: number, waitingTime?: number, distance?: number)}
		<div class="flex items-center gap-4 text-xs text-gray-700">
			{#if rating}
				<div class="flex items-center gap-1">
					<span class="text-gray-500">Rating</span>
					<span class="font-semibold">{Math.round(rating)}</span>
					<span class="text-gray-400">/</span>
					<span class="text-gray-400">5</span>
					<span class="text-yellow-400">★</span>
				</div>
			{/if}
			{#if waitingTime}
				<div>
					<span class="text-gray-500">Waiting Time</span>
					<span class="font-semibold">{waitingTime}</span>
					<span class="text-gray-400">min</span>
				</div>
			{/if}
			{#if distance}
				<div>
					<span class="text-gray-500">Ride Distance</span>
					<span class="font-semibold">{distance}</span>
					<span class="text-gray-400">km</span>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet note(entry: {
		pubkey?: string;
		username?: string;
		content: string;
		time?: number;
		user?: any;
	})}
		{@const username = entry.username ?? entry.user?.name ?? 'Anonymous'}
		<div class="space-y-3 border-b border-gray-300 last-of-type:border-0">
			<div>{entry.content}</div>
			<details class="space-y-4">
				<summary class="flex list-none items-center justify-between">
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
							{new Date(entry.time * 1000).toLocaleDateString(undefined, {
								year: 'numeric',
								month: 'long'
							})}
						</div>
					{/if}
					<span class="cursor-pointer text-xs text-gray-400">Show raw data</span>
				</summary>
				<pre class="bg-gray-100 p-2 text-xs whitespace-pre-wrap">
					{JSON.stringify(entry, null, 2)}
				</pre>
			</details>
		</div>
	{/snippet}

	{#if clickedFeature}
		<div class="space-y-2 overflow-y-auto rounded bg-white p-4 text-sm shadow-md">
			{#if clickedFeature.cluster}
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
					<h2 class="font-bold">Cluster ({clickedFeature.point_count} points)</h2>
					<h3 class="font-bold">Comments</h3>
					<p>Loading...</p>
				{:then children}
					<details class="mb-4">
						<summary class="flex list-none items-center justify-between">
							<h2 class="font-bold">Cluster ({clickedFeature.point_count} points)</h2>
							<span class="cursor-pointer text-xs text-gray-400">Show raw data</span>
						</summary>
						<pre class="bg-gray-100 p-2 text-xs whitespace-pre-wrap">{JSON.stringify(
								{ ...clickedFeature, children },
								null,
								2
							)}</pre>
					</details>
					{@render overview(
						clickedFeature.total_rating / clickedFeature.point_count,
						undefined,
						undefined
					)}
					<h3 class="font-bold">Comments</h3>
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
				{@render overview(clickedFeature.rating, undefined, undefined)}
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

<!-- Custom Footer with GitHub and About links -->
<div class="absolute right-4 bottom-4 z-20">
	<div
		class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs shadow-lg"
	>
		<span class="text-gray-600">MapLibre | OpenFreeMap © OpenMapTiles Data from OpenStreetMap</span
		>
		<div class="flex items-center gap-2">
			<a
				href="https://github.com/Hitchwiki/hitchmap-nostr"
				target="_blank"
				rel="noopener noreferrer"
				class="text-blue-600 hover:text-blue-800 hover:underline"
			>
				GitHub
			</a>
			<span class="text-gray-400">|</span>
			<a
				href="https://hitchwiki.org/en/Hitchwiki:About#maps.hitchwiki.org"
				target="_blank"
				rel="noopener noreferrer"
				class="text-blue-600 hover:text-blue-800 hover:underline"
			>
				About
			</a>
		</div>
	</div>
</div>
