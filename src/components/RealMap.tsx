'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
// @ts-ignore
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Entrance } from '@/data/entrances';

export interface MapController {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: (lat: number, lng: number) => void;
}

interface RealMapProps {
  waypoints: any[];
  entrances: Entrance[];
  routeGeoJSON: any | null;
  activeLayer: 'all' | 'tactile' | 'elevators' | 'ramps' | 'entrances';
  recommendedEntranceId: string | null;
  avoidedEntranceIds: string[];
  onWaypointClick: (id: number) => void;
  onEntranceClick: (ent: Entrance) => void;
}

const RealMap = forwardRef<MapController, RealMapProps>(({
  waypoints, 
  entrances, 
  routeGeoJSON, 
  activeLayer, 
  recommendedEntranceId, 
  avoidedEntranceIds, 
  onWaypointClick, 
  onEntranceClick
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    recenter: (lat: number, lng: number) => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 16 });
    }
  }));

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    
    const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';
    
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [72.8777, 19.0760],
      zoom: 12,
      maxBounds: [
        [72.70, 18.85], // southwest coordinates
        [73.05, 19.35]  // northeast coordinates
      ],
      attributionControl: false,
    });
    
    mapRef.current = map;

    map.on('load', () => {
      // Add Route Source
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Add Entrances Source
      map.addSource('entrances', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Add Waypoints Source
      map.addSource('waypoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Route Line Layer
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#2563EB', // Primary Electric Blue (#2563EB)
          'line-width': 6,
          'line-dasharray': [1, 2]
        }
      });

      // Entrance Layer (Circles)
      map.addLayer({
        id: 'entrances-circle',
        type: 'circle',
        source: 'entrances',
        paint: {
          'circle-radius': 10,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Waypoints Layer (Circles)
      map.addLayer({
        id: 'waypoints-circle',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': 12,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 4,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Interactivity
      map.on('click', 'entrances-circle', (e: any) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const entId = feature.properties.id;
        const ent = entrances.find(x => x.id === entId);
        if (ent) onEntranceClick(ent);
      });

      map.on('mouseenter', 'entrances-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'entrances-circle', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', 'waypoints-circle', (e: any) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        onWaypointClick(feature.properties.id);
      });

      map.on('mouseenter', 'waypoints-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'waypoints-circle', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync data to map layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const updateData = () => {
      // 1. Route
      const routeSource = map.getSource('route') as maplibregl.GeoJSONSource;
      if (routeSource) {
        routeSource.setData(routeGeoJSON || { type: 'FeatureCollection', features: [] });
      }

      // 2. Entrances
      const entrancesSource = map.getSource('entrances') as maplibregl.GeoJSONSource;
      if (entrancesSource) {
        if (activeLayer === 'all' || activeLayer === 'entrances') {
          const features = entrances.map(ent => {
            let color = '#475569'; // grey (other)
            if (recommendedEntranceId === ent.id) {
              color = '#2563EB'; // Primary Electric Blue (#2563EB)
            } else if (avoidedEntranceIds.includes(ent.id)) {
              color = '#dc2626'; // red
            }
            return {
              type: 'Feature',
              properties: { id: ent.id, color, name: ent.name },
              geometry: { type: 'Point', coordinates: [ent.lng, ent.lat] }
            };
          });
          entrancesSource.setData({ type: 'FeatureCollection', features: features as any });
        } else {
          entrancesSource.setData({ type: 'FeatureCollection', features: [] });
        }
      }

      // 3. Waypoints
      const waypointsSource = map.getSource('waypoints') as maplibregl.GeoJSONSource;
      if (waypointsSource) {
        const features = waypoints.map(wp => {
          const color = wp.type === 'destination' ? '#FACC15' : '#1D4ED8';
          // using fallback coords if lat/lng missing
          const lng = wp.lng || 72.8885;
          const lat = wp.lat || 19.0460;
          return {
            type: 'Feature',
            properties: { id: wp.id, color, title: wp.title },
            geometry: { type: 'Point', coordinates: [lng, lat] }
          };
        });
        waypointsSource.setData({ type: 'FeatureCollection', features: features as any });
      }
    };

    if (map.loaded()) {
      updateData();
    } else {
      map.once('load', updateData);
    }
  }, [routeGeoJSON, entrances, waypoints, activeLayer, recommendedEntranceId, avoidedEntranceIds]);

  return (
    <div 
      ref={mapContainer} 
      className="absolute inset-0 w-full h-full"
      role="region"
      aria-label="Interactive Map of Mumbai"
    >
      <div className="sr-only">
        This is an interactive map. If you are using a screen reader, please refer to the turn-by-turn and Last 50m text sections available in the side panel for navigation details.
      </div>
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
