<script lang="ts">
	import { availableRelays, ndk } from '$lib/ndk.svelte';
	import { BugBeetle, GithubLogo } from 'phosphor-svelte';
	import { type Component } from 'svelte';

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
</script>

{#snippet link(Icon: Component, text: string, href: string)}
	<li class="flex items-center space-x-2">
		<Icon size={20} class="text-gray-600" />
		<a {href} class="text-blue-600 hover:underline">{text}</a>
	</li>
{/snippet}

<h3 class="mb-2 text-lg font-semibold text-gray-800">Relays</h3>

<ul class="flex flex-col gap-1 overflow-x-auto rounded bg-gray-50 text-sm">
	{#each availableRelays as relay (relay)}
		{@const status = getRelayStatus.get(relay)}
		<li class="pointer-events-none flex items-center gap-2 whitespace-nowrap uppercase">
			<span aria-label={status} title={status} class="animate-pulse">
				{#if status === 'connected'}
					<span class="text-green-500">●</span>
				{:else if status === 'connecting' || status === 'reconnecting'}
					<span class="text-yellow-500">●</span>
				{:else}
					<span class="text-red-500">●</span>
				{/if}
			</span>
			<span class="text-xs text-gray-700">{relay}</span>
		</li>
	{/each}
</ul>

<h3 class="mt-6 mb-2 text-lg font-semibold text-gray-800">Links</h3>

<ul class="list-none space-y-2 p-0">
	{@render link(GithubLogo, 'Contribute', 'https://github.com/Hitchwiki/hitchmap-nostr')}
	{@render link(BugBeetle, 'Report bugs', 'https://github.com/Hitchwiki/hitchmap-nostr/issues/new')}
</ul>

<div class="my-6 space-y-2">
	<h3 class="text-lg font-semibold text-gray-800">About</h3>

	<p class="text-sm text-gray-700">
		Hitchmap Nostr is an open, decentralized hitchhiking map built on the Nostr protocol. It’s
		designed for the community to share and discover hitchhiking spots and experiences.
	</p>

	<p class="text-sm text-gray-700">
		You can contribute by adding new spots, sharing stories, or improving the code. Every
		contribution helps make Hitchmap Nostr a better resource for travelers everywhere.
	</p>
</div>

<h3 class="mt-6 mb-2 text-lg font-semibold text-gray-800">License</h3>

<p class="text-sm text-gray-700">
	This version of Hitchmap is released into the public domain. The Hitchmap database is licensed
	under the ODBL.
</p>
