import React from 'react';
import { Award, CheckCircle2, ShieldCheck, Zap, Code, HeartHandshake } from 'lucide-react';

export const RubricView: React.FC = () => {
  const pillars = [
    {
      title: 'Correctness',
      weight: '30%',
      icon: <CheckCircle2 size={24} className="rubric-icon text-cyan" />,
      desc: 'Algorithmic logic and edge cases handling.',
      checks: 'Handles nulls, empty inputs, extreme integer bounds, recursion depth, off-by-one errors.',
    },
    {
      title: 'Time & Space Complexity',
      weight: '25%',
      icon: <Zap size={24} className="rubric-icon text-amber" />,
      desc: 'Asymptotic performance and memory footprint.',
      checks: 'Achieves optimal Big-O bounds, avoids redundant iterations, minimizes heap allocations.',
    },
    {
      title: 'Code Cleanliness & Style',
      weight: '15%',
      icon: <Code size={24} className="rubric-icon text-emerald" />,
      desc: 'Readability, formatting, and language-idiomatic syntax.',
      checks: 'Meaningful naming conventions, PEP 8 / Prettier compliance, clear separation of concerns.',
    },
    {
      title: 'Security & Safety',
      weight: '15%',
      icon: <ShieldCheck size={24} className="rubric-icon text-rose" />,
      desc: 'Vulnerability prevention and safe execution patterns.',
      checks: 'Proper input validation, memory safety, prevention of stack overflows and injection vectors.',
    },
    {
      title: 'Maintainability & Docs',
      weight: '15%',
      icon: <HeartHandshake size={24} className="rubric-icon text-purple" />,
      desc: 'Long-term code health, extensibility, and clarity.',
      checks: 'Type annotations, concise explanatory comments, modular design, testability.',
    },
  ];

  return (
    <section className="rubric-section">
      <div className="section-header">
        <div className="section-tag">
          <Award size={16} />
          <span>EVALUATION ENGINE</span>
        </div>
        <h1 className="section-title">AI Code Review Rubric</h1>
        <p className="section-description">
          Every submission submitted on the platform is evaluated through our multi-dimensional AI scoring engine based on five fundamental software engineering pillars.
        </p>
      </div>

      <div className="rubric-grid">
        {pillars.map((p, idx) => (
          <div key={idx} className="rubric-card">
            <div className="rubric-card-header">
              <div className="rubric-icon-box">{p.icon}</div>
              <span className="rubric-weight-badge">{p.weight} Weight</span>
            </div>
            <h3 className="rubric-card-title">{p.title}</h3>
            <p className="rubric-card-desc">{p.desc}</p>
            <div className="rubric-checks-box">
              <span className="checks-label">Key Checks:</span>
              <p className="checks-content">{p.checks}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="feedback-tiers-card">
        <h3>Automated Feedback Tiers</h3>
        <div className="tiers-list">
          <div className="tier-item blocker">
            <span className="tier-badge blocker">Critical (Blocker)</span>
            <p>Severe logic bug, infinite loop, memory leak, or security vulnerability.</p>
          </div>
          <div className="tier-item warning">
            <span className="tier-badge warning">Warning</span>
            <p>Suboptimal complexity, potential edge case failure, or unhandled exceptions.</p>
          </div>
          <div className="tier-item suggestion">
            <span className="tier-badge suggestion">Suggestion</span>
            <p>Language-idiomatic improvement, cleaner syntax, or minor optimization.</p>
          </div>
          <div className="tier-item commendation">
            <span className="tier-badge commendation">Commendation</span>
            <p>Elegant algorithmic approach, optimal data structure selection, or clean design.</p>
          </div>
        </div>
      </div>
    </section>
  );
};
