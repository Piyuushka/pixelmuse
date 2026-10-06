import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { VoiceButton } from './VoiceButton';

export interface LocationInputConnectorProps {
  source: string;
  destination: string;
  onSourceChange: (val: string) => void;
  onDestinationChange: (val: string) => void;
  onSwap?: () => void;
  sourcePlaceholder?: string;
  destinationPlaceholder?: string;
  className?: string;
}

export const LocationInputConnector: React.FC<LocationInputConnectorProps> = ({
  source,
  destination,
  onSourceChange,
  onDestinationChange,
  onSwap,
  sourcePlaceholder = 'Choose origin / starting location...',
  destinationPlaceholder = 'Search accessible destination...',
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Dots connection visual column */}
      <div className="flex flex-col items-center gap-1.5 py-1 shrink-0">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-primary bg-white shadow-xs" />
        <div className="w-0.5 h-8 bg-outline-variant/50 border-dashed" />
        <div className="w-3.5 h-3.5 rounded-full bg-secondary shadow-xs flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
      </div>

      {/* Input Fields */}
      <div className="flex-1 flex flex-col gap-2">
        <div className="relative flex items-center">
          <input
            type="text"
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder={sourcePlaceholder}
            aria-label="Origin starting location"
            className="w-full h-11 pl-3 pr-9 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="absolute right-1.5">
            <VoiceButton announcement="Voice input active for origin starting location" size="sm" />
          </div>
        </div>

        <div className="relative flex items-center">
          <input
            type="text"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            placeholder={destinationPlaceholder}
            aria-label="Destination location"
            className="w-full h-11 pl-3 pr-9 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="absolute right-1.5">
            <VoiceButton announcement="Voice input active for destination" size="sm" />
          </div>
        </div>
      </div>

      {/* Swap Button */}
      {onSwap && (
        <button
          type="button"
          onClick={onSwap}
          aria-label="Swap origin and destination"
          className="p-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default LocationInputConnector;
