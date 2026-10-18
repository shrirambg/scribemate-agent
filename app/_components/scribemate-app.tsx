"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  FilePlus2,
  LogOut,
  Mic,
  Pause,
  Plus,
  ShieldCheck,
  Users,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  calculateScore,
  compareRegNo,
  getExamPhase,
  isInRange,
  readStored,
  STORAGE_KEYS,
  writeStored,
  type ApprovedCandidate,
  type CandidateAccount,
  type CandidateSubmission,
  type Exam,
  type ExamQuestion,
  type ExamSession,
  type Invigilator,
  type InvigilatorAlert,
} from "@/lib/exam-data";

type Role = "candidate" | "examiner" | "invigilator";
type DashboardTab = "Current" | "Upcoming" | "Completed";
type SpeechRecognitionResult = { [index: number]: { transcript: string }; isFinal: boolean };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResult[] }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const EMPTY_QUESTION: ExamQuestion = { id: 1, text: "", options: ["", "", "", ""], correctAnswer: "A" };

export function ScribeMateApp() {
  const [hydrated, setHydrated] = useState(false);
  const [role, setRole] = useState<Role>("candidate");
  const [roster, setRoster] = useState<ApprovedCandidate[]>([]);
  const [invigilators, setInvigilators] = useState<Invigilator[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<CandidateSubmission[]>([]);
  const [alerts, setAlerts] = useState<InvigilatorAlert[]>([]);
  const [accounts, setAccounts] = useState<CandidateAccount[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [notice, setNotice] = useState("");
  const [candidate, setCandidate] = useState<ApprovedCandidate | null>(null);
  const [activeExamId, setActiveExamId] = useState("");
  const [invigilator, setInvigilator] = useState<Invigilator | null>(null);

  function refresh() {
    setRoster(readStored(STORAGE_KEYS.roster, []));
    setInvigilators(readStored(STORAGE_KEYS.invigilators, []));
    setExams(readStored(STORAGE_KEYS.exams, []));
    setSubmissions(readStored(STORAGE_KEYS.submissions, []));
    setAlerts(readStored(STORAGE_KEYS.alerts, []));
    setAccounts(readStored(STORAGE_KEYS.accounts, []));
    setSessions(readStored(STORAGE_KEYS.sessions, []));
  }

  useEffect(() => {
    refresh();
    setHydrated(true);
    const syncStorage = (event: StorageEvent) => {
      if (!event.key || Object.values(STORAGE_KEYS).includes(event.key as (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS])) refresh();
    };
    window.addEventListener("storage", syncStorage);
    return () => window.removeEventListener("storage", syncStorage);
  }, []);

  function save<T>(key: string, value: T) {
    writeStored(key, value);
    refresh();
  }

  function exitRole() {
    setCandidate(null);
    setActiveExamId("");
    setInvigilator(null);
    setRole("candidate");
  }

  if (!hydrated) return <main className="app-loading" aria-label="Loading ScribeMate" />;

  const locked = Boolean(candidate && activeExamId);
  return (
    <main className="app-shell">
      {!locked && (
        <header className="app-header">
          <a className="brand" href="/" aria-label="ScribeMate home">
            <span className="brand-mark"><BookOpen size={18} strokeWidth={2.2} /></span>
            <span>Scribe<span>Mate</span></span>
          </a>
          <nav className="role-switch" aria-label="Workspace">
            {(["candidate", "examiner", "invigilator"] as Role[]).map((item) => (
              <button key={item} className={role === item ? "role-button selected" : "role-button"} onClick={() => { setRole(item); setCandidate(null); setInvigilator(null); }}>
                {item === "candidate" ? "Candidate" : item === "examiner" ? "Examiner" : "Invigilator"}
              </button>
            ))}
          </nav>
          <span className="secure-label"><ShieldCheck size={15} /> Examination workspace</span>
        </header>
      )}

      {notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}>×</button></div>}
      {role === "examiner" && <ExaminerPortal roster={roster} invigilators={invigilators} exams={exams} submissions={submissions} save={save} />}
      {role === "invigilator" && <InvigilatorPortal roster={roster} invigilators={invigilators} exams={exams} alerts={alerts} sessions={sessions} save={save} active={invigilator} setActive={setInvigilator} />}
      {role === "candidate" && (candidate && activeExamId ? (
        <CandidateExam
          candidate={candidate}
          exam={exams.find((exam) => exam.id === activeExamId)!}
          sessions={sessions}
          alerts={alerts}
          save={save}
          onComplete={() => { setActiveExamId(""); setNotice("Your answers were submitted for examiner review."); }}
        />
      ) : candidate ? (
        <CandidateDashboard candidate={candidate} exams={exams} submissions={submissions} sessions={sessions} save={save} onOpen={setActiveExamId} onSignOut={exitRole} />
      ) : (
        <CandidateAccess roster={roster} accounts={accounts} save={save} onAccess={(person) => setCandidate(person)} />
      ))}
    </main>
  );
}

function ExaminerPortal({ roster, invigilators, exams, submissions, save }: {
  roster: ApprovedCandidate[]; invigilators: Invigilator[]; exams: Exam[]; submissions: CandidateSubmission[]; save: <T>(key: string, value: T) => void;
}) {
  const [section, setSection] = useState("Overview");
  const [staffName, setStaffName] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [editingId, setEditingId] = useState("");
  const [personName, setPersonName] = useState("");
  const [personReg, setPersonReg] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [examInstructions, setExamInstructions] = useState("");
  const [examMarks, setExamMarks] = useState("100");
  const [examDuration, setExamDuration] = useState("60");
  const [examStart, setExamStart] = useState("");
  const [examEnd, setExamEnd] = useState("");
  const [question, setQuestion] = useState<ExamQuestion>(EMPTY_QUESTION);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [bulkText, setBulkText] = useState("");
  const pending = submissions.filter((submission) => submission.status === "Pending Review");

  function addStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}$/.test(staffCode)) return;
    if (compareRegNo(rangeStart, rangeEnd) > 0) return;
    const entry: Invigilator = { id: editingId || crypto.randomUUID(), name: staffName.trim(), passcode: staffCode, regNoRangeStart: rangeStart.trim(), regNoRangeEnd: rangeEnd.trim() };
    save(STORAGE_KEYS.invigilators, editingId ? invigilators.map((item) => item.id === editingId ? entry : item) : [...invigilators, entry]);
    setStaffName(""); setStaffCode(""); setRangeStart(""); setRangeEnd(""); setEditingId("");
  }

  function addPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const regNo = personReg.trim();
    if (!regNo || roster.some((person) => person.regNo.toLowerCase() === regNo.toLowerCase())) return;
    save(STORAGE_KEYS.roster, [...roster, { name: personName.trim(), regNo }]);
    setPersonName(""); setPersonReg("");
  }

  function addQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.text.trim() || question.options.some((option) => !option.trim())) return;
    setQuestions((current) => [...current, { ...question, id: current.length + 1 }]);
    setQuestion({ ...EMPTY_QUESTION, id: questions.length + 2 });
  }

  function importQuestions() {
    try {
      const imported = JSON.parse(bulkText) as Array<{ text: string; options: string[]; correctAnswer: string }>;
      if (!Array.isArray(imported) || imported.some((item) => !item.text || item.options?.length !== 4 || !["A", "B", "C", "D"].includes(item.correctAnswer))) throw new Error();
      setQuestions((current) => [...current, ...imported.map((item, index) => ({ ...item, id: current.length + index + 1 }))]);
      setBulkText("");
    } catch {
      window.alert('Import must be a JSON array of {"text":"...","options":["...","...","...","..."],"correctAnswer":"A"} items.');
    }
  }

  function publishExam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (questions.length === 0 || Date.parse(examEnd) <= Date.parse(examStart)) return;
    const exam: Exam = { id: crypto.randomUUID(), title: examTitle.trim(), durationMinutes: Number(examDuration), totalMarks: Number(examMarks), startTime: new Date(examStart).toISOString(), endTime: new Date(examEnd).toISOString(), instructions: examInstructions.trim(), questions, published: true };
    save(STORAGE_KEYS.exams, [...exams, exam]);
    setExamTitle(""); setExamInstructions(""); setExamStart(""); setExamEnd(""); setQuestions([]);
  }

  function approve(submission: CandidateSubmission) {
    save(STORAGE_KEYS.submissions, submissions.map((item) => item.candidateRegNo === submission.candidateRegNo && item.examId === submission.examId ? { ...item, status: "Approved" as const } : item));
  }

  return (
    <div className="workspace">
      <aside className="side-rail">
        <p className="rail-label">EXAMINER</p>
        {["Overview", "People", "Exam papers", "Review reports"].map((item) => <button key={item} className={section === item ? "rail-link active" : "rail-link"} onClick={() => setSection(item)}>{item}</button>)}
      </aside>
      <section className="workspace-content">
        <div className="page-heading"><div><p className="eyebrow">EXAMINER WORKSPACE</p><h1>{section}</h1><p className="subheading">Manage access, papers, and released results.</p></div><span className="date-stamp">{new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(new Date())}</span></div>
        {section === "Overview" && <>
          <div className="metric-grid"><Metric label="Approved candidates" value={roster.length} icon={<Users />} /><Metric label="Published papers" value={exams.filter((exam) => exam.published).length} icon={<BookOpen />} /><Metric label="Awaiting review" value={pending.length} icon={<FileCheck2 />} /></div>
          <div className="section-title"><h2>Recent examination papers</h2><button className="text-action" onClick={() => setSection("Exam papers")}>Create paper <ChevronRight size={16} /></button></div>
          {exams.length ? <div className="table-wrap"><table><thead><tr><th>Paper</th><th>Schedule</th><th>Questions</th><th>Status</th></tr></thead><tbody>{exams.slice().reverse().slice(0, 5).map((exam) => <tr key={exam.id}><td className="strong-cell">{exam.title}</td><td>{formatDate(exam.startTime)}</td><td>{exam.questions.length}</td><td><span className="status-chip">Published</span></td></tr>)}</tbody></table></div> : <EmptyState title="No papers yet" detail="Published exams will appear here once you create them." />}
        </>}

        {section === "People" && <div className="two-column">
          <Panel title={editingId ? "Edit invigilator" : "Add invigilator"} icon={<Users size={17} />}>
            <form className="form-stack" onSubmit={addStaff}>
              <Field label="Full name"><input required value={staffName} onChange={(event) => setStaffName(event.target.value)} /></Field>
              <Field label="4-digit passcode"><input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={staffCode} onChange={(event) => setStaffCode(event.target.value)} /></Field>
              <div className="inline-fields"><Field label="Registration range start"><input required value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} /></Field><Field label="Range end"><input required value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} /></Field></div>
              <button className="primary-button" type="submit">{editingId ? "Save changes" : "Add invigilator"}</button>
            </form>
            <div className="compact-list">{invigilators.map((person) => <div className="list-row" key={person.id}><div><strong>{person.name}</strong><small>{person.regNoRangeStart} – {person.regNoRangeEnd}</small></div><button className="small-button" onClick={() => { setEditingId(person.id); setStaffName(person.name); setStaffCode(person.passcode); setRangeStart(person.regNoRangeStart); setRangeEnd(person.regNoRangeEnd); }}>Edit</button></div>)}</div>
          </Panel>
          <Panel title="Approve candidate" icon={<Plus size={17} />}>
            <form className="form-stack" onSubmit={addPerson}>
              <Field label="Full name"><input required value={personName} onChange={(event) => setPersonName(event.target.value)} /></Field>
              <Field label="Registration number"><input required value={personReg} onChange={(event) => setPersonReg(event.target.value)} /></Field>
              <button className="primary-button" type="submit">Add to approved roster</button>
            </form>
            <div className="compact-list">{roster.map((person) => <div className="list-row" key={person.regNo}><div><strong>{person.name}</strong><small>{person.regNo}</small></div><button className="small-button danger-text" onClick={() => save(STORAGE_KEYS.roster, roster.filter((item) => item.regNo !== person.regNo))}>Remove</button></div>)}</div>
            {!roster.length && <p className="quiet-note">Roster is empty. Only approved registration numbers can create candidate accounts.</p>}
          </Panel>
        </div>}

        {section === "Exam papers" && <div className="paper-layout">
          <Panel title="Paper details" icon={<FilePlus2 size={17} />}>
            <form className="form-stack" onSubmit={publishExam}>
              <Field label="Exam title"><input required value={examTitle} onChange={(event) => setExamTitle(event.target.value)} /></Field>
              <Field label="Rules and instructions"><textarea required rows={3} value={examInstructions} onChange={(event) => setExamInstructions(event.target.value)} /></Field>
              <div className="inline-fields"><Field label="Total marks"><input type="number" min="1" required value={examMarks} onChange={(event) => setExamMarks(event.target.value)} /></Field><Field label="Duration (minutes)"><input type="number" min="1" required value={examDuration} onChange={(event) => setExamDuration(event.target.value)} /></Field></div>
              <div className="inline-fields"><Field label="Start (24-hour)"><input type="datetime-local" required value={examStart} onChange={(event) => setExamStart(event.target.value)} /></Field><Field label="End (24-hour)"><input type="datetime-local" required value={examEnd} onChange={(event) => setExamEnd(event.target.value)} /></Field></div>
              <button className="primary-button" type="submit" disabled={!questions.length}>Publish exam · {questions.length} questions</button>
              {!questions.length && <small className="field-hint">Add at least one question before publishing.</small>}
            </form>
          </Panel>
          <div className="stack-column">
            <Panel title="Add a question" icon={<Plus size={17} />}>
              <form className="form-stack" onSubmit={addQuestion}>
                <Field label={`Question ${question.id}`}><textarea required rows={2} value={question.text} onChange={(event) => setQuestion({ ...question, text: event.target.value })} /></Field>
                <div className="options-grid">{question.options.map((option, index) => <Field key={index} label={`Option ${String.fromCharCode(65 + index)}`}><input required value={option} onChange={(event) => setQuestion({ ...question, options: question.options.map((value, position) => position === index ? event.target.value : value) })} /></Field>)}</div>
                <div className="inline-fields"><Field label="Answer key"><select value={question.correctAnswer} onChange={(event) => setQuestion({ ...question, correctAnswer: event.target.value })}>{["A", "B", "C", "D"].map((letter) => <option key={letter}>{letter}</option>)}</select></Field><button className="secondary-button align-end" type="submit">Add question</button></div>
              </form>
              <Field label="Bulk import questions (JSON)"><textarea rows={3} placeholder='[{"text":"Question?","options":["A","B","C","D"],"correctAnswer":"A"}]' value={bulkText} onChange={(event) => setBulkText(event.target.value)} /></Field><button className="text-action" onClick={importQuestions}>Import questions</button>
              {questions.length > 0 && <div className="question-list">{questions.map((item) => <div className="question-row" key={item.id}><span>{String(item.id).padStart(2, "0")}</span><p>{item.text}</p><button aria-label={`Remove question ${item.id}`} className="small-button danger-text" onClick={() => setQuestions(questions.filter((questionItem) => questionItem.id !== item.id).map((questionItem, index) => ({ ...questionItem, id: index + 1 })))}>Remove</button></div>)}</div>}
            </Panel>
          </div>
        </div>}

        {section === "Review reports" && <Panel title="Pending review" icon={<FileCheck2 size={17} />}>
          {pending.length ? <div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Exam</th><th>Score</th><th>Submitted</th><th></th></tr></thead><tbody>{pending.map((submission) => <tr key={`${submission.candidateRegNo}-${submission.examId}`}><td className="strong-cell">{roster.find((person) => person.regNo === submission.candidateRegNo)?.name ?? submission.candidateRegNo}<small className="table-subtext">{submission.candidateRegNo}</small></td><td>{exams.find((exam) => exam.id === submission.examId)?.title ?? "Removed exam"}</td><td>{submission.score}</td><td>{formatDate(submission.submittedAt)}</td><td><button className="primary-button compact" onClick={() => approve(submission)}>Approve &amp; release</button></td></tr>)}</tbody></table></div> : <EmptyState title="Nothing to review" detail="Submitted answer sheets will be listed here." />}
          {submissions.filter((submission) => submission.status === "Approved").length > 0 && <><div className="section-title"><h2>Released reports</h2></div><div className="compact-list">{submissions.filter((submission) => submission.status === "Approved").map((submission) => <div className="list-row" key={`${submission.examId}-${submission.candidateRegNo}`}><div><strong>{roster.find((person) => person.regNo === submission.candidateRegNo)?.name ?? submission.candidateRegNo}</strong><small>{exams.find((exam) => exam.id === submission.examId)?.title} · {submission.score} marks</small></div><span className="status-chip approved">Released</span></div>)}</div></>}
        </Panel>}
      </section>
    </div>
  );
}

