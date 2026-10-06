/**
 * Shared Formatting Utilities
 */

/**
 * Formats a distance in meters into a human-readable string (m or km)
 */
export function formatDistance(meters: number): string {
  if (!meters || meters <= 0) return '0 m';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Formats duration in minutes into hours and minutes
 */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
  }
  return `${Math.round(minutes)} min`;
}

/**
 * Formats GPS accuracy in meters
 */
export function formatAccuracy(accuracyMeters: number): string {
  return `±${Math.round(accuracyMeters)}m`;
}

/**
 * Returns color badge styling based on community confidence score percentage (0-100)
 */
export function getConfidenceBadgeColor(confidence: number): {
  bg: string;
  text: string;
  label: string;
} {
  if (confidence >= 80) {
    return { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-700 dark:text-emerald-300', label: 'High Confidence' };
  } else if (confidence >= 50) {
    return { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-700 dark:text-amber-300', label: 'Moderate Confidence' };
  }
  return { bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-700 dark:text-rose-300', label: 'Low Confidence' };
}
