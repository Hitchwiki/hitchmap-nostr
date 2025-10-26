import type { NDKEvent, NDKRawEvent } from '@nostr-dev-kit/ndk';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
import { DefaultProcessor } from './DefaultProcessor';
import type { SingleProperties } from './types';

// Concrete Kind36820Processor class
export class Kind36820Processor extends DefaultProcessor {
	async process(event: NDKEvent | NDKRawEvent): Promise<GeoJSONFeature<Geometry, SingleProperties> | null> {
		if (!this.validateEvent(event)) {
			throw new Error('Invalid event structure');
		}

		const coordinates = this.extractLocation(event);
		if (!coordinates) return null;

		let username: string | null = null;
		let { content, created_at: time } = event;
		let rating;

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
				kind: event.kind,
				id: event.id,
				pubkey: event.pubkey,
				user: null, //profile,
				time,
				username: username || undefined,
				content,
				geohash: coordinates.geohash || undefined,
				coordinates: coordinates.lngLat,
				tags: event.tags,
				rating,
				rawEvent: event,
			}
		};
	}
}