function CandidateAccess({ roster, accounts, save, onAccess }: { roster: ApprovedCandidate[]; accounts: CandidateAccount[]; save: <T>(key: string, value: T) => void; onAccess: (candidate: ApprovedCandidate) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [regNo, setRegNo] = useState("");
  const [passcode, setPasscode] = useState("");
  const [captured, setCaptured] = useState("");
  const [error, setError] = useState("");
  const person = roster.find((item) => item.regNo.toLowerCase() === regNo.trim().toLowerCase());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!person) { setError("Registration number not authorized by examiner. Contact examination team."); return; }
    if (!captured) { setError("Complete the camera snapshot before continuing."); return; }
    const account = accounts.find((item) => item.regNo.toLowerCase() === person.regNo.toLowerCase());
    if (mode === "signup") {
      if (account) { setError("An account already exists for this registration number. Please sign in."); return; }
      save(STORAGE_KEYS.accounts, [...accounts, { regNo: person.regNo, passcode, baselineImage: captured }]);
    } else {
      if (!account) { setError("No candidate account found. Please sign up first."); return; }
      if (account.passcode !== passcode) { setError("Registration number or passcode is incorrect."); return; }
      if (!(await snapshotsMatch(account.baselineImage, captured))) { setError("Snapshot did not match the saved baseline. Center your face and try again in similar lighting."); return; }
    }
    onAccess(person);
  }

  return <div className="access-layout"><div className="access-copy"><p className="eyebrow">SECURE EXAM ACCESS</p><h1>Your next exam,<br />with a clear voice.</h1><p>Enter with your approved registration number. Your exam room and released reports are kept in one place.</p><div className="access-assurance"><ShieldCheck size={18} /><span>Roster-authorized access<br /><small>Only candidates approved by the examiner can continue.</small></span></div></div><section className="access-panel">
    <div className="access-tabs"><button className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); setCaptured(""); }}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); setCaptured(""); }}>Create account</button></div>
    <form className="form-stack" onSubmit={submit}>
      <Field label="Registration number"><input autoComplete="username" required value={regNo} onChange={(event) => { setRegNo(event.target.value); setCaptured(""); }} /></Field>
      <Field label="4-digit passcode"><input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={passcode} onChange={(event) => setPasscode(event.target.value)} /></Field>
      <CameraGate registration={regNo} snapshot={captured} onSnapshot={setCaptured} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button full-width" type="submit">{mode === "signin" ? "Verify and continue" : "Create candidate account"}<ChevronRight size={16} /></button>
    </form>
    {!roster.length && <p className="quiet-note access-note">The examiner has not added an approved candidate roster yet.</p>}
  </section></div>;
}

