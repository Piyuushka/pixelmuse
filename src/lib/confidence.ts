import { Entrance } from '../data/entrances';

export interface ConfidenceResult {
  score: number;
  breakdown: { label: string; value: number }[];
}

export function computeConfidence(entrance: Entrance): ConfidenceResult {
  let score = 0;
  const breakdown: { label: string; value: number }[] = [];

  // Source weight
  let sourceScore = 0;
  if (entrance.source === 'Official' || entrance.source === 'Survey') {
    sourceScore = 40;
    breakdown.push({ label: 'Verified Source', value: 40 });
  } else {
    sourceScore = 20;
    breakdown.push({ label: 'Community Source', value: 20 });
  }
  score += sourceScore;

  // Recency decay
  const daysSinceVerified = Math.floor((Date.now() - new Date(entrance.lastVerified).getTime()) / (1000 * 60 * 60 * 24));
  let recencyScore = 0;
  if (daysSinceVerified <= 7) {
    recencyScore = 30;
    breakdown.push({ label: 'Recently Verified (<7 days)', value: 30 });
  } else if (daysSinceVerified <= 30) {
    recencyScore = 20;
    breakdown.push({ label: 'Verified (<30 days)', value: 20 });
  } else if (daysSinceVerified <= 90) {
    recencyScore = 10;
    breakdown.push({ label: 'Verified (<90 days)', value: 10 });
  } else {
    recencyScore = 0;
    breakdown.push({ label: 'Old Verification', value: 0 });
  }
  score += recencyScore;

  // Confirmations net
  const netConfirmations = entrance.confirmations - entrance.disputes;
  let confScore = 0;
  if (netConfirmations > 50) {
    confScore = 30;
    breakdown.push({ label: 'High Trust (>50 net confirmations)', value: 30 });
  } else if (netConfirmations > 10) {
    confScore = 20;
    breakdown.push({ label: 'Trusted (>10 net confirmations)', value: 20 });
  } else if (netConfirmations > 0) {
    confScore = 10;
    breakdown.push({ label: 'Some Trust (>0 net confirmations)', value: 10 });
  } else {
    confScore = 0;
    breakdown.push({ label: 'Disputed/Unconfirmed', value: 0 });
  }
  score += confScore;

  // Clamp score
  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return { score, breakdown };
}
