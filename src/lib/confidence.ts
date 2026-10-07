import { Entrance } from '../data/entrances';
import { computeTrust, TrustResult, TrustableItem } from './trust';

export interface ConfidenceResult {
  score: number;
  breakdown: { label: string; value: number }[];
  trust?: TrustResult;
}

/**
 * Backward-compatible confidence wrapper delegating to generalized computeTrust engine.
 */
export function computeConfidence(entrance: Entrance | TrustableItem): ConfidenceResult {
  const trust = computeTrust(entrance);
  return {
    score: trust.score,
    breakdown: trust.breakdown.map((b) => ({ label: b.label, value: b.value })),
    trust,
  };
}

export * from './trust';
