import { browser } from '$app/environment';
import NDKCacheAdapterSqliteWasm from '@nostr-dev-kit/cache-sqlite-wasm';
import type { NDKCacheAdapter } from '@nostr-dev-kit/ndk';
import { NDKSvelte } from '@nostr-dev-kit/svelte';
import { SvelteSet } from 'svelte/reactivity';

let cacheAdapter: NDKCacheAdapter | undefined = $state(undefined);

if (browser) {
	cacheAdapter = new NDKCacheAdapterSqliteWasm({
		dbName: 'hitchmap-ndk',
		useWorker: true,
		workerUrl: '/wasm/worker.js',
		wasmUrl: '/wasm/sql-wasm.wasm'
	}) as any;
}

const DEFAULT_RELAYS = ['wss://relay.nomadwiki.org', 'wss://relay.trustroots.org'];

let selectedRelayUrls = new SvelteSet(DEFAULT_RELAYS);
export const availableRelays = DEFAULT_RELAYS;

export const ndk = new NDKSvelte({
	explicitRelayUrls: Array.from(selectedRelayUrls),
	autoConnectUserRelays: true,
	cacheAdapter
});

(async () => {
	if (!browser) return;

	if (cacheAdapter) {
		console.log('Initializing NDK Sqlite WASM Cache Adapter');
		await cacheAdapter?.initialize?.(ndk);
	}

	ndk.connect().then(() => console.log('NDK Connected'));
})();
