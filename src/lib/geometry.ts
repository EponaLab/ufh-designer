import { MAX_ZOOM, MIN_ZOOM, SCALE } from '../constants';
import type { Point, Rect, Room, Viewport, WallSide } from '../types';

/*
 * Coordinate spaces:
 *  - screen: canvas pixels (relative to the canvas element)
 *  - world:  unzoomed pixels (meters * SCALE)
 *  - meters: model units used by rooms
 */

export function screenToWorld(screen: Point, vp: Viewport): Point {
  return {
    x: (screen.x - vp.panX) / vp.zoom,
    y: (screen.y - vp.panY) / vp.zoom,
  };
}

export function worldToScreen(world: Point, vp: Viewport): Point {
  return {
    x: world.x * vp.zoom + vp.panX,
    y: world.y * vp.zoom + vp.panY,
  };
}

export function screenToMeters(screen: Point, vp: Viewport): Point {
  const world = screenToWorld(screen, vp);
  return { x: world.x / SCALE, y: world.y / SCALE };
}

export function metersToScreen(m: Point, vp: Viewport): Point {
  return worldToScreen({ x: m.x * SCALE, y: m.y * SCALE }, vp);
}

/** Snap a screen point to the grid; returns the snapped point in world px. */
export function snapScreenToWorldGrid(screen: Point, vp: Viewport, gridSize: number): Point {
  const world = screenToWorld(screen, vp);
  const step = gridSize * SCALE;
  return {
    x: Math.round(world.x / step) * step,
    y: Math.round(world.y / step) * step,
  };
}

export function snapMeters(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** Zoom by `factor` keeping the world point under `anchor` (screen px) fixed. */
export function zoomAt(vp: Viewport, anchor: Point, factor: number): Viewport {
  const zoom = clampZoom(vp.zoom * factor);
  const before = screenToWorld(anchor, vp);
  const after = screenToWorld(anchor, { ...vp, zoom });
  return {
    zoom,
    panX: vp.panX + (after.x - before.x) * zoom,
    panY: vp.panY + (after.y - before.y) * zoom,
  };
}

/** Topmost room containing the point (meters), or undefined. */
export function findRoomAt(rooms: readonly Room[], p: Point): Room | undefined {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i]!;
    if (p.x >= room.x && p.x <= room.x + room.width && p.y >= room.y && p.y <= room.y + room.height) {
      return room;
    }
  }
  return undefined;
}

/** Coordinates closer than this (meters) are treated as equal (guards against float drift). */
const EPS = 1e-6;

/**
 * Portion of a room side, either facing outside (`neighborId` null) or shared with
 * the opposite side of another room. Lengths in meters.
 */
export interface WallSegment {
  side: WallSide;
  neighborId: number | null;
  length: number;
  /** Absolute extent along the side's axis (x for north/south, y for east/west). */
  from: number;
  to: number;
}

interface SideSpan {
  side: WallSide;
  /** Fixed coordinate of the side (y for north/south, x for east/west). */
  at: number;
  /** Extent along the side (x for north/south, y for east/west). */
  from: number;
  to: number;
}

function sideSpans(r: Rect): SideSpan[] {
  const right = r.x + r.width;
  const bottom = r.y + r.height;
  return [
    { side: 'north', at: r.y, from: r.x, to: right },
    { side: 'south', at: bottom, from: r.x, to: right },
    { side: 'west', at: r.x, from: r.y, to: bottom },
    { side: 'east', at: right, from: r.y, to: bottom },
  ];
}

const OPPOSITE: Record<WallSide, WallSide> = { north: 'south', south: 'north', east: 'west', west: 'east' };

/**
 * Split every side of `room` into the parts shared with neighbouring rooms (any
 * overlap with a neighbour's opposite side on the same line — not only identical
 * edges) and the remaining external parts.
 */
