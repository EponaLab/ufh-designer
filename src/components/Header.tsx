import { useRef } from 'react';
import { APP_VERSION } from '../constants';

interface HeaderProps {
  onNewProject: () => void;
  onSave: () => void;
  /** Called with the chosen file's text. */
  onOpen: (file: File) => void;
}

export function Header({ onNewProject, onSave, onOpen }: HeaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <header className="header">
      <div className="header-left">
        <i className="fas fa-fire-flame-curved" />
        <h1>UFH Designer</h1>
        <span className="version">v{APP_VERSION}</span>
      </div>
      <div className="header-right">
        <button id="newProject" className="btn btn-secondary" onClick={onNewProject} title="New project">
          <i className="fas fa-file" /> <span>New</span>
        </button>
        <button id="openProject" className="btn btn-secondary" onClick={() => fileRef.current?.click()} title="Open a saved project">
          <i className="fas fa-folder-open" /> <span>Open</span>
        </button>
        <button id="saveProject" className="btn btn-secondary" onClick={onSave} title="Save project to a file (⌘S / Ctrl+S)">
          <i className="fas fa-floppy-disk" /> <span>Save</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // allow re-opening the same file
            if (file) onOpen(file);
          }}
        />
      </div>
    </header>
  );
}
