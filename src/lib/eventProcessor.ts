// TypeScript interfaces for data structures
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
abstract class EventProcessor {
	constructor(protected ndk: any) {}

	abstract process(event: any): Promise<GeoJSONFeature<Geometry, SingleProperties> | null>;

	// Shared method to validate event structure
	protected validateEvent(event: any): boolean {
		return event && typeof event === 'object' && 'kind' in event && 'content' in event;
	}

	// Shared method to extract basic data
	protected extractBasicData(event: any): Partial<ProcessedData> {
		return {
			timestamp: event.created_at || Date.now(),
			kind: event.kind,
			user: {
				id: event.pubkey || '',
				name: 'Anonymous'
			},
			features: []
		};
	}

	// Extract location from event tags
	protected extractLocation(
		event: any
	): { lngLat: [number, number]; geohash: string | null } | null {
		const gTags = event.tags.filter((tag: any) => tag[0] === 'g' && tag[1]);
		const longestGTag = gTags.reduce(
			(longest: string, tag: any) => (tag[1].length > (longest?.length ?? 0) ? tag[1] : longest),
			''
		);

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

// Concrete Kind36820Processor class
class Kind36820Processor extends EventProcessor {
	async process(event: any): Promise<GeoJSONFeature<Geometry, SingleProperties> | null> {
		if (!this.validateEvent(event)) {
			throw new Error('Invalid event structure');
		}

		const coordinates = this.extractLocation(event);
		if (!coordinates) return null;

		let username: string | null = null;
		let content = event.content;
		let time = event.created_at;
		let rating = event.rating;

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

		const user = await this.ndk.fetchUser(event.pubkey);
		const userProfile = await user?.fetchProfile();
		const { profileEvent, ...profile } = userProfile ?? {};

		return {
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates: coordinates.lngLat
			},
			properties: {
				id: event.id,
				pubkey: event.pubkey,
				user: profile,
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

// Concrete DefaultProcessor class
class DefaultProcessor extends EventProcessor {
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

		const user = await this.ndk.fetchUser(event.pubkey);
		const userProfile = await user?.fetchProfile();
		const { profileEvent, ...profile } = userProfile ?? {};

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

// EventProcessorFactory class
class EventProcessorFactory {
	private static processors: Map<number, new (ndk: any) => EventProcessor> = new Map();

	static register(kind: number, processorClass: new (ndk: any) => EventProcessor): void {
		this.processors.set(kind, processorClass);
	}

	static createProcessor(event: any, ndk: any): EventProcessor {
		const ProcessorClass = this.processors.get(event.kind);
		if (ProcessorClass) {
			return new ProcessorClass(ndk);
		}
		return new DefaultProcessor(ndk);
	}
}

// Register processors
EventProcessorFactory.register(36820, Kind36820Processor);

export {
  DefaultProcessor,
  EventProcessor,
  EventProcessorFactory,
  Kind36820Processor,
  type Feature,
  type LocationData,
  type ProcessedContent,
  type ProcessedData,
  type UserProfile
};

