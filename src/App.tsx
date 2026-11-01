import { useCallback, useMemo, useReducer, useState } from 'react';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Header } from './components/Header';
import { ResultsPanel } from './components/ResultsPanel';
import { RoomTemperatureLayer } from './components/RoomTemperatureLayer';
import { SettingsPanel, type RoomPatch } from './components/SettingsPanel';
import { MobileToolbar, Toolbar } from './components/Toolbar';
import { DEFAULT_GLOBALS, INITIAL_VIEWPORT, OPENING_LABEL, TABLET_BREAKPOINT } from './constants';
import { useWindowWidth } from './hooks/useWindowWidth';
import { calculateProject, type ProjectResults } from './lib/heatLoss';
import { initialProjectState, projectReducer, type OpeningPatch } from './state/projectReducer';
import type { GlobalSettings, OpeningKind, Rect, RoomType, Tool, Viewport, WallSide } from './types';

export default function App() {
  const [project, dispatch] = useReducer(projectReducer, initialProjectState);
  const [tool, setTool] = useState<Tool>('select');
  const [globals, setGlobals] = useState<GlobalSettings>(DEFAULT_GLOBALS);
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Results are shown after "Calculate" and then stay live as the design changes. */
  const [showResults, setShowResults] = useState(false);
  const windowWidth = useWindowWidth();

  const { rooms, openings, selectedId, selectedOpeningId } = project;
  const selectedRoom = rooms.find((r) => r.id === selectedId);
  const selectedOpening = openings.find((o) => o.id === selectedOpeningId);
  const selectedOpeningRoom = selectedOpening && rooms.find((r) => r.id === selectedOpening.roomId);
  const hasHeatedRoom = rooms.some((r) => r.type === 'room');
  const results = useMemo<ProjectResults | null>(
    () => (showResults && hasHeatedRoom ? calculateProject(rooms, globals, openings) : null),
    [showResults, hasHeatedRoom, rooms, globals, openings],
  );

  const updateGlobals = useCallback((patch: Partial<GlobalSettings>) => {
    setGlobals((g) => ({ ...g, ...patch }));
  }, []);

  const updateRoom = useCallback((id: number, patch: RoomPatch) => {
    dispatch({ type: 'updateRoom', id, patch });
  }, []);

  const handleCreateRoom = useCallback(
    (roomType: RoomType, rect: Rect) => {
      dispatch({ type: 'addRoom', roomType, rect, ceilingHeight: globals.roomHeight });
    },
    [globals.roomHeight],
  );

  const handleMoveRoom = useCallback((id: number, x: number, y: number) => {
    dispatch({ type: 'updateRoom', id, patch: { x, y } });
  }, []);

  const handleResizeRoom = useCallback((id: number, rect: Rect) => {
    dispatch({ type: 'resizeRoom', id, rect });
  }, []);

  const handleSelect = useCallback((id: number | null) => {
    dispatch({ type: 'select', id });
  }, []);

  const handleAddOpening = useCallback((kind: OpeningKind, roomId: number, side: WallSide, center: number) => {
    dispatch({ type: 'addOpening', kind, roomId, side, center });
  }, []);

  const handleMoveOpening = useCallback((id: number, offset: number) => {
    dispatch({ type: 'updateOpening', id, patch: { offset } });
  }, []);

  const handleSelectOpening = useCallback((id: number) => {
    dispatch({ type: 'selectOpening', id });
  }, []);

  const updateOpening = useCallback((id: number, patch: OpeningPatch) => {
    dispatch({ type: 'updateOpening', id, patch });
  }, []);

  const handleDeleteOpening = (id: number) => {
    const opening = openings.find((o) => o.id === id);
    if (!opening || !window.confirm(`Delete this ${OPENING_LABEL[opening.kind].toLowerCase()}?`)) return;
    dispatch({ type: 'deleteOpening', id });
  };

  const handleNewProject = () => {
    if (!window.confirm('Start a new project? This will clear all current data.')) return;
    dispatch({ type: 'reset' });
    setShowResults(false);
  };

  const handleCalculate = () => {
    if (!hasHeatedRoom) {
      window.alert('Please add at least one heated room before calculating.');
      return;
    }
    setShowResults(true);
  };

  const handleDeleteRoom = (id: number) => {
    const room = rooms.find((r) => r.id === id);
    if (!room || !window.confirm(`Delete this ${room.type === 'zone' ? 'zone' : 'room'}?`)) return;
    dispatch({ type: 'deleteRoom', id });
  };

  return (
    <div className="app-container">
      <Header onNewProject={handleNewProject} />

      <div className="main-content">
        <MobileToolbar
          tool={tool}
          onToolChange={setTool}
          onToggleSettings={() => setSettingsOpen((o) => !o)}
          onCalculate={handleCalculate}
        />

        <Toolbar
          tool={tool}
          onToolChange={setTool}
          globals={globals}
          onGlobalsChange={updateGlobals}
          onCalculate={handleCalculate}
        />

        <DrawingCanvas
          tool={tool}
          rooms={rooms}
          openings={openings}
          selectedId={selectedId}
          selectedOpeningId={selectedOpeningId}
          gridSize={globals.gridSize}
          viewport={viewport}
          setViewport={setViewport}
          onCreateRoom={handleCreateRoom}
          onMoveRoom={handleMoveRoom}
          onResizeRoom={handleResizeRoom}
          onSelect={handleSelect}
          onAddOpening={handleAddOpening}
          onMoveOpening={handleMoveOpening}
          onSelectOpening={handleSelectOpening}
        >
          <RoomTemperatureLayer
            rooms={rooms}
            viewport={viewport}
            selectedId={selectedId}
            onChange={(id, indoorTemp) => updateRoom(id, { indoorTemp })}
            onSelect={handleSelect}
          />
        </DrawingCanvas>

        <div className="side-column">
          <SettingsPanel
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            room={selectedRoom}
            onRoomChange={updateRoom}
            onRoomDelete={handleDeleteRoom}
            globals={globals}
            onGlobalsChange={updateGlobals}
            opening={selectedOpening}
            openingRoom={selectedOpeningRoom}
            onOpeningChange={updateOpening}
            onOpeningDelete={handleDeleteOpening}
          />

          {results && (
            <ResultsPanel
              results={results}
              selectedId={selectedId}
              modal={windowWidth <= TABLET_BREAKPOINT}
              onSelectRoom={handleSelect}
              onClose={() => setShowResults(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
