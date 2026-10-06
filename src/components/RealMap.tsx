'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
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

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

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
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);

  const defaultCenter = useMemo(() => ({ lat: 19.0760, lng: 72.8777 }), []);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(12);

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (mapRef.current) {
        mapRef.current.setZoom((mapRef.current.getZoom() || 12) + 1);
      }
    },
    zoomOut: () => {
      if (mapRef.current) {
        mapRef.current.setZoom((mapRef.current.getZoom() || 12) - 1);
      }
    },
    recenter: (lat: number, lng: number) => {
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(16);
      } else {
        setMapCenter({ lat, lng });
        setZoom(16);
      }
    }
  }));

  const onLoad = React.useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = React.useCallback(() => {
    mapRef.current = null;
  }, []);

  // Parse GeoJSON to Path for Polyline
  const routePath = useMemo(() => {
    if (!routeGeoJSON) return [];
    try {
      const feature = routeGeoJSON.features?.[0];
      if (feature && feature.geometry && feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates;
        return coords.map((c: any) => ({ lat: c[1], lng: c[0] }));
      }
    } catch (e) {
      console.error('Failed to parse routeGeoJSON', e);
    }
    return [];
  }, [routeGeoJSON]);

  // Compute entrances to show
  const activeEntrances = useMemo(() => {
    if (activeLayer === 'all' || activeLayer === 'entrances') {
      return entrances;
    }
    return [];
  }, [entrances, activeLayer]);

  if (loadError) {
    return <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-red-500">Error loading Google Maps</div>;
  }

  if (!isLoaded) {
    return <div className="absolute inset-0 flex items-center justify-center bg-gray-100">Loading Map...</div>;
  }

  return (
    <div className="absolute inset-0 w-full h-full" role="region" aria-label="Interactive Map of Mumbai">
      <div className="sr-only">
        This is an interactive map. If you are using a screen reader, please refer to the turn-by-turn and Last 50m text sections available in the side panel for navigation details.
      </div>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={mapCenter}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          disableDefaultUI: true, // we hide default UI to keep our custom UI clean
          zoomControl: false,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: false,
          styles: [
            {
              "featureType": "all",
              "elementType": "geometry.fill",
              "stylers": [
                  {
                      "weight": "2.00"
                  }
              ]
            },
            {
              "featureType": "all",
              "elementType": "geometry.stroke",
              "stylers": [
                  {
                      "color": "#9c9c9c"
                  }
              ]
            },
            {
              "featureType": "all",
              "elementType": "labels.text",
              "stylers": [
                  {
                      "visibility": "on"
                  }
              ]
            },
            {
              "featureType": "landscape",
              "elementType": "all",
              "stylers": [
                  {
                      "color": "#f2f2f2"
                  }
              ]
            },
            {
              "featureType": "landscape",
              "elementType": "geometry.fill",
              "stylers": [
                  {
                      "color": "#ffffff"
                  }
              ]
            },
            {
              "featureType": "landscape.man_made",
              "elementType": "geometry.fill",
              "stylers": [
                  {
                      "color": "#ffffff"
                  }
              ]
            },
            {
              "featureType": "poi",
              "elementType": "all",
              "stylers": [
                  {
                      "visibility": "off"
                  }
              ]
            },
            {
              "featureType": "road",
              "elementType": "all",
              "stylers": [
                  {
                      "saturation": -100
                  },
                  {
                      "lightness": 45
                  }
              ]
            },
            {
              "featureType": "road",
              "elementType": "geometry.fill",
              "stylers": [
                  {
                      "color": "#eeeeee"
                  }
              ]
            },
            {
              "featureType": "road",
              "elementType": "labels.text.fill",
              "stylers": [
                  {
                      "color": "#7b7b7b"
                  }
              ]
            },
            {
              "featureType": "road",
              "elementType": "labels.text.stroke",
              "stylers": [
                  {
                      "color": "#ffffff"
                  }
              ]
            },
            {
              "featureType": "road.highway",
              "elementType": "all",
              "stylers": [
                  {
                      "visibility": "simplified"
                  }
              ]
            },
            {
              "featureType": "road.arterial",
              "elementType": "labels.icon",
              "stylers": [
                  {
                      "visibility": "off"
                  }
              ]
            },
            {
              "featureType": "transit",
              "elementType": "all",
              "stylers": [
                  {
                      "visibility": "off"
                  }
              ]
            },
            {
              "featureType": "water",
              "elementType": "all",
              "stylers": [
                  {
                      "color": "#46bcec"
                  },
                  {
                      "visibility": "on"
                  }
              ]
            },
            {
              "featureType": "water",
              "elementType": "geometry.fill",
              "stylers": [
                  {
                      "color": "#c8d7d4"
                  }
              ]
            },
            {
              "featureType": "water",
              "elementType": "labels.text.fill",
              "stylers": [
                  {
                      "color": "#070707"
                  }
              ]
            },
            {
              "featureType": "water",
              "elementType": "labels.text.stroke",
              "stylers": [
                  {
                      "color": "#ffffff"
                  }
              ]
            }
          ]
        }}
      >
        {/* Route Polyline */}
        {routePath.length > 0 && (
          <Polyline
            path={routePath}
            options={{
              strokeColor: '#2563EB',
              strokeOpacity: 0.8,
              strokeWeight: 6,
            }}
          />
        )}

        {/* Waypoints */}
        {waypoints.map((wp) => {
          const lng = wp.lng || 72.8885;
          const lat = wp.lat || 19.0460;
          const isDest = wp.type === 'destination';
          return (
            <Marker
              key={wp.id}
              position={{ lat, lng }}
              onClick={() => onWaypointClick(wp.id)}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: isDest ? '#FACC15' : '#1D4ED8',
                fillOpacity: 1,
                strokeWeight: 4,
                strokeColor: '#ffffff',
                scale: 12,
              }}
              title={wp.title}
            />
          );
        })}

        {/* Entrances */}
        {activeEntrances.map((ent) => {
          let color = '#475569';
          if (recommendedEntranceId === ent.id) {
            color = '#2563EB';
          } else if (avoidedEntranceIds.includes(ent.id)) {
            color = '#dc2626';
          }
          return (
            <Marker
              key={`ent-${ent.id}`}
              position={{ lat: ent.lat, lng: ent.lng }}
              onClick={() => onEntranceClick(ent)}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeWeight: 3,
                strokeColor: '#ffffff',
                scale: 10,
              }}
              title={ent.name}
            />
          );
        })}
      </GoogleMap>
    </div>
  );
});

RealMap.displayName = 'RealMap';

export default RealMap;
