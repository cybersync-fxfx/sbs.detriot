import { Shield, ExternalLink, Activity, Terminal } from 'lucide-react';

function App() {
  return (
    <div className="modern-container">
      {/* Background glow effects without images */}
      <div className="bg-glow bg-glow-blue"></div>
      <div className="bg-glow bg-glow-cyan"></div>
      
      <main className="content-wrapper">
        <div className="brand-header">
          <Shield size={48} className="brand-icon" />
          <h1 className="brand-title">SBS Platform</h1>
          <p className="brand-subtitle">Next-Generation Infrastructure Security</p>
        </div>

        <div className="redirect-grid">
          <a href="https://example.com/portal" className="redirect-card primary-card">
            <div className="card-icon-wrapper">
              <Lock size={24} />
            </div>
            <div className="card-content">
              <h2>Client Portal</h2>
              <p>Access your centralized security dashboard</p>
            </div>
            <ExternalLink size={20} className="link-icon" />
          </a>

          <a href="https://example.com/docs" className="redirect-card">
            <div className="card-icon-wrapper">
              <Terminal size={24} />
            </div>
            <div className="card-content">
              <h2>Documentation</h2>
              <p>Integration guides and API references</p>
            </div>
            <ExternalLink size={20} className="link-icon" />
          </a>

          <a href="https://example.com/status" className="redirect-card">
            <div className="card-icon-wrapper">
              <Activity size={24} />
            </div>
            <div className="card-content">
              <h2>System Status</h2>
              <p>View real-time network telemetry</p>
            </div>
            <ExternalLink size={20} className="link-icon" />
          </a>
        </div>
      </main>

      <footer className="simple-footer">
        <p>© {new Date().getFullYear()} Server Based Security. No images used. Pure CSS.</p>
      </footer>
    </div>
  );
}

// Missing Lock icon import in the above block, let's fix it by adding Lock to the import
import { Lock } from 'lucide-react';

export default App;
