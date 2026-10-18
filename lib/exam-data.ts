export type SubmissionStatus = "Pending Review" | "Approved";
export type AlertType = "Help" | "Water" | "Restroom" | "Emergency" | "Early Submission";
export type AlertStatus = "Pending" | "Approved" | "Rejected";

export type ApprovedCandidate = {
  regNo: string;
  name: string;
  assignedInvigilatorId?: string;
};

export type Invigilator = {
  id: string;
  name: string;
  passcode: string;
  regNoRangeStart: string;
  regNoRangeEnd: string;
};

export type ExamQuestion = {
  id: number;
  text: string;
  options: string[];
  correctAnswer: string;
};

export type Exam = {
  id: string;
  title: string;
  durationMinutes: number;
  totalMarks: number;
  startTime: string;
  endTime: string;
  instructions: string;
  questions: ExamQuestion[];
  published: boolean;
};

export type CandidateSubmission = {
  candidateRegNo: string;
  examId: string;
  answers: Record<number, string>;
  score: number;
  status: SubmissionStatus;
  submittedAt: string;
};

export type InvigilatorAlert = {
  id: number;
  candidateName: string;
  candidateRegNo: string;
  type: AlertType;
  status: AlertStatus;
  timestamp: string;
};

export type CandidateAccount = {
  regNo: string;
  passcode: string;
  baselineImage: string;
};

export type ExamSession = {
  candidateRegNo: string;
  examId: string;
  answers: Record<number, string>;
  currentQuestion: number;
  skippedQuestions: number[];
  remainingSeconds: number;
  breakStartedAt?: string;
  pendingEarlySubmission?: boolean;
};

export const STORAGE_KEYS = {
  roster: "approved_roster",
  invigilators: "invigilators",
  exams: "exams",
  submissions: "candidate_submissions",
  alerts: "invigilator_alerts",
  accounts: "candidate_accounts",
  sessions: "exam_sessions",
} as const;

export function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : (JSON.parse(value) as T);
  } catch {
    return fallback;
  }
}

export function writeStored<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function compareRegNo(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function isInRange(regNo: string, start: string, end: string): boolean {
  return compareRegNo(regNo, start) >= 0 && compareRegNo(regNo, end) <= 0;
}

export function isExamActive(exam: Exam, now = Date.now()): boolean {
  return exam.published && Date.parse(exam.startTime) <= now && Date.parse(exam.endTime) > now;
}

export function getExamPhase(exam: Exam, now = Date.now()): "upcoming" | "active" | "ended" {
  if (Date.parse(exam.endTime) <= now) return "ended";
  if (Date.parse(exam.startTime) > now) return "upcoming";
  return "active";
}

export function calculateScore(exam: Exam, answers: Record<number, string>): number {
  if (exam.questions.length === 0) return 0;
  const earned = exam.questions.reduce(
    (total, question) => total + (answers[question.id] === question.correctAnswer ? 1 : 0),
    0,
  );
  return Math.round((earned / exam.questions.length) * exam.totalMarks);
}