import { metersToScreen } from '../lib/geometry';
import type { Room, Viewport } from '../types';
import { isZone } from '../types';
import { NumberField } from './fields';

/** Vertical offset (screen px) of a room's chip below its center, under the canvas name/area labels. */
const ROOM_CHIP_OFFSET_Y = 20;

interface RoomTemperatureLayerProps {
  rooms: readonly Room[];
  viewport: Viewport;
  selectedId: number | null;
  onChange: (id: number, indoorTemp: number) => void;
  onSelect: (id: number) => void;
}

/** Editable temperature chips drawn over each room on the canvas. */
export function RoomTemperatureLayer({ rooms, viewport, selectedId, onChange, onSelect }: RoomTemperatureLayerProps) {
  return (
    <>
      {rooms.map((room) => {
        const center = metersToScreen({ x: room.x + room.width / 2, y: room.y + room.height / 2 }, viewport);
        const zone = isZone(room);
        const classes = ['room-temp', zone ? 'is-zone' : 'is-heated', room.id === selectedId ? 'is-selected' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <label
            key={room.id}
            className={classes}
            style={{ left: center.x, top: center.y + (zone ? 0 : ROOM_CHIP_OFFSET_Y) }}
            title={`${room.name} temperature`}
          >
            <i className="fas fa-temperature-half" aria-hidden="true" />
            <NumberField
              className="room-temp-input"
              style={{ width: `${Math.max(2, String(room.indoorTemp).length) + 0.5}ch` }}
              value={room.indoorTemp}
              step={0.5}
              min={-30}
              max={40}
              ariaLabel={`${room.name} temperature (°C)`}
              onFocus={() => onSelect(room.id)}
              onChange={(t) => onChange(room.id, t)}
            />
            <span aria-hidden="true">°C</span>
          </label>
        );
      })}
    </>
  );
}
