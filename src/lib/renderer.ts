import { SCALE } from '../constants';
import type { Opening, Room, Viewport } from '../types';
import { isZone } from '../types';
import { inwardNormal, openingInterval } from './openings';

/** Room being drawn, in world px (grid-snapped). */
export interface RoomPreview {
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
}

export interface Scene {
  width: number;
  height: number;
  viewport: Viewport;
  gridSize: number;
  rooms: readonly Room[];
  openings: readonly Opening[];
  selectedId: number | null;
  selectedOpeningId: number | null;
  preview: RoomPreview | null;
}

/** Canvas palette — monochrome, with a warm tint marking heated rooms and blue for glazing. */
const COLORS = {
  grid: '#ececee',
  text: '#09090b',
  textMuted: '#71717a',
  heatedFill: 'rgba(234, 88, 12, 0.06)',
  heatedFillSelected: 'rgba(234, 88, 12, 0.12)',
  zoneFill: 'rgba(228, 228, 231, 0.35)',
  zoneFillSelected: 'rgba(212, 212, 216, 0.5)',
  border: '#27272a',
  zoneBorder: '#a1a1aa',
  selected: '#09090b',
  previewFill: 'rgba(24, 24, 27, 0.04)',
  glass: '#38bdf8',
  openingFill: '#ffffff',
} as const;

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/** Render the full canvas scene. Pure function of `scene`. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { viewport: vp } = scene;
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.save();
  ctx.translate(vp.panX, vp.panY);
  ctx.scale(vp.zoom, vp.zoom);

  drawGrid(ctx, scene);
  for (const room of scene.rooms) {
    drawRoom(ctx, room, room.id === scene.selectedId, vp.zoom);
  }
  const selected = scene.rooms.find((r) => r.id === scene.selectedId);
  if (selected) drawResizeHandles(ctx, selected, vp.zoom);
  drawOpenings(ctx, scene, vp.zoom);
  if (scene.preview && scene.preview.endX !== undefined && scene.preview.endY !== undefined) {
    drawRoomPreview(ctx, scene.preview, vp.zoom);
  }

  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const { viewport: vp } = scene;
  const step = scene.gridSize * SCALE;
  if (!(step > 0)) return; // guard against zero/NaN grid (would loop forever)

  const startX = Math.floor(-vp.panX / vp.zoom / step) * step;
  const startY = Math.floor(-vp.panY / vp.zoom / step) * step;
  const endX = startX + scene.width / vp.zoom + step;
  const endY = startY + scene.height / vp.zoom + step;

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1 / vp.zoom;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += step) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = startY; y <= endY; y += step) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();
}

function drawRoom(ctx: CanvasRenderingContext2D, room: Room, selected: boolean, zoom: number): void {
  const x = room.x * SCALE;
  const y = room.y * SCALE;
  const width = room.width * SCALE;
  const height = room.height * SCALE;
  const zone = isZone(room);

  // Fill: warm tint = heated (UFH), neutral = unheated zone
  if (zone) {
    ctx.fillStyle = selected ? COLORS.zoneFillSelected : COLORS.zoneFill;
  } else {
    ctx.fillStyle = selected ? COLORS.heatedFillSelected : COLORS.heatedFill;
  }
  ctx.fillRect(x, y, width, height);

  // Border: solid for rooms, dashed for zones; heavier when selected
  ctx.strokeStyle = selected ? COLORS.selected : zone ? COLORS.zoneBorder : COLORS.border;
  ctx.lineWidth = (selected ? 2.5 : 1.5) / zoom;
  if (zone) ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);

  // Zones only show their temperature (an HTML chip centered in the zone).
  if (zone) return;

  // Name and area (the temperature is an editable HTML chip below them)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const area = room.width * room.height;
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 ${13 / zoom}px ${FONT}`;
  ctx.fillText(room.name, x + width / 2, y + height / 2 - 18 / zoom);
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `${12 / zoom}px ${FONT}`;
  ctx.fillText(`${area.toFixed(1)} m²`, x + width / 2, y + height / 2 - 2 / zoom);

  // Dimensions
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `${11 / zoom}px ${FONT}`;
  ctx.fillText(`${room.width.toFixed(2)} m`, x + width / 2, y - 10 / zoom); // width (top)
  ctx.save();
  ctx.translate(x - 10 / zoom, y + height / 2); // height (left)
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${room.height.toFixed(2)} m`, 0, 0);
  ctx.restore();
}

/** Small square handles on the corners and edge midpoints of the selected room. */
function drawResizeHandles(ctx: CanvasRenderingContext2D, room: Room, zoom: number): void {
  const x = room.x * SCALE;
  const y = room.y * SCALE;
  const w = room.width * SCALE;
  const h = room.height * SCALE;
  const size = 7 / zoom;
  const points: Array<[number, number]> = [
    [x, y], [x + w / 2, y], [x + w, y],
    [x, y + h / 2], [x + w, y + h / 2],
    [x, y + h], [x + w / 2, y + h], [x + w, y + h],
  ];

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = COLORS.selected;
  ctx.lineWidth = 1.5 / zoom;
  for (const [px, py] of points) {
    ctx.fillRect(px - size / 2, py - size / 2, size, size);
    ctx.strokeRect(px - size / 2, py - size / 2, size, size);
  }
}

