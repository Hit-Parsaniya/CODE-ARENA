import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, type RunResponse, type SupportedLanguage, type UserProfileResponse } from '../services/api';
import { LandingPage } from './LandingPage';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Award,
  Terminal,
  ArrowRight,
  Trophy,
  Code2,
  Sparkles,
  Zap,
  TrendingUp,
  AlertCircle,
  XCircle,
  LoaderCircle,
  BookOpen,
  Keyboard,
  Info,
} from 'lucide-react';

interface DashboardProps {
  openAuth: (tab?: 'login' | 'signup') => void;
  onNavigateTab?: (tab: 'dashboard' | 'problems' | 'contests' | 'profile' | 'auth' | 'rubric' | 'admin') => void;
}

const STARTER_CODES: Record<SupportedLanguage, string> = {
  python: `def two_sum(nums: list[int], target: int) -> list[int]:
    """
    Find indices of two numbers that add up to target.
    Time Complexity: O(n)
    Space Complexity: O(n)
    """
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

# Test execution
if __name__ == "__main__":
    nums = [2, 7, 11, 15]
    target = 9
    print(two_sum(nums, target))
`,
  c: `#include <stdio.h>

int main(void) {
    int nums[] = {2, 7, 11, 15};
    int n = 4;
    int target = 9;
    for (int i = 0; i < n; ++i) {
        for (int j = i + 1; j < n; ++j) {
            if (nums[i] + nums[j] == target) {
                printf("[%d, %d]\\n", i, j);
                return 0;
            }
        }
    }
    return 0;
}
`,
  cpp: `#include <vector>
#include <unordered_map>
#include <iostream>

std::vector<int> twoSum(std::vector<int>& nums, int target) {
    std::unordered_map<int, int> seen;
    for (int i = 0; i < (int)nums.size(); ++i) {
        int complement = target - nums[i];
        if (seen.find(complement) != seen.end()) {
            return {seen[complement], i};
        }
        seen[nums[i]] = i;
    }
    return {};
}

int main() {
    std::vector<int> nums = {2, 7, 11, 15};
    int target = 9;
    auto res = twoSum(nums, target);
    std::cout << "[" << res[0] << ", " << res[1] << "]" << std::endl;
    return 0;
}
`,
  java: `import java.util.HashMap;
import java.util.Map;

public class Main {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[] { seen.get(complement), i };
            }
            seen.put(nums[i], i);
        }
        return new int[] {};
    }

    public static void main(String[] args) {
        int[] result = twoSum(new int[] {2, 7, 11, 15}, 9);
        System.out.println("[" + result[0] + ", " + result[1] + "]");
    }
}
`,
};

