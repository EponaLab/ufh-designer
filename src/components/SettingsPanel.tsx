import {
  CEILING_ABOVE_OPTIONS,
  CEILING_MATERIAL_OPTIONS,
  FLOOR_BELOW_OPTIONS,
  FLOOR_MATERIAL_OPTIONS,
  FLOOR_STRUCTURE_OPTIONS,
  FLOOR_THICKNESS_MAX,
  FLOOR_THICKNESS_MIN,
  floorMaterialPatch,
  INSTALLATION_OPTIONS,
  INSULATION_OPTIONS,
  MIN_OPENING_SIZE,
  OPENING_LABEL,
  PIPE_SPACING_OPTIONS,
  type Option,
} from '../constants';
import { floorU } from '../lib/floor';
import { clampOpening, sideLine } from '../lib/openings';
import type { OpeningPatch } from '../state/projectReducer';
import type { GlobalSettings, Opening, OpeningKind, Room, RoomSettings, WallSide } from '../types';
import { isZone } from '../types';
import { NumberField, SelectField } from './fields';

export type RoomPatch = Partial<Pick<Room, 'name'> & RoomSettings>;

interface SettingsPanelProps {
  /** Mobile/tablet only: whether the sheet is open. */
  open: boolean;
  onClose: () => void;
  /** Selected room/zone; the panel edits all of its parameters. */
  room: Room | undefined;
  onRoomChange: (id: number, patch: RoomPatch) => void;
  onRoomDelete: (id: number) => void;
  /** Project settings — shown here only on small screens, where the left tool bar is hidden. */
  globals: GlobalSettings;
  onGlobalsChange: (patch: Partial<GlobalSettings>) => void;
  /** Selected window/door (takes precedence over the room) and the room it belongs to. */
  opening?: Opening | undefined;
  openingRoom?: Room | undefined;
  onOpeningChange: (id: number, patch: OpeningPatch) => void;
  onOpeningDelete: (id: number) => void;
}

/** Right-hand panel: parameters of the selected room, zone or opening. */
export function SettingsPanel(props: SettingsPanelProps) {
  const { open, onClose, room, onRoomChange, onRoomDelete, globals, onGlobalsChange } = props;
  const { opening, openingRoom, onOpeningChange, onOpeningDelete } = props;

  return (
    <aside className={`properties-panel${open ? ' active' : ''}`} id="settingsPanel">
      <div className="toolbar-header">
        <h3>Settings</h3>
        <button className="close-btn" id="closeProperties" onClick={onClose} aria-label="Close settings">
          <i className="fas fa-times" />
        </button>
      </div>

      {/* Project settings: duplicated from the left tool bar, which doesn't exist on small screens */}
      <div className="config-section mobile-only">
        <h3>Project</h3>
        <label htmlFor="outdoorTemp2">Outdoor (°C)</label>
        <NumberField
          id="outdoorTemp2"
          value={globals.outdoorTemp}
          step={0.5}
          onChange={(outdoorTemp) => onGlobalsChange({ outdoorTemp })}
        />
        <label htmlFor="roomHeight2">Default Height (m)</label>
        <NumberField
          id="roomHeight2"
          value={globals.roomHeight}
          step={0.1}
          min={2}
          onChange={(roomHeight) => onGlobalsChange({ roomHeight })}
        />
        <label htmlFor="wallU2">Wall U (W/m²K)</label>
        <NumberField
          id="wallU2"
          value={globals.wallU}
          step={0.05}
          min={0.05}
          max={5}
          onChange={(wallU) => onGlobalsChange({ wallU })}
        />
        <label htmlFor="gridSize2">Grid (m)</label>
        <NumberField
          id="gridSize2"
          value={globals.gridSize}
          step={0.1}
          min={0.1}
          onChange={(gridSize) => onGlobalsChange({ gridSize })}
        />
      </div>

      {opening && openingRoom ? (
        <OpeningEditor
          key={opening.id}
          opening={opening}
          room={openingRoom}
          onChange={(patch) => onOpeningChange(opening.id, patch)}
          onDelete={() => onOpeningDelete(opening.id)}
        />
      ) : !room ? (
        <div id="propertiesContent">
          <div className="properties-empty">
            <i className="fas fa-hand-pointer" />
            <p>Select a room or zone to edit its parameters</p>
          </div>
        </div>
      ) : isZone(room) ? (
        // Zones have no editable parameters here: temperature is edited on the drawing.
        <div className="panel-actions panel-actions-only">
          <button className="btn btn-destructive-outline" onClick={() => onRoomDelete(room.id)}>
            <i className="fas fa-trash" /> Delete zone
          </button>
        </div>
      ) : (
        <RoomEditor
          key={room.id}
          room={room}
          onChange={(patch) => onRoomChange(room.id, patch)}
          onDelete={() => onRoomDelete(room.id)}
        />
      )}
    </aside>
  );
}

