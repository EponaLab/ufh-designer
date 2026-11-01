import type {
  CeilingAbove,
  CeilingMaterial,
  FloorBelow,
  FloorMaterial,
  FloorStructure,
  GlobalSettings,
  InstallationType,
  InsulationThickness,
  OpeningKind,
  PipeSpacing,
  RoomSettings,
  RoomType,
  Viewport,
} from './types';

export const APP_VERSION = '2.1.0';

/** Pixels per meter at zoom 1. */
export const SCALE = 50;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;

/** Max floor surface temperature for occupied areas (EN 1264-3), °C. */
export const MAX_FLOOR_TEMP = 29;
/** Combined surface heat transfer resistance (≈10.8 W/m²K), m²K/W. */
export const SURFACE_RESISTANCE = 0.093;
/** Default U-value of external walls (brick), W/m²K — editable per project. */
export const DEFAULT_WALL_U = 0.5;
/** U-value of walls between rooms / to zones, W/m²K (not editable). */
export const INTERNAL_WALL_U = 0.5;
/** Minimum room size when drawing, meters. */
export const MIN_ROOM_SIZE = 1;

/** Defaults for newly placed openings (window: triple glazing). */
export const OPENING_DEFAULTS: Record<OpeningKind, { width: number; height: number; uValue: number }> = {
  window: { width: 1.2, height: 1.5, uValue: 1.1 },
  door: { width: 0.9, height: 2.1, uValue: 1.8 },
};
export const OPENING_LABEL: Record<OpeningKind, string> = { window: 'Window', door: 'Door' };
export const MIN_OPENING_SIZE = 0.3;
/** Openings snap to this step along the wall, meters. */
export const OPENING_SNAP = 0.1;

/** Breakpoints matching the CSS. */
export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

/** Initial pan leaves room for the floating tool bar on the left. */
export const INITIAL_VIEWPORT: Viewport = { panX: 280, panY: 60, zoom: 1.0 };

export const DEFAULT_GLOBALS: GlobalSettings = {
  outdoorTemp: -10,
  roomHeight: 2.7,
  wallU: DEFAULT_WALL_U,
  gridSize: 0.5,
};

export function defaultRoomSettings(type: RoomType, ceilingHeight = DEFAULT_GLOBALS.roomHeight): RoomSettings {
  return {
    indoorTemp: type === 'zone' ? 15 : 20, // Zones default to 15°C (unheated)
    ceilingHeight,
    floorBelow: 'ground',
    floorStructure: 'concrete',
    insulationBelow: 20,
    installationType: 'wet',
    pipeSpacing: 150,
    floorMaterial: 'tile',
    floorThickness: FLOOR_MATERIALS.tile.defaultThickness,
    ceilingMaterial: 'plaster',
    ceilingAbove: 'heated',
  };
}

// Material properties (U-values in W/m²K, resistance in m²K/W)
export const WALL_MATERIALS = {
  brick: { name: 'Brick Wall (0.3m)', u: 0.5 },
  concrete: { name: 'Concrete (0.2m)', u: 0.8 },
  lightweight: { name: 'Lightweight Block', u: 0.3 },
  insulated: { name: 'Insulated Wall', u: 0.2 },
} as const;

export interface FloorMaterialProps {
  name: string;
  /** Thermal conductivity λ of the floor covering, W/mK. */
  conductivity: number;
  /** Typical covering thickness, mm. */
  defaultThickness: number;
}

/** Top layer. Tiles R = 0.01 and wood R = 0.10 m²K/W at their default thickness. */
export const FLOOR_MATERIALS: Record<FloorMaterial, FloorMaterialProps> = {
  tile: { name: 'Tiles', conductivity: 1.0, defaultThickness: 10 },
  wood: { name: 'Wood', conductivity: 0.15, defaultThickness: 15 },
};

/** Thermal resistance of the floor covering, m²K/W (R = d / λ). */
export function floorCoveringResistance(material: FloorMaterial, thicknessMm: number): number {
  return thicknessMm / 1000 / FLOOR_MATERIALS[material].conductivity;
}

/** Resistance of the load-bearing structure under the heating system, m²K/W. */
export const FLOOR_STRUCTURES: Record<FloorStructure, { name: string; resistance: number }> = {
  concrete: { name: 'Concrete slab (≈200 mm)', resistance: 0.15 },
  'wood-beams': { name: 'Wood beams (boards, cavity, ceiling)', resistance: 0.4 },
};

