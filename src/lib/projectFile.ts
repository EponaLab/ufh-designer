/*
 * Saving / loading projects as JSON (download/upload and browser autosave).
 * Loading is defensive: unknown or invalid values fall back to defaults so older
 * or hand-edited files still open.
 */
import {
  CEILING_ABOVE_OPTIONS,
  CEILING_MATERIAL_OPTIONS,
  DEFAULT_GLOBALS,
  defaultRoomSettings,
  FLOOR_BELOW_OPTIONS,
  FLOOR_MATERIAL_OPTIONS,
  FLOOR_MATERIALS,
  FLOOR_STRUCTURE_OPTIONS,
  INSTALLATION_OPTIONS,
  INSULATION_OPTIONS,
  MIN_OPENING_SIZE,
  OPENING_DEFAULTS,
  PIPE_SPACING_OPTIONS,
  type Option,
} from '../constants';
import type { GlobalSettings, Opening, OpeningKind, Room, RoomType, WallSide } from '../types';

export const FILE_FORMAT = 'ufh-designer-project';
export const FILE_VERSION = 1;
export const AUTOSAVE_KEY = 'ufh-designer:project';

export interface ProjectData {
  globals: GlobalSettings;
  rooms: Room[];
  openings: Opening[];
}

export interface ProjectFile extends ProjectData {
  format: typeof FILE_FORMAT;
  version: number;
  savedAt: string;
}

export function serializeProject(data: ProjectData): string {
  const file: ProjectFile = { format: FILE_FORMAT, version: FILE_VERSION, savedAt: new Date().toISOString(), ...data };
  return JSON.stringify(file, null, 2);
}

// ---------------------------------------------------------------- parsing helpers

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
const oneOf = <T extends string | number>(v: unknown, options: readonly Option<T>[], fallback: T): T =>
  options.some((o) => o.value === v) ? (v as T) : fallback;
const SIDES: readonly WallSide[] = ['north', 'east', 'south', 'west'];

function parseGlobals(v: unknown): GlobalSettings {
  const g = isObj(v) ? v : {};
  return {
    outdoorTemp: num(g.outdoorTemp, DEFAULT_GLOBALS.outdoorTemp, -50, 30),
    roomHeight: num(g.roomHeight, DEFAULT_GLOBALS.roomHeight, 2, 10),
    wallU: num(g.wallU, DEFAULT_GLOBALS.wallU, 0.05, 5),
    gridSize: num(g.gridSize, DEFAULT_GLOBALS.gridSize, 0.1, 10),
  };
}

function parseRoom(v: unknown): Room | null {
  if (!isObj(v)) return null;
  const id = num(v.id, NaN, 1);
  const width = num(v.width, NaN, 0.01);
  const height = num(v.height, NaN, 0.01);
  if (!Number.isInteger(id) || Number.isNaN(width) || Number.isNaN(height)) return null;
  const type: RoomType = v.type === 'zone' ? 'zone' : 'room';
  const d = defaultRoomSettings(type);
  // Coverings that no longer exist (carpet, concrete) fall back to the default, with its thickness.
  const materialKnown = FLOOR_MATERIAL_OPTIONS.some((o) => o.value === v.floorMaterial);
  const floorMaterial = oneOf(v.floorMaterial, FLOOR_MATERIAL_OPTIONS, d.floorMaterial);
  return {
    id,
    type,
    name: typeof v.name === 'string' ? v.name : `${type === 'zone' ? 'Zone' : 'Room'} ${id}`,
    x: num(v.x, 0),
    y: num(v.y, 0),
    width,
    height,
    indoorTemp: num(v.indoorTemp, d.indoorTemp, -30, 40),
    ceilingHeight: num(v.ceilingHeight, d.ceilingHeight, 2, 10),
    floorBelow: oneOf(v.floorBelow, FLOOR_BELOW_OPTIONS, d.floorBelow),
    floorStructure: oneOf(v.floorStructure, FLOOR_STRUCTURE_OPTIONS, d.floorStructure),
    insulationBelow: oneOf(v.insulationBelow, INSULATION_OPTIONS, d.insulationBelow),
    installationType: oneOf(v.installationType, INSTALLATION_OPTIONS, d.installationType),
    pipeSpacing: oneOf(v.pipeSpacing, PIPE_SPACING_OPTIONS, d.pipeSpacing),
    floorMaterial,
    floorThickness: materialKnown
      ? num(v.floorThickness, FLOOR_MATERIALS[floorMaterial].defaultThickness, 1, 100)
      : FLOOR_MATERIALS[floorMaterial].defaultThickness,
    ceilingMaterial: oneOf(v.ceilingMaterial, CEILING_MATERIAL_OPTIONS, d.ceilingMaterial),
    ceilingAbove: oneOf(v.ceilingAbove, CEILING_ABOVE_OPTIONS, d.ceilingAbove),
  };
}

