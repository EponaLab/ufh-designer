import { APP_VERSION } from '../constants';

interface HeaderProps {
  onNewProject: () => void;
}

export function Header({ onNewProject }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <i className="fas fa-fire-flame-curved" />
        <h1>UFH Designer</h1>
        <span className="version">v{APP_VERSION}</span>
      </div>
      <div className="header-right">
        <button id="newProject" className="btn btn-secondary" onClick={onNewProject}>
          <i className="fas fa-file" /> New Project
        </button>
      </div>
    </header>
  );
}
