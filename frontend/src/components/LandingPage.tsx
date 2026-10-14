import React from 'react';
import { ArrowRight, CheckCircle2, Code2, Cpu, Sparkles, Trophy } from 'lucide-react';

interface LandingPageProps {
  openAuth: (tab?: 'login' | 'signup') => void;
  onNavigateTab: (tab: 'dashboard' | 'problems' | 'contests' | 'profile' | 'auth' | 'rubric' | 'admin') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ openAuth, onNavigateTab }) => {
  return (
    <div className="landing-page-wrapper">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-pill">
          <Sparkles size={14} className="text-cyan" />
          <span>Next-Generation Competitive Programming & AI Review</span>
        </div>

        <h1 className="landing-title">
          Solve. Compete. Get instant <br />
          <span className="landing-title-gradient">AI-powered code reviews.</span>
        </h1>

        <p className="landing-subtitle">
          Code Arena blends the thrill of high-stakes contest arenas with an automated AI Staff Engineer code reviewer. Receive instant, multi-pillar rubric scoring on correctness, algorithmic complexity, security, and maintainability.
        </p>

        <div className="landing-cta-group">
          <button
            type="button"
            className="btn-hero-primary"
            onClick={() => openAuth('signup')}
            id="btn-hero-get-started"
          >
            <span>Get Started Free</span>
            <ArrowRight size={17} />
          </button>
          <button
            type="button"
            className="btn-hero-secondary"
            onClick={() => onNavigateTab('problems')}
            id="btn-hero-explore-problems"
          >
            <Code2 size={17} />
            <span>Explore Challenges</span>
          </button>
          <button
            type="button"
            className="btn-hero-secondary"
            onClick={() => onNavigateTab('contests')}
            id="btn-hero-explore-contests"
          >
            <Trophy size={17} />
            <span>Live Contests</span>
          </button>
        </div>

        {/* Live Platform Highlights Metrics */}
        <div className="landing-metrics-strip">
          <div className="metric-pill-card">
            <div className="metric-pill-value">5 Pillars</div>
            <div className="metric-pill-label">AI Review Engine</div>
          </div>
          <div className="metric-pill-card">
            <div className="metric-pill-value">4 Languages</div>
            <div className="metric-pill-label">Python, C, C++, Java</div>
          </div>
          <div className="metric-pill-card">
            <div className="metric-pill-value">&lt; 150ms</div>
            <div className="metric-pill-label">Judge0 Sandbox Speed</div>
          </div>
          <div className="metric-pill-card">
            <div className="metric-pill-value">Real-Time</div>
            <div className="metric-pill-label">WebSocket Scoreboards</div>
          </div>
        </div>

        {/* Interactive Feature Demo Card */}
        <div className="landing-preview-card">
          <div className="preview-card-header">
            <div className="window-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <span className="preview-filename">two_sum_optimal.py — Code Arena AI Review Preview</span>
            <span className="preview-badge-status">
              <CheckCircle2 size={13} className="text-emerald" /> 94 / 100 Score
            </span>
          </div>
          <div className="preview-card-body">
            <div className="preview-code-pane">
              <pre>
                <code>{`def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Optimal O(N) single-pass hash map solution.
    Handles extreme integer bounds and negative complements.
    """
    lookup = {}
    for index, val in enumerate(nums):
        diff = target - val
        if diff in lookup:
            return [lookup[diff], index]
        lookup[val] = index
    return []`}</code>
              </pre>
            </div>
            <div className="preview-review-pane">
              <div className="preview-score-badge">
                <span className="score-num">9.4</span>
                <span className="score-den">/ 10</span>
                <p className="score-label">Exemplary Solution</p>
              </div>
              <div className="preview-mini-bars">
                <div className="mini-bar">
                  <span>Correctness (30%)</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: '98%' }} /></div>
                </div>
                <div className="mini-bar">
                  <span>Complexity O(N) (25%)</span>
                  <div className="bar-track"><div className="bar-fill amber" style={{ width: '100%' }} /></div>
                </div>
                <div className="mini-bar">
                  <span>Cleanliness & Style (15%)</span>
                  <div className="bar-track"><div className="bar-fill emerald" style={{ width: '92%' }} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars Section */}
      <section className="landing-features-section">
        <div className="section-header text-center">
          <span className="section-eyebrow">BUILT FOR EXCELLENCE</span>
          <h2 className="section-title">Everything you need to master code interviews</h2>
          <p className="section-description">
            Traditional online judges only tell you if your code passed sample test cases. Code Arena evaluates how you think, how your algorithms scale, and whether your code meets production standards.
          </p>
        </div>

        <div className="landing-features-grid">
          <div className="feature-box">
            <div className="feature-box-icon">
              <Sparkles size={24} />
            </div>
            <h3>Multi-Pillar AI Code Reviews</h3>
            <p>
              Every submission is analyzed across Correctness, Time & Space Complexity, Cleanliness, Security, and Maintainability. Get actionable suggestions before you hit interview day.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-box-icon">
              <Cpu size={24} />
            </div>
            <h3>Sandboxed Multi-Language Judging</h3>
            <p>
              Isolated execution sandboxes running GCC and OpenJDK benchmarks. Test edge cases with real-time stdout and compile error diagnostics.
            </p>
          </div>

          <div className="feature-box">
            <div className="feature-box-icon">
              <Trophy size={24} />
            </div>
            <h3>Live Competitions & Leaderboards</h3>
            <p>
              Compete in scheduled and private invite-only contests. Real-time WebSocket broadcasts instantly update rankings as solutions get accepted.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
