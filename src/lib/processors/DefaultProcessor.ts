import type { NDKEvent, NDKRawEvent } from '@nostr-dev-kit/ndk';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
import { IEventProcessor } from './BaseProcessor';
import type { SingleProperties } from './types';

// Concrete DefaultProcessor class
export class DefaultProcessor extends IEventProcessor {
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
			}
		};
	}
}