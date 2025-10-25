import NDKCacheAdapterSqliteWasm from '@nostr-dev-kit/cache-sqlite-wasm';
import type { NDKCacheAdapter } from '@nostr-dev-kit/ndk';
import NDK, { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';

const BASE_PATH = import.meta.env.DEV ? '/' : '/hitchmap-nostr/';

let cacheAdapter: NDKCacheAdapter | undefined = new NDKCacheAdapterSqliteWasm({
	dbName: 'hitchmap-ndk',
	useWorker: true,
	workerUrl: `${BASE_PATH}wasm/worker.js`,
	wasmUrl: `${BASE_PATH}wasm/sql-wasm.wasm`
}) as any;

self.postMessage({
	type: 'log',
	message: `Web Worker: Setting up NDK Sqlite WASM Cache Adapter, ${cacheAdapter ? 'success' : 'failed'} – ${JSON.stringify(cacheAdapter)}`
});

const DEFAULT_RELAYS = ['wss://relay.nomadwiki.org', 'wss://relay.trustroots.org'];

let selectedRelayUrls = new Set(DEFAULT_RELAYS);
export const availableRelays = DEFAULT_RELAYS;

export const ndk = new NDK({
	explicitRelayUrls: Array.from(selectedRelayUrls),
	autoConnectUserRelays: true,
	cacheAdapter
});

const BATCH_SIZE = 500;

(async () => {
	await ndk
		.connect()
		.then(() => self.postMessage({ type: 'log', message: 'Web Worker: NDK Connected' }));

	const events: any[] = [];
	ndk.subscribe(
		{
			kinds: [1, 36820] as any[],
			'#t': ['hitchmap'],
			limit: 1000
		},
		{
			cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
			onEvent: (event) => {
				events.push(event.rawEvent());
				if (events.length >= BATCH_SIZE) {
					self.postMessage({ type: 'batch', items: JSON.stringify(events.splice(0, BATCH_SIZE)) });
				}
			},
			onEose: () => {
				if (events.length > 0) {
					self.postMessage({ type: 'batch', items: JSON.stringify(events.splice(0)) });
				}
				self.postMessage({ type: 'done' });
			}
		}
	);
})();
