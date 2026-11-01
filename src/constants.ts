import type {
  CeilingAbove,
  CeilingMaterial,
  FloorBelow,
  FloorMaterial,
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
/** Default wall U-value used in calculations (brick), W/m²K. */
export const DEFAULT_WALL_U = 0.5;
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
  gridSize: 0.5,
};

export function defaultRoomSettings(type: RoomType, ceilingHeight = DEFAULT_GLOBALS.roomHeight): RoomSettings {
  return {
    indoorTemp: type === 'zone' ? 15 : 20, // Zones default to 15°C (unheated)
    ceilingHeight,
    floorMaterial: 'tile',
    floorThickness: FLOOR_MATERIALS.tile.defaultThickness,
    floorBelow: 'ground',
    installationType: 'wet',
    insulationBelow: 20,
    pipeSpacing: 150,
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
  /** U-value of the floor construction for heat loss downwards, W/m²K. */
  u: number;
  /** Thermal conductivity λ of the floor covering, W/mK. */
  conductivity: number;
  /** Typical covering thickness, mm. Defaults reproduce the previous fixed resistances. */
  defaultThickness: number;
}

export const FLOOR_MATERIALS: Record<FloorMaterial, FloorMaterialProps> = {
  concrete: { name: 'Concrete Slab', u: 0.7, conductivity: 1.4, defaultThickness: 70 }, // R 0.05
  tile: { name: 'Tile on Concrete', u: 0.8, conductivity: 1.0, defaultThickness: 10 }, // R 0.01
  wood: { name: 'Wood Flooring', u: 0.5, conductivity: 0.15, defaultThickness: 15 }, // R 0.10
  carpet: { name: 'Carpet', u: 0.3, conductivity: 0.06, defaultThickness: 9 }, // R 0.15
};

/** Thermal resistance of the floor covering, m²K/W (R = d / λ). */
export function floorCoveringResistance(material: FloorMaterial, thicknessMm: number): number {
  return thicknessMm / 1000 / FLOOR_MATERIALS[material].conductivity;
}

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
  resistanceAbovePipes: number;
  downwardLossFactor: number;
  spacingEffectiveness: number;
}

export const UFH_SYSTEMS: Record<InstallationType, UFHSystemProps> = {
  wet: {
    name: 'Wet System (Screed/Concrete)',
    resistanceAbovePipes: 0.045,
    downwardLossFactor: 0.05,
    spacingEffectiveness: 1.0,
  },
  'overlay-aluminum': {
    name: 'Overlay - Aluminum Spreader Plates',
    resistanceAbovePipes: 0.012,
    downwardLossFactor: 0.25,
    spacingEffectiveness: 0.9,
  },
  'overlay-grooved': {
    name: 'Overlay - Grooved Panels',
    resistanceAbovePipes: 0.018,
    downwardLossFactor: 0.3,
    spacingEffectiveness: 0.85,
  },
  'overlay-basic': {
    name: 'Overlay - Basic (No Plates)',
    resistanceAbovePipes: 0.025,
    downwardLossFactor: 0.35,
    spacingEffectiveness: 0.75,
  },
};

/** Fraction of downward loss remaining for a given insulation thickness. */
export const INSULATION_FACTORS: Record<InsulationThickness, number> = {
  0: 1.0,
  10: 0.7,
  20: 0.5,
  30: 0.35,
  50: 0.2,
};

// Select options shown in the UI

export interface Option<T> {
  value: T;
  label: string;
}

export const FLOOR_MATERIAL_OPTIONS: Option<FloorMaterial>[] = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'tile', label: 'Tile' },
  { value: 'wood', label: 'Wood' },
  { value: 'carpet', label: 'Carpet' },
];

export const FLOOR_BELOW_OPTIONS: Option<FloorBelow>[] = [
  { value: 'ground', label: 'Ground' },
  { value: 'heated', label: 'Heated' },
  { value: 'unheated', label: 'Unheated' },
];

export const INSTALLATION_OPTIONS: Option<InstallationType>[] = [
  { value: 'wet', label: 'Wet (Screed)' },
  { value: 'overlay-aluminum', label: 'Overlay - Aluminum' },
  { value: 'overlay-grooved', label: 'Overlay - Grooved' },
  { value: 'overlay-basic', label: 'Overlay - Basic' },
];

export const INSULATION_OPTIONS: Option<InsulationThickness>[] = [
  { value: 0, label: 'None' },
  { value: 10, label: '10mm' },
  { value: 20, label: '20mm' },
  { value: 30, label: '30mm' },
  { value: 50, label: '50mm' },
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
