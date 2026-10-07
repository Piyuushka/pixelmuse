import React, { useState, useEffect, useRef } from 'react';
import { searchLocation, getPlaceDetails, GeocodeResult, Coordinates } from '@/lib/orsClient';
import { DEMO_LOCATIONS } from '@/data/routeSimulatorData';
import { Search, MapPin, Loader2, X } from 'lucide-react';

interface LocationSearchInputProps {
  label: string;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onLocationSelect: (location: { name: string; coords: Coordinates; placeId?: string }) => void;
  initialValue?: string;
}

export default function LocationSearchInput({
  label,
  placeholder = 'Search location...',
  icon,
  disabled = false,
  onLocationSelect,
  initialValue = ''
}: LocationSearchInputProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommittedNameRef = useRef<string>(initialValue);
  const lastCommittedCoordsRef = useRef<Coordinates | null>(null);
  const lastCommittedPlaceIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Close dropdown if clicked outside
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const prevInitialValueRef = useRef(initialValue);
  useEffect(() => {
    // Only auto sync if initialValue itself changed externally (e.g. preset chosen or swap clicked)
    if (initialValue !== undefined && initialValue !== prevInitialValueRef.current) {
      prevInitialValueRef.current = initialValue;
      setQuery(initialValue);
      lastCommittedNameRef.current = initialValue;
    }
  }, [initialValue]);

  const commitLocation = async (text: string, preferredCoords?: Coordinates, placeId?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    
    // If the input already matches the last committed valid selection, do not re-geocode or overwrite
    if (
      trimmed.toLowerCase() === lastCommittedNameRef.current.toLowerCase() &&
      lastCommittedCoordsRef.current &&
      (lastCommittedCoordsRef.current.lat !== 0 || lastCommittedCoordsRef.current.lng !== 0)
    ) {
      return;
    }

    // 1. Check exact preset location name match
    const norm = trimmed.toLowerCase();
    const matchedLoc = DEMO_LOCATIONS.find(l => l.name.toLowerCase() === norm);

    if (matchedLoc?.lat && matchedLoc?.lng) {
      const coords = { lat: matchedLoc.lat, lng: matchedLoc.lng };
      lastCommittedNameRef.current = matchedLoc.name;
      lastCommittedCoordsRef.current = coords;
      lastCommittedPlaceIdRef.current = undefined;
      onLocationSelect({
        name: matchedLoc.name,
        coords,
        placeId: undefined,
      });
      return;
    }

    if (preferredCoords && (preferredCoords.lat !== 0 || preferredCoords.lng !== 0)) {
      lastCommittedNameRef.current = trimmed;
      lastCommittedCoordsRef.current = preferredCoords;
      lastCommittedPlaceIdRef.current = placeId;
      onLocationSelect({
        name: trimmed,
        coords: preferredCoords,
        placeId,
      });
      return;
    }

    // 2. Real Geocode search via Google/Nominatim
    try {
      setIsLoading(true);
      const searchData = await searchLocation(trimmed);
      if (searchData && searchData.length > 0) {
        const best = searchData[0];
        let coords = best.coordinates;
        if ((!coords || (coords.lat === 0 && coords.lng === 0)) && best.placeId) {
          const detailedCoords = await getPlaceDetails(best.placeId);
          if (detailedCoords) coords = detailedCoords;
        }

        if (coords && (coords.lat !== 0 || coords.lng !== 0)) {
          lastCommittedNameRef.current = best.name;
          lastCommittedCoordsRef.current = coords;
          lastCommittedPlaceIdRef.current = best.placeId;
          onLocationSelect({
            name: best.name,
            coords,
            placeId: best.placeId,
          });
        }
      }
    } catch (err) {
      console.warn('Location commit geocode error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuggestions = async (text: string) => {
    if (!text || text.trim().length < 2) {
      setResults([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await searchLocation(text);
      setResults(data);
      setIsOpen(data.length > 0);
    } catch (err) {
      console.warn('Fetch suggestions failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setQuery(text);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 250);
  };

  const handleSelect = async (result: GeocodeResult) => {
    setQuery(result.name);
    setIsOpen(false);
    
    let coords = result.coordinates;
    if ((!coords || (coords.lat === 0 && coords.lng === 0)) && result.placeId) {
      setIsLoading(true);
      try {
        const details = await getPlaceDetails(result.placeId);
        if (details) coords = details;
      } finally {
        setIsLoading(false);
      }
    }

    lastCommittedNameRef.current = result.name;
    lastCommittedCoordsRef.current = coords;
    lastCommittedPlaceIdRef.current = result.placeId;

    onLocationSelect({
      name: result.name,
      coords,
      placeId: result.placeId,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        handleSelect(results[0]);
      } else {
        commitLocation(query);
        setIsOpen(false);
      }
    }
  };

  const handleBlur = () => {
    if (query && query !== lastCommittedNameRef.current) {
      commitLocation(query);
    }
  };

  return (
    <div className="flex flex-col gap-2 relative" ref={containerRef}>
      <label className="text-xs font-black uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => { 
            if (query && query.length >= 2 && results.length > 0) {
              setIsOpen(true);
            } else if (query && query.length >= 2) {
              fetchSuggestions(query);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-12 px-3.5 pr-10 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : query ? (
            <button 
              type="button" 
              onClick={() => { 
                setQuery(''); 
                setResults([]); 
                setIsOpen(false);
                lastCommittedNameRef.current = '';
                lastCommittedCoordsRef.current = null;
                lastCommittedPlaceIdRef.current = undefined;
                onLocationSelect({ name: '', coords: { lat: 0, lng: 0 }, placeId: undefined });
              }}
              className="p-1 hover:text-on-surface transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <Search className="w-4 h-4 opacity-50" />
          )}
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-[72px] left-0 w-full z-50 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-xl max-h-60 overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={`${result.placeId || result.name}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur before click registers
                handleSelect(result);
              }}
              className="w-full px-4 py-3 text-left hover:bg-surface-container-low border-b border-outline-variant/20 last:border-0 flex items-start gap-3 transition-colors cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold text-on-surface truncate">{result.name}</span>
                <span className="text-xs font-medium text-on-surface-variant truncate">{result.label}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
