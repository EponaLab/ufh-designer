/*
 * Geometry of windows/doors on room sides. All values in meters.
 */
import { MIN_OPENING_SIZE, OPENING_SNAP } from '../constants';
import type { Opening, Point, Rect, WallSide } from '../types';

/** A room side as a line: fixed coordinate `at`, extent `from`..`to` along x (n/s) or y (e/w). */
export interface SideLine {
  side: WallSide;
  horizontal: boolean;
  at: number;
  from: number;
  to: number;
}

export function sideLine(r: Rect, side: WallSide): SideLine {
  switch (side) {
    case 'north':
      return { side, horizontal: true, at: r.y, from: r.x, to: r.x + r.width };
    case 'south':
      return { side, horizontal: true, at: r.y + r.height, from: r.x, to: r.x + r.width };
    case 'west':
      return { side, horizontal: false, at: r.x, from: r.y, to: r.y + r.height };
    case 'east':
      return { side, horizontal: false, at: r.x + r.width, from: r.y, to: r.y + r.height };
  }
}

/** Unit vector pointing from the side into the room. */
export function inwardNormal(side: WallSide): Point {
  return side === 'north' ? { x: 0, y: 1 } : side === 'south' ? { x: 0, y: -1 } : side === 'west' ? { x: 1, y: 0 } : { x: -1, y: 0 };
}

/**
 * Opening clamped to its side: width ≤ side length, fully within the side.
 * Rooms can shrink after an opening was placed, so geometry is always read through this.
 */
export function clampOpening<T extends Pick<Opening, 'offset' | 'width'>>(opening: T, sideLength: number): T {
  const width = Math.min(Math.max(opening.width, Math.min(MIN_OPENING_SIZE, sideLength)), sideLength);
  const offset = Math.min(Math.max(opening.offset, 0), sideLength - width);
  return { ...opening, width, offset };
}

/** Absolute interval (along the side's axis) covered by the opening. */
export function openingInterval(opening: Opening, room: Rect): { line: SideLine; from: number; to: number } {
  const line = sideLine(room, opening.side);
  const { offset, width } = clampOpening(opening, line.to - line.from);
  return { line, from: line.from + offset, to: line.from + offset + width };
}

export const snapOpening = (v: number) => Math.round(v / OPENING_SNAP) * OPENING_SNAP;

/** Offset that centers an opening of `width` at `center` (absolute) on `line`, snapped and clamped. */
export function centeredOffset(line: SideLine, center: number, width: number): number {
  const length = line.to - line.from;
  const w = Math.min(width, length);
  return Math.min(Math.max(snapOpening(center - line.from - w / 2), 0), length - w);
}

/** Opening under point `p`, within `tolerance` of its wall line (last placed wins). */
export function hitOpening(
  openings: readonly Opening[],
  roomsById: ReadonlyMap<number, Rect>,
  p: Point,
  tolerance: number,
): Opening | undefined {
  for (let i = openings.length - 1; i >= 0; i--) {
    const o = openings[i]!;
    const room = roomsById.get(o.roomId);
    if (!room) continue;
    const { line, from, to } = openingInterval(o, room);
    const along = line.horizontal ? p.x : p.y;
    const across = line.horizontal ? p.y : p.x;
    if (Math.abs(across - line.at) <= tolerance && along >= from - tolerance && along <= to + tolerance) return o;
  }
  return undefined;
}
