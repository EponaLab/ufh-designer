import type { ProjectResults, RoomUFHResult } from '../lib/heatLoss';

interface ResultsPanelProps {
  results: ProjectResults;
  selectedId: number | null;
  /** Adds the `active` (bottom sheet) class used on smaller screens. */
  modal: boolean;
  onSelectRoom: (id: number) => void;
  onClose: () => void;
}

const kW = (w: number) => (w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${w.toFixed(0)} W`);

function validationText(results: ProjectResults): string {
  const { validation, supplyTemp, maxSupplyTemp, highestFloorTemp, maxFloorTemp } = results;
  switch (validation.kind) {
    case 'ok':
      return `Design supply ${supplyTemp.toFixed(1)} °C · warmest floor ${highestFloorTemp.toFixed(1)} °C (max ${maxFloorTemp} °C)`;
    case 'supplyTooHigh':
      return `Supply ${validation.supply.toFixed(1)} °C exceeds ${maxSupplyTemp} °C: reduce losses, pipe spacing or floor covering`;
    case 'floorTooWarm':
      return `Floor too warm (> ${maxFloorTemp} °C, EN 1264) in ${validation.rooms.join(', ')}: add heat sources or reduce losses`;
  }
}

function RoomRow({ r, maxFloorTemp, selected, onSelect }: { r: RoomUFHResult; maxFloorTemp: number; selected: boolean; onSelect: () => void }) {
  const h = r.hydraulics;
  const ok = h.floorTempOk;
  return (
    <li>
      <button
        type="button"
        className={`result-room${selected ? ' is-selected' : ''}`}
        onClick={onSelect}
        title={ok ? 'Floor temperature OK' : `Floor surface above ${maxFloorTemp} °C`}
      >
        <i className={`fas ${ok ? 'fa-circle-check is-ok' : 'fa-circle-xmark is-bad'}`} aria-label={ok ? 'OK' : 'Problem'} />
        <span className="result-room-name">{r.room}</span>
        <span className="result-room-loss">{kW(r.loss)}</span>
        <span className="result-room-detail">
          {h.q.toFixed(0)} W/m² · return {h.returnTemp.toFixed(1)} °C · floor{' '}
          <span className={ok ? undefined : 'is-bad'}>{h.floorTemp.toFixed(1)} °C</span>
        </span>
        <span className="result-room-detail">
          {h.pipeLength.toFixed(0)} m pipe{h.loops > 1 ? ` · ${h.loops} loops` : ''} · {h.flow.toFixed(0)} l/h
        </span>
      </button>
    </li>
  );
}

/** Compact results card shown under the room panel. */
export function ResultsPanel({ results, selectedId, modal, onSelectRoom, onClose }: ResultsPanelProps) {
  const { totalLoss, supplyTemp, maxSupplyTemp, highestFloorTemp, maxFloorTemp, breakdown, ufhResults, validation } = results;
  const ok = validation.kind === 'ok';

  // Breakdown grouped by room, in drawing order
  const groups = new Map<number, { room: string; items: typeof breakdown }>();
  for (const item of breakdown) {
    const g = groups.get(item.roomId) ?? { room: item.room, items: [] };
    g.items.push(item);
    groups.set(item.roomId, g);
  }

  return (
    <section id="resultsSection" className={`results-section${modal ? ' active' : ''}`} aria-label="Results">
      <div className="toolbar-header">
        <h3>Results</h3>
        <button className="close-btn" id="closeResults" onClick={onClose} aria-label="Close results">
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="result-stats">
        <div>
          <label>Heat loss</label>
          <strong id="totalLoss">{kW(totalLoss)}</strong>
        </div>
        <div>
          <label>Supply</label>
          <strong
            id="supplyTemp"
            className={supplyTemp > maxSupplyTemp ? 'is-over-limit' : undefined}
            title="Design supply temperature, set by the most demanding room at a 5 K spread"
          >
            {supplyTemp.toFixed(1)} °C
          </strong>
        </div>
        <div>
          <label>Floor max</label>
          <strong
            id="floorTemp"
            className={highestFloorTemp > maxFloorTemp ? 'is-over-limit' : undefined}
            title={`Warmest floor surface; limit ${maxFloorTemp} °C (EN 1264)`}
          >
            {highestFloorTemp.toFixed(1)} °C
          </strong>
        </div>
      </div>

      <div id="validationStatus" className={`validation-status ${ok ? 'success' : 'error'}`}>
        <i className={`fas ${ok ? 'fa-check-circle' : 'fa-times-circle'}`} /> {validationText(results)}
      </div>

      {ufhResults.length > 0 && (
        <ul className="result-rooms" aria-label="Rooms">
          {ufhResults.map((r) => (
            <RoomRow
              key={r.roomId}
              r={r}
              maxFloorTemp={maxFloorTemp}
              selected={r.roomId === selectedId}
              onSelect={() => onSelectRoom(r.roomId)}
            />
          ))}
        </ul>
      )}

      <details className="result-breakdown">
        <summary>Breakdown</summary>
        <div id="breakdownDetails" className="breakdown-details">
          {[...groups.entries()].map(([roomId, g]) => (
            <div key={roomId} className="breakdown-group">
              <h4>{g.room}</h4>
              {g.items.map((item, i) => (
                <div className="breakdown-item" key={i}>
                  <div className="breakdown-item-header">
                    <span>{item.name}</span>
                    <span>{item.loss.toFixed(0)} W</span>
                  </div>
                  <div className="breakdown-item-details">
                    {item.area.toFixed(2)} m² · U {item.uValue} · ΔT {item.deltaT.toFixed(1)} K
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
