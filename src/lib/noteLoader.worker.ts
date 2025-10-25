import NDKCacheAdapterSqliteWasm from '@nostr-dev-kit/cache-sqlite-wasm';
import type { NDKCacheAdapter } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';
import { DEFAULT_RELAYS } from './ndk.svelte';

const BASE_PATH = import.meta.env.DEV ? '/' : '/hitchmap-nostr/';
const BATCH_SIZE = 500;
const LIMIT = 5000; //Number.MAX_SAFE_INTEGER; // 9007199254740991

let selectedRelayUrls = new Set(DEFAULT_RELAYS);
export const availableRelays = DEFAULT_RELAYS;

let cacheAdapter: NDKCacheAdapter = new NDKCacheAdapterSqliteWasm({
	dbName: 'hitchmap-ndk',
	useWorker: true,
	workerUrl: `${BASE_PATH}wasm/worker.js`,
	wasmUrl: `${BASE_PATH}wasm/sql-wasm.wasm`
}) as any;

export const ndk = new NDK({
	explicitRelayUrls: Array.from(selectedRelayUrls),
	autoConnectUserRelays: true,
	cacheAdapter
});

(async () => {
	await ndk
		.connect()
		.then(() => self.postMessage({ type: 'log', message: 'Web Worker: NDK Connected' }));
		
	cacheAdapter.initializeAsync?.(ndk);

	/** @todo Check if with new fixes, the subscription will work again (allows us to communicate progress) */
	const events = await ndk.fetchEvents({
		kinds: [1, 36820] as any[],
		'#t': ['hitchmap'],
		limit: LIMIT
	});

	let batchedEvents = [];
	for (const event of events) {
		batchedEvents.push(event.rawEvent());
	}

	self.postMessage({ type: 'done', items: JSON.stringify(batchedEvents) });
})();
