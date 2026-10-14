import React, { useEffect, useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useAuth } from '../context/AuthContext';
import {
  api,
  type UserProfileResponse,
  type SubmissionHistoryItem,
} from '../services/api';
import {
  User as UserIcon,
  Trophy,
  Award,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Code,
  Check,
  Copy,
  Search,
  RefreshCw,
  Zap,
  Target,
  FileCode,
  ShieldCheck,
  Layers,
} from 'lucide-react';

interface ProfileProps {
  openAuth: () => void;
  targetUserId?: number | null;
}

export const Profile: React.FC<ProfileProps> = ({ openAuth, targetUserId }) => {
  const { user: currentUser, token, isAuthenticated } = useAuth();

  // Selected user ID to view (defaults to logged in user, or provided targetUserId, or 1 as fallback)
  const activeUserId = targetUserId || (currentUser ? currentUser.id : 1);
  const [viewUserId, setViewUserId] = useState<number>(activeUserId);
  const [searchInputId, setSearchInputId] = useState<string>(activeUserId.toString());

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const perPage = 8;

  // Modal for viewing submission code & AI review
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionHistoryItem | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Active tab in profile (overview & submissions / best scores / contests)
  const [subTab, setSubTab] = useState<'submissions' | 'problems' | 'contests'>('submissions');

  // Chart tooltip state
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    data: {
      date: string;
      overall_score: number;
      problem_title: string;
      correctness?: number | null;
      readability?: number | null;
      efficiency?: number | null;
      best_practices?: number | null;
    };
  } | null>(null);

  // Sync with current user when user logs in or targetUserId changes
  useEffect(() => {
    if (targetUserId) {
      setViewUserId(targetUserId);
      setSearchInputId(targetUserId.toString());
      setCurrentPage(1);
    } else if (currentUser) {
      setViewUserId(currentUser.id);
      setSearchInputId(currentUser.id.toString());
      setCurrentPage(1);
    }
  }, [targetUserId, currentUser?.id]);

  const loadProfile = async (uid: number, page: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUserProfile(uid, page, perPage, token);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile(viewUserId, currentPage);
  }, [viewUserId, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(searchInputId.trim(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      setViewUserId(parsed);
      setCurrentPage(1);
    }
  };

  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Helper for language badge class
  const getLangBadgeClass = (lang: string) => {
    const l = lang.toLowerCase();
    if (l.includes('python')) return 'lang-python';
    if (l.includes('cpp') || l.includes('c++')) return 'lang-cpp';
    if (l.includes('c')) return 'lang-c';
    if (l.includes('java')) return 'lang-java';
    return 'lang-other';
  };

  // Helper for verdict badge
  const renderVerdictBadge = (verdict: string) => {
    const v = verdict.toLowerCase();
    if (v === 'accepted') {
      return (
        <span className="verdict-tag accepted">
          <CheckCircle2 size={13} />
          Accepted
        </span>
      );
    }
    if (v.includes('wrong')) {
      return (
        <span className="verdict-tag wrong">
          <XCircle size={13} />
          Wrong Answer
        </span>
      );
    }
    if (v.includes('time')) {
      return (
        <span className="verdict-tag tle">
          <Clock size={13} />
          TLE
        </span>
      );
    }
    if (v.includes('compile')) {
      return (
        <span className="verdict-tag compile-err">
          <Code size={13} />
          Compile Error
        </span>
      );
    }
    return (
      <span className="verdict-tag runtime-err">
        <XCircle size={13} />
        {verdict}
      </span>
    );
  };

  // Line Chart Calculations for AI Review Score Trend
  const chartData = useMemo(() => {
    if (!profile || !profile.ai_review_trend || profile.ai_review_trend.length === 0) {
      return null;
    }

    const items = profile.ai_review_trend;
    const width = 740;
    const height = 220;
    const padding = { top: 25, right: 30, bottom: 40, left: 45 };

    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    // AI score scale is 0 to 10 (or 0 to 100 if stored > 10)
    const maxPossibleScore = 10;
    const minPossibleScore = 0;

    const points = items.map((item, idx) => {
      const x =
        items.length === 1
          ? padding.left + innerWidth / 2
          : padding.left + (idx / (items.length - 1)) * innerWidth;
      
      const normalizedScore = item.overall_score > 10 ? item.overall_score / 10 : item.overall_score;
      const y =
        padding.top +
        innerHeight -
        ((normalizedScore - minPossibleScore) / (maxPossibleScore - minPossibleScore)) * innerHeight;

      return {
        x,
        y,
        score: item.overall_score,
        normalizedScore,
        raw: item,
      };
    });

    const pathD = points.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x},${pt.y}`;
      return `${acc} L ${pt.x},${pt.y}`;
    }, '');

    const areaD =
      points.length > 0
        ? `${pathD} L ${points[points.length - 1].x},${padding.top + innerHeight} L ${points[0].x},${
            padding.top + innerHeight
          } Z`
        : '';

    return {
      width,
      height,
      padding,
      innerWidth,
      innerHeight,
      points,
      pathD,
      areaD,
    };
  }, [profile?.ai_review_trend]);

  return (
    <div className="profile-page">
      {/* Top Banner & User Switcher */}
      <div className="profile-header-banner">
        <div className="profile-user-summary">
          <div className="profile-avatar-large">
            <UserIcon size={38} className="profile-avatar-icon" />
            <div className="avatar-glow-ring" />
          </div>
          <div className="profile-user-details">
            <div className="profile-username-row">
              <h1 className="profile-username">
                {profile ? profile.username : `User #${viewUserId}`}
              </h1>
              {profile?.is_admin && (
                <span className="badge-admin">
                  <ShieldCheck size={13} /> Admin
                </span>
              )}
              {currentUser && currentUser.id === viewUserId && (
                <span className="badge-self">Your Profile</span>
              )}
            </div>
            <div className="profile-meta-row">
              <span className="profile-meta-item">
                <span className="meta-label">User ID:</span> #{profile?.id ?? viewUserId}
              </span>
              {profile?.email && (
                <span className="profile-meta-item">
                  <span className="meta-label">Email:</span> {profile.email}
                </span>
              )}
              {profile?.created_at && (
                <span className="profile-meta-item">
                  <Calendar size={13} /> Joined{' '}
                  {new Date(profile.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* User Search & Switcher Bar */}
        <div className="profile-actions-bar">
          <form onSubmit={handleSearchSubmit} className="profile-search-form">
            <div className="search-input-wrap">
              <Search size={14} className="search-icon" />
              <input
                type="number"
                min="1"
                placeholder="Lookup user ID..."
                value={searchInputId}
                onChange={(e) => setSearchInputId(e.target.value)}
                className="profile-search-input"
                id="input-user-lookup"
              />
            </div>
            <button type="submit" className="btn-secondary btn-sm" id="btn-user-lookup">
              View
            </button>
          </form>

          {currentUser && currentUser.id !== viewUserId && (
            <button
              onClick={() => {
                setViewUserId(currentUser.id);
                setSearchInputId(currentUser.id.toString());
                setCurrentPage(1);
              }}
              className="btn-primary btn-sm"
              id="btn-view-my-profile"
            >
              My Profile
            </button>
          )}

          <button
            onClick={() => loadProfile(viewUserId, currentPage)}
            className="btn-icon-secondary"
            title="Refresh profile data"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="auth-nag-banner">
          <Zap size={18} className="text-amber" />
          <span>
            You are viewing in guest mode. Sign in to view and track your own submissions & AI score history.
          </span>
          <button onClick={openAuth} className="btn-primary btn-sm ml-auto">
            Sign In
          </button>
        </div>
      )}

      {error && (
        <div className="error-alert">
          <XCircle size={18} />
          <span>{error}</span>
          <button onClick={() => loadProfile(viewUserId, 1)} className="btn-retry">
            Retry
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="stats-grid">
        {/* Problems Solved Card */}
        <div className="stat-card stat-card-solved">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper cyan">
              <Target size={22} />
            </div>
            <span className="stat-card-title">Problems Solved</span>
          </div>
          <div className="stat-card-value">
            {profile ? profile.stats.problems_solved : 0}
            <span className="stat-card-subvalue">
              / {profile ? profile.best_scores.length : 0} attempted
            </span>
          </div>
          <div className="stat-progress-bar">
            <div
              className="stat-progress-fill cyan"
              style={{
                width:
                  profile && profile.best_scores.length > 0
                    ? `${Math.min(
                        100,
                        (profile.stats.problems_solved / profile.best_scores.length) * 100
                      )}%`
                    : '0%',
              }}
            />
          </div>
          <div className="stat-card-footer">
            <span>
              Solve Rate:{' '}
              <strong>
                {profile && profile.best_scores.length > 0
                  ? `${Math.round(
                      (profile.stats.problems_solved / profile.best_scores.length) * 100
                    )}%`
                  : '0%'}
              </strong>
            </span>
          </div>
        </div>

        {/* Average AI Score Card */}
        <div className="stat-card stat-card-ai">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper purple">
              <Sparkles size={22} />
            </div>
            <span className="stat-card-title">Average AI Score</span>
          </div>
          <div className="stat-card-value">
            {profile ? (
              profile.stats.average_ai_score > 10
                ? profile.stats.average_ai_score.toFixed(1)
                : profile.stats.average_ai_score.toFixed(1)
            ) : (
              '0.0'
            )}
            <span className="stat-card-subvalue">
              {profile && profile.stats.average_ai_score > 10 ? '/ 100' : '/ 10'}
            </span>
          </div>
          <div className="stat-progress-bar">
            <div
              className="stat-progress-fill purple"
              style={{
                width:
                  profile && profile.stats.average_ai_score > 0
                    ? `${Math.min(
                        100,
                        profile.stats.average_ai_score > 10
                          ? profile.stats.average_ai_score
                          : profile.stats.average_ai_score * 10
                      )}%`
                    : '0%',
              }}
            />
          </div>
          <div className="stat-card-footer">
            <span>
              Rubric Status:{' '}
              <strong className="text-purple">
                {!profile || profile.stats.average_ai_score === 0
                  ? 'No reviews yet'
                  : profile.stats.average_ai_score >= 8 || profile.stats.average_ai_score >= 80
                  ? 'Excellent Standard'
                  : profile.stats.average_ai_score >= 6 || profile.stats.average_ai_score >= 60
                  ? 'Proficient'
                  : 'Needs Improvement'}
              </strong>
            </span>
          </div>
        </div>

        {/* Contests Entered Card */}
        <div className="stat-card stat-card-contests">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper amber">
              <Trophy size={22} />
            </div>
            <span className="stat-card-title">Contests Entered</span>
          </div>
          <div className="stat-card-value">
            {profile ? profile.stats.contests_entered : 0}
            <span className="stat-card-subvalue">contests</span>
          </div>
          <div className="stat-progress-bar">
            <div
              className="stat-progress-fill amber"
              style={{
                width: `${Math.min(100, ((profile?.stats.contests_entered || 0) / 10) * 100)}%`,
              }}
            />
          </div>
          <div className="stat-card-footer">
            <span>
              Best Rank:{' '}
              <strong>
                {profile && profile.contest_history.length > 0
                  ? `#${Math.min(...profile.contest_history.map((c) => c.rank))}`
                  : 'N/A'}
              </strong>
            </span>
          </div>
        </div>

        {/* Total Submissions Card */}
        <div className="stat-card stat-card-subs">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper emerald">
              <Code size={22} />
            </div>
            <span className="stat-card-title">Total Submissions</span>
          </div>
          <div className="stat-card-value">
            {profile ? profile.stats.total_submissions : 0}
            <span className="stat-card-subvalue">runs</span>
          </div>
          <div className="stat-progress-bar">
            <div
              className="stat-progress-fill emerald"
              style={{
                width: `${Math.min(
                  100,
                  ((profile?.stats.total_submissions || 0) / 50) * 100
                )}%`,
              }}
            />
          </div>
          <div className="stat-card-footer">
            <span>
              Accepted Submissions:{' '}
              <strong>
                {profile
                  ? profile.submission_history.items.filter((s) => s.verdict === 'Accepted').length
                  : 0}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* AI Review Score Trend Line Chart */}
      <div className="card-section profile-chart-section">
        <div className="section-header">
          <div className="section-header-title">
            <TrendingUp size={18} className="text-cyan" />
            <h2>AI Review Score Trend Over Time</h2>
          </div>
          <div className="chart-legend">
            <span className="legend-dot" />
            <span className="legend-text">Overall AI Score (0 - 10)</span>
          </div>
        </div>

        <div className="chart-container">
          {chartData && chartData.points.length > 0 ? (
            <div className="svg-chart-wrapper">
              <svg
                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                className="profile-trend-svg"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <defs>
                  <linearGradient id="scoreTrendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                    <stop offset="75%" stopColor="#8b5cf6" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="scoreStrokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                  <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Grid Lines */}
                {[0, 2.5, 5, 7.5, 10].map((val) => {
                  const y =
                    chartData.padding.top +
                    chartData.innerHeight -
                    (val / 10) * chartData.innerHeight;
                  return (
                    <g key={val}>
                      <line
                        x1={chartData.padding.left}
                        y1={y}
                        x2={chartData.width - chartData.padding.right}
                        y2={y}
                        className="chart-grid-line"
                      />
                      <text
                        x={chartData.padding.left - 8}
                        y={y + 4}
                        className="chart-axis-label y-axis"
                        textAnchor="end"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Area under line */}
                {chartData.points.length > 1 && (
                  <path d={chartData.areaD} fill="url(#scoreTrendGradient)" />
                )}

                {/* Main Curve Line */}
                {chartData.points.length > 1 ? (
                  <path
                    d={chartData.pathD}
                    fill="none"
                    stroke="url(#scoreStrokeGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glowEffect)"
                  />
                ) : null}

                {/* Data Points */}
                {chartData.points.map((pt, idx) => (
                  <g key={idx} className="chart-point-group">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="6"
                      className="chart-point-outer"
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="3.5"
                      className="chart-point-inner"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          x: pt.x,
                          y: pt.y,
                          data: {
                            date: new Date(pt.raw.date).toLocaleString(),
                            overall_score: pt.score,
                            problem_title: pt.raw.problem_title,
                            correctness: pt.raw.correctness,
                            readability: pt.raw.readability,
                            efficiency: pt.raw.efficiency,
                            best_practices: pt.raw.best_practices,
                          },
                        })
                      }
                    />
                    {/* Date label at bottom for selected or endpoints */}
                    {(idx === 0 ||
                      idx === chartData.points.length - 1 ||
                      idx === Math.floor(chartData.points.length / 2)) && (
                      <text
                        x={pt.x}
                        y={chartData.height - 12}
                        className="chart-axis-label x-axis"
                        textAnchor="middle"
                      >
                        {new Date(pt.raw.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </text>
                    )}
                  </g>
                ))}
              </svg>

              {/* Floating Tooltip */}
              {hoveredPoint && (
                <div
                  className="chart-tooltip"
                  style={{
                    left: `${(hoveredPoint.x / chartData.width) * 100}%`,
                    top: `${(hoveredPoint.y / chartData.height) * 100}%`,
                  }}
                >
                  <div className="tooltip-header">
                    <Sparkles size={12} className="text-cyan" />
                    <span className="tooltip-prob-title">{hoveredPoint.data.problem_title}</span>
                  </div>
                  <div className="tooltip-score">
                    Overall Score: <strong>{hoveredPoint.data.overall_score.toFixed(1)} / 10</strong>
                  </div>
                  <div className="tooltip-subscores">
                    {hoveredPoint.data.correctness !== null && hoveredPoint.data.correctness !== undefined && (
                      <span>Corr: {hoveredPoint.data.correctness}</span>
                    )}
                    {hoveredPoint.data.readability !== null && hoveredPoint.data.readability !== undefined && (
                      <span>Read: {hoveredPoint.data.readability}</span>
                    )}
                    {hoveredPoint.data.efficiency !== null && hoveredPoint.data.efficiency !== undefined && (
                      <span>Eff: {hoveredPoint.data.efficiency}</span>
                    )}
                  </div>
                  <div className="tooltip-date">{hoveredPoint.data.date}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-chart-state">
              <Sparkles size={32} className="empty-chart-icon" />
              <h4>No AI Review Score History Yet</h4>
              <p>
                Submit solutions to problems to trigger our automated Gemini AI code evaluation.
                Your scores across correctness, readability, efficiency, and best practices will be tracked here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sub-tabs for Details (Submissions / Best Scores / Contests) */}
      <div className="profile-subtabs-nav">
        <button
          className={`subtab-btn ${subTab === 'submissions' ? 'active' : ''}`}
          onClick={() => setSubTab('submissions')}
          id="tab-btn-submission-history"
        >
          <Layers size={16} />
          Submission History
          {profile && (
            <span className="subtab-count">{profile.stats.total_submissions}</span>
          )}
        </button>
        <button
          className={`subtab-btn ${subTab === 'problems' ? 'active' : ''}`}
          onClick={() => setSubTab('problems')}
          id="tab-btn-best-scores"
        >
          <Award size={16} />
          Best Scores Per Problem
          {profile && (
            <span className="subtab-count">{profile.best_scores.length}</span>
          )}
        </button>
        <button
          className={`subtab-btn ${subTab === 'contests' ? 'active' : ''}`}
          onClick={() => setSubTab('contests')}
          id="tab-btn-contest-history"
        >
          <Trophy size={16} />
          Contest History
          {profile && (
            <span className="subtab-count">{profile.contest_history.length}</span>
          )}
        </button>
      </div>

      {/* Subtab Content: Submission History */}
      {subTab === 'submissions' && (
        <div className="card-section submissions-section">
          <div className="table-responsive">
            <table className="custom-table" id="table-submission-history">
              <thead>
                <tr>
                  <th>Problem</th>
                  <th>Language</th>
                  <th>Verdict</th>
                  <th>Test Score</th>
                  <th>AI Review</th>
                  <th>Submitted At</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {profile && profile.submission_history.items.length > 0 ? (
                  profile.submission_history.items.map((sub) => (
                    <tr
                      key={sub.id}
                      className="clickable-table-row"
                      onClick={() => setSelectedSubmission(sub)}
                    >
                      <td className="font-semibold text-primary">
                        <div className="problem-cell">
                          <FileCode size={15} className="text-muted" />
                          <span>{sub.problem_title}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`lang-badge ${getLangBadgeClass(sub.language)}`}>
                          {sub.language.toUpperCase()}
                        </span>
                      </td>
                      <td>{renderVerdictBadge(sub.verdict)}</td>
                      <td>
                        <span className="score-pill">
                          {Math.round(sub.score * 100)}%
                        </span>
                      </td>
                      <td>
                        {sub.ai_review && sub.ai_review.overall_score !== undefined ? (
                          <span className="ai-score-pill">
                            <Sparkles size={12} />
                            <strong>{sub.ai_review.overall_score.toFixed(1)}</strong>
                            <small>/10</small>
                          </span>
                        ) : (
                          <span className="text-muted text-xs">No AI Review</span>
                        )}
                      </td>
                      <td className="text-muted text-sm">
                        {new Date(sub.submitted_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="text-right">
                        <button
                          className="btn-sm btn-ghost view-code-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSubmission(sub);
                          }}
                          title="View submitted code and AI analysis"
                        >
                          <Eye size={14} />
                          <span>View Code</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      {loading ? (
                        <div className="loading-state">
                          <RefreshCw size={20} className="spin" />
                          <span>Loading submissions...</span>
                        </div>
                      ) : (
                        'No submissions recorded for this user yet.'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {profile && profile.submission_history.total_pages > 1 && (
            <div className="pagination-bar">
              <div className="pagination-info text-muted text-sm">
                Showing page <strong>{profile.submission_history.page}</strong> of{' '}
                <strong>{profile.submission_history.total_pages}</strong> (
                {profile.submission_history.total} total submissions)
              </div>
              <div className="pagination-buttons">
                <button
                  disabled={currentPage <= 1 || loading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary btn-sm"
                  id="btn-prev-page"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                {Array.from({ length: profile.submission_history.total_pages }, (_, i) => i + 1)
                  .filter((p) => {
                    const current = profile.submission_history.page;
                    return p === 1 || p === profile.submission_history.total_pages || Math.abs(p - current) <= 1;
                  })
                  .map((pageNum, idx, arr) => {
                    const prev = arr[idx - 1];
                    return (
                      <React.Fragment key={pageNum}>
                        {prev && pageNum - prev > 1 && <span className="pagination-ellipsis">...</span>}
                        <button
                          className={`btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    );
                  })}
                <button
                  disabled={currentPage >= profile.submission_history.total_pages || loading}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="btn-secondary btn-sm"
                  id="btn-next-page"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtab Content: Best Score Per Problem */}
      {subTab === 'problems' && (
        <div className="card-section best-scores-section">
          <div className="table-responsive">
            <table className="custom-table" id="table-best-scores">
              <thead>
                <tr>
                  <th>Problem</th>
                  <th>Difficulty</th>
                  <th>Best Verdict</th>
                  <th>Best Score</th>
                  <th>Attempts</th>
                  <th>Status</th>
                  <th>Last Attempt</th>
                </tr>
              </thead>
              <tbody>
                {profile && profile.best_scores.length > 0 ? (
                  profile.best_scores.map((prob) => (
                    <tr key={prob.problem_id}>
                      <td className="font-semibold text-primary">
                        <div className="problem-cell">
                          <FileCode size={15} className="text-muted" />
                          <span>{prob.problem_title}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`diff-pill diff-${prob.difficulty.toLowerCase()}`}>
                          {prob.difficulty.toUpperCase()}
                        </span>
                      </td>
                      <td>{renderVerdictBadge(prob.best_verdict)}</td>
                      <td>
                        <span className="score-pill">
                          {Math.round(prob.best_score * 100)}%
                        </span>
                      </td>
                      <td>
                        <span className="attempts-badge">{prob.attempts_count} tries</span>
                      </td>
                      <td>
                        {prob.is_solved ? (
                          <span className="solved-badge">
                            <CheckCircle2 size={13} /> Solved
                          </span>
                        ) : (
                          <span className="attempted-badge">In Progress</span>
                        )}
                      </td>
                      <td className="text-muted text-sm">
                        {new Date(prob.last_attempted_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      No problems attempted yet by this user.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab Content: Contest History */}
      {subTab === 'contests' && (
        <div className="card-section contest-history-section">
          <div className="table-responsive">
            <table className="custom-table" id="table-contest-history">
              <thead>
                <tr>
                  <th>Contest Title</th>
                  <th>Contest Date</th>
                  <th>Final Rank</th>
                  <th>Points Scored</th>
                  <th>Total Participants</th>
                  <th>Joined At</th>
                </tr>
              </thead>
              <tbody>
                {profile && profile.contest_history.length > 0 ? (
                  profile.contest_history.map((contest) => (
                    <tr key={contest.contest_id}>
                      <td className="font-semibold text-primary">
                        <div className="contest-title-cell">
                          <Trophy size={16} className="text-amber" />
                          <span>{contest.contest_title}</span>
                        </div>
                      </td>
                      <td className="text-muted text-sm">
                        {new Date(contest.start_time).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <span
                          className={`rank-badge ${
                            contest.rank === 1
                              ? 'rank-gold'
                              : contest.rank === 2
                              ? 'rank-silver'
                              : contest.rank === 3
                              ? 'rank-bronze'
                              : 'rank-standard'
                          }`}
                        >
                          <Award size={13} /> #{contest.rank}
                        </span>
                      </td>
                      <td>
                        <span className="points-pill font-mono">
                          {contest.total_points} pts
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {contest.total_participants} competitors
                      </td>
                      <td className="text-muted text-sm">
                        {contest.joined_at
                          ? new Date(contest.joined_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      No contest participation recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Code & AI Review Viewer Modal */}
      {selectedSubmission && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedSubmission(null)}
        >
          <div
            className="modal-container submission-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <FileCode size={20} className="text-cyan" />
                <div>
                  <h3 className="modal-title">
                    Submission #{selectedSubmission.id}: {selectedSubmission.problem_title}
                  </h3>
                  <div className="submission-modal-meta">
                    <span className={`lang-badge ${getLangBadgeClass(selectedSubmission.language)}`}>
                      {selectedSubmission.language.toUpperCase()}
                    </span>
                    {renderVerdictBadge(selectedSubmission.verdict)}
                    <span className="text-muted text-xs">
                      {new Date(selectedSubmission.submitted_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedSubmission(null)}
                title="Close"
              >
                &times;
              </button>
            </div>

            <div className="submission-modal-body">
              {/* Code Viewer Panel */}
              <div className="code-viewer-panel">
                <div className="panel-subhead">
                  <span className="panel-subhead-title">Submitted Code</span>
                  <button
                    className="btn-xs btn-secondary"
                    onClick={() => handleCopyCode(selectedSubmission.code)}
                  >
                    {isCopied ? (
                      <>
                        <Check size={12} className="text-emerald" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copy Code
                      </>
                    )}
                  </button>
                </div>
                <div className="modal-monaco-wrapper">
                  <Editor
                    height="320px"
                    language={
                      selectedSubmission.language.toLowerCase().includes('python')
                        ? 'python'
                        : selectedSubmission.language.toLowerCase().includes('cpp')
                        ? 'cpp'
                        : selectedSubmission.language.toLowerCase().includes('c')
                        ? 'c'
                        : selectedSubmission.language.toLowerCase().includes('java')
                        ? 'java'
                        : 'plaintext'
                    }
                    value={selectedSubmission.code}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      scrollBeyondLastLine: false,
                      lineNumbers: 'on',
                    }}
                  />
                </div>
              </div>

              {/* AI Review Breakdown Panel */}
              {selectedSubmission.ai_review && (
                <div className="ai-review-panel">
                  <div className="panel-subhead">
                    <span className="panel-subhead-title flex items-center gap-1">
                      <Sparkles size={14} className="text-cyan" />
                      Gemini AI Code Evaluation
                    </span>
                    <span className="ai-score-banner-badge">
                      Overall Score: {selectedSubmission.ai_review.overall_score.toFixed(1)} / 10
                    </span>
                  </div>

                  <div className="rubric-mini-grid">
                    <div className="rubric-mini-card">
                      <span className="rubric-card-label">Correctness</span>
                      <span className="rubric-card-score">
                        {selectedSubmission.ai_review.correctness} / 10
                      </span>
                    </div>
                    <div className="rubric-mini-card">
                      <span className="rubric-card-label">Readability</span>
                      <span className="rubric-card-score">
                        {selectedSubmission.ai_review.readability} / 10
                      </span>
                    </div>
                    <div className="rubric-mini-card">
                      <span className="rubric-card-label">Efficiency</span>
                      <span className="rubric-card-score">
                        {selectedSubmission.ai_review.efficiency} / 10
                      </span>
                    </div>
                    <div className="rubric-mini-card">
                      <span className="rubric-card-label">Best Practices</span>
                      <span className="rubric-card-score">
                        {selectedSubmission.ai_review.best_practices} / 10
                      </span>
                    </div>
                  </div>

                  {selectedSubmission.ai_review.feedback && (
                    <div className="ai-feedback-box">
                      <div className="ai-feedback-title">Detailed Feedback:</div>
                      <p className="ai-feedback-text">
                        {selectedSubmission.ai_review.feedback}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setSelectedSubmission(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