interface RoomEditorProps {
  room: Room;
  onChange: (patch: RoomPatch) => void;
  onDelete: () => void;
}

/** Full parameter editor for a heated room (zones only get a delete button). */
function RoomEditor({ room, onChange, onDelete }: RoomEditorProps) {
  return (
    <>
      {/* Identity */}
      <div className="room-header">
        <i className="fas fa-vector-square is-heated" title="Heated room" />
        <input
          type="text"
          id="roomName"
          className="room-name-input"
          value={room.name}
          aria-label="Room name"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <span className="badge badge-heat">UFH</span>
      </div>
      <div className="room-meta">
        <i className="fas fa-ruler-combined" /> {room.width.toFixed(2)} × {room.height.toFixed(2)} m ·{' '}
        {(room.width * room.height).toFixed(1)} m²
      </div>

      {/* Floor build-up, bottom to top */}
      <div className="config-section">
        <h3>Floor (bottom to top)</h3>

        <label htmlFor="floorBelow">1. Below</label>
        <SelectField
          id="floorBelow"
          value={room.floorBelow}
          options={FLOOR_BELOW_OPTIONS}
          onChange={(floorBelow) => onChange({ floorBelow })}
        />

        <label htmlFor="floorStructure">2. Structure</label>
        <SelectField
          id="floorStructure"
          value={room.floorStructure}
          options={FLOOR_STRUCTURE_OPTIONS}
          onChange={(floorStructure) => onChange({ floorStructure })}
        />

        <label htmlFor="insulationBelow">Insulation</label>
        <SelectField
          id="insulationBelow"
          value={room.insulationBelow}
          options={INSULATION_OPTIONS}
          onChange={(insulationBelow) => onChange({ insulationBelow })}
        />

        <label htmlFor="installationType">3. Heating system</label>
        <SelectField
          id="installationType"
          value={room.installationType}
          options={INSTALLATION_OPTIONS}
          onChange={(installationType) => onChange({ installationType })}
        />

        <label htmlFor="pipeSpacing">Pipe spacing</label>
        <SelectField
          id="pipeSpacing"
          value={room.pipeSpacing}
          options={PIPE_SPACING_OPTIONS}
          onChange={(pipeSpacing) => onChange({ pipeSpacing })}
        />

        <label htmlFor="floorMaterial">4. Top material</label>
        <SelectField
          id="floorMaterial"
          value={room.floorMaterial}
          options={FLOOR_MATERIAL_OPTIONS}
          onChange={(m) => onChange(floorMaterialPatch(m))}
        />

        <label htmlFor="floorThickness">Thickness (mm)</label>
        <NumberField
          id="floorThickness"
          value={room.floorThickness}
          step={1}
          min={FLOOR_THICKNESS_MIN}
          max={FLOOR_THICKNESS_MAX}
          onChange={(floorThickness) => onChange({ floorThickness })}
        />

        <p className="section-note" id="floorUNote">
          Floor U-value: <strong>{floorU(room).toFixed(2)} W/m²K</strong>. Supply and return temperatures are
          calculated from the heat loss.
        </p>
      </div>

      {/* Ceiling */}
      <div className="config-section">
        <h3>Ceiling</h3>
        <label htmlFor="ceilingHeight">Height (m)</label>
        <NumberField
          id="ceilingHeight"
          value={room.ceilingHeight}
          step={0.1}
          min={2}
          max={10}
          onChange={(ceilingHeight) => onChange({ ceilingHeight })}
        />

        <label htmlFor="ceilingMaterial">Material</label>
        <SelectField
          id="ceilingMaterial"
          value={room.ceilingMaterial}
          options={CEILING_MATERIAL_OPTIONS}
          onChange={(ceilingMaterial) => onChange({ ceilingMaterial })}
        />

        <label htmlFor="ceilingAbove">Above</label>
        <SelectField
          id="ceilingAbove"
          value={room.ceilingAbove}
          options={CEILING_ABOVE_OPTIONS}
          onChange={(ceilingAbove) => onChange({ ceilingAbove })}
        />
      </div>

      <div className="panel-actions">
        <button className="btn btn-destructive-outline" onClick={onDelete}>
          <i className="fas fa-trash" /> Delete room
        </button>
      </div>
    </>
  );
}

