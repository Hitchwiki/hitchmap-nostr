import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
import { decodeGeoHash } from './geohash';

interface LocationData {
	latitude: number;
	longitude: number;
	accuracy?: number;
	timestamp?: number;
}

interface UserProfile {
	id: string;
	name: string;
	avatar?: string;
	bio?: string;
}

interface Feature {
	name: string;
	enabled: boolean;
	value?: any;
}

interface ProcessedContent {
	text: string;
	media?: string[];
	links?: string[];
}

interface ProcessedData {
	content: ProcessedContent;
	location?: LocationData;
	user: UserProfile;
	features: Feature[];
	timestamp: number;
	kind: number;
}

type SingleProperties = {
	id: string;
	pubkey: string;
	user: any;
	time: number;
	username?: string;
	content: string;
	geohash?: string;
	coordinates: [number, number];
	tags: any[];
	rating?: number;
};

// Abstract EventProcessor base class
abstract class IEventProcessor {
	constructor() {}

	abstract processWorker(event: any): Promise<any>;

	abstract process(event: any): Promise<GeoJSONFeature<Geometry, SingleProperties> | null>;

	// Shared method to validate event structure
	protected validateEvent(event: any): boolean {
		return event && typeof event === 'object' && 'kind' in event && 'content' in event;
	}

	// Extract location from event tags
	protected extractLocation(
		event: any
	): { lngLat: [number, number]; geohash: string | null } | null {
		if (!event?.tags?.length) return null;

		const longestGTag = event.tags
			.filter((tag: any) => tag[0] === 'g' && typeof tag[1] === 'string' && tag[1].length)
			.reduce(
				(longest: string, tag: any) => (tag[1].length > longest.length ? tag[1] : longest),
				''
			);

		if (!longestGTag) return null;

		// Check if longestGTag is in "lat,lng" format
		const latLngMatch = longestGTag.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
		if (latLngMatch) {
			const lat = parseFloat(latLngMatch[1]);
			const lng = parseFloat(latLngMatch[3]);
			if (isFinite(lat) && isFinite(lng)) {
				return { lngLat: [lng, lat], geohash: null };
			}
			return null;
		}

		// Import decodeGeoHash dynamically to avoid circular imports
		const location = decodeGeoHash(longestGTag);
		if (!location) return null;
		return { lngLat: [location.longitude[2], location.latitude[2]], geohash: longestGTag };
	}
}

// Concrete DefaultProcessor class
class DefaultProcessor extends IEventProcessor {
	async processWorker(event: any): Promise<any> {}

	async process(event: any): Promise<GeoJSONFeature<Geometry, SingleProperties> | null> {
		if (!this.validateEvent(event)) {
			throw new Error('Invalid event structure');
		}

		const coordinates = this.extractLocation(event);
		if (!coordinates) return null;

		let username: string | null = null;
		let { content, created_at: time, rating } = event;

		const match = content.match(/^hitchmap\.com\s*(.*?):\s*/);
		if (match) {
			username = match[1]?.trim() || null;
			content = content.slice(match[0].length);
		}
		content = content.replace(/\s*#hitchhiking\s*$/i, '').trim();

		return {
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates: coordinates.lngLat
			},
			properties: {
				id: event.id,
				pubkey: event.pubkey,
				user: null, //profile,
				time,
				username: username || undefined,
				content,
				geohash: coordinates.geohash || undefined,
				coordinates: coordinates.lngLat,
				tags: event.tags,
				rating
			}
		};
	}
}

// Concrete Kind36820Processor class
class Kind36820Processor extends DefaultProcessor {
	async process(event: any): Promise<GeoJSONFeature<Geometry, SingleProperties> | null> {
		if (!this.validateEvent(event)) {
			throw new Error('Invalid event structure');
		}

		const coordinates = this.extractLocation(event);
		if (!coordinates) return null;

		let username: string | null = null;
		let { content, created_at: time, rating } = event;

		try {
			const data = JSON.parse(content);
			username = data?.hitchhikers?.[0]?.nickname ?? null;
			content = data.comment || content;
			if (data.submission_time) {
				const date = new Date(data.submission_time);
				if (!isNaN(date.getTime())) time = Math.floor(date.getTime() / 1000);
			}
			if (typeof data.rating !== 'undefined') rating = data.rating;
		} catch (error) {
			console.error('Failed to parse JSON for kind 36820 event:', error);
			return null;
		}

		return {
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates: coordinates.lngLat
			},
			properties: {
				id: event.id,
				pubkey: event.pubkey,
				user: null, //profile,
				time,
				username: username || undefined,
				content,
				geohash: coordinates.geohash || undefined,
				coordinates: coordinates.lngLat,
				tags: event.tags,
				rating: typeof rating !== 'undefined' ? rating : Math.floor(Math.random() * 5) + 1
			}
		};
	}
}

