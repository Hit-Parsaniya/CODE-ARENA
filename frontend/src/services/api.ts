import { API_BASE_URL } from '../config';
import type { SignupPayload, LoginPayload, TokenResponse, User } from '../types/auth';

export type RunStage = 'compile' | 'runtime' | 'success';
export type SupportedLanguage = 'python' | 'c' | 'cpp' | 'java';

export interface RunRequest {
  language: string;
  code: string;
  stdin?: string;
}

export interface RunResponse {
  stage: RunStage;
  status: string;
  status_id: number;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  error: string | null;
  execution_time: number | null;
  memory: number | null;
  language: string;
  language_id: number;
}

export type ProblemDifficulty = 'easy' | 'medium' | 'hard';

export interface Problem {
  id: number;
  title: string;
  description: string;
  difficulty: ProblemDifficulty;
  tags: string[];
  time_limit_ms: number;
  memory_limit_kb: number;
  created_by: number;
  created_at: string;
  is_ready?: boolean;
  hidden_test_cases_count?: number;
}

export interface SampleTestCase {
  id: number;
  input: string;
  expected_output: string;
  is_sample: true;
}

export interface ProblemDetail extends Problem {
  sample_test_cases: SampleTestCase[];
}

export interface SampleTestResult {
  test_case_id: number;
  input: string;
  expected_output: string;
  actual_output: string | null;
  passed: boolean;
}

export interface AIReview {
  correctness: number;
  readability: number;
  efficiency: number;
  best_practices: number;
  overall_score: number;
  feedback: string;
}

export interface SubmissionResult {
  id: number;
  user_id: number;
  problem_id: number;
  code: string;
  language: string;
  verdict: string;
  score: number;
  submitted_at: string;
  sample_results: SampleTestResult[];
  ai_review: AIReview | null;
}

export interface ContestProblem {
  problem_id: number;
  title: string;
  difficulty: ProblemDifficulty;
  points: number;
  is_ready?: boolean;
  hidden_test_cases_count?: number;
  test_cases_count?: number;
}

export interface ContestSummary {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  visibility?: 'public' | 'private' | string;
  created_by: number;
}

export interface ContestDetail extends ContestSummary {
  problems: ContestProblem[];
}

export interface ContestInvite {
  contest_id: number;
  invited_email: string;
  invited_at: string;
}

export interface BulkInviteResponse {
  added: string[];
  skipped_duplicates: string[];
  invalid: string[];
}

export interface AdminTestCase {
  id: number;
  problem_id: number;
  input: string;
  expected_output: string;
  is_sample: boolean;
}

export interface ContestCreatePayload {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  visibility: 'public' | 'private';
  problems?: Array<{ problem_id: number; points: number }>;
}

export interface ProblemCreatePayload {
  title: string;
  description: string;
  difficulty: ProblemDifficulty;
  tags: string[];
  time_limit_ms: number;
  memory_limit_kb: number;
}

export interface TestCasePayload {
  input: string;
  expected_output: string;
  is_sample: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  total_points: number;
  reached_score_at: string | null;
}

export interface UserStats {
  problems_solved: number;
  total_submissions: number;
  average_ai_score: number;
  contests_entered: number;
}

export interface BestScorePerProblem {
  problem_id: number;
  problem_title: string;
  difficulty: ProblemDifficulty | string;
  best_score: number;
  best_verdict: string;
  attempts_count: number;
  is_solved: boolean;
  last_attempted_at: string;
}

export interface AIReviewTrendItem {
  submission_id: number;
  date: string;
  overall_score: number;
  correctness?: number | null;
  readability?: number | null;
  efficiency?: number | null;
  best_practices?: number | null;
  problem_title: string;
}

export interface ContestHistoryItem {
  contest_id: number;
  contest_title: string;
  start_time: string;
  end_time: string;
  rank: number;
  total_points: number;
  total_participants: number;
  joined_at?: string | null;
}

