import React, { useState, useEffect, useRef } from 'react';
import { searchLocation, GeocodeResult, Coordinates } from '@/lib/orsClient';
import { DEMO_LOCATIONS } from '@/data/routeSimulatorData';
import { Search, MapPin, Loader2, X } from 'lucide-react';

interface LocationSearchInputProps {
  label: string;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onLocationSelect: (location: { name: string; coords: Coordinates }) => void;
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

  useEffect(() => {
    // Auto sync if initialValue changes externally
    if (initialValue !== undefined && initialValue !== query) {
      setQuery(initialValue);
    }
  }, [initialValue]);

  const commitLocation = (text: string, preferredCoords?: Coordinates) => {
    if (!text.trim()) return;
    
    // Check demo locations for matching name
    const norm = text.toLowerCase().trim();
    const demo = DEMO_LOCATIONS.find(l => 
      l.name.toLowerCase() === norm || 
      norm.includes(l.name.toLowerCase()) || 
      l.name.toLowerCase().includes(norm)
    );

    const coords = preferredCoords || (demo?.lat && demo?.lng ? { lat: demo.lat, lng: demo.lng } : undefined);

    onLocationSelect({
      name: demo ? demo.name : text,
      coords
    });
  };

  const fetchSuggestions = async (text: string) => {
    if (!text || text.trim().length < 2) {
      setResults([]);
      return;
    }
    
    setIsLoading(true);
    const data = await searchLocation(text);
    setResults(data);
    setIsLoading(false);
    setIsOpen(data.length > 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setQuery(text);
    
    // REMOVED commitLocation(text) here so it doesn't aggressively overwrite while typing.
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 250);
  };

  const handleSelect = (result: GeocodeResult) => {
    setQuery(result.name);
    setIsOpen(false);
    onLocationSelect({ name: result.name, coords: result.coordinates });
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
    if (query) {
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
            if (query && query.length >= 2) {
              fetchSuggestions(query);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-12 px-3.5 pr-10 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : query ? (
            <button 
              type="button" 
              onClick={() => { 
                setQuery(''); 
                setResults([]); 
                onLocationSelect({ name: '', coords: { lat: 19.0178, lng: 72.8478 } });
              }}
              className="p-1 hover:text-on-surface"
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
              key={idx}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur before click registers
                handleSelect(result);
              }}
              className="w-full px-4 py-3 text-left hover:bg-surface-container-low border-b border-outline-variant/20 last:border-0 flex items-start gap-3 transition-colors cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="flex flex-col">
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
