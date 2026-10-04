import dynamic from 'next/dynamic';

interface LiveMapWrapperProps {
  center: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  accuracy?: number;
  zoom?: number;
  routeGeojson?: any;
  navigationStep?: any;
}

const LiveMapWrapper = dynamic<LiveMapWrapperProps>(() => import('./LiveLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-surface-container-low text-on-surface-variant animate-pulse">
      Loading Real Map...
    </div>
  ),
});

export default LiveMapWrapper;
