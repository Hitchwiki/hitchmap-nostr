import { browser } from '$app/environment';
import type { NDKCacheAdapter } from '@nostr-dev-kit/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import { NDKSvelte } from '@nostr-dev-kit/svelte';
import { SvelteSet } from 'svelte/reactivity';

let cacheAdapter: NDKCacheAdapter | undefined = $state(undefined);

if (browser) {
	console.log('Initializing NDK Dexie Cache Adapter');
	cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'lightfoot' }) as any;
}

const DEFAULT_RELAYS = [
	'wss://relay.nomadwiki.org',
	'wss://relay.trustroots.org'
	// 'wss://relay.damus.io',
	// 'wss://relay.nostr.band',
	// 'wss://f7z.io',
	// 'wss://nos.lol',
	// 'wss://nostr.wine'
];

let selectedRelayUrls = new SvelteSet(DEFAULT_RELAYS);
export const availableRelays = DEFAULT_RELAYS;

export const ndk = new NDKSvelte({
	explicitRelayUrls: Array.from(selectedRelayUrls),
	autoConnectUserRelays: true,
	cacheAdapter
});

ndk.connect().then(() => console.log('NDK Connected'));
