import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
import type { HitchhikingRide } from '../types/hitchhiking';
import { IEventProcessor } from './BaseProcessor';
import type { SingleProperties } from './types';

// Concrete Kind34242Processor class
export class Kind34242Processor extends IEventProcessor {
	async process(event: any): Promise<GeoJSONFeature<Geometry, SingleProperties> | null> {
		if (!this.validateEvent(event)) {
			throw new Error('Invalid event structure');
		}

		let rideData: HitchhikingRide | null = null;
		try {
			rideData = JSON.parse(event.content);
		} catch (error) {
			console.warn('Failed to parse JSON for kind 34242 event, treating as plain text:', error);
		}

		// If parsing failed, treat as plain text event
		if (!rideData) {
			const location = this.extractLocation(event);
			if (!location) return null;
			
			const { lngLat: coordinates, geohash } = location;
			// Extract username if present in event.content
			let content = event.content;
			let username: string | undefined = undefined;

			const hitchmapUserRegex = /^hitchmap\.com\s+([a-zA-Z0-9_]+):\s*/i;
			const hitchmapPrefixRegex = /^hitchmap\.com\s*:\s*/i;
			const hitchhikingHashtagRegex = /\s*#hitchhiking\s*$/i;

			const userMatch = content.match(hitchmapUserRegex);
			if (userMatch) {
				username = userMatch[1];
				content = content.replace(hitchmapUserRegex, '');
			} else if (hitchmapPrefixRegex.test(content)) {
				content = content.replace(hitchmapPrefixRegex, '');
			}

			// Remove trailing #hitchhiking hashtag if present
			content = content.replace(hitchhikingHashtagRegex, '');

			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates
				},
				properties: {
					kind: event.kind,
					id: event.id,
					pubkey: event.pubkey,
					user: username,
					time: event.created_at,
					content: content.trim(),
					geohash: geohash || undefined,
					coordinates,
					tags: event.tags,
					rating: undefined,
					rawEvent: event,
				}
			};
		}

		if (!rideData.stops || rideData.stops.length === 0) return null;

		// Use only the first stop (origin)
		const firstStop = rideData.stops[0];
		const coordinates: [number, number] = [firstStop.longitude, firstStop.latitude];

		// Extract username from hitchhikers
		const username = rideData.hitchhikers.length > 0 ? rideData.hitchhikers[0].name : undefined;

		// Use submission_time or created_at
		let time = event.created_at;
		if (rideData.submission_time) {
			const date = new Date(rideData.submission_time);
			if (!isNaN(date.getTime())) time = Math.floor(date.getTime() / 1000);
		}

		// Determine content based on ride details
		let content = rideData.comment || '';
		if (firstStop.arrival_time || firstStop.departure_time) {
			const arrival = firstStop.arrival_time
				? new Date(firstStop.arrival_time).toLocaleString()
				: '';
			const departure = firstStop.departure_time
				? new Date(firstStop.departure_time).toLocaleString()
				: '';
			content += ` Departure: ${departure}`;
		}
		content = content.trim();

		return {
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates
			},
			properties: {
				kind: event.kind,
				id: event.id,
				pubkey: event.pubkey,
				user: null,
				time,
				username,
				content,
				geohash: undefined, // Could compute if needed
				coordinates,
				tags: event.tags,
				rating: rideData.rating,
				rawEvent: event,
			}
		};
	}
}
