import { ndk } from './ndk.svelte';

const BATCH_SIZE = 5000;

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