export function roomWallSegments(room: Room, rooms: readonly Room[]): WallSegment[] {
  const segments: WallSegment[] = [];

  for (const span of sideSpans(room)) {
    // Overlaps with neighbours' opposite sides on the same line
    const shared: Array<{ neighborId: number; from: number; to: number }> = [];
    for (const other of rooms) {
      if (other.id === room.id) continue;
      const opp = sideSpans(other).find((s) => s.side === OPPOSITE[span.side])!;
      if (Math.abs(opp.at - span.at) > EPS) continue;
      const from = Math.max(span.from, opp.from);
      const to = Math.min(span.to, opp.to);
      if (to - from > EPS) shared.push({ neighborId: other.id, from, to });
    }

    // Clip overlapping shares (only possible if rooms overlap) so no length is counted twice;
    // the gaps between shared pieces are the external parts.
    shared.sort((a, b) => a.from - b.from);
    let cursor = span.from;
    for (const s of shared) {
      const from = Math.max(s.from, cursor);
      if (s.to - from <= EPS) continue;
      if (from - cursor > EPS) {
        segments.push({ side: span.side, neighborId: null, length: from - cursor, from: cursor, to: from });
      }
      segments.push({ side: span.side, neighborId: s.neighborId, length: s.to - from, from, to: s.to });
      cursor = s.to;
    }
    if (span.to - cursor > EPS) {
      segments.push({ side: span.side, neighborId: null, length: span.to - cursor, from: cursor, to: span.to });
    }
  }

  return segments;
}

// ---------------------------------------------------------------- Resizing

/** Edge or corner of a rectangle being dragged. */
export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const RESIZE_CURSORS: Record<ResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

/**
 * Which edge/corner of `rect` is within `tolerance` of point `p` (all in meters),
 * or null if the point isn't on the border.
 */
export function hitResizeHandle(rect: Rect, p: Point, tolerance: number): ResizeHandle | null {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  if (p.x < left - tolerance || p.x > right + tolerance || p.y < top - tolerance || p.y > bottom + tolerance) {
    return null;
  }

  const vertical = Math.abs(p.y - top) <= tolerance ? 'n' : Math.abs(p.y - bottom) <= tolerance ? 's' : '';
  const horizontal = Math.abs(p.x - left) <= tolerance ? 'w' : Math.abs(p.x - right) <= tolerance ? 'e' : '';
  return ((vertical + horizontal) as ResizeHandle) || null;
}

/**
 * New rectangle when dragging `handle` of `original` to point `p` (meters).
 * Moved edges snap to the grid; the opposite edges stay fixed; size never drops below `minSize`.
 */
export function resizeRect(original: Rect, handle: ResizeHandle, p: Point, gridSize: number, minSize: number): Rect {
  let left = original.x;
  let right = original.x + original.width;
  let top = original.y;
  let bottom = original.y + original.height;

  if (handle.includes('w')) left = Math.min(snapMeters(p.x, gridSize), right - minSize);
  if (handle.includes('e')) right = Math.max(snapMeters(p.x, gridSize), left + minSize);
  if (handle.includes('n')) top = Math.min(snapMeters(p.y, gridSize), bottom - minSize);
  if (handle.includes('s')) bottom = Math.max(snapMeters(p.y, gridSize), top + minSize);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** A single side of a rectangle (for typing its length). */
export type Side = 'n' | 's' | 'e' | 'w';

/** Side for a hit handle; corners resolve to their horizontal side (n/s). */
export function handleToSide(handle: ResizeHandle): Side {
  return handle[0] as Side;
}

/** Length of a side: n/s → width, e/w → height (meters). */
export function sideLength(rect: Rect, side: Side): number {
  return side === 'n' || side === 's' ? rect.width : rect.height;
}

/**
 * Set a side's length, keeping the top-left corner fixed:
 * n/s sides change the width (grows to the right), e/w sides the height (grows downward).
 */
export function setSideLength(rect: Rect, side: Side, length: number): Rect {
  return side === 'n' || side === 's' ? { ...rect, width: length } : { ...rect, height: length };
}

/** Screen-space midpoint of a side. */
export function sideMidpoint(rect: Rect, side: Side, vp: Viewport): Point {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const m: Point =
    side === 'n' ? { x: cx, y: rect.y }
    : side === 's' ? { x: cx, y: rect.y + rect.height }
    : side === 'w' ? { x: rect.x, y: cy }
    : { x: rect.x + rect.width, y: cy };
  return metersToScreen(m, vp);
}