const KIND_OPTIONS: Option<OpeningKind>[] = [
  { value: 'window', label: OPENING_LABEL.window },
  { value: 'door', label: OPENING_LABEL.door },
];

const SIDE_TEXT: Record<WallSide, string> = { north: 'north', south: 'south', east: 'east', west: 'west' };

interface OpeningEditorProps {
  opening: Opening;
  room: Room;
  onChange: (patch: OpeningPatch) => void;
  onDelete: () => void;
}

/** Window/door parameters. Geometry is kept within the wall by the reducer. */
function OpeningEditor({ opening, room, onChange, onDelete }: OpeningEditorProps) {
  const line = sideLine(room, opening.side);
  const sideLength = line.to - line.from;
  const { offset, width } = clampOpening(opening, sideLength);
  const height = Math.min(opening.height, room.ceilingHeight);
  const round = (v: number) => Math.round(v * 100) / 100;

  return (
    <>
      <div className="room-header">
        <i className={opening.kind === 'window' ? 'far fa-window-maximize is-glass' : 'fas fa-door-open'} />
        <span className="room-name-static">{OPENING_LABEL[opening.kind]}</span>
      </div>
      <div className="room-meta">
        {room.name} · {SIDE_TEXT[opening.side]} wall ({sideLength.toFixed(2)} m) · {(width * height).toFixed(2)} m²
      </div>

      <div className="config-section">
        <h3>Opening</h3>
        <label htmlFor="openingKind">Type</label>
        <SelectField id="openingKind" value={opening.kind} options={KIND_OPTIONS} onChange={(kind) => onChange({ kind })} />

        <label htmlFor="openingWidth">Width (m)</label>
        <NumberField
          id="openingWidth"
          value={round(width)}
          step={0.1}
          min={MIN_OPENING_SIZE}
          max={round(sideLength)}
          onChange={(w) => onChange({ width: w })}
        />

        <label htmlFor="openingHeight">Height (m)</label>
        <NumberField
          id="openingHeight"
          value={round(height)}
          step={0.1}
          min={MIN_OPENING_SIZE}
          max={room.ceilingHeight}
          onChange={(h) => onChange({ height: h })}
        />

        <label htmlFor="openingOffset">From corner (m)</label>
        <NumberField
          id="openingOffset"
          value={round(offset)}
          step={0.1}
          min={0}
          max={round(sideLength - width)}
          onChange={(o) => onChange({ offset: o })}
        />

        <label htmlFor="openingU">U-value (W/m²K)</label>
        <NumberField
          id="openingU"
          value={opening.uValue}
          step={0.1}
          min={0.1}
          max={6}
          onChange={(uValue) => onChange({ uValue })}
        />
      </div>

      <div className="panel-actions">
        <button className="btn btn-destructive-outline" onClick={onDelete}>
          <i className="fas fa-trash" /> Delete {OPENING_LABEL[opening.kind].toLowerCase()}
        </button>
      </div>
    </>
  );
}
