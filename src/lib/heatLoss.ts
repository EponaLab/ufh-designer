import {
  CEILING_MATERIALS,
  INTERNAL_WALL_U,
  MAX_FLOOR_TEMP,
  OPENING_LABEL,
} from '../constants';
import type { FloorBelow, GlobalSettings, Opening, Room, WallSide } from '../types';
import { isZone } from '../types';
import { floorU } from './floor';
import { roomWallSegments } from './geometry';
import { openingInterval } from './openings';
import { designSupply, MAX_SUPPLY_TEMP, roomDemand, roomHydraulics, type RoomHydraulics } from './ufhDesign';

const SIDE_LABEL: Record<WallSide, string> = { north: 'N', east: 'E', south: 'S', west: 'W' };
const FLOOR_BREAKDOWN_NAME: Record<FloorBelow, string> = {
  ground: 'Floor (ground)',
  heated: 'Floor (other floor)',
  unheated: 'Floor (unheated space)',
};
const OPPOSITE_SIDE: Record<WallSide, WallSide> = { north: 'south', south: 'north', east: 'west', west: 'east' };

export interface BreakdownItem {
  roomId: number;
  room: string;
  name: string;
  area: number;
  uValue: number;
  deltaT: number;
  loss: number;
}

export interface RoomUFHResult {
  roomId: number;
  room: string;
  area: number;
  loss: number;
  /** Heat loss per floor area, W/m². */
  ufhRequired: number;
  hydraulics: RoomHydraulics;
}

export type Validation =
  | { kind: 'ok' }
  | { kind: 'supplyTooHigh'; supply: number }
  | { kind: 'floorTooWarm'; rooms: string[] };

export interface ProjectResults {
  totalLoss: number;
  /** Heated floor area (zones excluded), m². */
  totalArea: number;
  ufhResults: RoomUFHResult[];
  breakdown: BreakdownItem[];
  /** Heat loss per heated floor area, W/m². */
  avgUfhRequired: number;
  /** Design supply temperature shared by all loops, °C. */
  supplyTemp: number;
  /** Warmest floor surface of all rooms, °C. */
  highestFloorTemp: number;
  /** Comfort limit for the floor surface (EN 1264), °C. */
  maxFloorTemp: number;
  maxSupplyTemp: number;
  validation: Validation;
}

function floorDeltaT(room: Room, outdoorTemp: number): number {
  switch (room.floorBelow) {
    case 'ground':
      return room.indoorTemp - (outdoorTemp + 5); // simplified ground temperature
    case 'heated':
      return 0;
    case 'unheated':
      return room.indoorTemp - (room.indoorTemp + outdoorTemp) / 2;
  }
}

function ceilingDeltaT(room: Room, outdoorTemp: number): number {
  switch (room.ceilingAbove) {
    case 'outdoor':
      return room.indoorTemp - outdoorTemp;
    case 'heated':
      return 0;
    case 'unheated':
      return room.indoorTemp - (room.indoorTemp + outdoorTemp) / 2;
  }
}

