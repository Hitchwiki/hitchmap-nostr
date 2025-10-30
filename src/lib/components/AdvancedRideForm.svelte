<script lang="ts">
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { encodeGeoHash } from '../geohash';
	import { initializeSigner, ndk } from '../ndk.svelte';
	import type {
		DeclinedRide,
		HitchhikingRide,
		Person,
		RideDetails,
		Signal,
		Stop
	} from '../types/hitchhiking';
	import LocationPicker from './LocationPicker.svelte';
	import PublishButton from './PublishButton.svelte';

	let {
		onRidePublished = (ride: HitchhikingRide) => {}
	}: {
		onRidePublished?: (ride: HitchhikingRide) => void;
	} = $props();

	let initialCoordinates: [number, number] | undefined = [0, 0];

	let rideData = $state({
		rating: 3,
		comment: '',
		stops: [{ latitude: 0, longitude: 0, arrival_time: '', departure_time: '' }] as Stop[],
		hitchhikers: [
			{ name: '', age: undefined, gender: 'other' as const, nationality: '' }
		] as Person[],
		signals: [] as Signal[],
		occupants: 1,
		mode_of_transportation: 'car' as const,
		ride: {
			distance: undefined,
			duration: undefined,
			cost: undefined,
			currency: ''
		} as RideDetails,
		declined_rides: [] as DeclinedRide[]
	});

	let isPublishing = $state(false);
	let publishError = $state('');

	let errors = $derived.by(() => {
		const errs = {
			rating: '',
			stops: '',
			hitchhikers: '',
			occupants: '',
			mode_of_transportation: ''
		};

		// Rating validation
		if (rideData.rating < 1 || rideData.rating > 5) {
			errs.rating = 'Rating must be between 1 and 5';
		}

		// Stops validation
		if (
			rideData.stops.length === 0 ||
			rideData.stops.some((stop) => stop.latitude === 0 || stop.longitude === 0)
		) {
			errs.stops = 'At least one valid stop is required';
		}

		// Hitchhikers validation
		if (rideData.hitchhikers.length === 0 || rideData.hitchhikers.some((h) => !h.name.trim())) {
			errs.hitchhikers = 'At least one hitchhiker with a name is required';
		}

		// Occupants validation
		if (rideData.occupants < 1) {
			errs.occupants = 'At least 1 occupant is required';
		}

		// Mode of transportation validation
		if (!rideData.mode_of_transportation) {
			errs.mode_of_transportation = 'Mode of transportation is required';
		}

		return errs;
	});

	let isValid = $derived.by(
		() =>
			!errors.rating &&
			!errors.stops &&
			!errors.hitchhikers &&
			!errors.occupants &&
			!errors.mode_of_transportation
	);

	function createRideData(): HitchhikingRide {
		return {
			version: '1.0',
			stops: rideData.stops.filter((stop) => stop.latitude !== 0 && stop.longitude !== 0),
			rating: rideData.rating,
			hitchhikers: rideData.hitchhikers.filter((h) => h.name.trim()),
			comment: rideData.comment || undefined,
			signals: rideData.signals,
			occupants: rideData.occupants,
			mode_of_transportation: rideData.mode_of_transportation,
			ride: rideData.ride,
			declined_rides: rideData.declined_rides,
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
			await initializeSigner();

			const ride = createRideData();
			const geohash = encodeGeoHash(ride.stops[0].latitude, ride.stops[0].longitude, 12);
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

	// Initialize location from initialCoordinates
	$effect(() => {
		if (initialCoordinates && rideData.stops.length > 0) {
			rideData.stops[0].latitude = initialCoordinates[1];
			rideData.stops[0].longitude = initialCoordinates[0];
		}
	});

	// Stop management functions
	function addStop() {
		rideData.stops.push({ latitude: 0, longitude: 0, arrival_time: '', departure_time: '' });
	}

	function removeStop(index: number) {
		if (rideData.stops.length > 1) {
			rideData.stops.splice(index, 1);
		}
	}

	function updateStopLocation(index: number, latitude: number, longitude: number) {
		rideData.stops[index].latitude = latitude;
		rideData.stops[index].longitude = longitude;
	}

	// Hitchhiker management functions
	function addHitchhiker() {
		rideData.hitchhikers.push({ name: '', age: undefined, gender: 'other', nationality: '' });
	}

	function removeHitchhiker(index: number) {
		if (rideData.hitchhikers.length > 1) {
			rideData.hitchhikers.splice(index, 1);
		}
	}

	// Signal management functions
	function addSignal() {
		rideData.signals.push({ type: 'thumb', description: '', duration: undefined });
	}

	function removeSignal(index: number) {
		rideData.signals.splice(index, 1);
	}

	// Declined ride management functions
	function addDeclinedRide() {
		rideData.declined_rides.push({ reason: '', timestamp: '', location: undefined });
	}

	function removeDeclinedRide(index: number) {
		rideData.declined_rides.splice(index, 1);
	}

	function updateDeclinedRideLocation(index: number, latitude: number, longitude: number) {
		if (!rideData.declined_rides[index].location) {
			rideData.declined_rides[index].location = { latitude, longitude };
		} else {
			rideData.declined_rides[index].location!.latitude = latitude;
			rideData.declined_rides[index].location!.longitude = longitude;
		}
	}
</script>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- Rating -->
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

	<!-- Comment -->
	<div>
		<label for="comment" class="mb-1 block text-sm font-medium text-gray-700"> Comment </label>
		<textarea
			id="comment"
			class="resize-vertical w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
			placeholder="Share your detailed experience..."
			rows="4"
			bind:value={rideData.comment}
		></textarea>
		<p class="mt-1 text-xs text-gray-500">{rideData.comment.length}/1000 characters</p>
	</div>

	<!-- Stops -->
	<div>
		<div class="mb-2 flex items-center justify-between">
			<label class="block text-sm font-medium text-gray-700" for="stop-location-0">
				Stops <span class="text-red-500">*</span>
			</label>
			<button type="button" class="text-sm text-blue-600 hover:text-blue-800" onclick={addStop}>
				+ Add Stop
			</button>
		</div>
		{#each rideData.stops as stop, index}
			<div class="mb-4 rounded border border-gray-200 p-4">
				<div class="mb-2 flex items-center justify-between">
					<h4 class="text-sm font-medium">Stop {index + 1}</h4>
					{#if rideData.stops.length > 1}
						<button
							type="button"
							class="text-sm text-red-600 hover:text-red-800"
							onclick={() => removeStop(index)}
						>
							Remove
						</button>
					{/if}
				</div>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-600">Arrival Time</label>
							<input
								type="datetime-local"
								class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
								bind:value={stop.arrival_time}
							/>
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-gray-600">Departure Time</label>
							<input
								type="datetime-local"
								class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
								bind:value={stop.departure_time}
							/>
						</div>
					</div>
				</div>
			</div>
		{/each}
		{#if errors.stops}
			<p class="mt-1 text-sm text-red-600">{errors.stops}</p>
		{/if}
	</div>

	<!-- Hitchhikers -->
	<div>
		<div class="mb-2 flex items-center justify-between">
			<label class="block text-sm font-medium text-gray-700">
				Hitchhikers <span class="text-red-500">*</span>
			</label>
			<button
				type="button"
				class="text-sm text-blue-600 hover:text-blue-800"
				onclick={addHitchhiker}
			>
				+ Add Hitchhiker
			</button>
		</div>
		{#each rideData.hitchhikers as hitchhiker, index}
			<div class="mb-4 rounded border border-gray-200 p-4">
				<div class="mb-2 flex items-center justify-between">
					<h4 class="text-sm font-medium">Hitchhiker {index + 1}</h4>
					{#if rideData.hitchhikers.length > 1}
						<button
							type="button"
							class="text-sm text-red-600 hover:text-red-800"
							onclick={() => removeHitchhiker(index)}
						>
							Remove
						</button>
					{/if}
				</div>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-600">Name</label>
						<input
							type="text"
							class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
							placeholder="Full name"
							bind:value={hitchhiker.name}
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-600">Age</label>
						<input
							type="number"
							class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
							placeholder="Age"
							min="1"
							max="120"
							bind:value={hitchhiker.age}
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-600">Gender</label>
						<select
							class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
							bind:value={hitchhiker.gender}
						>
							<option value="male">Male</option>
							<option value="female">Female</option>
							<option value="other">Other</option>
						</select>
					</div>
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-600">Nationality</label>
						<input
							type="text"
							class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
							placeholder="Country of origin"
							bind:value={hitchhiker.nationality}
						/>
					</div>
				</div>
			</div>
		{/each}
		{#if errors.hitchhikers}
			<p class="mt-1 text-sm text-red-600">{errors.hitchhikers}</p>
		{/if}
	</div>

	<!-- Signals -->
	<div>
		<div class="mb-2 flex items-center justify-between">
			<label class="block text-sm font-medium text-gray-700"> Signals </label>
			<button type="button" class="text-sm text-blue-600 hover:text-blue-800" onclick={addSignal}>
				+ Add Signal
			</button>
		</div>
		{#each rideData.signals as signal, index}
			<div class="mb-4 rounded border border-gray-200 p-4">
				<div class="mb-2 flex items-center justify-between">
					<h4 class="text-sm font-medium">Signal {index + 1}</h4>
					<button
						type="button"
						class="text-sm text-red-600 hover:text-red-800"
						onclick={() => removeSignal(index)}
					>
						Remove
					</button>
				</div>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-600">Type</label>
						<select
							class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
							bind:value={signal.type}
						>
							<option value="thumb">Thumb</option>
							<option value="sign">Sign</option>
							<option value="phone">Phone</option>
							<option value="other">Other</option>
						</select>
					</div>
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-600">Description</label>
						<input
							type="text"
							class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
							placeholder="Signal description"
							bind:value={signal.description}
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-600">Duration (minutes)</label>
						<input
							type="number"
							class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
							placeholder="Duration"
							min="1"
							bind:value={signal.duration}
						/>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Vehicle Details -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<div>
			<label for="occupants" class="mb-2 block text-sm font-medium text-gray-700">
				Number of Occupants <span class="text-red-500">*</span>
			</label>
			<input
				id="occupants"
				type="number"
				class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
				min="1"
				max="50"
				bind:value={rideData.occupants}
			/>
			{#if errors.occupants}
				<p class="mt-1 text-sm text-red-600">{errors.occupants}</p>
			{/if}
		</div>

		<div>
			<label for="mode" class="mb-2 block text-sm font-medium text-gray-700">
				Mode of Transportation <span class="text-red-500">*</span>
			</label>
			<select
				id="mode"
				class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
				bind:value={rideData.mode_of_transportation}
			>
				<option value="car">Car</option>
				<option value="truck">Truck</option>
				<option value="bus">Bus</option>
				<option value="train">Train</option>
				<option value="other">Other</option>
			</select>
			{#if errors.mode_of_transportation}
				<p class="mt-1 text-sm text-red-600">{errors.mode_of_transportation}</p>
			{/if}
		</div>
	</div>

	<!-- Ride Details -->
	<div>
		<label class="mb-2 block text-sm font-medium text-gray-700"> Ride Details </label>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label class="mb-1 block text-xs font-medium text-gray-600">Distance (km)</label>
				<input
					type="number"
					class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
					placeholder="Distance traveled"
					min="0"
					step="0.1"
					bind:value={rideData.ride.distance}
				/>
			</div>
			<div>
				<label class="mb-1 block text-xs font-medium text-gray-600">Duration (minutes)</label>
				<input
					type="number"
					class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
					placeholder="Ride duration"
					min="0"
					bind:value={rideData.ride.duration}
				/>
			</div>
			<div>
				<label class="mb-1 block text-xs font-medium text-gray-600">Cost</label>
				<input
					type="number"
					class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
					placeholder="Cost amount"
					min="0"
					step="0.01"
					bind:value={rideData.ride.cost}
				/>
			</div>
			<div>
				<label class="mb-1 block text-xs font-medium text-gray-600">Currency</label>
				<input
					type="text"
					class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
					placeholder="e.g., USD, EUR"
					bind:value={rideData.ride.currency}
				/>
			</div>
		</div>
	</div>

	<!-- Declined Rides -->
	<div>
		<div class="mb-2 flex items-center justify-between">
			<label class="block text-sm font-medium text-gray-700"> Declined Rides </label>
			<button
				type="button"
				class="text-sm text-blue-600 hover:text-blue-800"
				onclick={addDeclinedRide}
			>
				+ Add Declined Ride
			</button>
		</div>
		{#each rideData.declined_rides as declinedRide, index}
			<div class="mb-4 rounded border border-gray-200 p-4">
				<div class="mb-2 flex items-center justify-between">
					<h4 class="text-sm font-medium">Declined Ride {index + 1}</h4>
					<button
						type="button"
						class="text-sm text-red-600 hover:text-red-800"
						onclick={() => removeDeclinedRide(index)}
					>
						Remove
					</button>
				</div>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-600">Reason</label>
						<input
							type="text"
							class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
							placeholder="Reason for declining"
							bind:value={declinedRide.reason}
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs font-medium text-gray-600">Timestamp</label>
						<input
							type="datetime-local"
							class="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
							bind:value={declinedRide.timestamp}
						/>
					</div>
					<div class="md:col-span-2">
						<label class="mb-1 block text-xs font-medium text-gray-600">Location</label>
						{#if declinedRide.location}
							<LocationPicker
								bind:latitude={declinedRide.location.latitude}
								bind:longitude={declinedRide.location.longitude}
							/>
						{:else}
							<LocationPicker latitude={0} longitude={0} />
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>

	{#if publishError}
		<p class="text-sm text-red-600">{publishError}</p>
	{/if}

	<div class="flex justify-end">
		<PublishButton {isPublishing} onclick={handlePublish} disabled={!isValid} />
	</div>
</div>
