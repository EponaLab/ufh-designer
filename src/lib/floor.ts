/*
 * Layered floor model. Layers, bottom to top:
 *
 *   below (ground / other floor / unheated space)
 *   → structure (concrete slab / wood beams)
 *   → insulation
 *   → heating pipes (screed or overlay system)
 *   → covering (wood / tiles)
 *   → room
 *
 * Heat from the pipes flows up through R_up (system above the pipes + covering + surface)
 * and down through R_down (insulation + structure + what is below).
 * The floor's heat loss to the space below uses the whole build-up.
 * All resistances in m²K/W.
 */
import {
  BELOW_SPACE_RESISTANCE,
  FLOOR_STRUCTURES,
  floorCoveringResistance,
  GROUND_RESISTANCE,
  INSULATION_CONDUCTIVITY,
  SURFACE_RESISTANCE,
  SURFACE_RESISTANCE_DOWN,
  UFH_SYSTEMS,
} from '../constants';
import type { FloorBelow, Room } from '../types';

type FloorSpec = Pick<
  Room,
  'floorBelow' | 'floorStructure' | 'insulationBelow' | 'installationType' | 'floorMaterial' | 'floorThickness'
>;

export interface FloorResistances {
  /** Floor covering (wood / tiles). */
  covering: number;
  /** Screed or overlay build-up between pipes and covering. */
  system: number;
  /** Insulation under the heating system. */
  insulation: number;
  /** Load-bearing structure. */
  structure: number;
  /** Ground, or the surface of the space below. */
  below: number;
}

export function belowResistance(below: FloorBelow): number {
  return below === 'ground' ? GROUND_RESISTANCE : BELOW_SPACE_RESISTANCE;
}

export function floorResistances(room: FloorSpec): FloorResistances {
  return {
    covering: floorCoveringResistance(room.floorMaterial, room.floorThickness),
    system: UFH_SYSTEMS[room.installationType].resistanceAbovePipes,
    insulation: room.insulationBelow / 1000 / INSULATION_CONDUCTIVITY,
    structure: FLOOR_STRUCTURES[room.floorStructure].resistance,
    below: belowResistance(room.floorBelow),
  };
}

/** Resistance from the pipes up to the room air. */
export function resistanceUp(room: FloorSpec): number {
  const r = floorResistances(room);
  return r.covering + r.system + SURFACE_RESISTANCE;
}

/** Resistance from the pipes down to the space below. */
export function resistanceDown(room: FloorSpec): number {
  const r = floorResistances(room);
  return r.insulation + r.structure + r.below;
}

/** U-value of the complete floor build-up towards the space below, W/m²K. */
export function floorU(room: FloorSpec): number {
  const r = floorResistances(room);
  return 1 / (SURFACE_RESISTANCE_DOWN + r.covering + r.system + r.insulation + r.structure + r.below);
}
