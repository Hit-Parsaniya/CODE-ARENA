import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  api,
  type ContestSummary,
  type ContestProblem,
  type ContestInvite,
  type BulkInviteResponse,
  type Problem,
  type AdminTestCase,
  type LeaderboardEntry,
  type ProblemDifficulty,
} from '../services/api';
import type { User } from '../types/auth';
import {
  ShieldAlert,
  ShieldCheck,
  Trophy,
  FileCode,
  Users,
  Plus,
  Trash2,
  Lock,
  Globe,
  Mail,
  RefreshCw,
  Edit3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Send,
  Layers,
  Award,
  Search,
} from 'lucide-react';

interface AdminPanelProps {
  openAuth?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ openAuth }) => {
  const { user, token, isAdmin, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<'contests' | 'problems' | 'rankings' | 'users'>('contests');

  // Notification / Alert Message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // -------------------------------------------------------------------------
  // Contests State
  // -------------------------------------------------------------------------
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loadingContests, setLoadingContests] = useState<boolean>(false);
  const [showCreateContest, setShowCreateContest] = useState<boolean>(false);
  const [contestForm, setContestForm] = useState<{
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    visibility: 'public' | 'private';
    problems: Array<{ problem_id: number; points: number }>;
    initial_problem_id: number | '';
    initial_points: number;
  }>({
    title: '',
    description: '',
    start_time: new Date().toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16),
    visibility: 'public',
    problems: [],
    initial_problem_id: '',
    initial_points: 100,
  });

  // Bulk Invite Manager State
  const [selectedContestForInvites, setSelectedContestForInvites] = useState<ContestSummary | null>(null);
  const [contestInvites, setContestInvites] = useState<ContestInvite[]>([]);
  const [inviteText, setInviteText] = useState<string>('');
  const [bulkInviteSummary, setBulkInviteSummary] = useState<BulkInviteResponse | null>(null);
  const [loadingInvites, setLoadingInvites] = useState<boolean>(false);
  const [submittingInvites, setSubmittingInvites] = useState<boolean>(false);

  // Contest Problem Management State
  const [selectedContestForProblems, setSelectedContestForProblems] = useState<ContestSummary | null>(null);
  const [contestProblems, setContestProblems] = useState<ContestProblem[]>([]);
  const [loadingContestProblems, setLoadingContestProblems] = useState<boolean>(false);
  const [selectedProblemToAttach, setSelectedProblemToAttach] = useState<number | ''>('');
  const [attachPoints, setAttachPoints] = useState<number>(100);
  const [problemFilterQuery, setProblemFilterQuery] = useState<string>('');
  const [attachingProblem, setAttachingProblem] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // Problems State
  // -------------------------------------------------------------------------
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingProblems, setLoadingProblems] = useState<boolean>(false);
  const [showCreateProblem, setShowCreateProblem] = useState<boolean>(false);
  const [editingProblemId, setEditingProblemId] = useState<number | null>(null);
  const [problemForm, setProblemForm] = useState<{
    title: string;
    description: string;
    difficulty: ProblemDifficulty;
    tags: string;
    time_limit_ms: number;
    memory_limit_kb: number;
  }>({
    title: '',
    description: '',
    difficulty: 'easy',
    tags: 'array, math',
    time_limit_ms: 2000,
    memory_limit_kb: 262144,
  });

  // Test Case Manager State
  const [selectedProblemForTestCases, setSelectedProblemForTestCases] = useState<Problem | null>(null);
  const [testCases, setTestCases] = useState<AdminTestCase[]>([]);
  const [loadingTestCases, setLoadingTestCases] = useState<boolean>(false);
  const [newTestCase, setNewTestCase] = useState<{ input: string; expected_output: string; is_sample: boolean }>({
    input: '',
    expected_output: '',
    is_sample: false,
  });

  // -------------------------------------------------------------------------
  // Rankings State
  // -------------------------------------------------------------------------
  const [selectedRankingContestId, setSelectedRankingContestId] = useState<number | null>(null);
  const [rankingLeaderboard, setRankingLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingRanking, setLoadingRanking] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // Users State
  // -------------------------------------------------------------------------
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');

  // -------------------------------------------------------------------------
  // Data Loaders
  // -------------------------------------------------------------------------
  const showNotification = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadContests = async () => {
    if (!token) return;
    setLoadingContests(true);
    try {
      const data = await api.getContests(token);
      setContests(data);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to fetch contests.');
    } finally {
      setLoadingContests(false);
    }
  };

  const loadProblems = async () => {
    setLoadingProblems(true);
    try {
      const data = await api.getProblems();
      setProblems(data);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to fetch problems.');
    } finally {
      setLoadingProblems(false);
    }
  };

  const loadUsers = async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const data = await api.adminListUsers(token);
      setUsersList(data);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to fetch users.');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin && token) {
      loadContests();
      loadProblems();
      loadUsers();
    }
  }, [isAdmin, token]);

  // Load invites for a selected private contest
  const openInviteManager = async (contest: ContestSummary) => {
    if (!token) return;
    setSelectedContestForInvites(contest);
    setInviteText('');
    setBulkInviteSummary(null);
    setLoadingInvites(true);
    try {
      const invites = await api.adminGetContestInvites(contest.id, token);
      setContestInvites(invites);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to load invites.');
    } finally {
      setLoadingInvites(false);
    }
  };

  const handleBulkInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedContestForInvites || !inviteText.trim()) return;

    // Parse textarea into array of emails split by comma, whitespace, or newline
    const parsedEmails = inviteText
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (parsedEmails.length === 0) {
      showNotification('error', 'Please enter at least one valid email address.');
      return;
    }

    setSubmittingInvites(true);
    setBulkInviteSummary(null);

    try {
      const result = await api.adminAddContestInvites(selectedContestForInvites.id, parsedEmails, token);
      setBulkInviteSummary(result);

      // Refresh currently invited list
      const updatedInvites = await api.adminGetContestInvites(selectedContestForInvites.id, token);
      setContestInvites(updatedInvites);

      if (result.added.length > 0) {
        showNotification('success', `Successfully added ${result.added.length} invite(s).`);
      } else if (result.skipped_duplicates.length > 0 || result.invalid.length > 0) {
        showNotification('error', 'No new invites added. Check the status summary below.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to process bulk invites.');
    } finally {
      setSubmittingInvites(false);
    }
  };

  const handleRemoveInvite = async (email: string) => {
    if (!token || !selectedContestForInvites) return;
    try {
      await api.adminRemoveContestInvite(selectedContestForInvites.id, email, token);
      setContestInvites((prev) => prev.filter((i) => i.invited_email !== email));
      showNotification('success', `Removed invite for ${email}.`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to remove invite.');
    }
  };

  // Load testcases for selected problem
  const openTestCaseManager = async (problem: { id: number; title: string }) => {
    if (!token) return;
    setSelectedProblemForTestCases(problem as Problem);
    setLoadingTestCases(true);
    try {
      const cases = await api.adminListProblemTestCases(problem.id, token);
      setTestCases(cases);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to load test cases.');
    } finally {
      setLoadingTestCases(false);
    }
  };

  const handleAddTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedProblemForTestCases) return;
    try {
      const created = await api.adminAddProblemTestCase(selectedProblemForTestCases.id, newTestCase, token);
      setTestCases((prev) => [...prev, created]);
      setNewTestCase({ input: '', expected_output: '', is_sample: false });
      showNotification('success', `Added ${created.is_sample ? 'Sample' : 'Hidden'} testcase #${created.id}`);
      loadProblems();
      if (selectedContestForProblems) {
        loadContestProblems(selectedContestForProblems.id);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to add testcase.');
    }
  };

  const handleDeleteTestCase = async (testCaseId: number) => {
    if (!token || !selectedProblemForTestCases) return;
    try {
      await api.adminDeleteProblemTestCase(selectedProblemForTestCases.id, testCaseId, token);
      setTestCases((prev) => prev.filter((tc) => tc.id !== testCaseId));
      showNotification('success', `Deleted testcase #${testCaseId}`);
      loadProblems();
      if (selectedContestForProblems) {
        loadContestProblems(selectedContestForProblems.id);
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete testcase.');
    }
  };

  // Contest Problems Management Handlers
  const loadContestProblems = async (contestId: number) => {
    if (!token) return;
    setLoadingContestProblems(true);
    try {
      const list = await api.adminGetContestProblems(contestId, token);
      setContestProblems(list);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to load contest problems.');
    } finally {
      setLoadingContestProblems(false);
    }
  };

  const openContestProblemManager = async (contest: ContestSummary) => {
    setSelectedContestForProblems(contest);
    setSelectedProblemToAttach('');
    setAttachPoints(100);
    setProblemFilterQuery('');
    await loadContestProblems(contest.id);
  };

  const handleAttachProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedContestForProblems || !selectedProblemToAttach) return;
    setAttachingProblem(true);
    try {
      await api.adminAttachContestProblem(
        selectedContestForProblems.id,
        { problem_id: Number(selectedProblemToAttach), points: attachPoints },
        token
      );
      showNotification('success', 'Problem attached to contest successfully.');
      setSelectedProblemToAttach('');
      await loadContestProblems(selectedContestForProblems.id);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to attach problem.');
    } finally {
      setAttachingProblem(false);
    }
  };

  const handleRemoveContestProblem = async (problemId: number, title: string) => {
    if (!token || !selectedContestForProblems) return;
    if (!window.confirm(`Are you sure you want to remove problem "${title}" from this contest? (The problem itself will not be deleted)`)) {
      return;
    }
    try {
      await api.adminRemoveContestProblem(selectedContestForProblems.id, problemId, token);
      showNotification('success', `Removed "${title}" from contest.`);
      await loadContestProblems(selectedContestForProblems.id);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to remove problem from contest.');
    }
  };

  // Load ranking
  const loadContestRanking = async (contestId: number) => {
    if (!token) return;
    setSelectedRankingContestId(contestId);
    setLoadingRanking(true);
    try {
      const data = await api.adminGetContestRanking(contestId, token);
      setRankingLeaderboard(data);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to load rankings.');
    } finally {
      setLoadingRanking(false);
    }
  };

  // Contest Actions
  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const payload = {
        title: contestForm.title,
        description: contestForm.description,
        start_time: new Date(contestForm.start_time).toISOString(),
        end_time: new Date(contestForm.end_time).toISOString(),
        visibility: contestForm.visibility,
        problems: [],
      };
      const created = await api.adminCreateContest(payload, token);
      if (contestForm.initial_problem_id) {
        try {
          await api.adminAttachContestProblem(
            created.id,
            { problem_id: Number(contestForm.initial_problem_id), points: Number(contestForm.initial_points) || 100 },
            token
          );
        } catch (attachErr: any) {
          console.error('Failed to attach initial problem:', attachErr);
        }
      }
      showNotification('success', `Contest "${created.title}" created successfully!`);
      setShowCreateContest(false);
      setContestForm({
        title: '',
        description: '',
        start_time: new Date().toISOString().slice(0, 16),
        end_time: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16),
        visibility: 'public',
        problems: [],
        initial_problem_id: '',
        initial_points: 100,
      });
      await loadContests();
      // Redirect straight to "Manage Problems" tab for that contest!
      openContestProblemManager(created);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to create contest.');
    }
  };

  const handleDeleteContest = async (contestId: number, title: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete contest "${title}"? This will cascade-delete all problems, invites, and submissions for this contest.`)) {
      return;
    }
    try {
      await api.adminDeleteContest(contestId, token);
      showNotification('success', `Contest "${title}" deleted.`);
      loadContests();
      if (selectedContestForInvites?.id === contestId) setSelectedContestForInvites(null);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete contest.');
    }
  };

  // Problem Actions
  const handleSaveProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const tagList = problemForm.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const payload = {
        title: problemForm.title,
        description: problemForm.description,
        difficulty: problemForm.difficulty,
        tags: tagList,
        time_limit_ms: Number(problemForm.time_limit_ms),
        memory_limit_kb: Number(problemForm.memory_limit_kb),
      };

      if (editingProblemId) {
        await api.adminUpdateProblem(editingProblemId, payload, token);
        showNotification('success', `Problem updated successfully.`);
      } else {
        await api.adminCreateProblem(payload, token);
        showNotification('success', `Problem "${problemForm.title}" created successfully.`);
      }
      setShowCreateProblem(false);
      setEditingProblemId(null);
      setProblemForm({
        title: '',
        description: '',
        difficulty: 'easy',
        tags: 'array',
        time_limit_ms: 2000,
        memory_limit_kb: 262144,
      });
      loadProblems();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to save problem.');
    }
  };

  const handleDeleteProblem = async (problemId: number, title: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete problem "${title}"?`)) return;
    try {
      await api.adminDeleteProblem(problemId, token);
      showNotification('success', `Problem "${title}" deleted.`);
      loadProblems();
      if (selectedProblemForTestCases?.id === problemId) setSelectedProblemForTestCases(null);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete problem.');
    }
  };

  // User Role Update
  const handleUpdateRole = async (userId: number, currentRole: string, username: string) => {
    if (!token) return;
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Are you sure you want to change role for "${username}" from ${currentRole} to ${newRole}?`)) {
      return;
    }
    try {
      const updated = await api.adminUpdateUserRole(userId, newRole as 'admin' | 'user', token);
      setUsersList((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role, is_admin: updated.is_admin } : u)));
      showNotification('success', `User ${username} role updated to "${newRole}".`);
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update user role.');
    }
  };

  // Access Control Guard
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="admin-access-denied">
        <ShieldAlert size={48} className="text-rose mb-3" />
        <h2>Administrator Access Required</h2>
        <p>You do not have permission to view this section. Please sign in with an administrator account.</p>
        {!isAuthenticated && (
          <button onClick={openAuth} className="btn-primary mt-3">
            Sign In as Admin
          </button>
        )}
      </div>
    );
  }

  const filteredUsers = usersList.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toString() === q;
  });

  return (
    <div className="admin-panel-page">
      <div className="admin-shell-layout">
        {/* Distinct Left Sidebar Navigation */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
            <span className="admin-badge-privilege">
              <ShieldCheck size={14} /> Privileged Access
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.65rem', marginBottom: '0.25rem' }}>
              Admin Portal
            </h2>
            <p className="text-xs text-muted">
              Signed in as <strong>{user?.username}</strong>
            </p>
          </div>

          <nav className="admin-sidebar-nav" aria-label="Admin Navigation">
            <button
              type="button"
              className={`admin-nav-item ${activeTab === 'contests' ? 'active' : ''}`}
              onClick={() => setActiveTab('contests')}
              id="admin-tab-contests"
            >
              <Trophy size={16} />
              <span>Contests Orchestration</span>
              <span className="tab-badge" style={{ marginLeft: 'auto' }}>{contests.length}</span>
            </button>
            <button
              type="button"
              className={`admin-nav-item ${activeTab === 'problems' ? 'active' : ''}`}
              onClick={() => setActiveTab('problems')}
              id="admin-tab-problems"
            >
              <FileCode size={16} />
              <span>Problem Library</span>
              <span className="tab-badge" style={{ marginLeft: 'auto' }}>{problems.length}</span>
            </button>
            <button
              type="button"
              className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
              id="admin-tab-users"
            >
              <Users size={16} />
              <span>User Roles & Access</span>
              <span className="tab-badge" style={{ marginLeft: 'auto' }}>{usersList.length}</span>
            </button>
            <button
              type="button"
              className={`admin-nav-item ${activeTab === 'rankings' ? 'active' : ''}`}
              onClick={() => setActiveTab('rankings')}
              id="admin-tab-rankings"
            >
              <Award size={16} />
              <span>Platform Rankings</span>
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="admin-main-panel">
          {/* Notifications */}
          {message && (
            <div className={`admin-notification ${message.type}`}>
              {message.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              <span>{message.text}</span>
              <button className="close-alert-btn" onClick={() => setMessage(null)}>&times;</button>
            </div>
          )}

      {/* =====================================================================
          TAB 1: CONTESTS & PRIVATE INVITES
          ===================================================================== */}
      {activeTab === 'contests' && (
        <div className="admin-section-content">
          {selectedContestForProblems ? (
            /* =================================================================
               CONTEST PROBLEM MANAGEMENT VIEW
               ================================================================= */
            <div className="contest-problem-manager-view" id="contest-problem-manager-view">
              {/* Top Navigation & Controls */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  className="btn-secondary btn-sm flex items-center gap-1.5"
                  onClick={() => setSelectedContestForProblems(null)}
                  id="btn-back-to-contests"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Contests List</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary btn-sm flex items-center gap-1"
                    onClick={() => loadContestProblems(selectedContestForProblems.id)}
                    disabled={loadingContestProblems}
                    title="Refresh attached problems"
                  >
                    <RefreshCw size={13} className={loadingContestProblems ? 'spin' : ''} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Contest Detail Header Card */}
              <div className="contest-detail-header-card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted">Contest #{selectedContestForProblems.id}</span>
                      {selectedContestForProblems.visibility === 'private' ? (
                        <span className="visibility-badge private">
                          <Lock size={12} /> Private
                        </span>
                      ) : (
                        <span className="visibility-badge public">
                          <Globe size={12} /> Public
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-primary">{selectedContestForProblems.title}</h2>
                    <p className="text-sm text-secondary mt-1">{selectedContestForProblems.description}</p>
                  </div>
                  <div className="text-right text-xs text-secondary flex flex-col gap-1">
                    <div><span className="text-muted">Start:</span> {new Date(selectedContestForProblems.start_time).toLocaleString()}</div>
                    <div><span className="text-muted">End:</span> {new Date(selectedContestForProblems.end_time).toLocaleString()}</div>
                    <div className="font-semibold text-primary mt-1">
                      {contestProblems.length} Problem{contestProblems.length === 1 ? '' : 's'} Attached
                    </div>
                  </div>
                </div>
              </div>

              {/* Contest Readiness Banners */}
              {(() => {
                const unreadyProblems = contestProblems.filter((cp) => !cp.is_ready);
                const totalProblems = contestProblems.length;

                if (totalProblems === 0) {
                  return (
                    <div className="contest-readiness-info-banner" id="banner-contest-empty">
                      <div className="flex items-center gap-2 font-semibold text-cyan mb-1">
                        <AlertCircle size={17} />
                        <span>No Problems Attached Yet</span>
                      </div>
                      <p className="text-xs text-secondary">
                        This contest is currently empty. Attach existing problems or author new problems below.
                        Remember: every problem must have at least <strong>3 hidden test cases</strong> before students can solve it.
                      </p>
                    </div>
                  );
                }

                if (unreadyProblems.length > 0) {
                  return (
                    <div className="contest-readiness-warning-banner" id="banner-contest-not-ready">
                      <div className="flex items-center gap-2 font-bold text-amber mb-1.5">
                        <AlertTriangle size={18} />
                        <span>Contest Problem Readiness Warning: {unreadyProblems.length} Problem{unreadyProblems.length > 1 ? 's' : ''} Not Ready</span>
                      </div>
                      <p className="text-xs text-secondary mb-3">
                        Students and participants will <strong>not be able to submit solutions</strong> or access code editors for problems that have fewer than 3 hidden test cases. Click any problem below to add test cases now:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {unreadyProblems.map((cp) => (
                          <button
                            key={cp.problem_id}
                            type="button"
                            className="btn-outline-warning flex items-center gap-1.5"
                            onClick={() => openTestCaseManager({ id: cp.problem_id, title: cp.title })}
                            id={`btn-fix-testcases-${cp.problem_id}`}
                          >
                            <AlertCircle size={12} />
                            <span>{cp.title} ({cp.hidden_test_cases_count || 0}/3 hidden test cases) — Add Cases</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="contest-readiness-success-banner" id="banner-contest-all-ready">
                    <div className="flex items-center gap-2 font-bold text-emerald">
                      <CheckCircle2 size={18} />
                      <span>All Attached Problems Are Ready! (3+ hidden test cases verified)</span>
                    </div>
                    <p className="text-xs text-secondary mt-1">
                      Every attached problem has satisfied the sandbox test suite requirements. Contestants will have full access to solve and submit.
                    </p>
                  </div>
                );
              })()}

              {/* Attach Existing Problem */}
              <div className="contest-action-card mb-6">
                <div className="contest-action-card-title">
                  <Layers size={16} className="text-cyan" />
                  <span>Attach Problem to Contest</span>
                </div>
                <p className="text-xs text-secondary">
                  Select an already-authored problem from your library and assign contest points to it.
                </p>

                <form onSubmit={handleAttachProblem} className="flex flex-col gap-3 mt-1">
                  <div>
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
                      <input
                        type="text"
                        placeholder="Filter problem library by title or tag..."
                        value={problemFilterQuery}
                        onChange={(e) => setProblemFilterQuery(e.target.value)}
                        className="admin-input text-xs pl-8"
                        id="input-filter-existing-problems"
                      />
                    </div>
                    <select
                      required
                      value={selectedProblemToAttach}
                      onChange={(e) => setSelectedProblemToAttach(e.target.value ? Number(e.target.value) : '')}
                      className="admin-input text-xs"
                      id="select-existing-problem"
                    >
                      <option value="">-- Choose a Problem to Attach --</option>
                      {problems
                        .filter((p) => {
                          const alreadyAttached = contestProblems.some((cp) => cp.problem_id === p.id);
                          if (alreadyAttached) return false;
                          if (!problemFilterQuery.trim()) return true;
                          const q = problemFilterQuery.toLowerCase();
                          return (
                            p.title.toLowerCase().includes(q) ||
                            (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
                          );
                        })
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.id} {p.title} ({p.difficulty}) — {p.hidden_test_cases_count || 0}/3 hidden cases {p.is_ready ? '✓ Ready' : '⚠ Not Ready'}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted block mb-1">Contest Points</label>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        step="10"
                        required
                        value={attachPoints}
                        onChange={(e) => setAttachPoints(parseInt(e.target.value, 10) || 100)}
                        className="admin-input text-xs"
                        id="input-attach-points"
                      />
                    </div>
                    <div className="self-end">
                      <button
                        type="submit"
                        className="btn-primary btn-sm flex items-center gap-1.5"
                        disabled={!selectedProblemToAttach || attachingProblem}
                        id="btn-confirm-attach-problem"
                      >
                        <Plus size={14} />
                        <span>{attachingProblem ? 'Attaching...' : 'Attach to Contest'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Attached Problems Table */}
              <div className="card-section">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-primary text-sm flex items-center gap-2">
                    <FileCode size={15} className="text-cyan" />
                    <span>Attached Problems ({contestProblems.length})</span>
                  </h3>
                  <span className="text-xs text-muted">
                    Each problem must have 3+ hidden test cases before contest launch.
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="custom-table" id="table-contest-problems">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Problem Name</th>
                        <th>Difficulty</th>
                        <th>Points</th>
                        <th>Readiness Status</th>
                        <th>Test Cases</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contestProblems.length > 0 ? (
                        contestProblems.map((cp) => (
                          <tr key={cp.problem_id} id={`row-contest-problem-${cp.problem_id}`}>
                            <td className="font-mono text-muted">#{cp.problem_id}</td>
                            <td className="font-semibold text-primary">{cp.title}</td>
                            <td>
                              <span className={`difficulty-badge ${cp.difficulty}`}>
                                {cp.difficulty}
                              </span>
                            </td>
                            <td>
                              <span className="points-badge">
                                <Award size={11} /> {cp.points} pts
                              </span>
                            </td>
                            <td>
                              {cp.is_ready ? (
                                <span className="status-badge-ready" id={`badge-ready-${cp.problem_id}`}>
                                  <CheckCircle2 size={13} />
                                  Ready ({cp.hidden_test_cases_count} hidden)
                                </span>
                              ) : (
                                <span className="status-badge-not-ready" id={`badge-not-ready-${cp.problem_id}`}>
                                  <AlertCircle size={13} />
                                  {cp.hidden_test_cases_count || 0}/3 hidden test cases — not ready
                                </span>
                              )}
                            </td>
                            <td className="text-sm text-secondary">
                              <span className="font-mono">{cp.test_cases_count || 0}</span> total cases
                            </td>
                            <td className="text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  className="btn-xs btn-primary flex items-center gap-1"
                                  onClick={() => openTestCaseManager({ id: cp.problem_id, title: cp.title })}
                                  id={`btn-manage-tc-${cp.problem_id}`}
                                  title="Manage test cases for this problem"
                                >
                                  <FileCode size={12} />
                                  <span>Manage Test Cases</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-xs btn-danger"
                                  onClick={() => handleRemoveContestProblem(cp.problem_id, cp.title)}
                                  id={`btn-remove-cp-${cp.problem_id}`}
                                  title="Remove problem from contest"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="table-empty">
                            No problems attached to this contest yet. Use the options above to attach or create problems.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* =================================================================
               DEFAULT CONTEST LIST VIEW
               ================================================================= */
            <>
              <div className="section-toolbar">
                <h2>Contest Management</h2>
                <div className="flex gap-2">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => setShowCreateContest(!showCreateContest)}
                    id="btn-admin-new-contest"
                  >
                    <Plus size={15} />
                    {showCreateContest ? 'Cancel Form' : 'Create New Contest'}
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={loadContests}
                    disabled={loadingContests}
                    title="Refresh contests"
                  >
                    <RefreshCw size={14} className={loadingContests ? 'spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Create Contest Form */}
              {showCreateContest && (
                <form onSubmit={handleCreateContest} className="admin-form-card" id="form-create-contest">
                  <h3 className="form-card-title">Create Contest Shell</h3>
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Contest Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Weekly Speed Contest #4"
                        value={contestForm.title}
                        onChange={(e) => setContestForm({ ...contestForm, title: e.target.value })}
                        className="admin-input"
                        id="input-contest-title"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Description</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Contest instructions and problem set details..."
                        value={contestForm.description}
                        onChange={(e) => setContestForm({ ...contestForm, description: e.target.value })}
                        className="admin-input"
                        id="input-contest-description"
                      />
                    </div>
                    <div className="form-group">
                      <label>Start Time</label>
                      <input
                        type="datetime-local"
                        required
                        value={contestForm.start_time}
                        onChange={(e) => setContestForm({ ...contestForm, start_time: e.target.value })}
                        className="admin-input"
                        id="input-contest-start-time"
                      />
                    </div>
                    <div className="form-group">
                      <label>End Time</label>
                      <input
                        type="datetime-local"
                        required
                        value={contestForm.end_time}
                        onChange={(e) => setContestForm({ ...contestForm, end_time: e.target.value })}
                        className="admin-input"
                        id="input-contest-end-time"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Visibility</label>
                      <div className="visibility-radio-group">
                        <label className={`radio-card ${contestForm.visibility === 'public' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="visibility"
                            value="public"
                            checked={contestForm.visibility === 'public'}
                            onChange={() => setContestForm({ ...contestForm, visibility: 'public' })}
                          />
                          <Globe size={18} className="text-cyan" />
                          <div>
                            <strong>Public</strong>
                            <p>Visible to all registered users and visitors on Code Arena</p>
                          </div>
                        </label>
                        <label className={`radio-card ${contestForm.visibility === 'private' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="visibility"
                            value="private"
                            checked={contestForm.visibility === 'private'}
                            onChange={() => setContestForm({ ...contestForm, visibility: 'private' })}
                          />
                          <Lock size={18} className="text-amber" />
                          <div>
                            <strong>Private / Invite-Only</strong>
                            <p>Completely hidden (404) except to invited emails and admins</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Attach Initial Problem (Optional)</label>
                      <select
                        value={contestForm.initial_problem_id}
                        onChange={(e) => setContestForm({ ...contestForm, initial_problem_id: e.target.value ? Number(e.target.value) : '' })}
                        className="admin-input"
                        id="select-initial-problem"
                      >
                        <option value="">None (attach later in Contest Problem Manager)</option>
                        {problems.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.id} - {p.title} ({p.difficulty}) {p.is_ready ? '✓ Ready' : '⚠ Needs Test Cases'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {contestForm.initial_problem_id && (
                      <div className="form-group">
                        <label>Initial Problem Points</label>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={contestForm.initial_points}
                          onChange={(e) => setContestForm({ ...contestForm, initial_points: Number(e.target.value) })}
                          className="admin-input"
                          id="input-initial-problem-points"
                        />
                      </div>
                    )}

                    <div className="form-group full-width">
                      <div style={{ padding: '0.65rem 0.9rem', background: 'rgba(6, 182, 212, 0.08)', borderRadius: '6px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                        <p className="text-xs text-secondary flex items-center gap-1.5 m-0">
                          <span className="text-cyan font-bold">ℹ Note:</span> Test cases belong to Problems, not Contests directly. Creating this contest will immediately guide you to attach problems and manage their test cases.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowCreateContest(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" id="btn-submit-create-contest">
                      Create Contest & Manage Problems →
                    </button>
                  </div>
                </form>
              )}

              {/* Contests Table */}
              <div className="card-section">
                <div className="table-responsive">
                  <table className="custom-table" id="admin-table-contests">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Visibility</th>
                        <th>Schedule</th>
                        <th>Invited Emails</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contests.length > 0 ? (
                        contests.map((c) => (
                          <tr key={c.id}>
                            <td className="font-mono text-muted">#{c.id}</td>
                            <td className="font-semibold text-primary">
                              <div className="flex flex-col">
                                <span>{c.title}</span>
                                <span className="text-muted text-xs">{c.description}</span>
                              </div>
                            </td>
                            <td>
                              {c.visibility === 'private' ? (
                                <span className="visibility-badge private">
                                  <Lock size={12} /> Private
                                </span>
                              ) : (
                                <span className="visibility-badge public">
                                  <Globe size={12} /> Public
                                </span>
                              )}
                            </td>
                            <td className="text-sm text-secondary">
                              <div><span className="text-muted">Start:</span> {new Date(c.start_time).toLocaleString()}</div>
                              <div><span className="text-muted">End:</span> {new Date(c.end_time).toLocaleString()}</div>
                            </td>
                            <td>
                              {c.visibility === 'private' ? (
                                <button
                                  className="btn-xs btn-secondary flex items-center gap-1"
                                  onClick={() => openInviteManager(c)}
                                >
                                  <Mail size={12} />
                                  <span>Manage Invites</span>
                                </button>
                              ) : (
                                <span className="text-muted text-xs">All Users Allowed</span>
                              )}
                            </td>
                            <td className="text-right">
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  className="btn-xs btn-primary flex items-center gap-1"
                                  onClick={() => openContestProblemManager(c)}
                                  id={`btn-manage-problems-${c.id}`}
                                  title="Manage attached problems and test cases"
                                >
                                  <Layers size={12} />
                                  <span>Manage Problems</span>
                                </button>
                                <button
                                  className="btn-xs btn-danger"
                                  onClick={() => handleDeleteContest(c.id, c.title)}
                                  title="Delete contest"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="table-empty">
                            No contests created yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Private Contest Invites Modal */}
          {selectedContestForInvites && (
            <div className="modal-overlay" onClick={() => setSelectedContestForInvites(null)}>
              <div className="modal-container invite-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
                <div className="modal-header">
                  <div className="flex items-center gap-2">
                    <Lock size={18} className="text-amber" />
                    <h3 className="modal-title">
                      Private Invites: {selectedContestForInvites.title}
                    </h3>
                  </div>
                  <button className="modal-close-btn" onClick={() => setSelectedContestForInvites(null)}>
                    &times;
                  </button>
                </div>

                <div className="invite-modal-body">
                  <p className="text-sm text-secondary mb-3">
                    Only users with the email addresses below can discover, access, and submit solutions to this contest.
                  </p>

                  <form onSubmit={handleBulkInvite} className="bulk-invite-form">
                    <label className="form-label-bold text-xs uppercase text-muted mb-1 block">
                      Bulk Email Input (Comma, Space, or Newline separated)
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder={`Paste multiple email addresses...\ne.g.\nalice@example.com, bob@example.com\ncharlie@codearena.com\ndavid@univ.edu`}
                      value={inviteText}
                      onChange={(e) => setInviteText(e.target.value)}
                      className="admin-input bulk-email-textarea"
                      id="textarea-bulk-invite-emails"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted">
                        Supports pasting from spreadsheets, CSVs, or text lists.
                      </span>
                      <div className="flex gap-2">
                        {inviteText && (
                          <button
                            type="button"
                            className="btn-xs btn-secondary"
                            onClick={() => setInviteText('')}
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="submit"
                          className="btn-primary btn-sm flex items-center gap-1"
                          id="btn-submit-bulk-invites"
                          disabled={submittingInvites || !inviteText.trim()}
                        >
                          {submittingInvites ? (
                            <>
                              <RefreshCw size={13} className="spin" /> Processing...
                            </>
                          ) : (
                            <>
                              <Send size={13} /> Add Invites
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* 3 Summary Sections: Added (Green), Already Invited (Gray), Invalid Format (Red) */}
                  {bulkInviteSummary && (
                    <div className="bulk-summary-container" id="bulk-invite-results">
                      <div className="bulk-summary-header">
                        <h4 className="text-xs uppercase font-bold text-secondary">
                          Last Invite Batch Result
                        </h4>
                        <button
                          type="button"
                          className="text-xs text-muted hover:underline"
                          onClick={() => setBulkInviteSummary(null)}
                        >
                          Dismiss
                        </button>
                      </div>

                      <div className="bulk-summary-grid">
                        {/* 1. Added (Green) */}
                        <div className="summary-card added-card">
                          <div className="summary-card-header text-emerald">
                            <CheckCircle2 size={14} />
                            <strong>Added ({bulkInviteSummary.added.length})</strong>
                          </div>
                          {bulkInviteSummary.added.length > 0 ? (
                            <div className="summary-chips-wrap">
                              {bulkInviteSummary.added.map((em, idx) => (
                                <span key={idx} className="summary-chip chip-added font-mono">
                                  {em}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="summary-empty-text">None</p>
                          )}
                        </div>

                        {/* 2. Already Invited / Skipped (Gray) */}
                        <div className="summary-card duplicate-card">
                          <div className="summary-card-header text-muted">
                            <AlertCircle size={14} />
                            <strong>Already Invited ({bulkInviteSummary.skipped_duplicates.length})</strong>
                          </div>
                          {bulkInviteSummary.skipped_duplicates.length > 0 ? (
                            <div className="summary-chips-wrap">
                              {bulkInviteSummary.skipped_duplicates.map((em, idx) => (
                                <span key={idx} className="summary-chip chip-duplicate font-mono">
                                  {em}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="summary-empty-text">None</p>
                          )}
                        </div>

                        {/* 3. Invalid Format (Red) */}
                        <div className="summary-card invalid-card">
                          <div className="summary-card-header text-rose">
                            <XCircle size={14} />
                            <strong>Invalid Format ({bulkInviteSummary.invalid.length})</strong>
                          </div>
                          {bulkInviteSummary.invalid.length > 0 ? (
                            <div className="summary-chips-wrap">
                              {bulkInviteSummary.invalid.map((em, idx) => (
                                <span key={idx} className="summary-chip chip-invalid font-mono">
                                  {em}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="summary-empty-text">None</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Current Invited List with Remove Button */}
                  <div className="invites-list-wrap mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs uppercase font-bold text-muted">
                        Currently Invited Emails ({contestInvites.length})
                      </h4>
                      {contestInvites.length > 0 && (
                        <span className="text-xs text-secondary font-mono">
                          {contestInvites.length} registered invite{contestInvites.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    {loadingInvites ? (
                      <div className="loading-state">
                        <RefreshCw size={16} className="spin" /> Loading invites...
                      </div>
                    ) : contestInvites.length > 0 ? (
                      <div className="invites-tags-grid">
                        {contestInvites.map((inv) => (
                          <div key={inv.invited_email} className="invite-email-tag">
                            <Mail size={13} className="text-cyan" />
                            <span className="font-mono text-xs">{inv.invited_email}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveInvite(inv.invited_email)}
                              className="remove-invite-btn"
                              title={`Remove ${inv.invited_email}`}
                            >
                              <Trash2 size={12} />
                              <span className="text-xs">Remove</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted text-sm italic py-2">
                        No emails invited yet. Paste emails above to grant access.
                      </p>
                    )}
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="btn-secondary" onClick={() => setSelectedContestForInvites(null)}>
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: PROBLEMS & TEST CASES
          ===================================================================== */}
      {activeTab === 'problems' && (
        <div className="admin-section-content">
          <div className="section-toolbar">
            <h2>Problem Authoring & Test Case Management</h2>
            <div className="flex gap-2">
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  setEditingProblemId(null);
                  setProblemForm({
                    title: '',
                    description: '',
                    difficulty: 'easy',
                    tags: 'array',
                    time_limit_ms: 2000,
                    memory_limit_kb: 262144,
                  });
                  setShowCreateProblem(!showCreateProblem);
                }}
                id="btn-admin-new-problem"
              >
                <Plus size={15} />
                {showCreateProblem ? 'Cancel Form' : 'Author New Problem'}
              </button>
              <button
                className="btn-secondary btn-sm"
                onClick={loadProblems}
                disabled={loadingProblems}
                title="Refresh problems"
              >
                <RefreshCw size={14} className={loadingProblems ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {/* Problem Create/Edit Form */}
          {showCreateProblem && (
            <form onSubmit={handleSaveProblem} className="admin-form-card">
              <h3 className="form-card-title">
                {editingProblemId ? `Edit Problem #${editingProblemId}` : 'Create New Problem'}
              </h3>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Problem Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Reverse Linked List"
                    value={problemForm.title}
                    onChange={(e) => setProblemForm({ ...problemForm, title: e.target.value })}
                    className="admin-input"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Problem Description (Markdown supported)</label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Detailed problem description, constraints, and examples..."
                    value={problemForm.description}
                    onChange={(e) => setProblemForm({ ...problemForm, description: e.target.value })}
                    className="admin-input"
                  />
                </div>
                <div className="form-group">
                  <label>Difficulty</label>
                  <select
                    value={problemForm.difficulty}
                    onChange={(e) => setProblemForm({ ...problemForm, difficulty: e.target.value as ProblemDifficulty })}
                    className="admin-input"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="array, dynamic-programming, math"
                    value={problemForm.tags}
                    onChange={(e) => setProblemForm({ ...problemForm, tags: e.target.value })}
                    className="admin-input"
                  />
                </div>
                <div className="form-group">
                  <label>CPU Time Limit (ms)</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={problemForm.time_limit_ms}
                    onChange={(e) => setProblemForm({ ...problemForm, time_limit_ms: parseInt(e.target.value, 10) || 2000 })}
                    className="admin-input"
                  />
                </div>
                <div className="form-group">
                  <label>Memory Limit (KB)</label>
                  <input
                    type="number"
                    min="16384"
                    max="1048576"
                    step="16384"
                    value={problemForm.memory_limit_kb}
                    onChange={(e) => setProblemForm({ ...problemForm, memory_limit_kb: parseInt(e.target.value, 10) || 262144 })}
                    className="admin-input"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCreateProblem(false);
                    setEditingProblemId(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingProblemId ? 'Save Changes' : 'Create Problem'}
                </button>
              </div>
            </form>
          )}

          {/* Problems List Table */}
          <div className="card-section">
            <div className="table-responsive">
              <table className="custom-table" id="admin-table-problems">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Difficulty</th>
                    <th>Tags</th>
                    <th>Limits</th>
                    <th>Test Cases</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {problems.length > 0 ? (
                    problems.map((p) => (
                      <tr key={p.id}>
                        <td className="font-mono text-muted">#{p.id}</td>
                        <td className="font-semibold text-primary">{p.title}</td>
                        <td>
                          {p.is_ready ? (
                            <span className="status-badge-ready" id={`status-ready-${p.id}`}>
                              <CheckCircle2 size={13} />
                              Ready (3+ hidden test cases)
                            </span>
                          ) : (
                            <span className="status-badge-not-ready" id={`status-not-ready-${p.id}`}>
                              <AlertCircle size={13} />
                              {`${p.hidden_test_cases_count ?? 0}/3 hidden test cases added — not yet visible to students`}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`diff-pill diff-${p.difficulty.toLowerCase()}`}>
                            {p.difficulty.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {p.tags?.map((t) => (
                              <span key={t} className="tag-badge-sm">
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="text-xs text-muted">
                          <div>{p.time_limit_ms}ms</div>
                          <div>{Math.round(p.memory_limit_kb / 1024)}MB</div>
                        </td>
                        <td>
                          <button
                            className="btn-xs btn-secondary flex items-center gap-1"
                            onClick={() => openTestCaseManager(p)}
                          >
                            <Layers size={13} />
                            <span>Manage Testcases</span>
                          </button>
                        </td>
                        <td className="text-right">
                          <div className="flex gap-1 justify-end">
                            <button
                              className="btn-xs btn-ghost"
                              onClick={() => {
                                setEditingProblemId(p.id);
                                setProblemForm({
                                  title: p.title,
                                  description: p.description,
                                  difficulty: p.difficulty,
                                  tags: p.tags?.join(', ') || '',
                                  time_limit_ms: p.time_limit_ms,
                                  memory_limit_kb: p.memory_limit_kb,
                                });
                                setShowCreateProblem(true);
                              }}
                              title="Edit problem"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              className="btn-xs btn-danger"
                              onClick={() => handleDeleteProblem(p.id, p.title)}
                              title="Delete problem"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="table-empty">
                        No problems authored yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: AUTHORITATIVE RANKINGS
          ===================================================================== */}
      {activeTab === 'rankings' && (
        <div className="admin-section-content">
          <div className="section-toolbar">
            <h2>Authoritative Contest Leaderboard</h2>
            <div className="flex items-center gap-3">
              <select
                className="admin-input"
                value={selectedRankingContestId || ''}
                onChange={(e) => {
                  const cid = parseInt(e.target.value, 10);
                  if (cid) loadContestRanking(cid);
                }}
                id="select-admin-ranking-contest"
              >
                <option value="">Select a Contest...</option>
                {contests.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} {c.title} ({(c.visibility || 'public').toUpperCase()})
                  </option>
                ))}
              </select>
              {selectedRankingContestId && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => loadContestRanking(selectedRankingContestId)}
                  disabled={loadingRanking}
                  title="Refresh ranking"
                >
                  <RefreshCw size={14} className={loadingRanking ? 'spin' : ''} />
                </button>
              )}
            </div>
          </div>

          {selectedRankingContestId ? (
            <div className="card-section">
              <div className="table-responsive">
                <table className="custom-table" id="admin-table-ranking">
                  <thead>
                    <tr>
                      <th>Official Rank</th>
                      <th>User ID</th>
                      <th>Username</th>
                      <th>Total Points</th>
                      <th>Score Reached At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingRanking ? (
                      <tr>
                        <td colSpan={5} className="table-empty">
                          <RefreshCw size={18} className="spin inline mr-2" />
                          Loading authoritative leaderboard...
                        </td>
                      </tr>
                    ) : rankingLeaderboard.length > 0 ? (
                      rankingLeaderboard.map((row) => (
                        <tr key={row.user_id}>
                          <td>
                            <span
                              className={`rank-badge ${
                                row.rank === 1
                                  ? 'rank-gold'
                                  : row.rank === 2
                                  ? 'rank-silver'
                                  : row.rank === 3
                                  ? 'rank-bronze'
                                  : 'rank-standard'
                              }`}
                            >
                              <Award size={13} /> #{row.rank}
                            </span>
                          </td>
                          <td className="font-mono text-muted">#{row.user_id}</td>
                          <td className="font-semibold text-primary">{row.username}</td>
                          <td>
                            <span className="points-pill font-mono">{row.total_points} pts</span>
                          </td>
                          <td className="text-muted text-sm">
                            {row.reached_score_at ? new Date(row.reached_score_at).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="table-empty">
                          No submissions or participants recorded for this contest yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty-chart-state">
              <Trophy size={36} className="text-muted opacity-50 mb-2" />
              <h4>Select a Contest Above</h4>
              <p>Choose any contest to inspect its authoritative leaderboard and scoring timestamps.</p>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: USER ROLES & ACCESS
          ===================================================================== */}
      {activeTab === 'users' && (
        <div className="admin-section-content">
          <div className="section-toolbar">
            <h2>User Role & Access Management</h2>
            <div className="flex items-center gap-2">
              <div className="search-input-wrap">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="profile-search-input"
                />
              </div>
              <button
                className="btn-secondary btn-sm"
                onClick={loadUsers}
                disabled={loadingUsers}
                title="Refresh users"
              >
                <RefreshCw size={14} className={loadingUsers ? 'spin' : ''} />
              </button>
            </div>
          </div>

          <div className="card-section">
            <div className="table-responsive">
              <table className="custom-table" id="admin-table-users">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Username</th>
                    <th>Email Address</th>
                    <th>Current Role</th>
                    <th>Joined Date</th>
                    <th className="text-right">Role Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td className="font-mono text-muted">#{u.id}</td>
                        <td className="font-semibold text-primary">
                          <div className="flex items-center gap-2">
                            <span>{u.username}</span>
                            {u.id === user?.id && <span className="badge-self">You</span>}
                          </div>
                        </td>
                        <td className="text-secondary text-sm">{u.email}</td>
                        <td>
                          {u.role === 'admin' || u.is_admin ? (
                            <span className="role-pill-admin">
                              <ShieldCheck size={12} /> ADMIN
                            </span>
                          ) : (
                            <span className="role-pill-user">USER</span>
                          )}
                        </td>
                        <td className="text-muted text-sm">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="text-right">
                          {u.id !== user?.id ? (
                            <button
                              className={`btn-xs ${u.role === 'admin' ? 'btn-danger' : 'btn-primary'}`}
                              onClick={() => handleUpdateRole(u.id, u.role || (u.is_admin ? 'admin' : 'user'), u.username)}
                            >
                              {u.role === 'admin' || u.is_admin ? 'Demote to User' : 'Promote to Admin'}
                            </button>
                          ) : (
                            <span className="text-muted text-xs italic">Current Session</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        {loadingUsers ? 'Loading users...' : 'No users found matching query.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>

      {/* Test Case Manager Modal (Accessible from any tab: Problems, Contests, etc.) */}
      {selectedProblemForTestCases && (
        <div className="modal-overlay" onClick={() => setSelectedProblemForTestCases(null)}>
          <div className="modal-container testcase-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="flex items-center gap-2">
                  <FileCode size={18} className="text-cyan" />
                  <h3 className="modal-title">
                    Test Cases: #{selectedProblemForTestCases.id} {selectedProblemForTestCases.title}
                  </h3>
                </div>
                <div className="mt-1">
                  {testCases.filter((tc) => !tc.is_sample).length >= 3 ? (
                    <span className="status-badge-ready" id={`modal-status-ready-${selectedProblemForTestCases.id}`}>
                      <CheckCircle2 size={13} />
                      Ready (3+ hidden test cases)
                    </span>
                  ) : (
                    <span className="status-badge-not-ready" id={`modal-status-not-ready-${selectedProblemForTestCases.id}`}>
                      <AlertCircle size={13} />
                      {`${testCases.filter((tc) => !tc.is_sample).length}/3 hidden test cases added — not yet visible to students`}
                    </span>
                  )}
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedProblemForTestCases(null)}>
                &times;
              </button>
            </div>

            <div className="testcase-modal-body">
              {/* Add New Testcase Form */}
              <form onSubmit={handleAddTestCase} className="add-testcase-card">
                <h4 className="text-xs uppercase font-bold text-secondary mb-2">Add New Test Case</h4>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="text-xs text-muted mb-1 block">Standard Input (stdin)</label>
                    <textarea
                      rows={3}
                      placeholder="Input passed to user code..."
                      value={newTestCase.input}
                      onChange={(e) => setNewTestCase({ ...newTestCase, input: e.target.value })}
                      className="admin-input text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">Expected Output (stdout)</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Exact expected stdout..."
                      value={newTestCase.expected_output}
                      onChange={(e) => setNewTestCase({ ...newTestCase, expected_output: e.target.value })}
                      className="admin-input text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={newTestCase.is_sample}
                      onChange={(e) => setNewTestCase({ ...newTestCase, is_sample: e.target.checked })}
                    />
                    <span>Is Sample Case (Sample cases are visible to users in problem statement)</span>
                  </label>
                  <button type="submit" className="btn-primary btn-sm">
                    <Plus size={14} /> Add Test Case
                  </button>
                </div>
              </form>

              {/* List of Test Cases */}
              <div className="testcases-list-section">
                <h4 className="text-xs uppercase font-bold text-muted mb-2">
                  Configured Test Cases ({testCases.length})
                </h4>
                {loadingTestCases ? (
                  <div className="loading-state">
                    <RefreshCw size={16} className="spin" /> Loading test cases...
                  </div>
                ) : testCases.length > 0 ? (
                  <div className="testcases-grid">
                    {testCases.map((tc, index) => (
                      <div key={tc.id} className="testcase-item-card">
                        <div className="testcase-item-header">
                          <span className="font-mono text-xs font-bold text-primary">
                            #{tc.id} (Case {index + 1})
                          </span>
                          {tc.is_sample ? (
                            <span className="tc-sample-badge">Sample (Public)</span>
                          ) : (
                            <span className="tc-hidden-badge">Hidden Sandbox Test</span>
                          )}
                          <button
                            type="button"
                            className="btn-xs btn-danger ml-auto"
                            onClick={() => handleDeleteTestCase(tc.id)}
                            title="Delete testcase"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="testcase-data-preview">
                          <div>
                            <span className="tc-label">Input:</span>
                            <pre className="tc-pre">{tc.input || '(empty input)'}</pre>
                          </div>
                          <div>
                            <span className="tc-label">Expected:</span>
                            <pre className="tc-pre">{tc.expected_output}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted text-sm italic">
                    No test cases added yet. Submissions cannot be evaluated without test cases.
                  </p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedProblemForTestCases(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
