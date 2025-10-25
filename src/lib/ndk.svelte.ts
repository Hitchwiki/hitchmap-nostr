import NDKCacheAdapterSqliteWasm from '@nostr-dev-kit/cache-sqlite-wasm';
import { NDKNip07Signer, NDKPrivateKeySigner, type NDKCacheAdapter } from '@nostr-dev-kit/ndk';
import { NDKSvelte } from '@nostr-dev-kit/svelte';
import { SvelteSet } from 'svelte/reactivity';
import { BASE_PATH, DEFAULT_RELAYS } from './constants';

let cacheAdapter: NDKCacheAdapter | undefined = $state(undefined);

if (typeof window !== 'undefined') {
	cacheAdapter = new NDKCacheAdapterSqliteWasm({
		dbName: 'hitchmap-ndk',
		useWorker: true,
		workerUrl: `${BASE_PATH}wasm/worker.js`,
		wasmUrl: `${BASE_PATH}wasm/sql-wasm.wasm`
	}) as any;
}

let selectedRelayUrls = new SvelteSet(DEFAULT_RELAYS);
export const availableRelays = DEFAULT_RELAYS;

export let signer: {
	instance: NDKPrivateKeySigner | NDKNip07Signer | undefined;
} = $state({
	instance: undefined
});

export const ndk = new NDKSvelte({
	explicitRelayUrls: Array.from(selectedRelayUrls),
	autoConnectUserRelays: true,
	cacheAdapter
});

// @todo Test NIP-07
export async function initializeSigner() {
	if (signer.instance) return signer.instance;

	if (window.nostr) {
		try {
			const nip07Signer = new NDKNip07Signer();
			await nip07Signer.blockUntilReady();
			signer.instance = nip07Signer;
			ndk.signer = signer.instance;
			return signer.instance;
		} catch (e) {
			console.warn('Failed to initialize NIP-07 signer, falling back to private key signer.', e);
		}
	}

	const storedSigner = localStorage.getItem('hitchmap:signer');
	if (storedSigner) {
		signer.instance = await NDKPrivateKeySigner.fromPayload(storedSigner, ndk);
		ndk.signer = signer.instance;
		return signer.instance;
	}

	const ncryptsec = localStorage.getItem('hitchmap:ncryptsec');
	if (ncryptsec) {
		signer.instance = NDKPrivateKeySigner.fromNcryptsec(ncryptsec, 'password', ndk);
		ndk.signer = signer.instance;
		return signer.instance;
	}

	signer.instance = NDKPrivateKeySigner.generate();
	ndk.signer = signer.instance;
	localStorage.setItem('hitchmap:signer', await signer.instance.toPayload());
	return signer.instance;
}

export async function resetSigner() {
	localStorage.removeItem('hitchmap:signer');
	localStorage.removeItem('hitchmap:ncryptsec');
	signer.instance = undefined;
	return initializeSigner();
}

(async () => {
	if (typeof window === 'undefined') return;

	if (cacheAdapter) {
		console.log(
			`Setting up NDK Sqlite WASM Cache Adapter, ${cacheAdapter ? 'success' : 'failed'} – ${JSON.stringify(cacheAdapter)}`
		);
		await cacheAdapter?.initializeAsync?.(ndk);
	}

	ndk.connect().then(() => console.log('NDK Connected'));
})();
