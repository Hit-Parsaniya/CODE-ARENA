import React, { useEffect, useMemo, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Globe,
  LoaderCircle,
  Lock,
  Minus,
  RotateCcw,
  Send,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserPlus,
  Wifi,
  WifiOff,
  X,
  XCircle,
  Play,
  Terminal,
  Copy,
  Check,
  Search,
  Award,
  AlertTriangle,
  Code2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  api,
  type ContestDetail,
  type ContestSummary,
  type LeaderboardEntry,
  type ProblemDetail,
  type SubmissionResult,
  type RunResponse,
} from '../services/api';
import { useContestLeaderboard } from '../hooks/useContestLeaderboard';

interface ContestsProps {
  openAuth: () => void;
  onViewProfile?: (userId: number) => void;
  onNavigateTab?: (tab: 'dashboard' | 'problems' | 'contests' | 'profile' | 'auth' | 'rubric' | 'admin') => void;
}

type ContestStatus = 'upcoming' | 'live' | 'past';

const DEFAULT_BOILERPLATES: Record<string, string> = {
  python: `# Write your Python 3 solution here
def solve():
    pass

if __name__ == "__main__":
    solve()
`,
  c: `#include <stdio.h>

int main(void) {
    // Write your C solution here
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

const statusOf = (contest: ContestSummary | ContestDetail, now: number): ContestStatus => {
  if (now < Date.parse(contest.start_time)) return 'upcoming';
  if (now <= Date.parse(contest.end_time)) return 'live';
  return 'past';
};

const countdown = (target: string, now: number) => {
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${remaining}s`;
  return `${minutes}m ${remaining}s`;
};

const formatDate = (isoStr: string) => {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
};