/** Steady-state heat loss (EN 12831 style) plus UFH validation for the heated rooms. */
export function calculateProject(
  rooms: readonly Room[],
  globals: GlobalSettings,
  openings: readonly Opening[] = [],
): ProjectResults {
  const { outdoorTemp } = globals;
  const roomsById = new Map(rooms.map((r) => [r.id, r]));

  const breakdown: BreakdownItem[] = [];
  const ufhResults: RoomUFHResult[] = [];
  const demands: Array<{ room: Room; loss: number; demand: ReturnType<typeof roomDemand> }> = [];
  let totalLoss = 0;
  let totalArea = 0;

  for (const room of rooms) {
    // Zones are unheated reference spaces: they only provide a neighbour temperature
    // for heated rooms and contribute no heat loss or area of their own.
    if (isZone(room)) continue;

    const roomArea = room.width * room.height;
    totalArea += roomArea;
    let roomTotalLoss = 0;

    // Walls: each segment of a side faces either outside or one neighbour. Openings in a
    // segment (this room's, or the neighbour's on the same shared wall) are removed from
    // the wall area and lose heat with the segment's ΔT. Q = U · A · ΔT.
    const wallGroups = new Map<string, { name: string; area: number; deltaT: number; internal: boolean }>();
    const openingGroups = new Map<string, { name: string; area: number; deltaT: number; uValue: number }>();

    for (const seg of roomWallSegments(room, rooms)) {
      const neighbor = seg.neighborId !== null ? roomsById.get(seg.neighborId) : undefined;
      // Heat flows to a colder neighbour; gains from warmer neighbours are ignored (conservative).
      const deltaT = neighbor ? room.indoorTemp - neighbor.indoorTemp : room.indoorTemp - outdoorTemp;

      // Openings on this wall line: own openings on this side, plus the neighbour's on its facing side.
      const candidates = openings.filter(
        (o) =>
          (o.roomId === room.id && o.side === seg.side) ||
          (neighbor !== undefined && o.roomId === neighbor.id && o.side === OPPOSITE_SIDE[seg.side]),
      );
      let openingArea = 0;
      for (const o of candidates) {
        const host = roomsById.get(o.roomId);
        if (!host) continue;
        const { from, to } = openingInterval(o, host);
        const overlap = Math.min(to, seg.to) - Math.max(from, seg.from);
        if (overlap <= 1e-6) continue;
        const area = overlap * Math.min(o.height, room.ceilingHeight);
        openingArea += area;
        const key = `${o.id}:${seg.neighborId ?? 'ext'}`;
        const group = openingGroups.get(key) ?? {
          name: neighbor ? `${OPENING_LABEL[o.kind]} to ${neighbor.name}` : `${OPENING_LABEL[o.kind]} (${SIDE_LABEL[seg.side]})`,
          area: 0,
          deltaT,
          uValue: o.uValue,
        };
        group.area += area;
        openingGroups.set(key, group);
      }

      const key = neighbor ? `n${neighbor.id}` : `e${seg.side}`;
      const group = wallGroups.get(key) ?? {
        name: neighbor ? `Wall to ${neighbor.name}` : `External Wall (${SIDE_LABEL[seg.side]})`,
        area: 0,
        internal: neighbor !== undefined,
        deltaT,
      };
      group.area += Math.max(0, seg.length * room.ceilingHeight - openingArea);
      wallGroups.set(key, group);
    }

    const addLoss = (name: string, area: number, uValue: number, deltaT: number) => {
      const loss = Math.max(0, area * uValue * deltaT);
      roomTotalLoss += loss;
      if (loss > 0.1) breakdown.push({ roomId: room.id, room: room.name, name, area, uValue, deltaT, loss });
    };
    for (const { name, area, deltaT, internal } of wallGroups.values()) {
      addLoss(name, area, internal ? INTERNAL_WALL_U : globals.wallU, deltaT);
    }
    for (const { name, area, uValue, deltaT } of openingGroups.values()) addLoss(name, area, uValue, deltaT);

    // Floor: U of the complete layered build-up towards what is below
    const floorUValue = floorU(room);
    const fDeltaT = floorDeltaT(room, outdoorTemp);
    const floorLoss = roomArea * floorUValue * fDeltaT;
    if (floorLoss > 0) {
      roomTotalLoss += floorLoss;
      breakdown.push({
        roomId: room.id,
        room: room.name,
        name: FLOOR_BREAKDOWN_NAME[room.floorBelow],
        area: roomArea,
        uValue: floorUValue,
        deltaT: fDeltaT,
        loss: floorLoss,
      });
    }

    // Ceiling
    const ceilingU = CEILING_MATERIALS[room.ceilingMaterial].u;
    const cDeltaT = ceilingDeltaT(room, outdoorTemp);
    const ceilingLoss = roomArea * ceilingU * cDeltaT;
    if (ceilingLoss > 0) {
      roomTotalLoss += ceilingLoss;
      breakdown.push({
        roomId: room.id,
        room: room.name,
        name: `Ceiling (${room.ceilingAbove})`,
        area: roomArea,
        uValue: ceilingU,
        deltaT: cDeltaT,
        loss: ceilingLoss,
      });
    }

    totalLoss += roomTotalLoss;
    // Temperature of whatever is below the floor (same convention as the floor ΔT above).
    const belowTemp = room.indoorTemp - fDeltaT;
    demands.push({ room, loss: roomTotalLoss, demand: roomDemand(room, roomTotalLoss, belowTemp) });
  }

  // Shared design supply: set by the most demanding loop at the design spread.
  const required = demands.filter((d) => d.demand.q > 0).map((d) => d.demand.requiredSupply);
  const supplyTemp = required.length > 0 ? designSupply(required) : 0;

  for (const { room, loss, demand } of demands) {
    const area = room.width * room.height;
    ufhResults.push({
      roomId: room.id,
      room: room.name,
      area,
      loss,
      ufhRequired: loss / area,
      hydraulics: roomHydraulics(room, demand, supplyTemp, MAX_FLOOR_TEMP),
    });
  }

  const highestFloorTemp = Math.max(0, ...ufhResults.map((r) => r.hydraulics.floorTemp));
  const tooWarm = ufhResults.filter((r) => !r.hydraulics.floorTempOk).map((r) => r.room);
  let validation: Validation;
  if (supplyTemp > MAX_SUPPLY_TEMP) validation = { kind: 'supplyTooHigh', supply: supplyTemp };
  else if (tooWarm.length > 0) validation = { kind: 'floorTooWarm', rooms: tooWarm };
  else validation = { kind: 'ok' };

  return {
    totalLoss,
    totalArea,
    ufhResults,
    breakdown,
    avgUfhRequired: totalArea > 0 ? totalLoss / totalArea : 0,
    supplyTemp,
    highestFloorTemp,
    maxFloorTemp: MAX_FLOOR_TEMP,
    maxSupplyTemp: MAX_SUPPLY_TEMP,
    validation,
  };
}