function CameraGate({ registration, snapshot, onSnapshot }: { registration: string; snapshot: string; onSnapshot: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch {
      setCameraError("Camera access is unavailable. Use the snapshot preview fallback.");
      setCameraReady(false);
    }
  }

  function takeSnapshot(simulated: boolean) {
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 240;
    const context = canvas.getContext("2d");
    if (!context) return;
    if (!simulated && videoRef.current?.videoWidth) context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    else {
      context.fillStyle = "#dbe8e2"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#315b4b"; context.font = "16px sans-serif"; context.textAlign = "center";
      context.fillText("ScribeMate preview", 160, 112); context.fillText(registration.trim().toUpperCase(), 160, 140);
    }
    onSnapshot(canvas.toDataURL("image/jpeg", 0.82));
  }

  return <div className="camera-control"><div className="camera-frame">
    {snapshot ? <img src={snapshot} alt="Captured candidate baseline" /> : <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />}
    {!snapshot && <div className="scan-oval" aria-hidden="true" />}
    <span className="camera-indicator">{snapshot ? <><Check size={12} /> Snapshot ready</> : cameraReady ? <><span className="live-dot" /> Camera live</> : <><Camera size={12} /> Camera check</>}</span>
  </div><div className="camera-actions"><button type="button" className="small-button" onClick={() => { onSnapshot(""); void startCamera(); }}><Camera size={14} /> Start / retry</button><button type="button" className="small-button" onClick={() => takeSnapshot(!cameraReady)}><Check size={14} /> {cameraReady ? "Capture snapshot" : "Simulate snapshot"}</button></div>{cameraError && <p className="field-hint" role="status">{cameraError}</p>}<span className="field-hint">{snapshot ? "Snapshot saved for this sign-in attempt." : "Center your face in the oval, then capture."}</span></div>;
}

