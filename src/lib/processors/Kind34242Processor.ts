import type { NDKEvent, NDKRawEvent } from '@nostr-dev-kit/ndk';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
import { IEventProcessor } from './BaseProcessor';
import type { SingleProperties } from './types';
import type { HitchhikingRide } from '../types/hitchhiking';

// Concrete Kind34242Processor class
export class Kind34242Processor extends IEventProcessor {
	async process(event: any): Promise<GeoJSONFeature<Geometry, SingleProperties> | null> {
		if (!this.validateEvent(event)) {
			throw new Error('Invalid event structure');
		}

		let rideData: HitchhikingRide;
		try {
			console.log('Processing kind 34242 event:', event);
			rideData = JSON.parse(event.content);
		} catch (error) {
			console.error('Failed to parse JSON for kind 34242 event:', error);
			return null;
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
				rating: rideData.rating
			}
		};
	}
}