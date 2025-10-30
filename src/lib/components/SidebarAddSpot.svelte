<script lang="ts">
	import type { HitchhikingRide } from '../types/hitchhiking';
	import AdvancedRideForm from './AdvancedRideForm.svelte';
	import SimpleRideForm from './SimpleRideForm.svelte';

	export let onRidePublished: (ride: HitchhikingRide) => void = () => {};

	let mode: 'simple' | 'advanced' = 'simple';

	function handleRidePublished(ride: HitchhikingRide) {
		onRidePublished(ride);
	}
</script>

<!-- Mode Toggle -->
<!-- <div class="flex border-b border-gray-200">
	<button
		class="flex-1 px-4 py-3 text-sm font-medium transition-colors {mode === 'simple'
			? 'border-b-2 border-gray-600 text-gray-800'
			: 'text-gray-500 hover:text-gray-700'}"
		onclick={() => (mode = 'simple')}
	>
		Simple
	</button>
	<button
		class="flex-1 px-4 py-3 text-sm font-medium transition-colors {mode === 'advanced'
			? 'border-b-2 border-gray-600 text-gray-800'
			: 'text-gray-500 hover:text-gray-700'}"
		onclick={() => (mode = 'advanced')}
	>
		Advanced
	</button>
</div> -->

<!-- Content -->
<div class="flex-1 overflow-y-auto p-4">
	{#if mode === 'simple'}
		<SimpleRideForm onRidePublished={handleRidePublished} />
	{:else}
		<AdvancedRideForm onRidePublished={handleRidePublished} />
	{/if}
</div>