function CandidateDashboard({ candidate, exams, submissions, sessions, save, onOpen, onSignOut }: {
  candidate: ApprovedCandidate; exams: Exam[]; submissions: CandidateSubmission[]; sessions: ExamSession[]; save: <T>(key: string, value: T) => void; onOpen: (id: string) => void; onSignOut: () => void;
}) {
  const [tab, setTab] = useState<DashboardTab>("Current");
  const [now, setNow] = useState(Date.now());
  const [voiceAsked, setVoiceAsked] = useState(false);
  const userSession = sessions.find((session) => session.candidateRegNo === candidate.regNo);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(timer); }, []);

  const visibleExams = exams.filter((exam) => exam.published && Number.isFinite(Date.parse(exam.startTime)) && Number.isFinite(Date.parse(exam.endTime)));
  const currentExam = visibleExams.filter((exam) => Date.parse(exam.startTime) <= now && Date.parse(exam.endTime) > now).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))[0]
    ?? visibleExams.filter((exam) => Date.parse(exam.startTime) > now).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))[0];
  const upcoming = visibleExams.filter((exam) => Date.parse(exam.startTime) > now).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const completed = exams.filter((exam) => exam.published && Date.parse(exam.endTime) <= now).sort((a, b) => Date.parse(b.endTime) - Date.parse(a.endTime));

  useEffect(() => {
    if (voiceAsked || !currentExam || !("speechSynthesis" in window)) return;
    setVoiceAsked(true);
    speak(`${currentExam.title}. Would you like to open ${currentExam.title}? Please say Yes or No.`);
    const Recognition = getRecognition();
    if (!Recognition) return;
    const listener = new Recognition(); listener.lang = "en-US"; listener.continuous = true; listener.interimResults = false;
    let awaitingExamDecision = true;
    let pendingAction: InvigilatorAlert["type"] | "" = "";
    listener.onresult = (event) => {
      const heard = event.results[event.resultIndex]?.[0]?.transcript.toLowerCase() ?? "";
      if (pendingAction) {
        if (/\b(yes|yeah|confirm)\b/.test(heard)) {
          const alert: InvigilatorAlert = { id: Date.now(), candidateName: candidate.name, candidateRegNo: candidate.regNo, type: pendingAction, status: "Pending", timestamp: new Date().toISOString() };
          save(STORAGE_KEYS.alerts, [...readStored<InvigilatorAlert[]>(STORAGE_KEYS.alerts, []), alert]);
          speak(`${pendingAction} request sent to your invigilator.`); pendingAction = "";
        } else if (/\b(no|cancel)\b/.test(heard)) { speak("Request cancelled."); pendingAction = ""; }
        return;
      }
      if (awaitingExamDecision && /\b(yes|open exam)\b/.test(heard)) { awaitingExamDecision = false; onOpen(currentExam.id); return; }
      if (awaitingExamDecision && /\bno\b/.test(heard)) {
        awaitingExamDecision = false;
        const wait = Math.max(0, Date.parse(currentExam.startTime) - Date.now());
        speak(`The exam starts in ${Math.max(1, Math.ceil(wait / 60000))} minutes.`);
        window.setTimeout(() => onOpen(currentExam.id), Math.max(0, wait - 5 * 60 * 1000));
        return;
      }
      const request: Array<[RegExp, InvigilatorAlert["type"]]> = [[/\bwater\b/, "Water"], [/\brestroom|toilet\b/, "Restroom"], [/\bhelp\b/, "Help"], [/\bemergency\b/, "Emergency"]];
      const match = request.find(([pattern]) => pattern.test(heard));
      if (match) { pendingAction = match[1]; window.speechSynthesis.cancel(); speak(`Are you sure you want to request ${pendingAction}? Please say Yes or No.`); }
    };
    listener.onend = () => { try { listener.start(); } catch { /* Browser can reject a rapid restart. */ } };
    try { listener.start(); } catch { /* Speech recognition may already be active in the browser. */ }
    return () => listener.stop();
  }, [currentExam?.id]);

  function resumeSession() {
    if (!userSession) return;
    const exam = exams.find((item) => item.id === userSession.examId);
    if (exam && Date.parse(exam.endTime) > Date.now()) onOpen(exam.id);
  }

  const chosen = tab === "Current" ? (currentExam ? [currentExam] : []) : tab === "Upcoming" ? upcoming : completed;
  return <div className="candidate-home">
    <div className="candidate-topline"><div><p className="eyebrow">CANDIDATE DASHBOARD</p><h1>Good to see you, {candidate.name.split(" ")[0]}.</h1><p className="subheading">Registration number <strong>{candidate.regNo}</strong></p></div><button className="secondary-button" onClick={onSignOut}><LogOut size={15} /> Sign out</button></div>
    {userSession && <div className="resume-banner"><div><strong>Exam in progress</strong><span>{exams.find((exam) => exam.id === userSession.examId)?.title} · {userSession.pendingEarlySubmission ? "Pending invigilator approval" : "Your answers are saved"}</span></div>{!userSession.pendingEarlySubmission && <button className="primary-button compact" onClick={resumeSession}>Return to exam</button>}</div>}
    <div className="dashboard-tabs" role="tablist" aria-label="Exams">{(["Current", "Upcoming", "Completed"] as DashboardTab[]).map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? "dashboard-tab active" : "dashboard-tab"} key={item} onClick={() => setTab(item)}>{item}<span>{item === "Current" ? currentExam ? 1 : 0 : item === "Upcoming" ? upcoming.length : completed.length}</span></button>)}</div>
    <div className="exam-list">{chosen.length ? chosen.map((exam) => {
      const phase = getExamPhase(exam, now);
      const submission = submissions.find((item) => item.candidateRegNo === candidate.regNo && item.examId === exam.id);
      return <article className="exam-row" key={exam.id}><div className="exam-icon"><BookOpen size={20} /></div><div className="exam-main"><div className="exam-title-row"><h2>{exam.title}</h2>{phase === "ended" ? <span className="status-chip ended">Exam Ended / Evaluated</span> : phase === "active" ? <span className="status-chip live">In progress</span> : <span className="status-chip">Upcoming</span>}</div><p>{phase === "ended" ? `Ended ${formatDate(exam.endTime)}` : phase === "active" ? `Closes ${formatDate(exam.endTime)}` : `Starts ${formatDate(exam.startTime)}`}</p><div className="exam-facts"><span><Clock3 size={14} /> {exam.durationMinutes} min</span><span><FileCheck2 size={14} /> {exam.totalMarks} marks</span><span>{exam.questions.length} questions</span></div></div><div className="exam-action">{phase === "ended" ? submission?.status === "Approved" ? <button className="secondary-button" onClick={() => downloadReport(candidate, exam, submission)}>Download released report (PDF)</button> : <span className="quiet-note">{submission ? "Report pending review" : "No submission"}</span> : phase === "active" ? <button className="primary-button" onClick={() => onOpen(exam.id)}>{userSession?.examId === exam.id ? "Resume exam" : "Open exam"}<ChevronRight size={15} /></button> : <span className="quiet-note">Opens at scheduled time</span>}</div></article>;
    }) : <EmptyState title={tab === "Current" ? "No current exam" : tab === "Upcoming" ? "No upcoming exams" : "No completed exams"} detail={tab === "Current" ? "Your active or next scheduled paper will appear here." : "There are no exams in this list right now."} />}</div>
    <div className="voice-hint"><Volume2 size={16} /><span>Hands-free entry is ready</span><button aria-label="Read current exam prompt" onClick={() => { if (currentExam) speak(`${currentExam.title}. Would you like to open ${currentExam.title}? Please say Yes or No.`); }}><Mic size={15} /> Read aloud</button></div>
  </div>;
}

