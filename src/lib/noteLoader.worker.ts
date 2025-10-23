import NDKCacheAdapterSqliteWasm from '@nostr-dev-kit/cache-sqlite-wasm';
import type { NDKCacheAdapter } from '@nostr-dev-kit/ndk';
import NDK from '@nostr-dev-kit/ndk';

const BASE_PATH = import.meta.env.DEV ? '/' : '/hitchmap-nostr/';

let cacheAdapter: NDKCacheAdapter | undefined;

/** @todo Clearly, this cache is either not the same as in the main thread or not being used */
if (typeof window !== 'undefined') {
	cacheAdapter = new NDKCacheAdapterSqliteWasm({
		dbName: 'hitchmap-ndk',
		useWorker: true,
		workerUrl: `${BASE_PATH}wasm/worker.js`,
		wasmUrl: `${BASE_PATH}wasm/sql-wasm.wasm`
	}) as any;
}

const DEFAULT_RELAYS = ['wss://relay.nomadwiki.org', 'wss://relay.trustroots.org'];

let selectedRelayUrls = new Set(DEFAULT_RELAYS);
export const availableRelays = DEFAULT_RELAYS;

export const ndk = new NDK({
	explicitRelayUrls: Array.from(selectedRelayUrls),
	autoConnectUserRelays: true,
	cacheAdapter
});

(async () => {
	if (typeof window === 'undefined') return;

	if (cacheAdapter) {
		console.log('Initializing NDK Sqlite WASM Cache Adapter');
		await cacheAdapter?.initialize?.(ndk);
	}

	ndk.connect().then(() => console.log('NDK Connected'));
})();

const BATCH_SIZE = 500;

(async () => {
	await ndk.connect();

	const sub = ndk.subscribe({
		kinds: [1, 36820] as any[],
		'#t': ['hitchmap'],
		limit: 99999
	});

	const events: any[] = [];

	sub.on('event', (event) => {
		events.push(event.rawEvent());
		if (events.length >= BATCH_SIZE) {
			self.postMessage({ type: 'batch', events: events.splice(0, BATCH_SIZE) });
		}
	});

	sub.on('eose', () => {
		if (events.length > 0) {
			self.postMessage({ type: 'batch', events: events.splice(0) });
		}
		self.postMessage({ type: 'done' });
	});

	sub.start();
})();