// EventProcessorFactory class
class EventProcessorFactory {
	private static processors: Map<number, new () => IEventProcessor> = new Map();

	static register(kind: number, processorClass: new () => IEventProcessor): void {
		this.processors.set(kind, processorClass);
	}

	static createProcessor(event: any): IEventProcessor {
		const ProcessorClass = this.processors.get(event.kind);
		if (ProcessorClass) {
			return new ProcessorClass();
		}
		return new DefaultProcessor();
	}
}

// Register processors
EventProcessorFactory.register(36820, Kind36820Processor);

class EventProcessorWorkerManager {
	private workers: Worker[] = [];
	private nextWorkerIndex = 0;
	private pendingPromises: Map<string, Promise<any>> = new Map();

	constructor(workerCount: number = navigator.hardwareConcurrency || 4) {
		if (typeof window === 'undefined' || !window.Worker) {
			console.warn('Web Workers are not supported in this environment.');
			return;
		}

		for (let i = 0; i < workerCount; i++) {
			this.workers.push(
				new Worker(new URL('./eventProcessor.worker.ts', import.meta.url), {
					type: 'module'
				})
			);
		}
	}

	private getNextWorker(): Worker | undefined {
		if (this.workers.length === 0) return undefined;
		const worker = this.workers[this.nextWorkerIndex];
		this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
		return worker;
	}

	processWithWorker(event: any): Promise<any> {
		const worker = this.getNextWorker();

		if (!worker || !window.Worker) {
			if (!window.Worker) {
				console.warn('Web Workers are not supported in this environment.');
			} else {
				console.warn('No available workers to process the event.');
			}

			// Fallback to direct processing if no worker is available
			const processor = EventProcessorFactory.createProcessor(event);
			return processor.process(event);
		}

		// Use a unique requestId to map responses to requests
		const requestId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
		if (!(worker as any)._listeners) {
			(worker as any)._listeners = new Map<string, { resolve: Function; reject: Function }>();
		}
		const listeners: Map<string, { resolve: Function; reject: Function }> = (worker as any)
			._listeners;

		const handleMessage = (e: MessageEvent) => {
			const data = e.data;
			if (typeof data !== 'object' || !data.requestId) return;
			const listener = listeners.get(data.requestId);
			if (listener) {
				listener.resolve(data.feature);
				listeners.delete(data.requestId);
				this.pendingPromises.delete(data.requestId);
			}
		};

		const handleError = (err: ErrorEvent) => {
			console.log('Worker error:', err, requestId);
			const listener = listeners.get(requestId);
			if (listener) {
				listener.reject(err);
				listeners.delete(requestId);
				this.pendingPromises.delete(requestId);
			}
		};

		// Attach the message handler only once per worker
		if (!(worker as any)._hasGlobalListener) {
			worker.addEventListener('message', handleMessage);
			worker.addEventListener('error', handleError);
			(worker as any)._hasGlobalListener = true;
		}

		const promise = new Promise((resolve, reject) => {
			listeners.set(requestId, { resolve, reject });

			worker.postMessage({
				requestId,
				event: {
					tags: event.tags,
					kind: event.kind,
					content: event.content,
					created_at: event.created_at,
					id: event.id,
					pubkey: event.pubkey
				}
			});
		});

		this.pendingPromises.set(requestId, promise);

		return promise;
	}
}

export {
	DefaultProcessor,
	EventProcessorFactory,
	EventProcessorWorkerManager,
	IEventProcessor,
	Kind36820Processor,
	type LocationData,
	type ProcessedContent,
	type ProcessedData,
	type UserProfile
};
