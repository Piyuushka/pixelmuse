import dynamic from 'next/dynamic';
import { LiveLeafletMapProps } from './LiveLeafletMap';

const LiveMapWrapper = dynamic<LiveLeafletMapProps>(() => import('./LiveLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[450px] flex items-center justify-center bg-surface-container-low text-on-surface-variant animate-pulse rounded-3xl">
      Loading Google Maps Navigation Engine...
    </div>
  ),
});

export default LiveMapWrapper;
