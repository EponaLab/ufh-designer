import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { MIN_ROOM_SIZE, SCALE } from '../constants';
import {
  clampZoom,
  findRoomAt,
  handleToSide,
  hitResizeHandle,
  RESIZE_CURSORS,
  resizeRect,
  screenToMeters,
  setSideLength,
  snapMeters,
  snapScreenToWorldGrid,
  zoomAt,
  type ResizeHandle,
  type Side,
} from '../lib/geometry';
import { LengthEditor } from './LengthEditor';
import { clampResize, findFreePosition, isInsideAny } from '../lib/layout';
import { drawScene, type RoomPreview } from '../lib/renderer';
import { hitOpening, sideLine, snapOpening } from '../lib/openings';
import type { Opening, OpeningKind, Point, Rect, Room, RoomType, Tool, Viewport, WallSide } from '../types';

interface DrawingCanvasProps {
  tool: Tool;
  rooms: Room[];
  openings: Opening[];
  selectedId: number | null;
  selectedOpeningId: number | null;
  gridSize: number;
  viewport: Viewport;
  setViewport: Dispatch<SetStateAction<Viewport>>;
  onCreateRoom: (type: RoomType, rect: Rect) => void;
  onMoveRoom: (id: number, x: number, y: number) => void;
  onResizeRoom: (id: number, rect: Rect) => void;
  onSelect: (id: number | null) => void;
  /** Place a window/door centered at `center` (absolute coordinate along the side). */
  onAddOpening: (kind: OpeningKind, roomId: number, side: WallSide, center: number) => void;
  onMoveOpening: (id: number, offset: number) => void;
  onSelectOpening: (id: number) => void;
  /** Overlay rendered inside the canvas area (e.g. the temperature chips). */
  children?: ReactNode;
}

const STATUS_TEXT: Record<Tool, string> = {
  select: 'Click to select · drag to move · drag edges to resize · double-click a side to type its length',
  room: 'Click and drag to create a heated room (with UFH)',
  zone: 'Click and drag to create an unheated zone (no UFH)',
  window: 'Click on a room side to add a window',
  door: 'Click on a room side to add a door',
};

const SIDE_NAME: Record<Side, WallSide> = { n: 'north', s: 'south', e: 'east', w: 'west' };
const isOpeningTool = (tool: Tool): tool is OpeningKind => tool === 'window' || tool === 'door';

/** How close (screen px) the pointer must be to a room edge to grab it for resizing. */
const RESIZE_TOLERANCE_PX = { mouse: 6, touch: 14 } as const;

interface DragState {
  id: number;
  offsetX: number;
  offsetY: number;
}

interface OpeningDragState {
  id: number;
  /** Pointer position minus the opening's near edge, along the wall (meters). */
  grab: number;
}

interface ResizeState {
  id: number;
  handle: ResizeHandle;
  /** Room rectangle when the resize started (meters). */
  original: Rect;
}

interface TouchState {
  touches: Point[];
  lastDistance: number;
}

const isRoomTool = (tool: Tool): tool is RoomType => tool === 'room' || tool === 'zone';