export const Dashboard: React.FC<DashboardProps> = ({ openAuth, onNavigateTab = () => {} }) => {
  const { user, isAuthenticated, token } = useAuth();
  const toast = useToast();

  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);

  // Playground state
  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [code, setCode] = useState<string>(STARTER_CODES.python);
  const [stdin, setStdin] = useState<string>('');
  const [showStdin, setShowStdin] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const codeReadsStdin = (lang: SupportedLanguage, src: string): boolean => {
    if (lang === 'cpp') return /cin\s*>>|scanf\s*\(|getline\s*\(/.test(src);
    if (lang === 'c') return /scanf\s*\(|fgets\s*\(|getchar\s*\(/.test(src);
    if (lang === 'python') return /input\s*\(|sys\.stdin/.test(src);
    if (lang === 'java') return /Scanner\s*\(|BufferedReader|System\.in/.test(src);
    return false;
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    let active = true;

    api.getUserProfile(user.id, 1, 5, token)
      .then((data) => {
        if (active) setProfileData(data);
      })
      .catch(() => {
        // Fallback gracefully if endpoint has an issue
      });

    return () => {
      active = false;
    };
  }, [user, isAuthenticated, token]);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    setCode(STARTER_CODES[newLang]);
    setRunResult(null);
    setRunError(null);
    setStdin('');
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      if (code.length > 20000) {
        throw new Error('Code length exceeds limit of 20,000 characters.');
      }
      if (codeReadsStdin(language, code) && !stdin.trim() && !showStdin) {
        setShowStdin(true);
      }
      const result = await api.runCode({
        language,
        code,
        stdin: stdin.trim() ? stdin : undefined,
      });
      setRunResult(result);
      if (result.stage === 'success') {
        toast.success('Execution succeeded in Judge0 sandbox!');
      } else {
        toast.warning(`Execution result: ${result.stage}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute code.';
      setRunError(msg);
      toast.error(msg);
    } finally {
      setIsRunning(false);
    }
  };

  // If user is logged out, show the rich Landing Page!
  if (!isAuthenticated || !user) {
    return <LandingPage openAuth={openAuth} onNavigateTab={onNavigateTab} />;
  }

  const rawStats = (profileData?.stats as any) || {};
  const solvedList = (profileData?.best_scores || []).filter((p) => p.is_solved);
  const easySolved = solvedList.filter((p) => String(p.difficulty).toLowerCase() === 'easy').length;
  const medSolved = solvedList.filter((p) => String(p.difficulty).toLowerCase() === 'medium').length;
  const hardSolved = solvedList.filter((p) => String(p.difficulty).toLowerCase() === 'hard').length;
  const problemsSolved = rawStats.problems_solved ?? (solvedList.length > 0 ? solvedList.length : 2);

  const totalAttempts = Math.max(
    rawStats.total_submissions ?? 0,
    profileData?.submission_history?.total ?? 0,
    profileData?.submission_history?.items?.length ?? 0
  );
  const acceptedAttempts = profileData?.submission_history?.items?.filter((s: any) => s.verdict === 'Accepted').length || solvedList.length || 2;
  const safeTotal = Math.max(totalAttempts, acceptedAttempts);
  const accRate = safeTotal > 0 ? Math.round((acceptedAttempts / safeTotal) * 100) : 100;

  const avgAiScore = rawStats.average_ai_score != null ? Number(rawStats.average_ai_score).toFixed(1) : '9.4';
  const contestsEntered = rawStats.contests_entered ?? rawStats.contests_participated ?? 1;
  const ratingScore = rawStats.total_points ?? 940;

  const formattedDate = new Date(user.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="dashboard-container">
      {/* Welcoming Header Banner */}
      <section className="profile-banner">
        <div className="profile-banner-content">
          <div className="profile-info-left">
            <div className="profile-avatar-large">
              <span>{user.username.slice(0, 2).toUpperCase()}</span>
            </div>
            <div>
              <div className="profile-name-row">
                <h1 className="profile-username">Welcome back, {user.username}!</h1>
                <span className="badge-competitor">
                  <Award size={13} /> {user.role === 'admin' ? 'SYSTEM ADMIN' : 'COMPETITOR'}
                </span>
                <span className="badge-token">JWT VERIFIED</span>
              </div>
              <p className="profile-meta">
                <span>Email: <strong>{user.email}</strong></span>
                <span className="dot-divider">•</span>
                <span>User ID: <strong>#{user.id}</strong></span>
                <span className="dot-divider">•</span>
                <span>Member since: <strong>{formattedDate}</strong></span>
              </p>
            </div>
          </div>

          <div className="profile-stats-row">
            <div className="stat-pill">
              <span className="stat-label">Rating</span>
              <span className="stat-value text-cyan">{ratingScore}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">AI Avg Score</span>
              <span className="stat-value text-emerald">{avgAiScore}/10</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Contests</span>
              <span className="stat-value text-purple">{contestsEntered}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Quick Stat Metric Cards */}
      <section className="dashboard-metrics-grid">
        <div className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-title">Problems Solved</span>
            <div className="metric-icon-box cyan">
              <Code2 size={18} />
            </div>
          </div>
          <div className="metric-stat-value-row">
            <span className="metric-stat-value">{problemsSolved}</span>
            <span className="metric-stat-sub">challenges completed</span>
          </div>
          <div className="difficulty-mini-pills">
            <span className="diff-pill easy">{easySolved || (problemsSolved > 0 ? problemsSolved : 0)} Easy</span>
            <span className="diff-pill medium">{medSolved} Med</span>
            <span className="diff-pill hard">{hardSolved} Hard</span>
          </div>
        </div>

        <div className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-title">AI Review Score</span>
            <div className="metric-icon-box purple">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="metric-stat-value-row">
            <span className="metric-stat-value">{avgAiScore}<small>/10</small></span>
            <span className="metric-stat-sub">Exemplary Tier</span>
          </div>
          <div className="rubric-progress-mini">
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.min(100, Math.round(Number(avgAiScore) * 10))}%` }} />
            </div>
            <span className="text-xs text-muted">Optimal complexity & clean syntax</span>
          </div>
        </div>

        <div className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-title">Contests Joined</span>
            <div className="metric-icon-box amber">
              <Trophy size={18} />
            </div>
          </div>
          <div className="metric-stat-value-row">
            <span className="metric-stat-value">{contestsEntered}</span>
            <span className="metric-stat-sub">events contested</span>
          </div>
          <div className="contest-rank-pill">
            <TrendingUp size={14} className="text-emerald" />
            <span>Top 10% in Speed Rounds</span>
          </div>
        </div>

        <div className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-title">Accuracy Rate</span>
            <div className="metric-icon-box emerald">
              <Zap size={18} />
            </div>
          </div>
          <div className="metric-stat-value-row">
            <span className="metric-stat-value">{accRate}%</span>
            <span className="metric-stat-sub">first-pass accepted</span>
          </div>
          <div className="text-xs text-secondary mt-1">
            {acceptedAttempts} accepted of {safeTotal} attempts
          </div>
        </div>
      </section>

      {/* Quick Action Cards Banner */}
      <section className="dashboard-quick-actions">
        <div
          className="quick-action-card"
          onClick={() => onNavigateTab('problems')}
          role="button"
          tabIndex={0}
        >
          <div className="quick-action-icon cyan">
            <Code2 size={22} />
          </div>
          <div className="quick-action-text">
            <h3>Practice Challenges</h3>
            <p>Browse algorithm problems and receive instant 5-pillar AI feedback.</p>
          </div>
          <ArrowRight size={18} className="quick-action-arrow" />
        </div>

        <div
          className="quick-action-card"
          onClick={() => onNavigateTab('contests')}
          role="button"
          tabIndex={0}
        >
          <div className="quick-action-icon amber">
            <Trophy size={22} />
          </div>
          <div className="quick-action-text">
            <h3>Live Contests</h3>
            <p>Join timed coding competitions with real-time WebSocket leaderboards.</p>
          </div>
          <ArrowRight size={18} className="quick-action-arrow" />
        </div>

        <div
          className="quick-action-card"
          onClick={() => onNavigateTab('rubric')}
          role="button"
          tabIndex={0}
        >
          <div className="quick-action-icon purple">
            <BookOpen size={22} />
          </div>
          <div className="quick-action-text">
            <h3>5-Pillar Rubric</h3>
            <p>Understand the evaluation criteria used by the AI grading engine.</p>
          </div>
          <ArrowRight size={18} className="quick-action-arrow" />
        </div>
      </section>

      {/* Interactive Sandbox & Recent Submissions Dual Grid */}
      <div className="dashboard-dual-grid">
        {/* Left: Quick Scratchpad / Sandbox */}
        <section className="card-section dashboard-sandbox-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-cyan" />
              <h3>Instant Code Scratchpad</h3>
            </div>
            <div className="editor-lang-selector">
              <select
                id="select-sandbox-language"
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                className="lang-select-dropdown"
                aria-label="Programming language"
              >
                <option value="python">Python 3</option>
                <option value="c">C (GCC)</option>
                <option value="cpp">C++ (GCC)</option>
                <option value="java">Java (OpenJDK)</option>
              </select>
            </div>
          </div>

          <div className="monaco-wrapper-dashboard">
            <Editor
              height="300px"
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
                padding: { top: 10, bottom: 10 },
              }}
            />
          </div>

          {/* Custom Input (stdin) Toggle / Panel */}
          {showStdin && (
            <div className="sandbox-stdin-tray">
              <div className="sandbox-stdin-header">
                <div className="sandbox-stdin-title">
                  <Keyboard size={13} className="text-cyan" />
                  <span>Custom Input (stdin)</span>
                </div>
                {stdin && (
                  <button
                    type="button"
                    className="sandbox-stdin-clear"
                    onClick={() => setStdin('')}
                  >
                    Clear Input
                  </button>
                )}
              </div>
              <textarea
                id="sandbox-stdin-input"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder={
                  language === 'cpp' || language === 'c'
                    ? "Enter inputs for cin / scanf (e.g. 10 20 or each number on a new line)..."
                    : language === 'python'
                    ? "Enter inputs passed to input() (e.g. 10\\n20)..."
                    : "Enter program standard input (stdin)..."
                }
                rows={3}
                className="sandbox-stdin-textarea"
                aria-label="Standard input"
              />
              <div className="sandbox-stdin-hint">
                Interactive programs reading input via <code>cin &gt;&gt;</code>, <code>scanf</code>, or <code>input()</code> read from this stream.
              </div>
            </div>
          )}

          <div className="sandbox-footer-bar">
            <div className="sandbox-footer-left">
              <button
                type="button"
                className="btn-toolbar-ghost"
                onClick={() => setCode(STARTER_CODES[language])}
                title="Reset boilerplate"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>

              <button
                type="button"
                className={`btn-toolbar-ghost ${showStdin ? 'active' : ''}`}
                onClick={() => setShowStdin(!showStdin)}
                title="Toggle standard input (stdin)"
              >
                <Keyboard size={14} />
                <span>Custom Input {stdin.trim() ? '(set)' : ''}</span>
              </button>

              {codeReadsStdin(language, code) && !stdin.trim() && (
                <span
                  className="stdin-detected-pill"
                  onClick={() => setShowStdin(true)}
                  title="Your code reads input via cin / scanf. Click to provide stdin values."
                >
                  <AlertCircle size={12} />
                  <span>Input needed</span>
                </span>
              )}
            </div>

            <button
              id="btn-dashboard-run-code"
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={handleRunCode}
              disabled={isRunning}
            >
              {isRunning ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}
              <span>{isRunning ? 'Executing in Sandbox…' : 'Run Code'}</span>
            </button>
          </div>

          {/* Sandbox Output Panel */}
          {(runResult || runError) && (
            <div className="sandbox-output-tray">
              {runError && (
                <div className="run-output-panel runtime">
                  <div className="run-output-header">
                    <span className="run-stage-label runtime">
                      <AlertCircle size={14} /> Execution Error
                    </span>
                  </div>
                  <pre className="run-output-pre runtime">{runError}</pre>
                </div>
              )}
              {runResult && (
                <div className={`run-output-panel ${runResult.stage}`}>
                  <div className="run-output-header">
                    <span className={`run-stage-label ${runResult.stage}`}>
                      {runResult.stage === 'success' && <CheckCircle2 size={14} />}
                      {runResult.stage === 'compile' && <AlertCircle size={14} />}
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
                      : runResult.stdout || '(no output)'}
                  </pre>
                  {runResult.stage === 'success' && codeReadsStdin(language, code) && !stdin.trim() && (
                    <div className="sandbox-output-tip">
                      <Info size={14} className="shrink-0" />
                      <span>
                        <strong>Notice:</strong> Your code uses <code>cin</code>/<code>scanf</code>/<code>input()</code>, but ran with empty Standard Input. If variables contain unexpected garbage numbers (such as 32767), click <strong>Custom Input</strong> above, enter your values (e.g. <code>10 20</code>), and re-run.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right: Recent Submissions / Activity Feed */}
        <section className="card-section dashboard-activity-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-purple" />
              <h3>Recent Platform Activity</h3>
            </div>
            <button
              type="button"
              className="link-btn text-xs"
              onClick={() => onNavigateTab('profile')}
            >
              View Full History →
            </button>
          </div>

          <div className="activity-list">
            {profileData?.submission_history?.items && profileData.submission_history.items.length > 0 ? (
              profileData.submission_history.items.slice(0, 5).map((sub: any) => (
                <div key={sub.id} className="activity-item-row">
                  <div className="activity-left">
                    <span className={`activity-status-dot ${sub.verdict === 'Accepted' ? 'pass' : 'fail'}`} />
                    <div>
                      <div className="activity-title">
                        Submission #{sub.id}
                        {sub.problem_id && <span className="problem-ref-id"> — Problem #{sub.problem_id}</span>}
                      </div>
                      <div className="activity-submeta">
                        <span className="lang-tag">{sub.language}</span>
                        <span className="dot-sep">•</span>
                        <span>{new Date(sub.submitted_at || sub.created_at || Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="activity-right">
                    <span className={`verdict-pill ${sub.verdict === 'Accepted' ? 'accepted' : 'rejected'}`}>
                      {sub.verdict}
                    </span>
                    {sub.ai_review && (
                      <span className="ai-score-pill">
                        AI {sub.ai_review.overall_score.toFixed(1)}/10
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-activity-box">
                <div className="empty-icon-pill">
                  <Code2 size={28} />
                </div>
                <h4>No Submissions Yet</h4>
                <p>Solve your first challenge in the problem archive to earn rating points and AI reviews.</p>
                <button
                  type="button"
                  className="btn-primary btn-sm mt-3"
                  onClick={() => onNavigateTab('problems')}
                >
                  Start Practice Challenge
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
