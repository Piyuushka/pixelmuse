import { Entrance } from '../data/entrances';
import { PersonaType } from '@/context/AccessibilityContext';
import { computeConfidence } from './confidence';

export interface SelectionResult {
  recommended: Entrance | null;
  avoided: { entrance: Entrance; reason: string }[];
  reasoning: string;
}

// Simple haversine distance in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function selectEntrance(entrances: Entrance[], profile: PersonaType, userLocation: {lat: number, lng: number}): SelectionResult {
  const avoided: { entrance: Entrance; reason: string }[] = [];
  const candidates: { entrance: Entrance; cost: number; pickReason: string }[] = [];

  for (const ent of entrances) {
    const { score: confScore } = computeConfidence(ent);
    const confFactor = Math.max(confScore / 100, 0.1); 
    
    let cost = getDistance(userLocation.lat, userLocation.lng, ent.lat, ent.lng);
    let isHardBlocked = false;
    let blockReason = '';
    let pickReason = '';

    if (profile === 'wheelchair') {
      if (!ent.stepFree || ent.stepCount > 0) {
        isHardBlocked = true;
        blockReason = `${ent.stepCount} steps, not step-free`;
      } else {
        if (ent.hasRamp && ent.rampSlopePercent && ent.rampSlopePercent > 8) cost += 50; 
        if (ent.doorType !== 'automatic') cost += 20;
        pickReason = `step-free with ${ent.doorType} door`;
      }
    } else if (profile === 'older-adult') {
      if (ent.stepCount > 3) {
        cost += 100 * ent.stepCount;
      } else if (ent.stepCount > 0) {
        cost += 50 * ent.stepCount;
      }
      if (ent.doorType === 'heavy') cost += 30;
      pickReason = ent.stepCount === 0 ? 'step-free access' : `has ${ent.stepCount} steps`;
    } else if (profile === 'low-vision') {
      if (!ent.hasTactilePaving) cost += 40;
      if (!ent.isWellLit) cost += 50;
      if (ent.doorType === 'heavy') cost += 30;
      pickReason = `${ent.hasTactilePaving ? 'tactile paving present' : 'no tactile paving'}`;
    } else if (profile === 'caregiver') {
      if (ent.width && ent.width < 100) cost += 50;
      if (ent.stepCount > 0) cost += 20 * ent.stepCount;
      pickReason = `${ent.width ? ent.width + 'cm wide' : 'standard width'}`;
    }

    if (isHardBlocked) {
      avoided.push({ entrance: ent, reason: blockReason });
    } else {
      const finalCost = cost / confFactor;
      candidates.push({ entrance: ent, cost: finalCost, pickReason });
    }
  }

  if (candidates.length === 0) {
    return {
      recommended: null,
      avoided,
      reasoning: "No verified accessible entrance found for your profile."
    };
  }

  candidates.sort((a, b) => a.cost - b.cost);
  const best = candidates[0];
  
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    let reason = c.entrance.stepCount > 0 ? `${c.entrance.stepCount} steps` : 'Less optimal';
    if (profile === 'low-vision' && !c.entrance.hasTactilePaving) reason = 'No tactile paving';
    else if (profile === 'caregiver' && c.entrance.width && c.entrance.width < 100) reason = 'Narrow entrance';
    avoided.push({ entrance: c.entrance, reason });
  }

  let reasoning = `Use the ${best.entrance.name}. It is ${best.pickReason}.`;
  if (avoided.length > 0) {
    reasoning += ` The ${avoided[0].entrance.name} was avoided (${avoided[0].reason}).`;
  }

  return {
    recommended: best.entrance,
    avoided,
    reasoning
  };
}