export interface SubmissionHistoryItem {
  id: number;
  problem_id: number;
  problem_title: string;
  code: string;
  language: string;
  verdict: string;
  score: number;
  submitted_at: string;
  ai_review: AIReview | null;
}

export interface PaginatedSubmissions {
  items: SubmissionHistoryItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface UserProfileResponse {
  id: number;
  username: string;
  email: string;
  created_at: string;
  is_admin: boolean;
  stats: UserStats;
  best_scores: BestScorePerProblem[];
  ai_review_trend: AIReviewTrendItem[];
  contest_history: ContestHistoryItem[];
  submission_history: PaginatedSubmissions;
}

class ApiService {
  private getHeaders(token?: string | null): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        }
      } catch {
        // Response wasn't json, use default message
      }
      throw new Error(errorMessage);
    }
    return response.json() as Promise<T>;
  }

  async checkHealth(): Promise<{ status: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await this.handleResponse<{ status: string }>(response);
    } catch {
      return { status: 'offline' };
    }
  }

  async signup(payload: SignupPayload): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<TokenResponse>(response);
  }

  async login(payload: LoginPayload): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<TokenResponse>(response);
  }

  async getCurrentUser(token: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<User>(response);
  }

  async runCode(payload: RunRequest): Promise<RunResponse> {
    const response = await fetch(`${API_BASE_URL}/run`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<RunResponse>(response);
  }

  async getProblems(filters: { difficulty?: string; tags?: string[] } = {}): Promise<Problem[]> {
    const query = new URLSearchParams();
    if (filters.difficulty) query.set('difficulty', filters.difficulty);
    filters.tags?.forEach((tag) => query.append('tags', tag));
    const suffix = query.size ? `?${query.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/problems${suffix}`);
    return this.handleResponse<Problem[]>(response);
  }

  async getProblem(problemId: number): Promise<ProblemDetail> {
    const response = await fetch(`${API_BASE_URL}/problems/${problemId}`);
    return this.handleResponse<ProblemDetail>(response);
  }

  async submitSolution(
    problemId: number,
    payload: { code: string; language: string },
    token: string,
  ): Promise<SubmissionResult> {
    const response = await fetch(`${API_BASE_URL}/submissions`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ ...payload, problem_id: problemId }),
    });
    return this.handleResponse<SubmissionResult>(response);
  }

  async getSubmission(submissionId: number, token: string): Promise<SubmissionResult> {
    const response = await fetch(`${API_BASE_URL}/submissions/${submissionId}`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<SubmissionResult>(response);
  }

  async getContests(token?: string | null): Promise<ContestSummary[]> {
    const response = await fetch(`${API_BASE_URL}/contests`, {
      headers: this.getHeaders(token),
    });
    return this.handleResponse<ContestSummary[]>(response);
  }

  async getContest(contestId: number, token?: string | null): Promise<ContestDetail> {
    const response = await fetch(`${API_BASE_URL}/contests/${contestId}`, {
      headers: this.getHeaders(token),
    });
    return this.handleResponse<ContestDetail>(response);
  }

  async joinContest(contestId: number, token: string): Promise<{ contest_id: number; joined: boolean }> {
    const response = await fetch(`${API_BASE_URL}/contests/${contestId}/join`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<{ contest_id: number; joined: boolean }>(response);
  }

  async submitContestSolution(
    contestId: number,
    payload: { problem_id: number; code: string; language: string },
    token: string,
  ): Promise<SubmissionResult> {
    const response = await fetch(`${API_BASE_URL}/contests/${contestId}/submit`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<SubmissionResult>(response);
  }

  async getLeaderboard(contestId: number, token?: string | null): Promise<LeaderboardEntry[]> {
    const response = await fetch(`${API_BASE_URL}/contests/${contestId}/leaderboard`, {
      headers: this.getHeaders(token),
    });
    return this.handleResponse<LeaderboardEntry[]>(response);
  }

  async getUserProfile(userId: number, page: number = 1, perPage: number = 10, token?: string | null): Promise<UserProfileResponse> {
    const query = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
    });
    const response = await fetch(`${API_BASE_URL}/users/${userId}/profile?${query.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<UserProfileResponse>(response);
  }

  // =========================================================================
  // Admin Methods
  // =========================================================================

  async adminListUsers(token: string): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<User[]>(response);
  }

  async adminUpdateUserRole(userId: number, role: 'admin' | 'user', token: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify({ role }),
    });
    return this.handleResponse<User>(response);
  }

  async adminCreateContest(payload: ContestCreatePayload, token: string): Promise<ContestSummary> {
    const response = await fetch(`${API_BASE_URL}/admin/contests`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ContestSummary>(response);
  }

  async adminDeleteContest(contestId: number, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/contests/${contestId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!response.ok) {
      throw new Error(`Failed to delete contest: ${response.statusText}`);
    }
  }

  async adminGetContestInvites(contestId: number, token: string): Promise<ContestInvite[]> {
    const response = await fetch(`${API_BASE_URL}/admin/contests/${contestId}/invites`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<ContestInvite[]>(response);
  }

  async adminAddContestInvites(contestId: number, emails: string[], token: string): Promise<BulkInviteResponse> {
    const response = await fetch(`${API_BASE_URL}/admin/contests/${contestId}/invite`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ emails }),
    });
    return this.handleResponse<BulkInviteResponse>(response);
  }

  async adminAddContestInvite(contestId: number, email: string, token: string): Promise<BulkInviteResponse> {
    return this.adminAddContestInvites(contestId, [email], token);
  }

  async adminRemoveContestInvite(contestId: number, email: string, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/contests/${contestId}/invite`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      throw new Error(`Failed to remove invite: ${response.statusText}`);
    }
  }

  async adminGetContestRanking(contestId: number, token: string): Promise<LeaderboardEntry[]> {
    const response = await fetch(`${API_BASE_URL}/admin/contests/${contestId}/ranking`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<LeaderboardEntry[]>(response);
  }

  async adminGetContestProblems(contestId: number, token: string): Promise<ContestProblem[]> {
    const response = await fetch(`${API_BASE_URL}/admin/contests/${contestId}/problems`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<ContestProblem[]>(response);
  }

  async adminAttachContestProblem(
    contestId: number,
    payload: { problem_id: number; points: number },
    token: string
  ): Promise<ContestProblem> {
    const response = await fetch(`${API_BASE_URL}/admin/contests/${contestId}/problems`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<ContestProblem>(response);
  }

  async adminRemoveContestProblem(contestId: number, problemId: number, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/contests/${contestId}/problems/${problemId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!response.ok) {
      throw new Error(`Failed to remove problem from contest: ${response.statusText}`);
    }
  }

  async adminCreateProblem(payload: ProblemCreatePayload, token: string): Promise<Problem> {
    const response = await fetch(`${API_BASE_URL}/admin/problems`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<Problem>(response);
  }

  async adminUpdateProblem(problemId: number, payload: ProblemCreatePayload, token: string): Promise<Problem> {
    const response = await fetch(`${API_BASE_URL}/admin/problems/${problemId}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<Problem>(response);
  }

  async adminDeleteProblem(problemId: number, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/problems/${problemId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!response.ok) {
      throw new Error(`Failed to delete problem: ${response.statusText}`);
    }
  }

  async adminListProblemTestCases(problemId: number, token: string): Promise<AdminTestCase[]> {
    const response = await fetch(`${API_BASE_URL}/admin/problems/${problemId}/testcases`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<AdminTestCase[]>(response);
  }

  async adminAddProblemTestCase(problemId: number, payload: TestCasePayload, token: string): Promise<AdminTestCase> {
    const response = await fetch(`${API_BASE_URL}/admin/problems/${problemId}/testcases`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(payload),
    });
    return this.handleResponse<AdminTestCase>(response);
  }

  async adminDeleteProblemTestCase(problemId: number, testCaseId: number, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/problems/${problemId}/testcases/${testCaseId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    if (!response.ok) {
      throw new Error(`Failed to delete test case: ${response.statusText}`);
    }
  }
}

export const api = new ApiService();
