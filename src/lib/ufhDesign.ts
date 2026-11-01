/*
 * Underfloor heating hydraulic design (simplified EN 1264 approach).
 *
 *  1. Each heated room needs an upward heat flux q = Q / A (W/m²).
 *  2. The floor construction gives a heat transfer coefficient K (W/m²K) from the water
 *     to the room; per metre of pipe that is K' = K · spacing. With the loop length
 *     L = A / spacing the emitted heat is  Q = K' · L · ΔT_ln, where ΔT_ln is the
 *     logarithmic mean of (supply − room) and (return − room).
 *  3. The design supply temperature is set by the most demanding room at the design
 *     spread σ = supply − return (5 K), and is shared by all loops.
 *  4. Every other room gets its own return temperature (and flow) from the shared supply,
 *     its heat loss and its loop length.
 *  5. The floor surface temperature follows the EN 1264 base characteristic
 *     q = 8.92 · (θF − θi)^1.1 and is checked against the comfort limit.
 */
import {
  floorCoveringResistance,
  INSULATION_FACTORS,
  PIPE_SPACING_FACTORS,
  SURFACE_RESISTANCE,
  UFH_SYSTEMS,
} from '../constants';
import type { Room } from '../types';

/** Design temperature spread of the most demanding loop, K. */
export const DESIGN_SPREAD = 5;
/** Highest sensible supply temperature for UFH, °C. */
export const MAX_SUPPLY_TEMP = 55;
/** Maximum length of one pipe loop (16 mm pipe), m. Longer runs are split into loops. */
export const MAX_LOOP_LENGTH = 100;
/** Supply temperatures are rounded up to this step, K. */
const SUPPLY_STEP = 0.5;
/** Volumetric heat capacity of water, Wh/(l·K). */
const WATER_HEAT_CAPACITY = 1.163;

/** Water-to-room heat transfer of the floor construction and the share emitted upward. */
export function floorCoefficient(room: Room): { k: number; upwardShare: number } {
  const system = UFH_SYSTEMS[room.installationType];
  const resistanceUp =
    floorCoveringResistance(room.floorMaterial, room.floorThickness) + system.resistanceAbovePipes + SURFACE_RESISTANCE;
  const spacingFactor = PIPE_SPACING_FACTORS[room.pipeSpacing] ?? 1;
  const upwardShare = room.installationType.startsWith('overlay')
    ? 1 - system.downwardLossFactor * (INSULATION_FACTORS[room.insulationBelow] ?? 1)
    : 1;
  return { k: (spacingFactor * system.spacingEffectiveness * upwardShare) / resistanceUp, upwardShare };
}

/** Floor surface temperature for an upward heat flux q (EN 1264 base characteristic). */
export function floorSurfaceTemp(q: number, roomTemp: number): number {
  return q > 0 ? roomTemp + Math.pow(q / 8.92, 1 / 1.1) : roomTemp;
}

/** Highest heat flux at which the floor stays at `limit` °C. */
export function maxFluxAtFloorTemp(limit: number, roomTemp: number): number {
  return limit > roomTemp ? 8.92 * Math.pow(limit - roomTemp, 1.1) : 0;
}

/** Logarithmic mean of (supply − room) and (return − room). */
export function logMeanDelta(supply: number, ret: number, room: number): number {
  const a = supply - room;
  const b = ret - room;
  if (a <= 0 || b <= 0) return 0;
  return Math.abs(a - b) < 1e-9 ? a : (a - b) / Math.log(a / b);
}

/** Supply temperature needed for log-mean ΔT `d` at spread σ: a/(a−σ) = e^(σ/d). */
export function supplyForLogMean(d: number, roomTemp: number, spread = DESIGN_SPREAD): number {
  if (d <= 0) return roomTemp;
  return roomTemp + spread / (1 - Math.exp(-spread / d));
}

/** Return temperature giving log-mean ΔT `d` with supply `supply` (bisection; ΔT_ln grows with return). */
export function returnForLogMean(d: number, supply: number, roomTemp: number): number {
  if (d <= 0) return supply;
  let lo = roomTemp + 1e-9;
  let hi = supply;
  if (logMeanDelta(supply, hi - 1e-9, roomTemp) < d) return supply; // supply too low for this room
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (logMeanDelta(supply, mid, roomTemp) < d) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface RoomHydraulics {
  /** Upward heat flux needed, W/m². */
  q: number;
  /** Heat the water must deliver (incl. downward losses), W. */
  waterHeat: number;
  /** Pipe length laid in the room, m. */
  pipeLength: number;
  loops: number;
  /** Required log-mean water-to-room ΔT, K. */
  logMeanDelta: number;
  /** Supply this room would need on its own at the design spread, °C. */
  requiredSupply: number;
  /** Return temperature with the shared design supply, °C. */
  returnTemp: number;
  /** Supply − return of this room's loop(s), K. */
  spread: number;
  /** Total flow for the room, l/h. */
  flow: number;
  floorTemp: number;
  floorTempOk: boolean;
}

/** Per-room demand figures that don't depend on the shared supply temperature. */
export function roomDemand(room: Room, heatLoss: number) {
  const area = room.width * room.height;
  const spacing = room.pipeSpacing / 1000;
  const pipeLength = area / spacing;
  const { k, upwardShare } = floorCoefficient(room);
  const q = Math.max(0, heatLoss) / area;
  // Q = K' · L · ΔT_ln with K' = K · spacing (W/mK) → ΔT_ln = Q / (K' · L)
  const kPerMetre = k * spacing;
  const logMean = pipeLength > 0 ? (q * area) / (kPerMetre * pipeLength) : 0;
  return {
    q,
    waterHeat: (q * area) / upwardShare,
    pipeLength,
    loops: Math.max(1, Math.ceil(pipeLength / MAX_LOOP_LENGTH)),
    logMeanDelta: logMean,
    requiredSupply: supplyForLogMean(logMean, room.indoorTemp),
  };
}

/** Round the design supply up to the next step. */
export function designSupply(requiredSupplies: number[]): number {
  const max = Math.max(...requiredSupplies);
  return Math.ceil(max / SUPPLY_STEP - 1e-9) * SUPPLY_STEP;
}

/** Complete a room's hydraulics once the shared supply temperature is known. */
export function roomHydraulics(
  room: Room,
  demand: ReturnType<typeof roomDemand>,
  supply: number,
  floorLimit: number,
): RoomHydraulics {
  const returnTemp = returnForLogMean(demand.logMeanDelta, supply, room.indoorTemp);
  const spread = supply - returnTemp;
  const floorTemp = floorSurfaceTemp(demand.q, room.indoorTemp);
  return {
    ...demand,
    returnTemp,
    spread,
    flow: spread > 1e-6 ? demand.waterHeat / (WATER_HEAT_CAPACITY * spread) : 0,
    floorTemp,
    floorTempOk: floorTemp <= floorLimit + 1e-9,
  };
}
