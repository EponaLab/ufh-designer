import type { GlobalSettings, Tool } from '../types';
import { NumberField } from './fields';

interface ToolDef {
  tool: Tool;
  icon: string;
  label: string;
  title: string;
}

/** Tools exposed in the UI ('window' placement is not implemented yet). */
export const TOOLS: ToolDef[] = [
  { tool: 'select', icon: 'fas fa-mouse-pointer', label: 'Select', title: 'Select' },
  { tool: 'room', icon: 'fas fa-vector-square', label: 'Room', title: 'Add Room (Heated)' },
  { tool: 'zone', icon: 'far fa-square', label: 'Zone', title: 'Add Zone (Unheated)' },
  { tool: 'window', icon: 'far fa-window-maximize', label: 'Window', title: 'Add Window' },
  { tool: 'door', icon: 'fas fa-door-open', label: 'Door', title: 'Add Door' },
];

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  globals: GlobalSettings;
  onGlobalsChange: (patch: Partial<GlobalSettings>) => void;
  onCalculate: () => void;
}

/** Left-hand desktop toolbar. */
export function Toolbar({ tool, onToolChange, globals, onGlobalsChange, onCalculate }: ToolbarProps) {
  return (
    <aside className="toolbar" id="toolbarPanel">
      <div className="tool-group">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            className={`tool-btn${tool === t.tool ? ' active' : ''}`}
            title={t.title}
            onClick={() => onToolChange(t.tool)}
          >
            <i className={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="section-divider" />

      <div className="param-group">
        <label htmlFor="outdoorTemp">Outdoor (°C)</label>
        <NumberField
          id="outdoorTemp"
          value={globals.outdoorTemp}
          step={0.5}
          onChange={(outdoorTemp) => onGlobalsChange({ outdoorTemp })}
        />

        <label htmlFor="roomHeight" title="Ceiling height for newly drawn rooms">Default Height (m)</label>
        <NumberField
          id="roomHeight"
          value={globals.roomHeight}
          step={0.1}
          min={2}
          onChange={(roomHeight) => onGlobalsChange({ roomHeight })}
        />

        <label htmlFor="gridSize">Grid (m)</label>
        <NumberField
          id="gridSize"
          value={globals.gridSize}
          step={0.1}
          min={0.1}
          onChange={(gridSize) => onGlobalsChange({ gridSize })}
        />
      </div>

      <div className="action-group">
        <button id="calculate" className="btn btn-primary" onClick={onCalculate}>
          <i className="fas fa-calculator" /> Calculate
        </button>
      </div>
    </aside>
  );
}

interface MobileToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onToggleSettings: () => void;
  onCalculate: () => void;
}

/** Bottom toolbar shown on small screens. */
export function MobileToolbar({ tool, onToolChange, onToggleSettings, onCalculate }: MobileToolbarProps) {
  return (
    <div className="mobile-bottom-toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.tool}
          className={`mobile-tool-btn${tool === t.tool ? ' active' : ''}`}
          title={t.title}
          onClick={() => onToolChange(t.tool)}
        >
          <i className={t.icon} />
          <span>{t.label}</span>
        </button>
      ))}
      <button className="mobile-tool-btn" id="mobileSettingsBtn" title="Settings" onClick={onToggleSettings}>
        <i className="fas fa-cog" />
        <span>Settings</span>
      </button>
      <button
        className="mobile-tool-btn mobile-calc-btn"
        id="mobileCalculateBtn"
        title="Calculate"
        onClick={onCalculate}
      >
        <i className="fas fa-calculator" />
        <span>Calculate</span>
      </button>
    </div>
  );
}
