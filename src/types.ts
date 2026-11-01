// Shared domain types for the UFH Designer.

export type Tool = 'select' | 'pan' | 'room' | 'zone' | 'window' | 'door';

export type RoomType = 'room' | 'zone';

/** Top layer of the floor (visible covering). */
export type FloorMaterial = 'tile' | 'wood';
/** What the floor rests on / what lies below it. */
export type FloorBelow = 'ground' | 'heated' | 'unheated';
/** Load-bearing floor structure under the heating system. */
export type FloorStructure = 'concrete' | 'wood-beams';
export type CeilingMaterial = 'concrete' | 'plaster' | 'wood';
export type CeilingAbove = 'heated' | 'unheated' | 'outdoor';
export type InstallationType = 'wet' | 'overlay-aluminum' | 'overlay-grooved' | 'overlay-basic';
export type InsulationThickness = 0 | 10 | 20 | 30 | 50 | 80 | 100;
export type PipeSpacing = 100 | 150 | 200 | 300;

/** Per-room thermal / UFH configuration. */
export interface RoomSettings {
  indoorTemp: number;
  /** Floor-to-ceiling height, meters. */
  ceilingHeight: number;
  // Floor layers, bottom to top: what is below → structure → insulation → heating system → covering.
  floorBelow: FloorBelow;
  floorStructure: FloorStructure;
  /** Insulation under the heating system, millimeters (0 = none). */
  insulationBelow: InsulationThickness;
  installationType: InstallationType;
  pipeSpacing: PipeSpacing;
  floorMaterial: FloorMaterial;
  /** Floor covering thickness, millimeters. */
  floorThickness: number;
  ceilingMaterial: CeilingMaterial;
  ceilingAbove: CeilingAbove;
}

/** A rectangular room (heated, with UFH) or zone (unheated). Geometry is in meters. */
export interface Room extends RoomSettings {
  id: number;
  type: RoomType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Project-wide settings. */
export interface GlobalSettings {
  outdoorTemp: number;
  /** Default ceiling height applied to newly drawn rooms, meters. */
  roomHeight: number;
  /** U-value of all external walls, W/m²K. */
  wallU: number;
  gridSize: number;
}

/** Canvas pan offset (screen px) and zoom factor. */
export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned rectangle in meters. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WallSide = 'north' | 'east' | 'south' | 'west';

export type OpeningKind = 'window' | 'door';

/**
 * A window or door on one side of a room (or zone). Position is measured along the side
 * from its start corner: the west end for north/south sides, the north end for east/west sides.
 */
export interface Opening {
  id: number;
  roomId: number;
  side: WallSide;
  kind: OpeningKind;
  /** Distance from the side's start corner to the opening's near edge, meters. */
  offset: number;
  /** Width along the wall, meters. */
  width: number;
  /** Height, meters. */
  height: number;
  /** Thermal transmittance, W/m²K. */
  uValue: number;
}

export const isZone = (room: Pick<Room, 'type'>): boolean => room.type === 'zone';