/** Windows (framed gap with a glass line) and doors (gap with leaf and swing arc). */
function drawOpenings(ctx: CanvasRenderingContext2D, scene: Scene, zoom: number): void {
  const roomsById = new Map(scene.rooms.map((r) => [r.id, r]));
  const thickness = 7 / zoom;

  for (const opening of scene.openings) {
    const room = roomsById.get(opening.roomId);
    if (!room) continue;
    const { line, from, to } = openingInterval(opening, room);
    const selected = opening.id === scene.selectedOpeningId;
    const n = inwardNormal(opening.side);
    // Endpoints in world px
    const p = (along: number, inward = 0) =>
      line.horizontal
        ? { x: along * SCALE + n.x * inward, y: line.at * SCALE + n.y * inward }
        : { x: line.at * SCALE + n.x * inward, y: along * SCALE + n.y * inward };
    const a = p(from);
    const b = p(to);
    const len = (to - from) * SCALE;

    // Gap in the wall
    ctx.fillStyle = COLORS.openingFill;
    ctx.strokeStyle = selected ? COLORS.selected : COLORS.border;
    ctx.lineWidth = (selected ? 2 : 1) / zoom;
    const rx = Math.min(a.x, b.x) - (line.horizontal ? 0 : thickness / 2);
    const ry = Math.min(a.y, b.y) - (line.horizontal ? thickness / 2 : 0);
    const rw = line.horizontal ? len : thickness;
    const rh = line.horizontal ? thickness : len;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);

    if (opening.kind === 'window') {
      ctx.strokeStyle = COLORS.glass;
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else {
      // Door leaf hinged at the start, opening into the room, with its swing arc
      const leaf = p(from, len);
      ctx.strokeStyle = selected ? COLORS.selected : COLORS.border;
      ctx.lineWidth = 1.25 / zoom;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(leaf.x, leaf.y);
      ctx.stroke();
      ctx.setLineDash([3 / zoom, 3 / zoom]);
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      const start = Math.atan2(leaf.y - a.y, leaf.x - a.x);
      const end = Math.atan2(b.y - a.y, b.x - a.x);
      // Sweep the short way between leaf and closed position
      let delta = end - start;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      ctx.arc(a.x, a.y, len, start, start + delta, delta < 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (selected) drawOpeningDimensions(ctx, line.from, from, to, line.to, p, zoom);
  }
}

/** Distances from the side's corners to the selected opening's edges, drawn inside the room. */
function drawOpeningDimensions(
  ctx: CanvasRenderingContext2D,
  sideFrom: number,
  from: number,
  to: number,
  sideTo: number,
  p: (along: number, inward?: number) => { x: number; y: number },
  zoom: number,
): void {
  const inset = 16 / zoom;
  ctx.fillStyle = COLORS.selected;
  ctx.font = `600 ${11 / zoom}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = (a: number, b: number, text: string) => {
    if (b - a < 0.01) return;
    const mid = p((a + b) / 2, inset);
    ctx.fillText(text, mid.x, mid.y);
  };
  label(sideFrom, from, `${(from - sideFrom).toFixed(2)}`);
  label(from, to, `${(to - from).toFixed(2)} m`);
  label(to, sideTo, `${(sideTo - to).toFixed(2)}`);

  // Ticks at the opening edges
  ctx.strokeStyle = COLORS.textMuted;
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (const along of [from, to]) {
    const s = p(along, 4 / zoom);
    const e = p(along, inset + 6 / zoom);
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
  }
  ctx.stroke();
}

function drawRoomPreview(ctx: CanvasRenderingContext2D, preview: RoomPreview, zoom: number): void {
  const endX = preview.endX!;
  const endY = preview.endY!;
  const x = Math.min(preview.startX, endX);
  const y = Math.min(preview.startY, endY);
  const width = Math.abs(endX - preview.startX);
  const height = Math.abs(endY - preview.startY);

  ctx.fillStyle = COLORS.previewFill;
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([5 / zoom, 5 / zoom]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);

  ctx.fillStyle = COLORS.text;
  ctx.font = `500 ${13 / zoom}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${(width / SCALE).toFixed(2)} m × ${(height / SCALE).toFixed(2)} m`, x + width / 2, y + height / 2);
}
