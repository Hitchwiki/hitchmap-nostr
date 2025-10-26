<script lang="ts">
	import { DEFAULT_KINDS } from '$lib/constants';
	import type { Feature, Geometry } from 'geojson';
	import {
		CircleLayer,
		GeoJSON,
		type LayerClickInfo,
		MapLibre,
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

	let {
		onClick,
		data,
		map = $bindable(undefined),
		...props
	}: {
		onClick: (feature: SingleProperties | null) => void;
		data: GeoJSON.FeatureCollection<Geometry, SingleProperties>;
		map: maplibregl.Map | undefined;
	} = $props();

	// Read filters from search params
	let searchParams = $derived(
		new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
	);

	// Combined filter functions for search params
	const filterFunctions = $derived.by(() => [
		// Filter by kind
		(f: any) => {
			const kinds: number[] =
				searchParams
					.get('kinds')
					?.split(',')
					.map((k) => Number(k.trim())) || DEFAULT_KINDS;
			return kinds.includes(f.properties.kind);
		},
		// Filter by minRating
		(f: any) => {
			const min = Number(searchParams.get('minRating'));
			return !min || (f.properties.rating ?? 0) >= min;
		},
		// Filter by username
		(f: any) => {
			const filter = searchParams.get('username')?.toLowerCase();
			if (!filter) return true;
			const name =
				f.properties.username ?? (typeof f.properties.user === 'string' ? f.properties.user : '');
			return name?.toLowerCase() === filter;
		},
		// Filter by content
		(f: any) => {
			const filter = searchParams.get('content')?.toLowerCase();
			return !filter || f.properties.content?.toLowerCase().includes(filter);
		},
		// Filter by minimum content length
		(f: any) => {
			const minLength = Number(searchParams.get('minContentLength'));
			return !minLength || (f.properties.content?.length ?? 0) >= minLength;
		},
		// Filter by maximum content length
		(f: any) => {
			const maxLength = Number(searchParams.get('maxContentLength'));
			return !maxLength || (f.properties.content?.length ?? 0) <= maxLength;
		}
	]);

	const filteredData = $derived.by(() => {
		return {
			...data,
			features: data.features.filter((feature: any) =>
				filterFunctions.every((fn: (f: any) => boolean) => fn(feature))
			)
		};
	});

	// Constants and helpers for styling
	const MAX_ZOOM = 14;

	const CLUSTER_STROKE_WIDTH = 6;

	const SPOT_RADIUS = 6;
	const SPOT_STROKE_WIDTH = 1;
	const SPOT_STROKE_WIDTH_HIGHLIGHTED = 2;
	const SPOT_STROKE_COLOR = '#000000';
	const SPOT_HIGHLIGHT_COUNT = 2;

	const POINT_COUNT_THRESHOLD_1 = 50;
	const POINT_COUNT_THRESHOLD_2 = 300;

	// Helper expression to safely calculate average rating without dividing by zero
	const CALCULATE_AVERAGE_RATING = [
		'case',
		['==', ['get', 'total_rating_count'], 0],
		0,
		['/', ['get', 'total_rating'], ['get', 'total_rating_count']]
	];

	// Determine whether to use average rating for cluster coloring based on search param
	const USE_AVERAGE_RATING_FOR_CLUSTERS = $derived(searchParams.has('averageClusterColoring'));

	const createPointColor = (ratingAttribute: string | typeof CALCULATE_AVERAGE_RATING) => {
		return [
			'interpolate',
			['linear'],
			[
				'coalesce',
				typeof ratingAttribute === 'string' ? ['get', ratingAttribute] : ratingAttribute,
				0
			],
			0,
			'#11b4da', // fallback color if value is 0 or missing
			1,
			'#9c2f2f', // red for bad (rating 1)
			3,
			'#ff9800', // orange for medium (rating 3)
			5,
			'#2ecc40' // brighter green for good (rating 5)
		] as any;
	};
</script>

<MapLibre
	center={[50, 20]}
	zoom={2}
	maxZoom={MAX_ZOOM}
	standardControls
	attributionControl={false}
	style="https://tiles.openfreemap.org/styles/liberty"
	onclick={() => onClick(null)}
	projection={{ type: 'globe' }}
	bind:map
	{...props}
>
	<GeoJSON
		id="notes"
		data={filteredData}
		cluster={{
			radius: 75,
			properties: {
				total_rating: ['+', ['case', ['has', 'rating'], ['get', 'rating'], 0]],
				total_rating_count: ['+', ['case', ['has', 'rating'], 1, 0]]
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
				'circle-color': USE_AVERAGE_RATING_FOR_CLUSTERS
					? createPointColor(CALCULATE_AVERAGE_RATING)
					: [
							'step',
							['zoom'],
							[
								'step',
								['get', 'point_count'],
								'rgba(23, 106, 60, 0.9)', // green for <50, 70% opacity
								POINT_COUNT_THRESHOLD_1,
								'rgba(255, 152, 0, 0.9)', // orange for 50-300
								POINT_COUNT_THRESHOLD_2,
								'rgba(156, 47, 47, 0.9)' // red for >=300
							],
							MAX_ZOOM,
							createPointColor(CALCULATE_AVERAGE_RATING)
						],
				'circle-radius': [
					'step',
					['zoom'],
					['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
					MAX_ZOOM,
					SPOT_RADIUS
				],
				'circle-stroke-width': [
					'step',
					['zoom'],
					CLUSTER_STROKE_WIDTH,
					MAX_ZOOM,
					[
						'step',
						['get', 'point_count'],
						SPOT_STROKE_WIDTH,
						SPOT_HIGHLIGHT_COUNT,
						SPOT_STROKE_WIDTH_HIGHLIGHTED
					]
				],
				'circle-stroke-opacity': 0.3, // 30% opacity for cluster strokes
				'circle-stroke-color': USE_AVERAGE_RATING_FOR_CLUSTERS
					? createPointColor(CALCULATE_AVERAGE_RATING)
					: [
							'step',
							['zoom'],
							[
								'step',
								['get', 'point_count'],
								'rgba(23, 106, 60)', // green stroke
								POINT_COUNT_THRESHOLD_1,
								'rgba(255, 152, 0)', // orange stroke
								POINT_COUNT_THRESHOLD_2,
								'rgba(156, 47, 47)' // red stroke
							],
							MAX_ZOOM,
							SPOT_STROKE_COLOR
						]
			}}
		/>

		<SymbolLayer
			interactive={false}
			maxzoom={MAX_ZOOM}
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
			onclick={(e: LayerClickInfo<Feature<Geometry, SingleProperties>>) => {
				const props = e.features?.[0]?.properties;
				if (!props) return;
				const parsed = Object.fromEntries(
					Object.entries(props).map(([key, value]) => {
						try {
							// Try to parse JSON, fallback to number, else keep as is
							if (typeof value === 'string') {
								try {
									return [key, JSON.parse(value)];
								} catch {
									const num = Number(value);
									return [key, isNaN(num) ? value : num];
								}
							}
							return [key, value];
						} catch {
							return [key, value];
						}
					})
				);
				onClick(parsed as any);
			}}
			hoverCursor="pointer"
			paint={{
				'circle-color': createPointColor('rating'),
				'circle-radius': SPOT_RADIUS,
				'circle-stroke-width': SPOT_STROKE_WIDTH,
				'circle-stroke-color': SPOT_STROKE_COLOR
			}}
		/>
	</GeoJSON>
</MapLibre>
