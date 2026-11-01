import { defaultRoomSettings, OPENING_DEFAULTS } from '../constants';
import { centeredOffset, clampOpening, sideLine } from '../lib/openings';
import type { Opening, OpeningKind, Rect, Room, RoomType, WallSide } from '../types';

export interface ProjectState {
  rooms: Room[];
  openings: Opening[];
  nextRoomId: number;
  nextOpeningId: number;
  /** Selected room/zone (mutually exclusive with `selectedOpeningId`). */
  selectedId: number | null;
  selectedOpeningId: number | null;
}

export type OpeningPatch = Partial<Pick<Opening, 'kind' | 'offset' | 'width' | 'height' | 'uValue'>>;

export type ProjectAction =
  | { type: 'addRoom'; roomType: RoomType; rect: Rect; ceilingHeight: number }
  | { type: 'updateRoom'; id: number; patch: Partial<Omit<Room, 'id'>> }
  | { type: 'resizeRoom'; id: number; rect: Rect }
  | { type: 'deleteRoom'; id: number }
  | { type: 'select'; id: number | null }
  | { type: 'addOpening'; kind: OpeningKind; roomId: number; side: WallSide; center: number }
  | { type: 'updateOpening'; id: number; patch: OpeningPatch }
  | { type: 'deleteOpening'; id: number }
  | { type: 'selectOpening'; id: number | null }
  | { type: 'load'; rooms: Room[]; openings: Opening[] }
  | { type: 'reset' };

export const initialProjectState: ProjectState = {
  rooms: [],
  openings: [],
  nextRoomId: 1,
  nextOpeningId: 1,
  selectedId: null,
  selectedOpeningId: null,
};

const sideLength = (room: Rect, side: WallSide) => {
  const line = sideLine(room, side);
  return line.to - line.from;
};

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'addRoom': {
      const id = state.nextRoomId;
      const room: Room = {
        id,
        type: action.roomType,
        name: action.roomType === 'zone' ? `Zone ${id}` : `Room ${id}`,
        ...action.rect,
        ...defaultRoomSettings(action.roomType, action.ceilingHeight),
      };
      // Newly created rooms are selected immediately.
      return { ...state, rooms: [...state.rooms, room], nextRoomId: id + 1, selectedId: id, selectedOpeningId: null };
    }
    case 'updateRoom':
      return {
        ...state,
        rooms: state.rooms.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };
    case 'resizeRoom': {
      const old = state.rooms.find((r) => r.id === action.id);
      if (!old) return state;
      const dx = action.rect.x - old.x;
      const dy = action.rect.y - old.y;
      return {
        ...state,
        rooms: state.rooms.map((r) => (r.id === action.id ? { ...r, ...action.rect } : r)),
        // Keep openings where they are on the drawing when the side's start corner moves.
        openings: state.openings.map((o) => {
          if (o.roomId !== action.id) return o;
          const shift = o.side === 'north' || o.side === 'south' ? dx : dy;
          return shift === 0 ? o : { ...o, offset: o.offset - shift };
        }),
      };
    }
    case 'deleteRoom':
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.id),
        openings: state.openings.filter((o) => o.roomId !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        selectedOpeningId:
          state.openings.find((o) => o.id === state.selectedOpeningId)?.roomId === action.id
            ? null
            : state.selectedOpeningId,
      };
    case 'select':
      return { ...state, selectedId: action.id, selectedOpeningId: null };
    case 'addOpening': {
      const room = state.rooms.find((r) => r.id === action.roomId);
      if (!room) return state;
      const id = state.nextOpeningId;
      const defaults = OPENING_DEFAULTS[action.kind];
      const line = sideLine(room, action.side);
      const width = Math.min(defaults.width, line.to - line.from);
      const opening: Opening = {
        id,
        roomId: room.id,
        side: action.side,
        kind: action.kind,
        offset: centeredOffset(line, action.center, width),
        width,
        height: Math.min(defaults.height, room.ceilingHeight),
        uValue: defaults.uValue,
      };
      return {
        ...state,
        openings: [...state.openings, opening],
        nextOpeningId: id + 1,
        selectedId: null,
        selectedOpeningId: id,
      };
    }
    case 'updateOpening':
      return {
        ...state,
        openings: state.openings.map((o) => {
          if (o.id !== action.id) return o;
          const room = state.rooms.find((r) => r.id === o.roomId);
          const next = { ...o, ...action.patch };
          return room ? clampOpening(next, sideLength(room, o.side)) : next;
        }),
      };
    case 'deleteOpening':
      return {
        ...state,
        openings: state.openings.filter((o) => o.id !== action.id),
        selectedOpeningId: state.selectedOpeningId === action.id ? null : state.selectedOpeningId,
      };
    case 'selectOpening':
      return { ...state, selectedOpeningId: action.id, selectedId: null };
    case 'load':
      return projectFromData(action.rooms, action.openings);
    case 'reset':
      return initialProjectState;
  }
}

/** State for a loaded project; id counters continue after the highest stored ids. */
export function projectFromData(rooms: Room[], openings: Opening[]): ProjectState {
  return {
    ...initialProjectState,
    rooms,
    openings,
    nextRoomId: Math.max(0, ...rooms.map((r) => r.id)) + 1,
    nextOpeningId: Math.max(0, ...openings.map((o) => o.id)) + 1,
  };
}