/** Conductivity of the insulation layer, W/mK (typical EPS/PIR board). */
export const INSULATION_CONDUCTIVITY = 0.035;
/** Resistance of the floor's inner surface for downward heat flow, m²K/W. */
export const SURFACE_RESISTANCE_DOWN = 0.17;
/** Equivalent resistance of the ground below a slab (simplified, EN ISO 13370-style), m²K/W. */
export const GROUND_RESISTANCE = 1.0;
/** Surface resistance on the underside facing another (heated or unheated) space, m²K/W. */
export const BELOW_SPACE_RESISTANCE = 0.17;

export const FLOOR_THICKNESS_MIN = 1;
export const FLOOR_THICKNESS_MAX = 100;

/** Changing the covering material also resets its thickness to the material's typical value. */
export function floorMaterialPatch(floorMaterial: FloorMaterial): Pick<RoomSettings, 'floorMaterial' | 'floorThickness'> {
  return { floorMaterial, floorThickness: FLOOR_MATERIALS[floorMaterial].defaultThickness };
}

export const CEILING_MATERIALS: Record<CeilingMaterial, { name: string; u: number }> = {
  concrete: { name: 'Concrete', u: 0.7 },
  plaster: { name: 'Plaster on Concrete', u: 0.6 },
  wood: { name: 'Wood', u: 0.4 },
};

/** UFH pipe spacing heat output factors. */
export const PIPE_SPACING_FACTORS: Record<PipeSpacing, number> = {
  100: 1.25,
  150: 1.0,
  200: 0.85,
  300: 0.65,
};

export interface UFHSystemProps {
  name: string;
  /** Resistance between the pipes and the floor covering, m²K/W. */
  resistanceAbovePipes: number;
  spacingEffectiveness: number;
}

export const UFH_SYSTEMS: Record<InstallationType, UFHSystemProps> = {
  wet: {
    name: 'Screed (wet system)',
    resistanceAbovePipes: 0.045,
    spacingEffectiveness: 1.0,
  },
  'overlay-aluminum': {
    name: 'Overlay - Aluminum Spreader Plates',
    resistanceAbovePipes: 0.012,
    spacingEffectiveness: 0.9,
  },
  'overlay-grooved': {
    name: 'Overlay - Grooved Panels',
    resistanceAbovePipes: 0.018,
    spacingEffectiveness: 0.85,
  },
  'overlay-basic': {
    name: 'Overlay - Basic (No Plates)',
    resistanceAbovePipes: 0.025,
    spacingEffectiveness: 0.75,
  },
};

// Select options shown in the UI

export interface Option<T> {
  value: T;
  label: string;
}

export const FLOOR_MATERIAL_OPTIONS: Option<FloorMaterial>[] = [
  { value: 'wood', label: 'Wood' },
  { value: 'tile', label: 'Tiles' },
];

export const FLOOR_BELOW_OPTIONS: Option<FloorBelow>[] = [
  { value: 'ground', label: 'Ground' },
  { value: 'heated', label: 'Other floor' },
  { value: 'unheated', label: 'Unheated space' },
];

export const FLOOR_STRUCTURE_OPTIONS: Option<FloorStructure>[] = [
  { value: 'concrete', label: 'Concrete slab' },
  { value: 'wood-beams', label: 'Wood beams' },
];

export const INSTALLATION_OPTIONS: Option<InstallationType>[] = [
  { value: 'wet', label: 'Screed (wet)' },
  { value: 'overlay-aluminum', label: 'Overlay - Aluminum' },
  { value: 'overlay-grooved', label: 'Overlay - Grooved' },
  { value: 'overlay-basic', label: 'Overlay - Basic' },
];

export const INSULATION_OPTIONS: Option<InsulationThickness>[] = [
  { value: 0, label: 'None' },
  { value: 10, label: '10 mm' },
  { value: 20, label: '20 mm' },
  { value: 30, label: '30 mm' },
  { value: 50, label: '50 mm' },
  { value: 80, label: '80 mm' },
  { value: 100, label: '100 mm' },
];

export const PIPE_SPACING_OPTIONS: Option<PipeSpacing>[] = [
  { value: 100, label: '100mm' },
  { value: 150, label: '150mm' },
  { value: 200, label: '200mm' },
  { value: 300, label: '300mm' },
];

export const CEILING_MATERIAL_OPTIONS: Option<CeilingMaterial>[] = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'plaster', label: 'Plaster' },
  { value: 'wood', label: 'Wood' },
];

export const CEILING_ABOVE_OPTIONS: Option<CeilingAbove>[] = [
  { value: 'heated', label: 'Heated' },
  { value: 'unheated', label: 'Unheated' },
  { value: 'outdoor', label: 'Outdoor' },
];