export const Contests: React.FC<ContestsProps> = ({ openAuth, onViewProfile, onNavigateTab }) => {
  const { token, user } = useAuth();
  const toast = useToast();

  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [selected, setSelected] = useState<ContestDetail | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<ProblemDetail | null>(null);
  const [activeProblemIdx, setActiveProblemIdx] = useState(0);

  // Filters for Overview
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'past'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');

  // Workspace & Editor state
  const [code, setCode] = useState(DEFAULT_BOILERPLATES.python);
  const [language, setLanguage] = useState('python');
  const [activeDrawerTab, setActiveDrawerTab] = useState<'output' | 'verdict' | 'leaderboard'>('output');

  // Run & Submit state
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Leaderboard & Joined state
  const [seedLeaderboard, setSeedLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [joined, setJoined] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSampleIdx, setCopiedSampleIdx] = useState<number | null>(null);

  // Live WebSocket leaderboard
  const { entries: leaderboard, status: wsStatus } = useContestLeaderboard(
    selected?.id ?? null,
    seedLeaderboard,
  );

  // Track previous rank changes for up/down trend indicators
  const prevRanksRef = useRef<Record<number, number>>({});
  const [rankTrends, setRankTrends] = useState<Record<number, 'up' | 'down' | 'same'>>({});

  useEffect(() => {
    if (!leaderboard.length) return;
    const newTrends: Record<number, 'up' | 'down' | 'same'> = {};
    leaderboard.forEach((entry) => {
      const prev = prevRanksRef.current[entry.user_id];
      if (prev !== undefined) {
        if (entry.rank < prev) newTrends[entry.user_id] = 'up';
        else if (entry.rank > prev) newTrends[entry.user_id] = 'down';
        else newTrends[entry.user_id] = 'same';
      } else {
        newTrends[entry.user_id] = 'same';
      }
      prevRanksRef.current[entry.user_id] = entry.rank;
    });
    setRankTrends(newTrends);
  }, [leaderboard]);

  // Load contest list
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getContests(token || undefined)
      .then((items) => {
        if (active) setContests(items);
      })
      .catch(() => {
        if (active) setError('Could not load contests.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Check URL on load for contest ID (e.g., /contests/3 or ?contest=3)
  useEffect(() => {
    const pathMatch = window.location.pathname.match(/\/contests\/(\d+)/);
    const searchMatch = new URLSearchParams(window.location.search).get('contest');
    const contestIdStr = pathMatch?.[1] || searchMatch;

    if (contestIdStr) {
      const id = parseInt(contestIdStr, 10);
      if (!isNaN(id) && (!selected || selected.id !== id)) {
        void openContest(id, false);
      }
    }
  }, []);

  // Sync clock every second for countdowns
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const openContest = async (contestId: number, updateUrl = true) => {
    setError(null);
    setLoading(true);
    try {
      if (updateUrl) {
        window.history.pushState(null, '', `/contests/${contestId}`);
      }
      const detail = await api.getContest(contestId, token || undefined);
      setSelected(detail);
      setActiveProblemIdx(0);

      const board = await api.getLeaderboard(contestId, token || undefined);
      setSeedLeaderboard(board);

      // Check if user is already joined from leaderboard
      if (user && board.some((p) => p.user_id === user.id)) {
        setJoined(true);
      } else {
        setJoined(false);
      }

      if (detail.problems && detail.problems.length > 0) {
        const firstProb = await api.getProblem(detail.problems[0].problem_id);
        setSelectedProblem(firstProb);
      } else {
        setSelectedProblem(null);
      }

      setSubmission(null);
      setRunResult(null);
      setCode(DEFAULT_BOILERPLATES[language] || DEFAULT_BOILERPLATES.python);
      setActiveDrawerTab('output');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load this contest.');
    } finally {
      setLoading(false);
    }
  };

  const closeContest = () => {
    setSelected(null);
    setSelectedProblem(null);
    setSubmission(null);
    setRunResult(null);
    window.history.pushState(null, '', '/contests');
  };

  const chooseProblem = async (problemId: number, idx: number) => {
    setError(null);
    setActiveProblemIdx(idx);
    try {
      const prob = await api.getProblem(problemId);
      setSelectedProblem(prob);
      setSubmission(null);
      setRunResult(null);
      setCode(DEFAULT_BOILERPLATES[language] || DEFAULT_BOILERPLATES.python);
      setActiveDrawerTab('output');
    } catch {
      setError('Could not load this problem.');
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    setCode(DEFAULT_BOILERPLATES[newLang] || '# Write your solution here\n');
  };

  const handleCopyInput = (input: string, idx: number) => {
    navigator.clipboard.writeText(input);
    setCopiedSampleIdx(idx);
    toast.success('Sample input copied to clipboard!');
    setTimeout(() => setCopiedSampleIdx(null), 2000);
  };

  const join = async () => {
    if (!selected) return;
    if (!token) {
      openAuth();
      return;
    }
    try {
      await api.joinContest(selected.id, token);
      setJoined(true);
      toast.success(`Registered for ${selected.title}! Ready for battle.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not join contest.';
      setError(msg);
      toast.error(msg);
    }
  };

  // Run code against sample test cases in sandbox
  const handleRunCode = async () => {
    if (!selectedProblem) return;
    setIsRunning(true);
    setError(null);
    setActiveDrawerTab('output');

    try {
      const sampleInput =
        selectedProblem.sample_test_cases && selectedProblem.sample_test_cases.length > 0
          ? selectedProblem.sample_test_cases[0].input
          : '';

      const result = await api.runCode({
        language,
        code,
        stdin: sampleInput,
      });

      setRunResult(result);
      if (result.stage === 'success') {
        toast.success('Sample run executed successfully!');
      } else {
        toast.warning(`Execution result: ${result.stage}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sandbox execution failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  };

  // Submit solution for contest grading
  const submit = async () => {
    if (!selected || !selectedProblem) return;
    if (!token) {
      openAuth();
      return;
    }

    setSubmitting(true);
    setError(null);
    setSubmission(null);
    setActiveDrawerTab('verdict');

    try {
      if (!joined) {
        try {
          await api.joinContest(selected.id, token);
          setJoined(true);
        } catch {
          // If already joined, proceed silently
        }
      }

      const res = await api.submitContestSolution(
        selected.id,
        {
          problem_id: selectedProblem.id,
          code,
          language,
        },
        token,
      );

      setSubmission(res);
      if (res.verdict === 'Accepted') {
        toast.success(`Verdict: Accepted! Score awarded: ${Math.round(res.score * 100)}%`);
      } else {
        toast.warning(`Verdict: ${res.verdict}`);
      }

      // Refresh seed leaderboard
      try {
        const updatedBoard = await api.getLeaderboard(selected.id, token || undefined);
        setSeedLeaderboard(updatedBoard);
      } catch {
        // WS will handle update
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not submit solution.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Groups and statistics
  const groups = useMemo(
    () => ({
      live: contests.filter((item) => statusOf(item, now) === 'live'),
      upcoming: contests.filter((item) => statusOf(item, now) === 'upcoming'),
      past: contests.filter((item) => statusOf(item, now) === 'past'),
    }),
    [contests, now],
  );

  // Filtered contests for Overview
  const filteredContests = useMemo(() => {
    return contests.filter((item) => {
      const status = statusOf(item, now);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (visibilityFilter !== 'all' && (item.visibility || 'public') !== visibilityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }, [contests, now, statusFilter, visibilityFilter, searchQuery]);

  // =========================================================================
  // VIEW 1: CONTEST ARENA WORKSPACE (When a contest is opened)
  // =========================================================================
  if (selected) {
    const status = statusOf(selected, now);
    const target = status === 'upcoming' ? selected.start_time : selected.end_time;

    return (
      <section className="contests-page contest-workspace-view" id="contest-workspace-page">
        {/* Top Control Bar with Breadcrumbs & Back */}
        <div className="contest-nav-bar">
          <button
            type="button"
            className="btn-contest-back"
            onClick={closeContest}
            id="btn-back-to-contests"
          >
            <ArrowLeft size={16} />
            <span>All Contests</span>
          </button>

          <div className="contest-breadcrumbs">
            <span className="crumb-root" onClick={closeContest}>Contests Arena</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-current">{selected.title}</span>
          </div>

          <div className="contest-quick-status">
            <span className={`contest-status-pill ${status}`}>
              {status === 'live' && <span className="pulse-dot" />}
              {status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Hero Header Banner Card */}
        <div className="contest-hero-banner">
          <div className="contest-banner-left">
            <div className="contest-banner-badges">
              <span className={`contest-status-pill ${status}`}>
                {status === 'live' && <span className="pulse-dot" />}
                {status === 'live' ? 'LIVE NOW' : status === 'upcoming' ? 'UPCOMING' : 'CONCLUDED'}
              </span>

              <span className={`contest-vis-pill ${selected.visibility || 'public'}`}>
                {selected.visibility === 'private' ? (
                  <>
                    <Lock size={12} />
                    <span>Private Arena</span>
                  </>
                ) : (
                  <>
                    <Globe size={12} />
                    <span>Public Arena</span>
                  </>
                )}
              </span>

              <span className="contest-meta-pill">
                <Calendar size={12} />
                <span>{formatDate(selected.start_time)} – {formatDate(selected.end_time)}</span>
              </span>
            </div>

            <h1 className="contest-banner-title">{selected.title}</h1>
            <p className="contest-banner-desc">
              {selected.description && selected.description !== '-'
                ? selected.description
                : 'Timed competitive programming round featuring sandboxed evaluation, rubric grading, and real-time live scoreboards.'}
            </p>
          </div>

          <div className="contest-banner-right">
            <div className="contest-countdown-card">
              <div className="countdown-card-label">
                <Clock3 size={15} />
                <span>
                  {status === 'upcoming'
                    ? 'Contest Starts In'
                    : status === 'live'
                    ? 'Time Remaining'
                    : 'Contest Concluded'}
                </span>
              </div>
              <strong className="countdown-card-timer">
                {status === 'past' ? '00:00:00' : countdown(target, now)}
              </strong>
            </div>

            {status !== 'past' && (
              joined ? (
                <div className="btn-joined-indicator">
                  <CheckCircle2 size={16} className="text-emerald" />
                  <span>Arena Registered</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-join-contest"
                  onClick={join}
                  id="btn-join-contest"
                >
                  <UserPlus size={16} />
                  <span>Join Arena</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Horizontal Contest Problems Strip */}
        <div className="contest-problems-strip-container">
          <div className="problems-strip-label">
            <Code2 size={15} className="text-primary" />
            <span>Contest Problems</span>
            <span className="problems-count-badge">{selected.problems.length}</span>
          </div>

          <div className="contest-problems-strip">
            {selected.problems.length ? (
              selected.problems.map((cp, idx) => {
                const isCurrent = activeProblemIdx === idx;
                const letter = String.fromCharCode(65 + idx);
                return (
                  <button
                    key={cp.problem_id}
                    type="button"
                    className={`contest-prob-pill ${isCurrent ? 'active' : ''}`}
                    onClick={() => void chooseProblem(cp.problem_id, idx)}
                    id={`btn-contest-prob-${cp.problem_id}`}
                  >
                    <span className="prob-pill-index">{letter}</span>
                    <div className="prob-pill-info">
                      <strong className="prob-pill-title">{cp.title}</strong>
                      <span className="prob-pill-pts">{cp.points} pts</span>
                    </div>
                    <span
                      className={`readiness-dot ${cp.is_ready ? 'ready' : 'unready'}`}
                      title={cp.is_ready ? 'Problem Ready' : 'Needs Test Cases'}
                    />
                  </button>
                );
              })
            ) : (
              <div className="no-problems-msg">No challenges attached to this contest yet.</div>
            )}
          </div>
        </div>

        {/* Main Arena 2-Column Split: [Problem Statement + Code Editor] & [Live Leaderboard] */}
        <div className="contest-main-arena-layout">
          {/* Left Column: Problem Workspace with Statement & Monaco Editor */}
          <div className="contest-workspace-pane">
            {selectedProblem ? (
              <div className="contest-challenge-box">
                {/* Problem Statement Card */}
                <div className="contest-statement-card">
                  <div className="statement-top-meta">
                    <div className="statement-meta-left">
                      <span className={`difficulty-badge ${selectedProblem.difficulty}`}>
                        {selectedProblem.difficulty}
                      </span>
                      <span className="statement-prob-id">ID: #{selectedProblem.id}</span>
                      {selectedProblem.time_limit_ms && (
                        <span className="statement-limit-badge">
                          <Clock3 size={12} /> {selectedProblem.time_limit_ms}ms
                        </span>
                      )}
                      {selectedProblem.memory_limit_kb && (
                        <span className="statement-limit-badge">
                          {Math.round(selectedProblem.memory_limit_kb / 1024)} MB
                        </span>
                      )}
                    </div>
                    <span className="statement-points-tag">
                      {selected.problems[activeProblemIdx]?.points || 100} Points
                    </span>
                  </div>

                  <h2 className="statement-title">{selectedProblem.title}</h2>

                  <div className="statement-markdown problem-markdown">
                    <ReactMarkdown>{selectedProblem.description}</ReactMarkdown>
                  </div>

                  {/* Sample Test Cases */}
                  {selectedProblem.sample_test_cases && selectedProblem.sample_test_cases.length > 0 && (
                    <div className="contest-sample-cases">
                      <h4 className="sample-cases-heading">Examples & Test Cases</h4>
                      {selectedProblem.sample_test_cases.map((sample, sIdx) => (
                        <div key={sample.id || sIdx} className="sample-case-card">
                          <div className="sample-case-header">
                            <span className="sample-case-num">Example {sIdx + 1}</span>
                            <button
                              type="button"
                              className="btn-copy-sample"
                              onClick={() => handleCopyInput(sample.input, sIdx)}
                              title="Copy input to clipboard"
                            >
                              {copiedSampleIdx === sIdx ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
                              <span>{copiedSampleIdx === sIdx ? 'Copied' : 'Copy Input'}</span>
                            </button>
                          </div>
                          <div className="sample-case-body">
                            <div className="sample-block">
                              <span className="sample-label">Input:</span>
                              <pre className="sample-pre">{sample.input || '(empty)'}</pre>
                            </div>
                            <div className="sample-block">
                              <span className="sample-label">Expected Output:</span>
                              <pre className="sample-pre">{sample.expected_output || '(empty)'}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Monaco Editor & Execution Deck */}
                <div className="contest-editor-deck">
                  {/* Editor Toolbar */}
                  <div className="contest-editor-toolbar">
                    <div className="toolbar-left">
                      <label htmlFor="contest-lang-select" className="toolbar-label">
                        Language:
                      </label>
                      <select
                        id="contest-lang-select"
                        value={language}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="contest-lang-select"
                      >
                        <option value="python">Python 3</option>
                        <option value="c">C (GCC)</option>
                        <option value="cpp">C++ (GCC)</option>
                        <option value="java">Java (OpenJDK)</option>
                      </select>
                    </div>

                    <div className="toolbar-right">
                      <button
                        type="button"
                        className="btn-arena-ghost"
                        onClick={() => setCode(DEFAULT_BOILERPLATES[language] || '# Write your solution here\n')}
                        title="Reset code template"
                      >
                        <RotateCcw size={14} />
                        <span>Reset</span>
                      </button>

                      <button
                        type="button"
                        className="btn-arena-run"
                        onClick={() => void handleRunCode()}
                        disabled={isRunning || submitting || !code.trim()}
                        id="btn-contest-run-code"
                      >
                        {isRunning ? <LoaderCircle size={14} className="spin text-cyan" /> : <Play size={14} />}
                        <span>{isRunning ? 'Running…' : 'Run Code'}</span>
                      </button>

                      <button
                        type="button"
                        className="btn-arena-submit"
                        onClick={() => void submit()}
                        disabled={
                          submitting ||
                          isRunning ||
                          (status !== 'live' && !(user && (user.is_admin || user.role === 'admin'))) ||
                          !code.trim()
                        }
                        id="btn-contest-submit"
                      >
                        {submitting ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}
                        <span>{submitting ? 'Judging…' : 'Submit Solution'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Monaco Editor Container */}
                  <div className="contest-monaco-wrap">
                    <Editor
                      height="400px"
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

                  {/* Output & Verdict Drawer */}
                  <div className="contest-output-deck">
                    <div className="deck-tab-bar">
                      <button
                        type="button"
                        className={`deck-tab-btn ${activeDrawerTab === 'output' ? 'active' : ''}`}
                        onClick={() => setActiveDrawerTab('output')}
                      >
                        <Terminal size={14} />
                        <span>Console & Run Output</span>
                        {runResult && (
                          <span className={`tab-indicator-badge ${runResult.stage === 'success' ? 'pass' : 'fail'}`}>
                            {runResult.stage.toUpperCase()}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        className={`deck-tab-btn ${activeDrawerTab === 'verdict' ? 'active' : ''}`}
                        onClick={() => setActiveDrawerTab('verdict')}
                      >
                        <CheckCircle2 size={14} />
                        <span>Submission Verdict</span>
                        {submission && (
                          <span className={`tab-indicator-badge ${submission.verdict === 'Accepted' ? 'pass' : 'fail'}`}>
                            {submission.verdict}
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="deck-tab-content">
                      {/* Output Tab */}
                      {activeDrawerTab === 'output' && (
                        <div className="tab-pane-output">
                          {isRunning && (
                            <div className="deck-loading-state">
                              <LoaderCircle size={20} className="spin text-cyan" />
                              <span>Compiling and executing in Judge0 sandbox…</span>
                            </div>
                          )}

                          {runResult && (
                            <div className={`deck-run-panel ${runResult.stage}`}>
                              <div className="deck-run-header">
                                <span className={`deck-stage-pill ${runResult.stage}`}>
                                  {runResult.stage === 'success' && <CheckCircle2 size={13} />}
                                  {runResult.stage === 'compile' && <AlertTriangle size={13} />}
                                  {runResult.stage === 'runtime' && <XCircle size={13} />}
                                  <span>{runResult.stage.toUpperCase()}</span>
                                </span>
                                <span className="deck-run-meta">
                                  {runResult.status}
                                  {runResult.execution_time != null && ` • ${runResult.execution_time}s`}
                                  {runResult.memory != null && ` • ${runResult.memory} KB`}
                                </span>
                              </div>
                              <pre className="deck-run-pre">
                                {runResult.stage === 'compile'
                                  ? runResult.compile_output || runResult.error || 'Compilation failed.'
                                  : runResult.stage === 'runtime'
                                  ? runResult.stderr || runResult.error || 'Runtime error during execution.'
                                  : runResult.stdout || '(no stdout output)'}
                              </pre>
                            </div>
                          )}

                          {!isRunning && !runResult && (
                            <div className="deck-empty-state">
                              <Terminal size={22} className="text-muted" />
                              <p>Click <strong>"Run Code"</strong> to test your solution against sample cases before submitting.</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Verdict Tab */}
                      {activeDrawerTab === 'verdict' && (
                        <div className="tab-pane-verdict">
                          {submitting && (
                            <div className="deck-loading-state">
                              <LoaderCircle size={20} className="spin text-emerald" />
                              <span>Executing test suites across hidden test cases…</span>
                            </div>
                          )}

                          {submission && (
                            <div className={`deck-verdict-card ${submission.verdict === 'Accepted' ? 'pass' : 'fail'}`}>
                              <div className="verdict-banner-row">
                                <div className="verdict-left-badge">
                                  {submission.verdict === 'Accepted' ? (
                                    <CheckCircle2 size={22} className="text-emerald" />
                                  ) : (
                                    <XCircle size={22} className="text-rose" />
                                  )}
                                  <strong className="verdict-title">{submission.verdict}</strong>
                                </div>
                                <span className="verdict-score-pill">
                                  Score: {Math.round(submission.score * 100)}%
                                </span>
                              </div>

                              {submission.sample_results && submission.sample_results.length > 0 && (
                                <div className="verdict-samples-list">
                                  {submission.sample_results.map((res, sIdx) => (
                                    <div key={res.test_case_id || sIdx} className="verdict-sample-row">
                                      <span>Sample Case {sIdx + 1}</span>
                                      <span className={`case-tag ${res.passed ? 'passed' : 'failed'}`}>
                                        {res.passed ? 'PASSED' : 'FAILED'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {!submitting && !submission && (
                            <div className="deck-empty-state">
                              <Send size={22} className="text-muted" />
                              <p>Click <strong>"Submit Solution"</strong> to receive an official contest verdict and leaderboard points.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="contest-no-problems-state">
                <Clock3 size={40} className="text-muted" />
                <h3>No Problems Attached Yet</h3>
                <p>This contest does not have any challenges linked to it yet.</p>
                {user && (user.is_admin || user.role === 'admin') && onNavigateTab && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onNavigateTab('admin')}
                    style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <ArrowRight size={16} /> Open Admin Panel to Attach Problems
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Live Contest Leaderboard */}
          <aside className="contest-leaderboard-sidebar">
            <div className="sidebar-leaderboard-card">
              <div className="sidebar-leaderboard-header">
                <div className="header-title-wrap">
                  <Trophy size={18} className="text-amber" />
                  <h3>Live Leaderboard</h3>
                </div>

                <span
                  className={`ws-indicator-pill ${wsStatus}`}
                  title={
                    wsStatus === 'connected'
                      ? 'Real-time WebSocket score stream active'
                      : wsStatus === 'connecting'
                      ? 'Reconnecting to scoreboard stream…'
                      : 'Offline — showing latest cached scores'
                  }
                >
                  {wsStatus === 'connected' ? (
                    <>
                      <Wifi size={12} className="text-emerald" />
                      <span>LIVE</span>
                    </>
                  ) : wsStatus === 'connecting' ? (
                    <>
                      <LoaderCircle size={12} className="spin text-amber" />
                      <span>CONNECTING</span>
                    </>
                  ) : (
                    <>
                      <WifiOff size={12} className="text-muted" />
                      <span>OFFLINE</span>
                    </>
                  )}
                </span>
              </div>

              <div className="leaderboard-competitors-list">
                {leaderboard.length ? (
                  leaderboard.map((entry) => {
                    const trend = rankTrends[entry.user_id] || 'same';
                    const isMe = user && entry.user_id === user.id;

                    return (
                      <div
                        key={entry.user_id}
                        className={`competitor-row ${isMe ? 'is-me' : ''}`}
                        onClick={() => onViewProfile && onViewProfile(entry.user_id)}
                        title="Click to view competitor profile"
                      >
                        <div className="competitor-rank-col">
                          {entry.rank === 1 ? (
                            <span className="rank-medal gold" title="1st Place">🥇</span>
                          ) : entry.rank === 2 ? (
                            <span className="rank-medal silver" title="2nd Place">🥈</span>
                          ) : entry.rank === 3 ? (
                            <span className="rank-medal bronze" title="3rd Place">🥉</span>
                          ) : (
                            <span className="rank-num">#{entry.rank}</span>
                          )}

                          <span className="rank-trend-col">
                            {trend === 'up' && <span title="Rank up"><TrendingUp size={12} className="text-emerald" /></span>}
                            {trend === 'down' && <span title="Rank down"><TrendingDown size={12} className="text-rose" /></span>}
                            {trend === 'same' && <Minus size={11} className="text-muted" />}
                          </span>
                        </div>

                        <div className="competitor-user-col">
                          <span className="competitor-name">{entry.username}</span>
                          {isMe && <span className="you-pill">YOU</span>}
                        </div>

                        <strong className="competitor-points">{entry.total_points} pts</strong>
                      </div>
                    );
                  })
                ) : (
                  <div className="leaderboard-empty-state">
                    <Award size={24} className="text-muted" />
                    <p>No scores registered yet. Be the first to submit!</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    );
  }

  // =========================================================================
  // VIEW 2: CONTESTS OVERVIEW & BROWSER (List of all Contests)
  // =========================================================================
  return (
    <section className="contests-page" id="contests-overview-page">
      {/* Hero Header */}
      <div className="contests-hero-section">
        <div className="hero-content-left">
          <span className="hero-eyebrow">
            <Sparkles size={14} className="text-cyan" />
            <span>GLOBAL COMPETITIVE ARENA</span>
          </span>
          <h1 className="hero-title">Contests Arena</h1>
          <p className="hero-description">
            Battle head-to-head against top programmers in timed rounds with sandboxed multi-language execution, automated rubric scoring, and instant live scoreboards.
          </p>
        </div>

        {/* Live Counters */}
        <div className="hero-stats-strip">
          <div className="hero-stat-box live">
            <span className="stat-num">{groups.live.length}</span>
            <span className="stat-lbl">Live Arenas</span>
          </div>
          <div className="hero-stat-box upcoming">
            <span className="stat-num">{groups.upcoming.length}</span>
            <span className="stat-lbl">Upcoming</span>
          </div>
          <div className="hero-stat-box total">
            <span className="stat-num">{contests.length}</span>
            <span className="stat-lbl">Total Contests</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="contests-control-bar">
        {/* Status Filter Tabs */}
        <div className="contests-status-tabs">
          <button
            type="button"
            className={`status-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Arenas ({contests.length})
          </button>
          <button
            type="button"
            className={`status-tab-btn live ${statusFilter === 'live' ? 'active' : ''}`}
            onClick={() => setStatusFilter('live')}
          >
            <span className="pulse-dot" />
            Live Now ({groups.live.length})
          </button>
          <button
            type="button"
            className={`status-tab-btn ${statusFilter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setStatusFilter('upcoming')}
          >
            Upcoming ({groups.upcoming.length})
          </button>
          <button
            type="button"
            className={`status-tab-btn ${statusFilter === 'past' ? 'active' : ''}`}
            onClick={() => setStatusFilter('past')}
          >
            Past Archives ({groups.past.length})
          </button>
        </div>

        {/* Search & Visibility */}
        <div className="contests-search-controls">
          <div className="contests-search-input-wrap">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search contests by title…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="contests-search-input"
              id="input-search-contests"
            />
            {searchQuery && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setSearchQuery('')}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value as 'all' | 'public' | 'private')}
            className="contests-vis-select"
            id="select-contest-visibility"
          >
            <option value="all">All Arenas</option>
            <option value="public">Public Only</option>
            <option value="private">Private / Invite Only</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="contests-error-banner" role="alert">
          <X size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton Grid */}
      {loading ? (
        <div className="contests-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="contest-card-skeleton skeleton" />
          ))}
        </div>
      ) : filteredContests.length > 0 ? (
        <div className="contests-cards-grid">
          {filteredContests.map((item) => {
            const status = statusOf(item, now);
            const target = status === 'upcoming' ? item.start_time : item.end_time;
            const isLive = status === 'live';

            return (
              <div
                key={item.id}
                className={`contest-arena-card ${status}`}
                onClick={() => void openContest(item.id)}
                role="button"
                tabIndex={0}
                id={`card-contest-${item.id}`}
              >
                {/* Top Badge Strip */}
                <div className="arena-card-top">
                  <span className={`contest-status-pill ${status}`}>
                    {isLive && <span className="pulse-dot" />}
                    {isLive ? 'LIVE' : status === 'upcoming' ? 'UPCOMING' : 'CONCLUDED'}
                  </span>

                  <span className={`contest-vis-pill ${item.visibility || 'public'}`}>
                    {item.visibility === 'private' ? (
                      <>
                        <Lock size={12} />
                        <span>Private</span>
                      </>
                    ) : (
                      <>
                        <Globe size={12} />
                        <span>Public</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Title & Description */}
                <div className="arena-card-body">
                  <h3 className="arena-card-title">{item.title}</h3>
                  <p className="arena-card-desc">
                    {item.description && item.description !== '-'
                      ? item.description
                      : 'Timed competitive algorithmic tournament round with real-time scoring and live scoreboard.'}
                  </p>
                </div>

                {/* Meta details */}
                <div className="arena-card-meta">
                  <div className="meta-item">
                    <Calendar size={13} className="text-muted" />
                    <span>{formatDate(item.start_time)}</span>
                  </div>

                  <div className="meta-item">
                    <Clock3 size={13} className="text-muted" />
                    <span className="meta-timer-highlight">
                      {status === 'past' ? 'Concluded' : countdown(target, now)}
                    </span>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="arena-card-footer">
                  <span className="card-enter-action">
                    <span>Enter Arena</span>
                    <ArrowRight size={15} className="arrow-icon" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="contests-empty-state">
          <Trophy size={42} className="text-muted" />
          <h3>No Contests Found</h3>
          <p>No competitions match your current filter or search criteria.</p>
          {(searchQuery || statusFilter !== 'all' || visibilityFilter !== 'all') && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setVisibilityFilter('all');
              }}
              style={{ marginTop: '1rem' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </section>
  );
};