import React from 'react';
import { ExternalLink, Heart, Terminal } from 'lucide-react';

interface FooterProps {
  onNavigateTab: (tab: 'dashboard' | 'problems' | 'contests' | 'profile' | 'auth' | 'rubric' | 'admin') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateTab }) => {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-container">
        <div className="footer-left">
          <div className="footer-brand-row">
            <div className="footer-logo-box">
              <Terminal size={18} className="text-cyan" />
            </div>
            <strong className="footer-brand-title">Code Arena</strong>
            <span className="footer-badge">Final Year Project Edition</span>
          </div>
          <p className="footer-desc">
            Next-generation competitive programming platform featuring real-time automated AI code reviews, multi-pillar rubric scoring, and sandboxed low-latency code execution.
          </p>
          <div className="footer-tech-stack">
            <span>FastAPI</span>
            <span className="dot-sep">•</span>
            <span>SQLAlchemy</span>
            <span className="dot-sep">•</span>
            <span>React 19</span>
            <span className="dot-sep">•</span>
            <span>Monaco Editor</span>
            <span className="dot-sep">•</span>
            <span>Judge0 Sandbox</span>
          </div>
        </div>

        <div className="footer-links-group">
          <div className="footer-column">
            <h4>Platform</h4>
            <button type="button" className="footer-nav-link" onClick={() => onNavigateTab('problems')}>
              Practice Problems
            </button>
            <button type="button" className="footer-nav-link" onClick={() => onNavigateTab('contests')}>
              Live Contests
            </button>
            <button type="button" className="footer-nav-link" onClick={() => onNavigateTab('rubric')}>
              5-Pillar Rubric
            </button>
          </div>

          <div className="footer-column">
            <h4>Developer & API</h4>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="footer-nav-link"
              title="Interactive Swagger OpenAPI Documentation"
            >
              <span>Swagger API Docs</span>
              <ExternalLink size={12} />
            </a>
            <a
              href="http://localhost:8000/health"
              target="_blank"
              rel="noreferrer"
              className="footer-nav-link"
              title="Backend Health Probe"
            >
              <span>GET /health</span>
              <ExternalLink size={12} />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="footer-nav-link"
              title="Project GitHub Repository"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
              <span>GitHub Repo</span>
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-container">
          <p>© {new Date().getFullYear()} Code Arena. Engineered with precision for competitive coders.</p>
          <p className="footer-credit">
            Built with <Heart size={13} className="text-rose inline-icon" /> and paired AI systems.
          </p>
        </div>
      </div>
    </footer>
  );
};
