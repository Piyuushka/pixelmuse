import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with Next.js/Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LiveLeafletMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  accuracy?: number;
  routeGeojson?: any;
  navigationStep?: any;
}

function MapUpdater({ center, accuracy }: { center: { lat: number; lng: number }; accuracy?: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.flyTo([center.lat, center.lng], map.getZoom());
  }, [center, map]);

  return null;
}

export default function LiveLeafletMap({ center, zoom = 15, accuracy, routeGeojson, navigationStep }: LiveLeafletMapProps) {
  // A unique key for GeoJSON forces re-render if the object reference changes
  const geojsonKey = routeGeojson ? JSON.stringify(routeGeojson.geometry.coordinates) : 'empty';

  return (
    <div className="w-full h-full min-h-[400px] relative z-0">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <Marker position={[center.lat, center.lng]}>
          <Popup>
            Your Live Location <br /> Accuracy: ±{accuracy || 0}m
          </Popup>
        </Marker>

        {routeGeojson && (
          <GeoJSON 
            key={geojsonKey} 
            data={routeGeojson} 
            style={() => ({
              color: '#2563EB', // Primary Electric Blue (#2563EB)
              weight: 5,
              opacity: 0.8,
              lineJoin: 'round',
            })}
          />
        )}
        
        {/* Navigation Step Overlay Marker */}
        {navigationStep?.location && (
          <Marker position={[navigationStep.location.lat, navigationStep.location.lng]}>
            <Popup autoPan={false}>
              <strong>Current Turn</strong><br/>
              {navigationStep.instruction}
            </Popup>
          </Marker>
        )}

        <MapUpdater center={center} accuracy={accuracy} />
      </MapContainer>
    </div>
  );
}
