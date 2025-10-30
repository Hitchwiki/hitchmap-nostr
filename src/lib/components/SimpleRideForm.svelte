<script lang="ts">
	import { mapStore } from '$lib/mapStore.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { encodeGeoHash } from '../geohash';
	import { initializeSigner, ndk } from '../ndk.svelte';
	import type { HitchhikingRide, Location, Person, RideDetails } from '../types/hitchhiking';
	import PublishButton from './PublishButton.svelte';

	let {
		onRidePublished = (ride: HitchhikingRide) => {}
	}: {
		onRidePublished?: (ride: HitchhikingRide) => void;
	} = $props();

	let initialCoordinates: [number, number] | undefined = [0, 0];

	let rideData = $state({
		rating: 3,
		comment: ''
	});

	let isPublishing = $state(false);
	let publishError = $state('');

	let errors = $derived.by(() => {
		const errs = {
			rating: '',
			location: ''
		};

		if (rideData.rating < 1 || rideData.rating > 5) {
			errs.rating = 'Rating must be between 1 and 5';
		}

		if (
			!mapStore.currentCoords ||
			typeof mapStore.currentCoords[0] !== 'number' ||
			typeof mapStore.currentCoords[1] !== 'number'
		) {
			errs.location = 'Location is required';
		}

		return errs;
	});

	let isValid = $derived.by(() => !errors.rating && !errors.location);

	function createRideData(): HitchhikingRide {
		const location: Location = {
			latitude: mapStore.currentCoords![1],
			longitude: mapStore.currentCoords![0]
		};

		const defaultPerson: Person = {
			name: 'Anonymous',
			gender: 'other'
		};

		const defaultRideDetails: RideDetails = {
			distance: undefined,
			duration: undefined,
			cost: undefined,
			currency: undefined
		};

		return {
			version: '1.0',
			stops: [location],
			rating: rideData.rating,
			hitchhikers: [defaultPerson],
			comment: rideData.comment || undefined,
			signals: [],
			occupants: 1,
			mode_of_transportation: 'car',
			ride: defaultRideDetails,
			declined_rides: [],
			source: 'hitchmap-web',
			license: 'CC-BY-SA-4.0',
			submission_time: new Date().toISOString()
		};
	}

	async function handlePublish() {
		if (!isValid) {
			return;
		}

		isPublishing = true;
		publishError = '';

		try {
			// Initialize signer if not already done
			await initializeSigner();

			const ride = createRideData();
			const geohash = encodeGeoHash(mapStore.currentCoords![1], mapStore.currentCoords![0], 12);
			const content = JSON.stringify(ride);

			const event = new NDKEvent(ndk, {
				kind: 34242,
				content,
				tags: [
					['d', geohash],
					['g', geohash],
					['published_at', Math.floor(Date.now() / 1000).toString()],
					['t', 'hitchhiking'],
					['t', 'ride']
				]
			});

			await event.publish();
			onRidePublished(ride);
		} catch (error) {
			if (error instanceof Error && error.message.includes('signer')) {
				publishError =
					'Authentication failed. Please check your Nostr extension or key configuration.';
			} else {
				publishError = 'Failed to publish ride. Please try again.';
			}
			console.error('Publish error:', error);
		} finally {
			isPublishing = false;
		}
	}
</script>

<div class="space-y-4">
	<div>
		<label for="rating" class="mb-2 block text-sm font-medium text-gray-700">
			Rating <span class="text-red-500">*</span>
		</label>
		<div class="flex gap-1">
			{#each [1, 2, 3, 4, 5] as star}
				<button
					type="button"
					class="text-2xl transition-colors hover:scale-110 {rideData.rating >= star
						? 'text-yellow-400'
						: 'text-gray-300'}"
					onclick={() => (rideData.rating = star)}
					aria-label="Rate {star} star{star > 1 ? 's' : ''}"
				>
					★
				</button>
			{/each}
		</div>
		{#if errors.rating}
			<p class="mt-1 text-sm text-red-600">{errors.rating}</p>
		{/if}
	</div>

	<div>
		<label for="comment" class="mb-1 block text-sm font-medium text-gray-700"> Comment </label>
		<textarea
			id="comment"
			class="resize-vertical w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
			placeholder="Share your experience..."
			rows="3"
			bind:value={rideData.comment}
		></textarea>
		<p class="mt-1 text-xs text-gray-500">{rideData.comment.length}/500 characters</p>
	</div>

	<div>
		<label for="location" class="mb-2 block text-sm font-medium text-gray-700">
			Location <span class="text-red-500">*</span>
		</label>
		<p class="mb-2 text-sm text-gray-600">Please select your location on the map by dragging it.</p>
		{#if mapStore.currentCoords}
			<div class="flex w-full uppercase text-xs bg-gray-200 p-2">
				<span class="w-1/2 truncate text-gray-800" title="Latitude">
					Lat: {mapStore.currentCoords[1].toFixed(6)}
				</span>
				<span class="w-1/2 truncate text-gray-800" title="Longitude">
					Lng: {mapStore.currentCoords[0].toFixed(6)}
				</span>
			</div>
		{:else}
			<p class="text-sm text-gray-500">Location not available.</p>
		{/if}
		{#if errors.location}
			<p class="mt-1 text-sm text-red-600">{errors.location}</p>
		{/if}
	</div>

	{#if publishError}
		<p class="text-sm text-red-600">{publishError}</p>
	{/if}

	<div class="flex justify-end">
		<PublishButton {isPublishing} onclick={handlePublish} disabled={!isValid} />
	</div>
</div>
