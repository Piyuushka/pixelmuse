'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import {
  MapPin,
  X,
  Crosshair,
  Check,
  Search,
  Compass,
  Navigation,
} from 'lucide-react';

interface MapLocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat: number;
  initialLng: number;
  onSelectLocation: (lat: number, lng: number, locationName: string) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const POPULAR_METRO_LANDMARKS = [
  { name: 'Dadar Central Station - West Exit', lat: 19.0178, lng: 72.8478 },
  { name: 'Bandra Station - Skywalk Concourse', lat: 19.0558, lng: 72.8402 },
  { name: 'Juhu Beach - Promenade Plaza', lat: 19.0988, lng: 72.8264 },
  { name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT)', lat: 18.9401, lng: 72.8354 },
  { name: 'BKC Concourse Crossing - G Block', lat: 19.0657, lng: 72.8687 },
  { name: 'Andheri Metro Station - Footbridge', lat: 19.1197, lng: 72.8464 },
];

export default function MapLocationPickerModal({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  onSelectLocation,
}: MapLocationPickerModalProps) {
  const [selectedPos, setSelectedPos] = useState<{ lat: number; lng: number }>({
    lat: initialLat || 19.0178,
    lng: initialLng || 72.8478,
  });
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  useEffect(() => {
    if (initialLat && initialLng) {
      setSelectedPos({ lat: initialLat, lng: initialLng });
      setLocationLabel(`${initialLat.toFixed(4)}° N, ${initialLng.toFixed(4)}° E`);
    }
  }, [initialLat, initialLng]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = Number(e.latLng.lat().toFixed(5));
      const lng = Number(e.latLng.lng().toFixed(5));
      setSelectedPos({ lat, lng });
      setLocationLabel(`Point: ${lat}° N, ${lng}° E`);
    }
  }, []);

  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setSelectedPos({ lat, lng });
        setLocationLabel(`Current GPS (${lat}° N, ${lng}° E)`);
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(17);
        }
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectLandmark = (lm: (typeof POPULAR_METRO_LANDMARKS)[0]) => {
    setSelectedPos({ lat: lm.lat, lng: lm.lng });
    setLocationLabel(lm.name);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: lm.lat, lng: lm.lng });
      mapRef.current.setZoom(17);
    }
  };

  const handleConfirm = () => {
    const finalLabel =
      locationLabel || `${selectedPos.lat.toFixed(4)}° N, ${selectedPos.lng.toFixed(4)}° E`;
    onSelectLocation(selectedPos.lat, selectedPos.lng, finalLabel);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-picker-title"
      className="fixed inset-0 z-[1300] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="region"
        aria-label="Interactive Map Location Picker"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-surface-container-lowest text-on-surface rounded-3xl border border-outline-variant/40 shadow-2xl overflow-hidden flex flex-col gap-0 max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 id="map-picker-title" className="text-base font-black text-on-surface leading-tight">
                Pick Hazard Location on Map
              </h3>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Click anywhere on the map or choose a landmark to set coordinates
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer"
            aria-label="Close map location picker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Landmark Chips */}
        <div className="px-4 py-2.5 bg-surface-container-lowest border-b border-outline-variant/20 flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
          <span className="text-[11px] font-black uppercase text-on-surface-variant tracking-wider whitespace-nowrap">
            Presets:
          </span>
          {POPULAR_METRO_LANDMARKS.map((lm, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectLandmark(lm)}
              className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-[11px] font-bold text-on-surface border border-outline-variant/30 whitespace-nowrap transition-colors cursor-pointer"
            >
              📍 {lm.name.split(' - ')[0]}
            </button>
          ))}
        </div>

        {/* Map Area */}
        <div className="relative w-full h-[380px] sm:h-[420px] bg-surface-container">
          {isLoaded && !loadError ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={selectedPos}
              zoom={16}
              onClick={onMapClick}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
              }}
            >
              <Marker
                position={selectedPos}
                draggable={true}
                onDragEnd={(e) => {
                  if (e.latLng) {
                    const lat = Number(e.latLng.lat().toFixed(5));
                    const lng = Number(e.latLng.lng().toFixed(5));
                    setSelectedPos({ lat, lng });
                    setLocationLabel(`Pin: ${lat}° N, ${lng}° E`);
                  }
                }}
              />
            </GoogleMap>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-3">
              <Compass className="w-10 h-10 text-primary animate-pulse" />
              <div className="text-sm font-bold text-on-surface">
                {loadError ? 'Map failed to load' : 'Loading Map Engine...'}
              </div>
              <p className="text-xs text-on-surface-variant max-w-sm">
                You can still set the exact coordinates directly:
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.0001"
                  value={selectedPos.lat}
                  onChange={(e) => setSelectedPos((p) => ({ ...p, lat: parseFloat(e.target.value) || 0 }))}
                  className="px-3 py-1.5 rounded-xl border border-outline-variant/40 text-xs w-28 bg-surface-container-lowest font-mono"
                  placeholder="Latitude"
                />
                <input
                  type="number"
                  step="0.0001"
                  value={selectedPos.lng}
                  onChange={(e) => setSelectedPos((p) => ({ ...p, lng: parseFloat(e.target.value) || 0 }))}
                  className="px-3 py-1.5 rounded-xl border border-outline-variant/40 text-xs w-28 bg-surface-container-lowest font-mono"
                  placeholder="Longitude"
                />
              </div>
            </div>
          )}

          {/* Floating Current GPS Button */}
          <button
            type="button"
            onClick={handleUseCurrentGPS}
            disabled={isLocating}
            className="absolute top-3 right-3 px-3 py-2 rounded-xl bg-surface-container-lowest/95 hover:bg-surface-container-lowest text-primary text-xs font-black shadow-lg border border-outline-variant/30 flex items-center gap-1.5 backdrop-blur-xs transition-all cursor-pointer"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Acquiring GPS...' : 'My GPS'}</span>
          </button>
        </div>

        {/* Footer with Selected Coordinates & Confirm Button */}
        <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">
                Selected Position
              </span>
              <span className="text-xs font-black text-on-surface font-mono">
                {selectedPos.lat.toFixed(5)}° N, {selectedPos.lng.toFixed(5)}° E
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