function CandidateExam({ candidate, exam, sessions, alerts, save, onComplete }: {
  candidate: ApprovedCandidate; exam: Exam; sessions: ExamSession[]; alerts: InvigilatorAlert[]; save: <T>(key: string, value: T) => void; onComplete: () => void;
}) {
  const [session, setSession] = useState<ExamSession>(() => sessions.find((item) => item.candidateRegNo === candidate.regNo && item.examId === exam.id) ?? {
    candidateRegNo: candidate.regNo, examId: exam.id, answers: {}, currentQuestion: 0, skippedQuestions: [], remainingSeconds: exam.durationMinutes * 60,
  });
  const [now, setNow] = useState(Date.now());
  const [activeQuestionIds, setActiveQuestionIds] = useState<number[]>(exam.questions.map((item) => item.id));
  const [reviewingSkips, setReviewingSkips] = useState(false);
  const [captureEnabled, setCaptureEnabled] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [redoField, setRedoField] = useState("");
  const [showRules, setShowRules] = useState(true);
  const captureRef = useRef(captureEnabled);
  const sessionRef = useRef(session);
  const examReady = Date.parse(exam.startTime) <= now && Date.parse(exam.endTime) > now;
  const examEnded = Date.parse(exam.endTime) <= now;
  const paused = Boolean(session.breakStartedAt || session.pendingEarlySubmission);
  const question = exam.questions.find((item) => item.id === activeQuestionIds[session.currentQuestion]);

  useEffect(() => { sessionRef.current = session; captureRef.current = captureEnabled; }, [session, captureEnabled]);
  useEffect(() => {
    const stored = sessions.find((item) => item.candidateRegNo === candidate.regNo && item.examId === exam.id);
    if (stored) setSession(stored);
  }, []);
  useEffect(() => {
    const stored = sessions.find((item) => item.candidateRegNo === candidate.regNo && item.examId === exam.id);
    if (stored && JSON.stringify(stored) !== JSON.stringify(sessionRef.current)) setSession(stored);
    else if (!stored && sessionRef.current.pendingEarlySubmission) onComplete();
  }, [sessions, candidate.regNo, exam.id]);
  useEffect(() => {
    const ticker = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(ticker);
  }, []);
  useEffect(() => {
    if (!examReady || paused || showRules) return;
    const timer = window.setInterval(() => {
      setSession((current) => {
        if (current.remainingSeconds <= 1) { window.setTimeout(() => finish(current), 0); return { ...current, remainingSeconds: 0 }; }
        const next = { ...current, remainingSeconds: current.remainingSeconds - 1 };
        saveSession(next); return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examReady, paused, showRules]);
  useEffect(() => {
    if (examEnded && !session.pendingEarlySubmission) finish();
  }, [examEnded]);

  function saveSession(next: ExamSession) {
    sessionRef.current = next;
    const list = readStored<ExamSession[]>(STORAGE_KEYS.sessions, []);
    save(STORAGE_KEYS.sessions, [...list.filter((item) => !(item.candidateRegNo === next.candidateRegNo && item.examId === next.examId)), next]);
  }

  function updateSession(updater: (current: ExamSession) => ExamSession) {
    setSession((current) => { const next = updater(current); saveSession(next); return next; });
  }

  function finish(finalSession = sessionRef.current) {
    if (finalSession.pendingEarlySubmission) return;
    const currentSubs = readStored<CandidateSubmission[]>(STORAGE_KEYS.submissions, []);
    const submission: CandidateSubmission = { candidateRegNo: candidate.regNo, examId: exam.id, answers: finalSession.answers, score: calculateScore(exam, finalSession.answers), status: "Pending Review", submittedAt: new Date().toISOString() };
    save(STORAGE_KEYS.submissions, [...currentSubs.filter((item) => !(item.candidateRegNo === candidate.regNo && item.examId === exam.id)), submission]);
    save(STORAGE_KEYS.sessions, readStored<ExamSession[]>(STORAGE_KEYS.sessions, []).filter((item) => !(item.candidateRegNo === candidate.regNo && item.examId === exam.id)));
    window.speechSynthesis?.cancel(); onComplete();
  }

  function advance() {
    setCaptureEnabled(false);
    if (session.currentQuestion + 1 < activeQuestionIds.length) updateSession((current) => ({ ...current, currentQuestion: current.currentQuestion + 1 }));
    else if (!reviewingSkips && session.skippedQuestions.length) {
      setReviewingSkips(true); speak("You have skipped questions. Let's review them now.");
      setActiveQuestionIds(session.skippedQuestions); updateSession((current) => ({ ...current, currentQuestion: 0 }));
    } else setAnnouncement("You have reached the end of this paper. Submit when ready.");
  }

  function chooseAnswer(letter: string) {
    if (!question || paused) return;
    updateSession((current) => ({ ...current, answers: { ...current.answers, [question.id]: letter } }));
    advance();
  }

  function skipQuestion() {
    if (!question) return;
    updateSession((current) => ({ ...current, skippedQuestions: current.skippedQuestions.includes(question.id) ? current.skippedQuestions : [...current.skippedQuestions, question.id] }));
    advance();
  }

  function raiseAlert(type: InvigilatorAlert["type"]) {
    const newAlert: InvigilatorAlert = { id: Date.now(), candidateName: candidate.name, candidateRegNo: candidate.regNo, type, status: "Pending", timestamp: new Date().toISOString() };
    save(STORAGE_KEYS.alerts, [...readStored<InvigilatorAlert[]>(STORAGE_KEYS.alerts, []), newAlert]);
    if (type === "Water" || type === "Restroom") updateSession((current) => ({ ...current, breakStartedAt: new Date().toISOString() }));
    if (type === "Early Submission") updateSession((current) => ({ ...current, pendingEarlySubmission: true }));
    setAnnouncement(type === "Early Submission" ? "Pending Invigilator Approval" : type === "Water" || type === "Restroom" ? "Break in Progress" : `${type} request sent to invigilator`);
  }

  function handleVoice(raw: string) {
    const text = raw.toLowerCase().trim();
    if (confirmation) {
      if (/\b(yes|yeah|confirm)\b/.test(text)) { const action = confirmation as InvigilatorAlert["type"]; setConfirmation(""); raiseAlert(action); }
      else if (/\b(no|cancel)\b/.test(text)) { setConfirmation(""); setAnnouncement("Request cancelled."); }
      return;
    }
    if (redoField === "pending") {
      if (text.length > 0) { setRedoField(text.split(" ")[0] ?? ""); speak(`Are you sure you want to clear ${text}? Say Yes or No.`); }
      return;
    }
    if (redoField) {
      if (/\b(yes|clear)\b/.test(text)) {
        if (/^(answer|response|question)$/.test(redoField) && question) updateSession((current) => { const answers = { ...current.answers }; delete answers[question.id]; return { ...current, answers }; });
        else { const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${CSS.escape(redoField)}"]`); if (field) { field.value = ""; field.dispatchEvent(new Event("input", { bubbles: true })); } }
        setRedoField("");
      }
      else if (/\bno\b/.test(text)) setRedoField("");
      return;
    }
    const triggers: Array<[RegExp, InvigilatorAlert["type"]]> = [[/\bwater\b/, "Water"], [/\brestroom|toilet\b/, "Restroom"], [/\bhelp\b/, "Help"], [/\bemergency\b/, "Emergency"], [/\bsubmit early|early submission\b/, "Early Submission"]];
    const trigger = triggers.find(([pattern]) => pattern.test(text));
    if (trigger) { window.speechSynthesis?.cancel(); setCaptureEnabled(false); setConfirmation(trigger[1]); speak(`Are you sure you want to request ${trigger[1]}? Please say Yes or No.`); return; }
    if (/\bredo\b/.test(text)) { setRedoField("pending"); speak("Which field would you like to redo?"); return; }
    if (!captureRef.current || !question) return;
    if (/\bskip\b/.test(text)) { skipQuestion(); return; }
    const answer = matchOption(text);
    if (answer) chooseAnswer(answer);
  }

  useEffect(() => {
    const Recognition = getRecognition();
    if (!Recognition) return;
    const recognition = new Recognition(); recognition.continuous = true; recognition.interimResults = false; recognition.lang = "en-US";
    recognition.onresult = (event) => { const result = event.results[event.resultIndex]; if (result?.isFinal) handleVoice(result[0]?.transcript ?? ""); };
    recognition.onend = () => { try { recognition.start(); } catch { /* Browser can reject a rapid restart. */ } };
    try { recognition.start(); } catch { /* Speech recognition may be blocked by browser permissions. */ }
    return () => recognition.stop();
  }, [question?.id, confirmation, redoField]);

  useEffect(() => {
    if (!question || !examReady || showRules || paused) return;
    setCaptureEnabled(false);
    const parts = [`Question ${question.id}.`, question.text, ...question.options.map((option, index) => `Option ${String.fromCharCode(65 + index)}. ${option}`)];
    void speakPaced(parts.join(" ")).then(() => setCaptureEnabled(true));
  }, [question?.id, examReady, showRules, paused]);

  const early = Date.parse(exam.startTime) > now;
  return <div className="exam-lock-screen">
    <header className="exam-lock-header"><span className="brand"><span className="brand-mark"><BookOpen size={18} /></span><span>Scribe<span>Mate</span></span></span><span className="lock-label"><ShieldCheck size={15} /> Secure exam session</span></header>
    {examEnded ? <section className="pause-panel"><div className="pause-symbol"><Clock3 size={26} /></div><p className="eyebrow">EXAM WINDOW CLOSED</p><h1>Time is up</h1><p>Your saved answers have been submitted for examiner review.</p></section> : early || showRules ? <section className="preexam-panel"><p className="eyebrow">{early ? "SCHEDULED EXAM" : "BEFORE YOU BEGIN"}</p><h1>{exam.title}</h1><div className="exam-facts"><span><Clock3 size={15} /> {exam.durationMinutes} minutes</span><span><FileCheck2 size={15} /> {exam.totalMarks} marks</span><span>{exam.questions.length} questions</span></div><div className="rules-block"><h2>Exam instructions</h2><p>{exam.instructions}</p></div>{early ? <div className="locked-time"><Clock3 size={18} /><div><strong>Entry opens at the scheduled start</strong><span>{formatDate(exam.startTime)}</span></div><span className="countdown">{formatCountdown(Date.parse(exam.startTime) - now)}</span></div> : <button className="primary-button" onClick={() => { if (!examReady) return; setShowRules(false); setAnnouncement(""); }}>Start exam <ChevronRight size={16} /></button>}</section> : paused ? <section className="pause-panel"><div className="pause-symbol"><Pause size={26} /></div><p className="eyebrow">EXAM PAUSED</p><h1>{session.pendingEarlySubmission ? "Pending Invigilator Approval" : "Break in Progress"}</h1><p>{session.pendingEarlySubmission ? "Your early submission request is with the invigilator. Your answers remain saved." : "Your timer is paused. Please wait for your invigilator to resume the session."}</p><span className="status-chip">{session.pendingEarlySubmission ? "Awaiting approval" : "Timer paused"}</span></section> : <section className="question-stage">
      <div className="exam-progress"><div><p className="eyebrow">{reviewingSkips ? "REVIEWING SKIPPED QUESTIONS" : "QUESTION"}</p><h1>{question ? `${String(session.currentQuestion + 1).padStart(2, "0")} / ${activeQuestionIds.length}` : "Paper complete"}</h1></div><div className="timer-display"><Clock3 size={17} /><span>{formatCountdown(session.remainingSeconds * 1000)}</span></div></div>
      {question ? <div className="question-card"><h2>{question.text}</h2><div className="answer-list">{question.options.map((option, index) => <button className={session.answers[question.id] === String.fromCharCode(65 + index) ? "answer-choice chosen" : "answer-choice"} key={`${question.id}-${index}`} onClick={() => chooseAnswer(String.fromCharCode(65 + index))}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div><div className="question-controls"><button className="small-button" onClick={skipQuestion}>Skip question</button><span>{captureEnabled ? <><span className="live-dot" /> Listening for an answer</> : <><Volume2 size={14} /> Reading question and options</>}</span><button className="text-action" onClick={() => speakPaced([`Question ${question.id}.`, question.text, ...question.options.map((option, index) => `Option ${String.fromCharCode(65 + index)}. ${option}`)].join(" "))}><Volume2 size={15} /> Repeat</button></div></div> : <div className="question-card"><h2>All questions have been answered or skipped.</h2><p>{session.skippedQuestions.length ? `${session.skippedQuestions.length} skipped questions reviewed.` : "Review your answers before submitting."}</p></div>}
      <div className="exam-footer"><span><Mic size={15} /> Voice answer capture enabled</span><button className="primary-button" disabled={session.pendingEarlySubmission} onClick={() => finish()}>{question ? "Submit exam" : "Submit answers"}<Check size={15} /></button></div>
      {announcement && <p className="exam-announcement" role="status">{announcement}</p>}
      {confirmation && <div className="voice-confirm" role="alert"><AlertTriangle size={17} /> Confirm {confirmation}: say Yes or No</div>}
    </section>}
  </div>;
}

function InvigilatorPortal({ roster, invigilators, exams, alerts, sessions, save, active, setActive }: {
  roster: ApprovedCandidate[]; invigilators: Invigilator[]; exams: Exam[]; alerts: InvigilatorAlert[]; sessions: ExamSession[]; save: <T>(key: string, value: T) => void; active: Invigilator | null; setActive: (person: Invigilator | null) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => { const interval = window.setInterval(() => setTick((current) => current + 1), 1200); return () => window.clearInterval(interval); }, []);
  const scopedRoster = active ? roster.filter((person) => isInRange(person.regNo, active.regNoRangeStart, active.regNoRangeEnd)) : [];
  const scopedAlerts = alerts.filter((alert) => scopedRoster.some((person) => person.regNo.toLowerCase() === alert.candidateRegNo.toLowerCase())).sort((a, b) => b.id - a.id);

  function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const person = invigilators.find((item) => item.id === selectedId);
    if (!person || person.passcode !== passcode) { setError("Choose your name and enter the matching 4-digit passcode."); return; }
    setActive(person); setError("");
  }

  function updateAlert(alert: InvigilatorAlert, status: InvigilatorAlert["status"]) {
    const current = readStored<InvigilatorAlert[]>(STORAGE_KEYS.alerts, []);
    const updated = current.map((item) => item.id === alert.id ? { ...item, status } : item);
    save(STORAGE_KEYS.alerts, updated);
    if (alert.type === "Early Submission") {
      const savedSessions = readStored<ExamSession[]>(STORAGE_KEYS.sessions, []);
      const session = savedSessions.find((item) => item.candidateRegNo === alert.candidateRegNo);
      const exam = exams.find((item) => item.id === session?.examId);
      if (status === "Approved" && session && exam) {
        const result: CandidateSubmission = { candidateRegNo: session.candidateRegNo, examId: session.examId, answers: session.answers, score: calculateScore(exam, session.answers), status: "Pending Review", submittedAt: new Date().toISOString() };
        save(STORAGE_KEYS.submissions, [...readStored<CandidateSubmission[]>(STORAGE_KEYS.submissions, []).filter((item) => !(item.candidateRegNo === result.candidateRegNo && item.examId === result.examId)), result]);
        save(STORAGE_KEYS.sessions, readStored<ExamSession[]>(STORAGE_KEYS.sessions, []).filter((item) => item.candidateRegNo !== alert.candidateRegNo));
      } else if (status === "Rejected") {
        save(STORAGE_KEYS.sessions, savedSessions.map((item) => item.candidateRegNo === alert.candidateRegNo ? { ...item, pendingEarlySubmission: false } : item));
      }
    }
  }

  function resume(alert: InvigilatorAlert) {
    const current = readStored<ExamSession[]>(STORAGE_KEYS.sessions, []);
    save(STORAGE_KEYS.sessions, current.map((item) => item.candidateRegNo === alert.candidateRegNo ? { ...item, breakStartedAt: undefined } : item));
    updateAlert(alert, "Approved");
  }

  if (!active) return <div className="auth-center"><section className="access-panel invigilator-login"><p className="eyebrow">INVIGILATOR ACCESS</p><h1>Sign in to your room</h1><p className="subheading">Your view is limited to the registration range assigned by the examiner.</p><form className="form-stack" onSubmit={signIn}><Field label="Invigilator name"><select required value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select your name</option>{invigilators.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></Field><Field label="4-digit passcode"><input required type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={passcode} onChange={(event) => setPasscode(event.target.value)} /></Field>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button full-width">Open monitoring dashboard <ChevronRight size={15} /></button></form>{!invigilators.length && <p className="quiet-note">No invigilators have been added by the examiner yet.</p>}</section></div>;

  return <div className="workspace invigilator-workspace"><aside className="side-rail"><p className="rail-label">MONITORING</p><div className="signed-in-name"><span className="avatar">{active.name.slice(0, 1).toUpperCase()}</span><div><strong>{active.name}</strong><small>Invigilator</small></div></div><div className="range-note"><span>Assigned range</span><strong>{active.regNoRangeStart} – {active.regNoRangeEnd}</strong></div><button className="rail-link" onClick={() => setActive(null)}><LogOut size={15} /> Sign out</button></aside><section className="workspace-content">
    <div className="page-heading"><div><p className="eyebrow">LIVE MONITORING</p><h1>Candidate room</h1><p className="subheading">Alerts and candidate status refresh automatically.</p></div><span className="live-status"><span className="live-dot" /> Live</span></div>
    <div className="metric-grid"><Metric label="Candidates in scope" value={scopedRoster.length} icon={<Users />} /><Metric label="Pending alerts" value={scopedAlerts.filter((alert) => alert.status === "Pending").length} icon={<CircleHelp />} /><Metric label="Active sessions" value={sessions.filter((session) => scopedRoster.some((person) => person.regNo === session.candidateRegNo)).length} icon={<BookOpen />} /></div>
    <div className="monitor-grid"><Panel title="Incoming alerts" icon={<AlertTriangle size={17} />}><div key={tick} className="compact-list">{scopedAlerts.length ? scopedAlerts.map((alert) => <div className="alert-row" key={alert.id}><div className="alert-meta"><span className={`alert-type ${alert.type === "Emergency" ? "emergency" : ""}`}>{alert.type}</span><strong>{alert.candidateName}</strong><small>{alert.candidateRegNo} · {formatDate(alert.timestamp)}</small></div><div className="alert-actions">{alert.status === "Pending" ? <><button className="primary-button compact" onClick={() => updateAlert(alert, "Approved")}>{alert.type === "Early Submission" ? "Approve early submission" : "Approve"}</button><button className="small-button danger-text" onClick={() => updateAlert(alert, "Rejected")}>Reject</button></> : <span className="status-chip">{alert.status}</span>}{(alert.type === "Water" || alert.type === "Restroom") && <button className="secondary-button compact" onClick={() => resume(alert)}>Resume exam</button>}</div></div>) : <EmptyState title="No alerts" detail="Candidate requests will arrive here." />}</div></Panel>
    <Panel title="Candidates in your range" icon={<Users size={17} />}><div className="compact-list">{scopedRoster.length ? scopedRoster.map((person) => { const session = sessions.find((item) => item.candidateRegNo === person.regNo); const exam = exams.find((item) => item.id === session?.examId); return <div className="list-row" key={person.regNo}><div><strong>{person.name}</strong><small>{person.regNo}{exam ? ` · ${exam.title}` : ""}</small></div><span className={session?.breakStartedAt ? "status-chip paused" : session ? "status-chip live" : "status-chip"}>{session?.breakStartedAt ? "On break" : session?.pendingEarlySubmission ? "Early submit" : session ? "In exam" : "Not started"}</span></div>; }) : <EmptyState title="No candidates in range" detail="Ask the examiner to verify your assigned registration range." />}</div></Panel></div>
  </section></div>;
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="panel"><div className="panel-heading">{icon && <span className="panel-icon">{icon}</span>}<h2>{title}</h2></div>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="metric"><span className="metric-icon">{icon}</span><div><strong>{value}</strong><span>{label}</span></div></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span><BookOpen size={19} /></span><strong>{title}</strong><p>{detail}</p></div>;
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.rate = 1.2; window.speechSynthesis.speak(utterance);
}

function speakPaced(text: string): Promise<void> {
  const chunks = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  if (!("speechSynthesis" in window)) return Promise.resolve();
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    let index = 0;
    const play = () => {
      if (index >= chunks.length) { resolve(); return; }
      const utterance = new SpeechSynthesisUtterance(chunks[index++]); utterance.rate = 1.2;
      utterance.onend = () => window.setTimeout(play, 1500);
      utterance.onerror = () => resolve(); window.speechSynthesis.speak(utterance);
    };
    play();
  });
}

function getRecognition(): (new () => SpeechRecognitionLike) | undefined {
  const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function matchOption(text: string): string | undefined {
  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
  const patterns: Array<[RegExp, string]> = [
    [/\b(option )?a\b|\bfirst( one)?\b|\balpha\b|\bay\b/, "A"],
    [/\b(option )?b\b|\bsecond( one)?\b|\bbravo\b|\bbee\b/, "B"],
    [/\b(option )?c\b|\bthird( one)?\b|\bcharlie\b|\bsee\b/, "C"],
    [/\b(option )?d\b|\bfourth( one)?\b|\bdelta\b|\bdee\b/, "D"],
  ];
  return patterns.find(([pattern]) => pattern.test(normalized))?.[1];
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unscheduled" : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function downloadReport(candidate: ApprovedCandidate, exam: Exam, submission: CandidateSubmission) {
  const lines = [
    exam.title,
    `Candidate: ${candidate.name} (${candidate.regNo})`,
    `Released score: ${submission.score} / ${exam.totalMarks}`,
    `Submitted: ${formatDate(submission.submittedAt)}`,
    "",
    ...exam.questions.flatMap((question) => [
      `${question.id}. ${question.text}`,
      `   Answer: ${submission.answers[question.id] ?? "Not answered"}`,
      "",
    ]),
  ].flatMap((line) => wrapPdfLine(toAscii(line), 88));
  const pageLines = Array.from({ length: Math.max(1, Math.ceil(lines.length / 50)) }, (_, index) => lines.slice(index * 50, (index + 1) * 50));
  const fontId = 3 + pageLines.length * 2;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", ""];
  const pageIds: number[] = [];
  pageLines.forEach((page, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const commands = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL", ...page.map((line) => `(${escapePdfText(line)}) Tj T*`), "ET"].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(exam.title)}-${safeFilename(candidate.regNo)}-report.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function toAscii(value: string): string {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?");
}

function wrapPdfLine(value: string, width: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line || !value) lines.push(line);
  return lines;
}

function escapePdfText(value: string): string {
  return value.replace(/[\\()]/g, "\\$&");
}

function safeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
}

async function snapshotsMatch(baseline: string, captured: string): Promise<boolean> {
  if (baseline === captured) return true;
  try {
    const [baselineImage, capturedImage] = await Promise.all([loadImage(baseline), loadImage(captured)]);
    const width = 32; const height = 40;
    const canvas = document.createElement("canvas"); canvas.width = width * 2; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(baselineImage, baselineImage.width * 0.3, baselineImage.height * 0.1, baselineImage.width * 0.4, baselineImage.height * 0.7, 0, 0, width, height);
    context.drawImage(capturedImage, capturedImage.width * 0.3, capturedImage.height * 0.1, capturedImage.width * 0.4, capturedImage.height * 0.7, width, 0, width, height);
    const pixels = context.getImageData(0, 0, width * 2, height).data;
    let difference = 0;
    for (let index = 0; index < pixels.length / 2; index += 4) {
      const other = index + width * height * 4;
      difference += Math.abs(pixels[index] - pixels[other]) + Math.abs(pixels[index + 1] - pixels[other + 1]) + Math.abs(pixels[index + 2] - pixels[other + 2]);
    }
    return 1 - difference / ((width * height) * 3 * 255) >= 0.72;
  } catch {
    return false;
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}