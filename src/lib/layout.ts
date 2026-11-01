/*
 * Non-overlap rules for rooms and zones. Rooms may touch (share walls) but never overlap.
 * All values in meters.
 */
import type { Point, Rect } from '../types';
import type { ResizeHandle } from './geometry';

const EPS = 1e-6;

/** True if the interiors of two rectangles intersect (touching edges is fine). */
export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width - EPS &&
    b.x < a.x + a.width - EPS &&
    a.y < b.y + b.height - EPS &&
    b.y < a.y + a.height - EPS
  );
}

const rangesOverlap = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - EPS && b0 < a1 - EPS;

/** True if `p` is strictly inside any of `rects`. */
export function isInsideAny(p: Point, rects: readonly Rect[]): boolean {
  return rects.some((r) => p.x > r.x + EPS && p.x < r.x + r.width - EPS && p.y > r.y + EPS && p.y < r.y + r.height - EPS);
}

/**
 * Position for a `width × height` rectangle closest to `desired` that overlaps none of
 * `others`. When the desired spot collides, the result sits flush against the walls of
 * the blocking room(s). Returns null if no free spot was found.
 */
export function findFreePosition(
  size: { width: number; height: number },
  desired: Point,
  others: readonly Rect[],
): Point | null {
  const { width, height } = size;
  const free = (x: number, y: number) => others.every((o) => !overlaps({ x, y, width, height }, o));
  if (free(desired.x, desired.y)) return desired;

  // Candidates: keep each coordinate, or put the rectangle flush against any room's walls.
  const xs = [desired.x, ...others.flatMap((o) => [o.x - width, o.x + o.width])];
  const ys = [desired.y, ...others.flatMap((o) => [o.y - height, o.y + o.height])];

  let best: Point | null = null;
  let bestDistance = Infinity;
  for (const x of xs) {
    for (const y of ys) {
      const d = Math.hypot(x - desired.x, y - desired.y);
      if (d < bestDistance && free(x, y)) {
        best = { x, y };
        bestDistance = d;
      }
    }
  }
  return best;
}

/**
 * Constrain a resize so the moved edges stop at neighbouring walls.
 * `original` is the rectangle before the resize, `proposed` the unconstrained result.
 * Returns null if no valid constrained rectangle exists (callers keep the current size).
 */
export function clampResize(original: Rect, proposed: Rect, handle: ResizeHandle, others: readonly Rect[]): Rect | null {
  // Ignore rooms that already overlap the original (legacy data) so the room isn't stuck.
  const blockers = others.filter((o) => !overlaps(o, original));
  const oRight = original.x + original.width;
  const oBottom = original.y + original.height;

  let left = proposed.x;
  let right = proposed.x + proposed.width;
  let top = proposed.y;
  let bottom = proposed.y + proposed.height;

  const clampHorizontal = () => {
    for (const o of blockers) {
      if (!rangesOverlap(top, bottom, o.y, o.y + o.height)) continue;
      if (handle.includes('e') && o.x >= oRight - EPS) right = Math.min(right, o.x);
      if (handle.includes('w') && o.x + o.width <= original.x + EPS) left = Math.max(left, o.x + o.width);
    }
  };
  const clampVertical = () => {
    for (const o of blockers) {
      if (!rangesOverlap(left, right, o.x, o.x + o.width)) continue;
      if (handle.includes('s') && o.y >= oBottom - EPS) bottom = Math.min(bottom, o.y);
      if (handle.includes('n') && o.y + o.height <= original.y + EPS) top = Math.max(top, o.y + o.height);
    }
  };

  // Alternate so corner drags resolve against rooms reached diagonally.
  clampHorizontal();
  clampVertical();
  clampHorizontal();

  const result = { x: left, y: top, width: right - left, height: bottom - top };
  if (result.width <= EPS || result.height <= EPS) return null;
  return blockers.some((o) => overlaps(result, o)) ? null : result;
}
