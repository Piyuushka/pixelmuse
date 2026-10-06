import { useState, useCallback } from 'react';
import { useVoiceFeedback } from './useVoiceFeedback';

export interface LocationPlannerConfig {
  initialSource?: string;
  initialDestination?: string;
}

export function useLocationPlannerState(config?: LocationPlannerConfig) {
  const [source, setSource] = useState<string>(config?.initialSource || 'Current Location (GPS)');
  const [destination, setDestination] = useState<string>(config?.initialDestination || 'Shivaji Park, Dadar');
  const [isListening, setIsListening] = useState<boolean>(false);
  const { speakText } = useVoiceFeedback();

  const swapLocations = useCallback(() => {
    setSource((prevSource) => {
      const prevDest = destination;
      setDestination(prevSource);
      return prevDest;
    });
    speakText('Swapped origin and destination');
  }, [destination, speakText]);

  const setSourceLocation = useCallback((val: string) => {
    setSource(val);
  }, []);

  const setDestinationLocation = useCallback((val: string) => {
    setDestination(val);
  }, []);

  return {
    source,
    destination,
    isListening,
    setIsListening,
    setSource: setSourceLocation,
    setDestination: setDestinationLocation,
    swapLocations,
    speakText,
  };
}
