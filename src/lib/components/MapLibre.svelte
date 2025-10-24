<script lang="ts">
	import type { Feature, Geometry } from 'geojson';
	import {
		CircleLayer,
		type LayerClickInfo,
		MapLibre,
		GeoJSON,
		SymbolLayer
	} from 'svelte-maplibre';

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

	const {
		onClick,
		data,
		...props
	}: {
		onClick: (feature: SingleProperties | null) => void;
		data: GeoJSON.FeatureCollection<Geometry, SingleProperties>;
	} = $props();
</script>

<MapLibre
	center={[50, 20]}
	zoom={2}
	maxZoom={14}
	standardControls
	style="https://tiles.openfreemap.org/styles/liberty"
	onclick={() => onClick(null)}
	projection={{ type: 'globe' }}
	{...props}
>
	<GeoJSON
		id="notes"
		{data}
		cluster={{
			radius: 75,
			properties: {
				point_count: ['+', ['get', 'point_count']]
			}
		}}
	>
		<CircleLayer
			id="cluster_circles"
			applyToClusters
			onclick={(e: LayerClickInfo<Feature<Geometry, any>>) => onClick(e.features?.[0]?.properties)}
			hoverCursor="pointer"
			manageHoverState
			paint={{
				'circle-color': [
					'step',
					['get', 'point_count'],
					'rgba(23, 106, 60, 0.9)', // green for <50, 70% opacity
					50,
					'rgba(255, 152, 0, 0.9)', // orange for 50-300
					300,
					'rgba(156, 47, 47, 0.9)' // red for >=300
				],
				'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
				'circle-stroke-width': 6,
				'circle-stroke-color': [
					'step',
					['get', 'point_count'],
					'rgba(23, 106, 60, 0.3)', // green stroke, 30% opacity
					50,
					'rgba(255, 152, 0, 0.3)', // orange stroke
					300,
					'rgba(156, 47, 47, 0.3)' // red stroke
				]
			}}
		/>

		<SymbolLayer
			interactive={false}
			applyToClusters
			layout={{
				'text-font': ['Noto Sans Regular'], // Needs to match available fonts in map style
				'text-field': ['format', ['get', 'point_count_abbreviated']],
				'text-size': 12,
				'text-offset': [0, -0.1]
			}}
			paint={{
				'text-color': '#ffffff'
			}}
		/>

		<CircleLayer
			applyToClusters={false}
			onclick={(e: LayerClickInfo<Feature<Geometry, SingleProperties>>) =>
				onClick(e.features?.[0]?.properties)}
			hoverCursor="pointer"
			paint={{
				'circle-color': [
					'case',
					['has', 'rating'],
					[
						'interpolate',
						['linear'],
						['get', 'rating'],
						1,
						'#9c2f2f', // red for bad (rating 1)
						3,
						'#ff9800', // orange for medium (rating 3)
						5,
						'#2ecc40' // brighter green for good (rating 5)
					],
					'#11b4da' // default color if no rating
				],
				'circle-radius': 6,
				'circle-stroke-width': 1,
				'circle-stroke-color': '#000'
			}}
		/>
	</GeoJSON>
</MapLibre>