export function DrawingCanvas(props: DrawingCanvasProps) {
  const { tool, children } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  /** Side whose length is being typed in (double-click on a room side). */
  const [lengthEdit, setLengthEdit] = useState<{ roomId: number; side: Side } | null>(null);
  const lengthEditRoom = lengthEdit ? props.rooms.find((r) => r.id === lengthEdit.roomId) : undefined;

  // Interaction state lives in refs: it changes on every pointer move and
  // shouldn't trigger React renders by itself.
  const propsRef = useRef(props);
  const previewRef = useRef<RoomPreview | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const openingDragRef = useRef<OpeningDragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const panRef = useRef<Point | null>(null);
  const touchRef = useRef<TouchState>({ touches: [], lastDistance: 0 });
  /** Last single-finger tap, for double-tap detection. */
  const lastTapRef = useRef<{ time: number; point: Point } | null>(null);
  /** Whether the current touch gesture involved two fingers (then it's not a tap). */
  const pinchedRef = useRef(false);

  useLayoutEffect(() => {
    propsRef.current = props;
  });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const p = propsRef.current;
    drawScene(ctx, {
      width: canvas.width,
      height: canvas.height,
      viewport: p.viewport,
      gridSize: p.gridSize,
      rooms: p.rooms,
      openings: p.openings,
      selectedId: p.selectedId,
      selectedOpeningId: p.selectedOpeningId,
      preview: previewRef.current,
    });
  }, []); // reads only refs, so it can stay stable

  // Redraw after every render (rooms, selection, viewport, grid changes).
  useEffect(() => {
    redraw();
  });

  // Size the canvas to its container.
  useLayoutEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const parent = canvas?.parentElement;
      if (!canvas || !parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redraw();
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [redraw]);

  // Switching tools cancels any room being drawn and resets the hover cursor.
  useEffect(() => {
    previewRef.current = null;
    setLengthEdit(null);
    if (canvasRef.current) canvasRef.current.style.cursor = '';
    redraw();
  }, [tool, redraw]);

  // Native listeners: wheel/touch need { passive: false } to call preventDefault.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocal = (clientX: number, clientY: number): Point => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    /** Room edge/corner under the pointer; the selected room wins over overlapping/adjacent ones. */
    const findResizeTarget = (p: Point, touch: boolean): { room: Room; handle: ResizeHandle } | null => {
      const { viewport, rooms, selectedId } = propsRef.current;
      const m = screenToMeters(p, viewport);
      const tolerance = (touch ? RESIZE_TOLERANCE_PX.touch : RESIZE_TOLERANCE_PX.mouse) / (SCALE * viewport.zoom);
      const selected = rooms.find((r) => r.id === selectedId);
      const candidates = selected ? [selected, ...[...rooms].reverse()] : [...rooms].reverse();
      for (const room of candidates) {
        const handle = hitResizeHandle(room, m, tolerance);
        if (handle) return { room, handle };
      }
      return null;
    };

    /** Window/door under the pointer. */
    const findOpening = (p: Point, touch: boolean): Opening | undefined => {
      const { viewport, rooms, openings } = propsRef.current;
      const tolerance = (touch ? RESIZE_TOLERANCE_PX.touch : RESIZE_TOLERANCE_PX.mouse) / (SCALE * viewport.zoom);
      return hitOpening(openings, new Map(rooms.map((r) => [r.id, r])), screenToMeters(p, viewport), tolerance);
    };

    /** Cursor feedback: resize arrows on edges, move over rooms/openings, copy where an opening can go. */
    const updateHoverCursor = (p: Point) => {
      const { tool, viewport, rooms } = propsRef.current;
      if (isOpeningTool(tool)) {
        canvas.style.cursor = findResizeTarget(p, false) ? 'copy' : 'not-allowed';
        return;
      }
      if (tool !== 'select') {
        canvas.style.cursor = '';
        return;
      }
      if (findOpening(p, false)) {
        canvas.style.cursor = 'grab';
        return;
      }
      const target = findResizeTarget(p, false);
      if (target) canvas.style.cursor = RESIZE_CURSORS[target.handle];
      else canvas.style.cursor = findRoomAt(rooms, screenToMeters(p, viewport)) ? 'move' : 'default';
    };

    const pointerDown = (p: Point, button: number, touch = false) => {
      const { tool, viewport, gridSize, rooms, onSelect, onSelectOpening, onAddOpening } = propsRef.current;

      if (button === 1) {
        panRef.current = p; // middle button pans
        return;
      }
      if (button !== 0) return;

      if (tool === 'select') {
        // Openings sit on the walls, so they take priority over the room edge.
        const opening = findOpening(p, touch);
        const host = opening && rooms.find((r) => r.id === opening.roomId);
        if (opening && host) {
          onSelectOpening(opening.id);
          const line = sideLine(host, opening.side);
          const m = screenToMeters(p, viewport);
          openingDragRef.current = { id: opening.id, grab: (line.horizontal ? m.x : m.y) - (line.from + opening.offset) };
          return;
        }
        const target = findResizeTarget(p, touch);
        if (target) {
          const { room, handle } = target;
          onSelect(room.id);
          resizeRef.current = {
            id: room.id,
            handle,
            original: { x: room.x, y: room.y, width: room.width, height: room.height },
          };
          return;
        }
        const m = screenToMeters(p, viewport);
        const room = findRoomAt(rooms, m);
        if (room) {
          onSelect(room.id);
          dragRef.current = { id: room.id, offsetX: m.x - room.x, offsetY: m.y - room.y };
        } else {
          onSelect(null);
        }
      } else if (isRoomTool(tool)) {
        const s = snapScreenToWorldGrid(p, viewport, gridSize);
        // Rooms can't be started inside another room.
        if (!isInsideAny({ x: s.x / SCALE, y: s.y / SCALE }, rooms)) {
          previewRef.current = { startX: s.x, startY: s.y };
        }
      } else if (isOpeningTool(tool)) {
        // Place on the nearest room side under the pointer (selected room first on shared walls).
        const target = findResizeTarget(p, touch);
        if (target) {
          const side = SIDE_NAME[handleToSide(target.handle)];
          const m = screenToMeters(p, viewport);
          onAddOpening(tool, target.room.id, side, side === 'north' || side === 'south' ? m.x : m.y);
        }
      }
    };

    /** New-room rectangle (meters) from the drag start to `endWorld`, stopped at existing walls. */
    const constrainedNewRoom = (preview: RoomPreview, endWorld: Point): Rect | null => {
      const start = { x: preview.startX / SCALE, y: preview.startY / SCALE };
      const end = { x: endWorld.x / SCALE, y: endWorld.y / SCALE };
      const handle = `${end.y >= start.y ? 's' : 'n'}${end.x >= start.x ? 'e' : 'w'}` as ResizeHandle;
      const proposed = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      };
      return clampResize({ ...start, width: 0, height: 0 }, proposed, handle, propsRef.current.rooms);
    };

    const othersThan = (id: number) => propsRef.current.rooms.filter((r) => r.id !== id);

    const pointerMove = (p: Point) => {
      const { tool, viewport, gridSize, setViewport, onMoveRoom, onResizeRoom } = propsRef.current;
      setCursor(screenToMeters(p, viewport));

      const last = panRef.current;
      if (last) {
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        panRef.current = p;
        setViewport((v) => ({ ...v, panX: v.panX + dx, panY: v.panY + dy }));
        return;
      }

      const preview = previewRef.current;
      if (isRoomTool(tool) && preview) {
        const rect = constrainedNewRoom(preview, snapScreenToWorldGrid(p, viewport, gridSize));
        if (rect) {
          // The start point is always a corner of the constrained rectangle; preview the opposite one.
          const sx = preview.startX / SCALE;
          const sy = preview.startY / SCALE;
          preview.endX = (Math.abs(rect.x - sx) < 1e-9 ? rect.x + rect.width : rect.x) * SCALE;
          preview.endY = (Math.abs(rect.y - sy) < 1e-9 ? rect.y + rect.height : rect.y) * SCALE;
        } else {
          preview.endX = undefined;
          preview.endY = undefined;
        }
        redraw();
      } else if (openingDragRef.current) {
        // Slide the opening along its wall (snapped; the reducer keeps it within the side).
        const { id, grab } = openingDragRef.current;
        const { openings, rooms, onMoveOpening } = propsRef.current;
        const opening = openings.find((o) => o.id === id);
        const host = opening && rooms.find((r) => r.id === opening.roomId);
        if (opening && host) {
          const line = sideLine(host, opening.side);
          const m = screenToMeters(p, viewport);
          onMoveOpening(id, snapOpening((line.horizontal ? m.x : m.y) - grab - line.from));
        }
      } else if (resizeRef.current) {
        const { id, handle, original } = resizeRef.current;
        const proposed = resizeRect(original, handle, screenToMeters(p, viewport), gridSize, MIN_ROOM_SIZE);
        const rect = clampResize(original, proposed, handle, othersThan(id));
        if (rect) onResizeRoom(id, rect);
      } else if (dragRef.current) {
        const drag = dragRef.current;
        const room = propsRef.current.rooms.find((r) => r.id === drag.id);
        const m = screenToMeters(p, viewport);
        const desired = { x: snapMeters(m.x - drag.offsetX, gridSize), y: snapMeters(m.y - drag.offsetY, gridSize) };
        // Never overlap: a colliding position snaps flush to the neighbour's wall.
        const pos = room ? findFreePosition(room, desired, othersThan(drag.id)) : null;
        if (pos) onMoveRoom(drag.id, pos.x, pos.y);
      } else {
        updateHoverCursor(p);
      }
    };

    const pointerUp = (p: Point, button: number) => {
      if (button === 1) {
        panRef.current = null;
        return;
      }
      if (button !== 0) return;

      const { tool, viewport, gridSize, onCreateRoom } = propsRef.current;
      const preview = previewRef.current;
      if (isRoomTool(tool) && preview) {
        const rect = constrainedNewRoom(preview, snapScreenToWorldGrid(p, viewport, gridSize));
        if (rect && rect.width >= MIN_ROOM_SIZE - 1e-9 && rect.height >= MIN_ROOM_SIZE - 1e-9) {
          onCreateRoom(tool, rect);
        }
        previewRef.current = null;
        redraw();
      } else if (openingDragRef.current) {
        openingDragRef.current = null;
      } else if (resizeRef.current) {
        resizeRef.current = null;
      } else if (dragRef.current) {
        dragRef.current = null;
      }
    };

    // Mouse
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
      pointerDown(toLocal(e.clientX, e.clientY), e.button);
    };
    const isInteracting = () =>
      panRef.current !== null ||
      previewRef.current !== null ||
      dragRef.current !== null ||
      resizeRef.current !== null ||
      openingDragRef.current !== null;

    /** Double-click / double-tap on a room side opens the length field for it. */
    const editSideAt = (p: Point, touch: boolean) => {
      if (propsRef.current.tool !== 'select') return;
      const target = findResizeTarget(p, touch);
      if (!target) return;
      propsRef.current.onSelect(target.room.id);
      setLengthEdit({ roomId: target.room.id, side: handleToSide(target.handle) });
    };
    const onDoubleClick = (e: MouseEvent) => editSideAt(toLocal(e.clientX, e.clientY), false);
    // Listen on window so drags continue over the floating panels and end even if released outside the canvas.
    const onMouseMove = (e: MouseEvent) => {
      if (e.target === canvas || isInteracting()) pointerMove(toLocal(e.clientX, e.clientY));
    };
    const onMouseUp = (e: MouseEvent) => {
      if (isInteracting()) pointerUp(toLocal(e.clientX, e.clientY), e.button);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const anchor = toLocal(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      propsRef.current.setViewport((v) => zoomAt(v, anchor, factor));
    };

    // Touch: one finger behaves like the left mouse button, two fingers pan/zoom.
    const touchPoints = (list: TouchList): Point[] =>
      Array.from(list, (t) => ({ x: t.clientX, y: t.clientY }));
    const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touches = touchPoints(e.touches);
      if (touches.length === 1) {
        pinchedRef.current = false;
        pointerDown(toLocal(touches[0]!.x, touches[0]!.y), 0, true);
      } else if (touches.length === 2) {
        pinchedRef.current = true;
        // A second finger turns the gesture into pan/zoom: cancel draw/drag/resize.
        previewRef.current = null;
        dragRef.current = null;
        resizeRef.current = null;
        openingDragRef.current = null;
        touchRef.current = { touches, lastDistance: distance(touches[0]!, touches[1]!) };
        redraw();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touches = touchPoints(e.touches);
      const state = touchRef.current;
      if (touches.length === 1) {
        pointerMove(toLocal(touches[0]!.x, touches[0]!.y));
      } else if (touches.length === 2 && state.touches.length === 2) {
        const [t1, t2] = touches as [Point, Point];
        const [o1, o2] = state.touches as [Point, Point];
        const dist = distance(t1, t2);
        const factor = state.lastDistance > 0 ? dist / state.lastDistance : 1;
        const dx = (t1.x + t2.x) / 2 - (o1.x + o2.x) / 2;
        const dy = (t1.y + t2.y) / 2 - (o1.y + o2.y) / 2;
        propsRef.current.setViewport((v) => ({
          zoom: clampZoom(v.zoom * factor),
          panX: v.panX + dx,
          panY: v.panY + dy,
        }));
        touchRef.current = { touches, lastDistance: dist };
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 0) {
        const t = e.changedTouches[0];
        const wasPinch = pinchedRef.current;
        if (t) {
          const p = toLocal(t.clientX, t.clientY);
          pointerUp(p, 0);
          // Double-tap (two quick taps close together) acts like a double-click.
          const now = performance.now();
          const last = lastTapRef.current;
          if (!wasPinch && last && now - last.time < 350 && Math.hypot(p.x - last.point.x, p.y - last.point.y) < 24) {
            lastTapRef.current = null;
            editSideAt(p, true);
          } else {
            lastTapRef.current = wasPinch ? null : { time: now, point: p };
          }
        }
        touchRef.current = { touches: [], lastDistance: 0 };
      } else if (e.touches.length === 1) {
        touchRef.current = { touches: [], lastDistance: 0 };
      }
    };

    const passiveFalse = { passive: false } as const;
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, passiveFalse);
    canvas.addEventListener('touchstart', onTouchStart, passiveFalse);
    canvas.addEventListener('touchmove', onTouchMove, passiveFalse);
    canvas.addEventListener('touchend', onTouchEnd, passiveFalse);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [redraw]);

  return (
    <main className="canvas-area">
      <canvas id="drawingCanvas" ref={canvasRef} />
      {children}
      {lengthEdit && lengthEditRoom && (
        <LengthEditor
          key={`${lengthEdit.roomId}-${lengthEdit.side}`}
          room={lengthEditRoom}
          side={lengthEdit.side}
          viewport={props.viewport}
          onCommit={(length) => {
            const { x, y, width, height } = lengthEditRoom;
            const original = { x, y, width, height };
            const proposed = setSideLength(original, lengthEdit.side, length);
            // n/s sides grow to the right, e/w sides grow downward; stop at neighbouring walls.
            const handle = lengthEdit.side === 'n' || lengthEdit.side === 's' ? 'e' : 's';
            const others = props.rooms.filter((r) => r.id !== lengthEditRoom.id);
            const rect = clampResize(original, proposed, handle, others);
            if (rect) props.onResizeRoom(lengthEditRoom.id, rect);
          }}
          onClose={() => setLengthEdit(null)}
        />
      )}
      <div className="canvas-info">
        <span id="cursorPos">
          X: {cursor.x.toFixed(1)}m, Y: {cursor.y.toFixed(1)}m
        </span>
        <span id="canvasStatus">{STATUS_TEXT[tool]}</span>
      </div>
    </main>
  );
}