function parseOpening(v: unknown, roomIds: ReadonlySet<number>): Opening | null {
  if (!isObj(v)) return null;
  const id = num(v.id, NaN, 1);
  const roomId = num(v.roomId, NaN);
  if (!Number.isInteger(id) || !roomIds.has(roomId)) return null;
  if (!SIDES.includes(v.side as WallSide)) return null;
  const kind: OpeningKind = v.kind === 'door' ? 'door' : 'window';
  const d = OPENING_DEFAULTS[kind];
  return {
    id,
    roomId,
    side: v.side as WallSide,
    kind,
    offset: num(v.offset, 0, 0),
    width: num(v.width, d.width, MIN_OPENING_SIZE, 100),
    height: num(v.height, d.height, MIN_OPENING_SIZE, 10),
    uValue: num(v.uValue, d.uValue, 0.1, 6),
  };
}

/** Parse a project file; throws an Error with a user-facing message if it isn't one. */
export function parseProject(text: string): ProjectData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!isObj(raw) || raw.format !== FILE_FORMAT || !Array.isArray(raw.rooms)) {
    throw new Error('This is not a UFH Designer project file.');
  }
  if (typeof raw.version === 'number' && raw.version > FILE_VERSION) {
    throw new Error('This project was saved by a newer version of UFH Designer.');
  }

  // Drop duplicate ids so selection and references stay unambiguous.
  const rooms: Room[] = [];
  const seen = new Set<number>();
  for (const r of raw.rooms.map(parseRoom)) {
    if (r && !seen.has(r.id)) {
      seen.add(r.id);
      rooms.push(r);
    }
  }
  const openings: Opening[] = [];
  const seenOpenings = new Set<number>();
  for (const o of (Array.isArray(raw.openings) ? raw.openings : []).map((o) => parseOpening(o, seen))) {
    if (o && !seenOpenings.has(o.id)) {
      seenOpenings.add(o.id);
      openings.push(o);
    }
  }
  return { globals: parseGlobals(raw.globals), rooms, openings };
}

/** Project restored from the browser autosave, if any. */
export function loadAutosave(): ProjectData | null {
  try {
    const text = localStorage.getItem(AUTOSAVE_KEY);
    return text ? parseProject(text) : null;
  } catch {
    return null; // corrupt or unavailable storage: start fresh
  }
}

export function writeAutosave(data: ProjectData): void {
  try {
    if (data.rooms.length === 0) localStorage.removeItem(AUTOSAVE_KEY);
    else localStorage.setItem(AUTOSAVE_KEY, serializeProject(data));
  } catch {
    // Storage full or disabled (private mode): autosave is best-effort.
  }
}

/** Trigger a browser download of the project. */
export function downloadProject(data: ProjectData): void {
  const blob = new Blob([serializeProject(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ufh-project-${new Date().toISOString().slice(0, 10)}.ufh.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
