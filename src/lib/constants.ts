export const BASE_PATH = import.meta.env.DEV ? '/' : '/hitchmap-nostr/';
export const DEFAULT_RELAYS = ['wss://relay.nomadwiki.org', 'wss://relay.trustroots.org'];
export const DEFAULT_FILTERS = {
	kinds: [1, 34242, 36820] as any[],
	'#t': ['hitchmap', 'hitchhiking']
	// This will result in too few results.
	// '#g': [...'0123456789bcdefghjkmnpqrstuvwxyz']
};
