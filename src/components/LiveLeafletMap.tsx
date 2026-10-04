import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';

interface LiveLeafletMapProps {
  center: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  zoom?: number;
  accuracy?: number;
  routeGeojson?: any;
  navigationStep?: any;
}

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

export default function LiveLeafletMap({ center, destination, zoom = 15, accuracy, routeGeojson, navigationStep }: LiveLeafletMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const routePath = useMemo(() => {
    if (!routeGeojson) return [];
    try {
      if (routeGeojson.geometry && routeGeojson.geometry.type === 'LineString') {
        const coords = routeGeojson.geometry.coordinates;
        return coords.map((c: any) => ({ lat: c[1], lng: c[0] }));
      }
    } catch (e) {
      console.error('Failed to parse routeGeojson', e);
    }
    return [];
  }, [routeGeojson]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const map = mapRef.current;

    if (navigationStep?.location) {
      // Zoom into the exact turn-by-turn step
      map.panTo({ lat: navigationStep.location.lat, lng: navigationStep.location.lng });
      map.setZoom(19);
    } else if (routePath && routePath.length > 0) {
      // Fit the entire route in view
      const bounds = new window.google.maps.LatLngBounds();
      routePath.forEach((p: any) => bounds.extend(p));
      map.fitBounds(bounds, { bottom: 40, top: 40, left: 40, right: 40 });
    } else if (center && destination) {
      // Zoom to fit both origin and destination before routing
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(center);
      bounds.extend(destination);
      map.fitBounds(bounds, { bottom: 50, top: 50, left: 50, right: 50 });
    } else if (center) {
      // Default to centering on the GPS location
      map.panTo(center);
      map.setZoom(zoom);
    }
  }, [navigationStep, routePath, center, destination, zoom]);

  if (loadError) return <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-gray-100 text-red-500">Error loading Google Maps</div>;
  if (!isLoaded) return <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-gray-100">Loading Map...</div>;

  return (
    <div className="w-full h-full min-h-[400px] relative z-0">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
        }}
      >
        {/* User Location Marker */}
        <Marker
          position={center}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#2563EB',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 8,
          }}
          title={`Your Live Location\nAccuracy: ±${accuracy || 0}m`}
        />

        {/* Destination Marker */}
        {destination && (
          <Marker
            position={destination}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#DC2626', // Red color for destination
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            }}
            title="Destination"
          />
        )}

        {/* Route Path */}
        {routePath.length > 0 && (
          <Polyline
            path={routePath}
            options={{
              strokeOpacity: 0,
              icons: [
                {
                  icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    fillColor: '#2563EB',
                    fillOpacity: 1,
                    scale: 4,
                    strokeColor: '#2563EB',
                    strokeWeight: 1,
                  },
                  offset: '0',
                  repeat: '20px'
                }
              ],
            }}
          />
        )}

        {/* Navigation Step Overlay Marker */}
        {navigationStep?.location && (
          <Marker 
            position={{ lat: navigationStep.location.lat, lng: navigationStep.location.lng }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#FACC15',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            }}
            title={`Current Turn\n${navigationStep.title || 'Navigation Step'}`}
          />
        )}
      </GoogleMap>
    </div>
  );
}
