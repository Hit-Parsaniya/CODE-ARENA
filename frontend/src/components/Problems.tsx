import React, { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Cpu,
  LoaderCircle,
  Play,
  Send,
  X,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Tag,
  Code2,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  api,
  type Problem,
  type ProblemDetail,
  type ProblemDifficulty,
  type RunResponse,
  type SubmissionResult,
  type SupportedLanguage,
} from '../services/api';

interface ProblemsProps {
  openAuth: () => void;
}

const DIFFICULTIES: ProblemDifficulty[] = ['easy', 'medium', 'hard'];
const MEMORY_LABEL = (kilobytes: number) => `${Math.round(kilobytes / 1024)} MB`;

const DEFAULT_BOILERPLATES: Record<string, string> = {
  python: `# Write your Python 3 solution here
class Solution:
    def solve(self):
        pass

if __name__ == "__main__":
    pass
`,
  c: `#include <stdio.h>

int main(void) {
    // Write your solution here
    return 0;
}
`,
  cpp: `#include <iostream>
#include <vector>

using namespace std;

int main() {
    // Write your C++ solution here
    return 0;
}
`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Write your Java solution here
    }
}
`,
};

export const Problems: React.FC<ProblemsProps> = ({ openAuth }) => {
  const { token, user } = useAuth();
  const toast = useToast();

  const [problems, setProblems] = useState<Problem[]>([]);
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [tag, setTag] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  // Playground state
  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [code, setCode] = useState(DEFAULT_BOILERPLATES.python);
  const [activeTab, setActiveTab] = useState<'output' | 'review'>('output');
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getProblems({ difficulty: difficulty || undefined, tags: tag ? [tag] : undefined })
      .then((data) => {
        if (active) setProblems(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load problems.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [difficulty, tag]);

  // Poll for AI Review completion after submission
  useEffect(() => {
    const submissionId = submission?.id;
    const hasReview = Boolean(submission?.ai_review);
    if (!submissionId || !token || hasReview) return undefined;

    let active = true;
    const pollReview = async () => {
      try {
        const updated = await api.getSubmission(submissionId, token);
        if (active) {
          setSubmission(updated);
          if (updated.ai_review) {
            toast.success('AI Code Review analysis completed!');
            setActiveTab('review');
          }
        }
      } catch {
        // Continue quietly
      }
    };

    void pollReview();
    const timer = window.setInterval(() => {
      void pollReview();
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [submission?.id, submission?.ai_review, token, toast]);

  const openProblem = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await api.getProblem(id);
      setProblem(detail);
      setCode(DEFAULT_BOILERPLATES[language] || DEFAULT_BOILERPLATES.python);
      setSubmission(null);
      setRunResult(null);
      setActiveTab('output');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load this problem.');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    setCode(DEFAULT_BOILERPLATES[newLang] || '# Write your solution here\n');
  };

  const handleRunCode = async () => {
    if (!problem) return;
    setIsRunning(true);
    setError(null);
    setActiveTab('output');
    try {
      const sampleInput = problem.sample_test_cases.length > 0 ? problem.sample_test_cases[0].input : '';
      const result = await api.runCode({
        language,
        code,
        stdin: sampleInput,
      });
      setRunResult(result);
      if (result.stage === 'success') {
        toast.success('Sandbox execution completed successfully.');
      } else {
        toast.warning(`Execution resulted in: ${result.stage}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute code in sandbox.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  };

  const submit = async () => {
    if (!problem) return;
    if (!token) {
      openAuth();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.submitSolution(problem.id, { code, language }, token);
      setSubmission(res);
      setActiveTab(res.ai_review ? 'review' : 'output');
      if (res.verdict === 'Accepted') {
        toast.success(`Verdict: Accepted! Score: ${Math.round(res.score * 100)}%`);
      } else {
        toast.warning(`Verdict: ${res.verdict}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not submit this solution.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Instant client-side search filtering
  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchTags = p.tags && p.tags.some((t) => t.toLowerCase().includes(q));
      return matchTitle || matchTags;
    });
  }, [problems, searchQuery]);

  const availableTags = useMemo(() => {
    return [...new Set(problems.flatMap((item) => item.tags || []))].sort();
  }, [problems]);

  // Problem Workspace View (Split-Pane Layout)
  if (problem) {
    const overallScore = submission?.ai_review ? submission.ai_review.overall_score : 0;
    // Circular progress radius = 48, circumference = 2 * PI * 48 ≈ 301.59
    const circumference = 301.59;
    const strokeDashoffset = circumference - (overallScore / 10) * circumference;

    return (
      <section className="problems-workspace">
        <div className="workspace-top-bar">
          <button
            className="problem-back"
            onClick={() => {
              setProblem(null);
              setSubmission(null);
              setRunResult(null);
            }}
          >
            <ArrowLeft size={16} /> All Challenges
          </button>
          <div className="workspace-breadcrumbs">
            <span>Problems</span>
            <span className="dot-sep">/</span>
            <span className="current-problem-name">{problem.title}</span>
          </div>
        </div>

        <div className="problem-detail-grid">
          {/* Left Pane: Problem Statement */}
          <article className="problem-statement">
            <div className="problem-detail-heading">
              <div className="flex items-center gap-2 mb-1">
                <span className={`difficulty-label ${problem.difficulty}`}>{problem.difficulty}</span>
                <span className="problem-id-tag">#{problem.id}</span>
              </div>
              <h1>{problem.title}</h1>
            </div>

            <div className="problem-limits">
              <span title="Execution Time Limit">
                <Clock3 size={15} /> {problem.time_limit_ms} ms
              </span>
              <span title="Memory Limit">
                <Cpu size={15} /> {MEMORY_LABEL(problem.memory_limit_kb)}
              </span>
            </div>

            <div className="problem-tags">
              {problem.tags.map((item) => (
                <span className="problem-tag" key={item}>
                  <Tag size={11} className="inline-icon" /> {item}
                </span>
              ))}
            </div>

            <div className="problem-markdown">
              <ReactMarkdown>{problem.description}</ReactMarkdown>
            </div>

            {/* Examples Section */}
            <section className="sample-cases">
              <h2>Examples & Constraints</h2>
              {problem.sample_test_cases.length ? (
                problem.sample_test_cases.map((testCase, index) => (
                  <div className="sample-case" key={testCase.id}>
                    <h3>Example {index + 1}</h3>
                    <div className="sample-io">
                      <div>
                        <span>Input</span>
                        <pre>{testCase.input || '(empty)'}</pre>
                      </div>
                      <div>
                        <span>Expected Output</span>
                        <pre>{testCase.expected_output || '(empty)'}</pre>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="problems-muted">No public sample test cases available.</p>
              )}
            </section>
          </article>

          {/* Right Pane: Code Editor & Output */}
          <section className="problem-playground">
            {problem.is_ready || (user && (user.is_admin || user.role === 'admin')) ? (
              <>
                {!problem.is_ready && user && (user.is_admin || user.role === 'admin') && (
                  <div className="admin-preview-banner">
                    <Clock3 size={15} />
                    <span>
                      <strong>Admin Preview:</strong> Problem has {problem.hidden_test_cases_count || 0}/3 hidden test cases (hidden from regular students).
                    </span>
                  </div>
                )}

                {/* Editor Toolbar */}
                <div className="playground-toolbar">
                  <div className="flex items-center gap-2">
                    <label htmlFor="problem-language" className="text-xs font-semibold text-secondary">
                      Language:
                    </label>
                    <select
                      id="problem-language"
                      value={language}
                      onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                      className="lang-select-dropdown"
                    >
                      <option value="python">Python 3</option>
                      <option value="c">C (GCC)</option>
                      <option value="cpp">C++ (GCC)</option>
                      <option value="java">Java (OpenJDK)</option>
                    </select>
                  </div>

                  <div className="toolbar-buttons-right">
                    <button
                      type="button"
                      className="btn-toolbar-ghost"
                      onClick={() => setCode(DEFAULT_BOILERPLATES[language] || '')}
                      title="Reset boilerplate"
                    >
                      <RotateCcw size={14} />
                      <span>Reset</span>
                    </button>
                    <button
                      id="btn-run-tests"
                      type="button"
                      className="btn-toolbar-secondary"
                      onClick={handleRunCode}
                      disabled={isRunning || !code.trim()}
                      title="Compile & Run in Sandbox"
                    >
                      {isRunning ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />}
                      <span>{isRunning ? 'Running…' : 'Run Code'}</span>
                    </button>
                    <button
                      id="btn-submit-solution"
                      type="button"
                      className="submit-solution"
                      onClick={submit}
                      disabled={submitting || !code.trim()}
                    >
                      {submitting ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}
                      <span>{submitting ? 'Judging…' : 'Submit Solution'}</span>
                    </button>
                  </div>
                </div>

                {/* Monaco Editor Container */}
                <div className="problem-editor">
                  <Editor
                    height="420px"
                    language={language === 'cpp' ? 'cpp' : language}
                    value={code}
                    theme="vs-dark"
                    onChange={(value) => setCode(value || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                    }}
                  />
                </div>

                {/* Output & AI Review Drawer */}
                <div className="playground-output-drawer">
                  <div className="drawer-tabs">
                    <button
                      type="button"
                      className={`drawer-tab ${activeTab === 'output' ? 'active' : ''}`}
                      onClick={() => setActiveTab('output')}
                    >
                      <Terminal size={14} />
                      <span>Console & Results</span>
                      {submission && (
                        <span className={`tab-pill-${submission.verdict === 'Accepted' ? 'success' : 'compile'}`}>
                          {submission.verdict}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={`drawer-tab ${activeTab === 'review' ? 'active' : ''}`}
                      onClick={() => setActiveTab('review')}
                    >
                      <Sparkles size={14} />
                      <span>AI Code Review</span>
                      {submission?.ai_review && (
                        <span className="tab-pill-score">
                          {submission.ai_review.overall_score.toFixed(1)} / 10
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="drawer-panel-body">
                    {/* Console / Output Tab */}
                    {activeTab === 'output' && (
                      <div className="output-tab-content">
                        {isRunning && (
                          <div className="loading-state">
                            <LoaderCircle size={22} className="spin text-cyan" />
                            <span>Compiling and executing in Judge0 sandbox…</span>
                          </div>
                        )}

                        {runResult && (
                          <div className={`run-output-panel ${runResult.stage}`}>
                            <div className="run-output-header">
                              <span className={`run-stage-label ${runResult.stage}`}>
                                {runResult.stage === 'success' && <CheckCircle2 size={14} />}
                                {runResult.stage === 'compile' && <AlertTriangle size={14} />}
                                {runResult.stage === 'runtime' && <XCircle size={14} />}
                                <span>{runResult.stage.toUpperCase()}</span>
                              </span>
                              <span className="run-meta">
                                {runResult.status}
                                {runResult.execution_time != null && ` • ${runResult.execution_time}s`}
                                {runResult.memory != null && ` • ${runResult.memory} KB`}
                              </span>
                            </div>
                            <pre className={`run-output-pre ${runResult.stage}`}>
                              {runResult.stage === 'compile'
                                ? runResult.compile_output || runResult.error || 'Compilation failed.'
                                : runResult.stage === 'runtime'
                                ? runResult.stderr || runResult.error || 'Runtime error during execution.'
                                : runResult.stdout || '(no stdout output)'}
                            </pre>
                          </div>
                        )}

                        {submission && (
                          <div className={`submission-verdict-box ${submission.verdict === 'Accepted' ? 'pass' : 'fail'}`}>
                            <div className="verdict-banner-row">
                              <div className="flex items-center gap-2">
                                {submission.verdict === 'Accepted' ? (
                                  <CheckCircle2 size={20} className="text-emerald" />
                                ) : (
                                  <XCircle size={20} className="text-rose" />
                                )}
                                <strong>{submission.verdict}</strong>
                              </div>
                              <span className="verdict-score">Score: {Math.round(submission.score * 100)}%</span>
                            </div>

                            <div className="sample-results-list">
                              {submission.sample_results.map((result, idx) => (
                                <div key={result.test_case_id || idx} className="sample-result-item">
                                  <span>Sample Case {idx + 1}</span>
                                  <span className={`case-badge ${result.passed ? 'passed' : 'failed'}`}>
                                    {result.passed ? 'Passed' : 'Failed'}
                                  </span>
                                  {!result.passed && result.actual_output && (
                                    <pre className="case-error-pre">{result.actual_output}</pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!runResult && !submission && !isRunning && (
                          <p className="run-empty-hint">
                            Select a language and click <strong>Run Code</strong> to test in sandbox, or <strong>Submit Solution</strong> for full evaluation.
                          </p>
                        )}
                      </div>
                    )}

                    {/* AI Code Review Tab (The Standout Feature!) */}
                    {activeTab === 'review' && (
                      <div className="ai-review-tab-content">
                        {submitting && (
                          <div className="loading-state">
                            <Sparkles size={24} className="spin text-cyan" />
                            <span>Submitting solution to automated AI evaluation engine…</span>
                          </div>
                        )}

                        {submission && !submission.ai_review && !submitting && (
                          <div className="loading-state">
                            <LoaderCircle size={24} className="spin text-purple" />
                            <span>Analyzing syntax, Big-O complexity, and maintainability across 5 pillars…</span>
                          </div>
                        )}

                        {submission?.ai_review && (
                          <div className="ai-review-full-result">
                            {/* Score Ring Banner */}
                            <div className="review-score-hero-card">
                              <div className="score-ring-container">
                                <svg className="score-ring-svg" viewBox="0 0 120 120">
                                  <circle className="score-ring-bg" cx="60" cy="60" r="48" strokeWidth="9" />
                                  <circle
                                    className="score-ring-circle"
                                    cx="60"
                                    cy="60"
                                    r="48"
                                    strokeWidth="9"
                                    stroke="url(#aiScoreGradient)"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                  />
                                  <defs>
                                    <linearGradient id="aiScoreGradient" x1="0" y1="0" x2="1" y2="1">
                                      <stop offset="0%" stopColor="#3b82f6" />
                                      <stop offset="50%" stopColor="#10b981" />
                                      <stop offset="100%" stopColor="#06b6d4" />
                                    </linearGradient>
                                  </defs>
                                </svg>
                                <div className="score-ring-value">
                                  <span className="score-ring-number">{overallScore.toFixed(1)}</span>
                                  <span className="score-ring-total">/ 10</span>
                                </div>
                              </div>

                              <div className="review-score-meta">
                                <h3>
                                  {overallScore >= 9
                                    ? 'Exemplary Solution'
                                    : overallScore >= 7
                                    ? 'Proficient Solution'
                                    : 'Needs Improvement'}
                                </h3>
                                <p className="review-summary-text">
                                  {submission.ai_review.feedback ||
                                    'Code passes algorithmic constraints and adheres to software engineering design best practices.'}
                                </p>
                              </div>
                            </div>

                            {/* 4/5-Pillar Horizontal Breakdown Bars */}
                            <div className="rubric-bars-grid">
                              <div className="rubric-bar-card">
                                <div className="bar-labels">
                                  <span>Correctness (30%)</span>
                                  <strong className="text-cyan">{submission.ai_review.correctness}/10</strong>
                                </div>
                                <div className="bar-track">
                                  <div
                                    className="bar-fill"
                                    style={{ width: `${(submission.ai_review.correctness / 10) * 100}%` }}
                                  />
                                </div>
                              </div>

                              <div className="rubric-bar-card">
                                <div className="bar-labels">
                                  <span>Time & Space Complexity (25%)</span>
                                  <strong className="text-amber">{submission.ai_review.efficiency}/10</strong>
                                </div>
                                <div className="bar-track">
                                  <div
                                    className="bar-fill amber"
                                    style={{ width: `${(submission.ai_review.efficiency / 10) * 100}%` }}
                                  />
                                </div>
                              </div>

                              <div className="rubric-bar-card">
                                <div className="bar-labels">
                                  <span>Cleanliness & Style (15%)</span>
                                  <strong className="text-emerald">{submission.ai_review.readability}/10</strong>
                                </div>
                                <div className="bar-track">
                                  <div
                                    className="bar-fill emerald"
                                    style={{ width: `${(submission.ai_review.readability / 10) * 100}%` }}
                                  />
                                </div>
                              </div>

                              <div className="rubric-bar-card">
                                <div className="bar-labels">
                                  <span>Best Practices & Security (30%)</span>
                                  <strong className="text-purple">{submission.ai_review.best_practices}/10</strong>
                                </div>
                                <div className="bar-track">
                                  <div
                                    className="bar-fill purple"
                                    style={{ width: `${(submission.ai_review.best_practices / 10) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {!submission && (
                          <div className="ai-review-empty">
                            <div className="ai-empty-badge">
                              <Sparkles size={26} className="text-cyan" />
                            </div>
                            <h4>No AI Review Generated Yet</h4>
                            <p className="ai-empty-desc">
                              AI Code Review requires submitting your code so the automated judging engine can compile and test it across all test suites first.
                            </p>
                            <div className="ai-empty-pillars-strip">
                              <span>✓ Correctness</span>
                              <span>✓ Time & Space Big-O</span>
                              <span>✓ Cleanliness & Style</span>
                              <span>✓ Best Practices</span>
                            </div>
                            <button
                              type="button"
                              className="submit-solution mt-3"
                              onClick={submit}
                              disabled={submitting || !code.trim()}
                              id="btn-trigger-ai-review"
                            >
                              {submitting ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}
                              <span>{submitting ? 'Judging & Analyzing…' : 'Submit Solution to Generate Review'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="problem-not-ready-card" id="problem-not-ready-card">
                <div className="not-ready-icon-pill">
                  <Clock3 size={32} />
                </div>
                <h3>Problem Not Ready</h3>
                <p className="not-ready-message">This problem isn't open yet — check back soon</p>
                <span className="not-ready-sub">
                  The author has not yet configured the test suite (requires at least 3 hidden test cases) for this challenge.
                </span>
              </div>
            )}
          </section>
        </div>
      </section>
    );
  }

  // Problem Archive / List View
  return (
    <section className="problems-page">
      <div className="problems-page-heading">
        <div>
          <p className="problems-eyebrow">CHALLENGE ARCHIVE</p>
          <h1>Practice Problems</h1>
          <p className="text-secondary text-sm">
            Sharpen algorithmic skills with automated test suites and instant AI code review feedback.
          </p>
        </div>
        <div className="heading-actions">
          <span className="problem-count">
            {filteredProblems.length} {filteredProblems.length === 1 ? 'challenge' : 'challenges'}
          </span>
          <div className="view-mode-toggle" role="group" aria-label="View Mode">
            <button
              type="button"
              className={`btn-view-toggle ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table view"
              aria-label="Table view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              className={`btn-view-toggle ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title="Card grid view"
              aria-label="Card view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="problems-search-filter-card">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            id="input-problem-search"
            type="text"
            placeholder="Search problems by title, tags, or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="filter-controls-group">
          <div className="difficulty-pills-row">
            <button
              type="button"
              className={`diff-filter-pill ${difficulty === '' ? 'active' : ''}`}
              onClick={() => setDifficulty('')}
            >
              All
            </button>
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                className={`diff-filter-pill ${difficulty === d ? 'active' : ''} ${d}`}
                onClick={() => setDifficulty(difficulty === d ? '' : d)}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>

          <div className="tag-select-wrapper">
            <Tag size={14} className="tag-icon" />
            <select
              id="tag-filter"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="tag-dropdown"
              aria-label="Filter by tag"
            >
              <option value="">All Tags</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="problem-error" role="alert">
          <X size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="skeleton-grid">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      ) : filteredProblems.length > 0 ? (
        viewMode === 'table' ? (
          /* Table View */
          <div className="problems-table-card">
            <table className="problems-table" role="table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th>Challenge Title</th>
                  <th style={{ width: '130px' }}>Difficulty</th>
                  <th>Tags</th>
                  <th style={{ width: '150px' }}>Limits</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProblems.map((item) => (
                  <tr
                    key={item.id}
                    className="problem-table-row"
                    onClick={() => void openProblem(item.id)}
                  >
                    <td className="problem-id-cell">#{item.id}</td>
                    <td className="problem-title-cell">
                      <strong>{item.title}</strong>
                    </td>
                    <td>
                      <span className={`difficulty-label ${item.difficulty}`}>{item.difficulty}</span>
                    </td>
                    <td>
                      <div className="problem-tags-inline">
                        {item.tags.map((t) => (
                          <span key={t} className="problem-tag-pill">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="problem-limits-cell">
                      <span>{item.time_limit_ms}ms</span>
                      <span className="dot-sep">•</span>
                      <span>{MEMORY_LABEL(item.memory_limit_kb)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="btn-solve-link">
                        <span>Solve</span>
                        <ChevronRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Card Grid View */
          <div className="problems-cards-grid">
            {filteredProblems.map((item) => (
              <div
                key={item.id}
                className="problem-card"
                onClick={() => void openProblem(item.id)}
                role="button"
                tabIndex={0}
              >
                <div className="problem-card-header">
                  <span className={`difficulty-label ${item.difficulty}`}>{item.difficulty}</span>
                  <span className="problem-card-id">#{item.id}</span>
                </div>
                <h3 className="problem-card-title">{item.title}</h3>
                <div className="problem-card-tags">
                  {item.tags.map((t) => (
                    <span key={t} className="problem-tag-pill">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="problem-card-footer">
                  <div className="card-limits">
                    <span>{item.time_limit_ms}ms</span>
                    <span className="dot-sep">•</span>
                    <span>{MEMORY_LABEL(item.memory_limit_kb)}</span>
                  </div>
                  <button type="button" className="btn-solve-action">
                    <span>Solve Challenge</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Empty State */
        <div className="problems-empty-card">
          <div className="empty-icon-box">
            <Code2 size={36} className="text-muted" />
          </div>
          <h3>No Challenges Found</h3>
          <p>No problems match your current search and filter criteria.</p>
          {(searchQuery || difficulty || tag) && (
            <button
              type="button"
              className="btn-primary btn-sm mt-3"
              onClick={() => {
                setSearchQuery('');
                setDifficulty('');
                setTag('');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </section>
  );
};