Build a complete, single-page React (Next.js/Vite + Tailwind CSS) application named "ScribeMate" — a voice-first, fully accessible examination platform. Generate the entire project structure, state management, components, and full UI in this single turn. Use localStorage for state persistence so it is 100% functional without an external backend.

### 1. APP ARCHITECTURE & STATE MANAGEMENT
Store all state in React context + localStorage:
- currentUser: { role: 'candidate'|'examiner'|'invigilator', regNo, name, gender, profilePic, guardianName, guardianPhone }
- exams: Array of exam objects containing metadata, scheduling, Set A / Set B question lists, answer keys, and Reg No allocation rules.
- invigilatorAllocations: Mapping of Invigilator credentials to student Reg No ranges.
- activeSession: Live exam state (timer, answers, question status matrix [green/yellow/red], alerts/requests sent).
- alertFeed: Real-time array of invigilator alerts (Water, Restroom, Face Check Failure, Early Submission).

### 2. VOICE-FIRST CANDIDATE PORTAL ENGINE (CRITICAL REQUIREMENT)
- Full Screen Readout: The app must automatically read ALOUD every screen text, question, input label, option, and state change to the candidate via Text-to-Speech (TTS).
- Question-Answer Listen Loop: After reading a question or input prompt, TTS stops and the speech engine automatically enters a listening state to capture the user's verbal answer/choice.
- Redo Flow with Field Targeting:
  * When a user says "redo" or phonetic variants ("ridu", "redu", "reader"), the app verbally asks: "Which field would you like to redo?" and waits for the field name.
  * Alternatively, direct verbal commands like "redo full name" immediately clear that specific box, re-prompt the candidate verbally, and overwrite the field with the new spoken response.
  * Natural Language & Single-Entry Spelling: Strip filler phrases ("my name is Shriram" -> "Shriram"). Spoken name + letter spelling ("Shriram S H R I R A M B G") overwrites the field strictly as "Shriram B G" without duplicate text.
- Gender-Adaptive TTS: Configure pitch/voice based on candidate gender profile (male/female).

### 3. EXAMINER PORTAL (Manual, High-Contrast UI)
- Passcode Login (Default: 1234).
- Smart Question Import Options:
  * Option 1 (Manual Entry): Add questions, options, and correct answers one-by-one.
  * Option 2 (Smart Bulk Paste): A text area where the examiner pastes an entire question paper with answers; an internal parser auto-segregates questions, options, and answer keys automatically.
- Accessible 24-Hour Date & Time Editor: Precise date-picker calendar plus distinct 24-Hour (HH:MM) dropdowns/selectors for exam start and end times.
- Advanced Set A / Set B Allocation Patterns:
  * Auto-shuffle Set A to form Set B or manually enter Set B questions.
  * Reg No Allocation Patterns: Toggle between "Even Reg Nos = Set A / Odd Reg Nos = Set B", "Sequential Reg No Ranges", or "Custom Reg No List".
- Persistent Storage: Saved exams persist permanently in localStorage so candidates can attend them and invigilators can monitor them seamlessly across sessions.
- Real-Time Grading & Conditional Results PDF:
  * Auto-grades completed exams against answer keys.
  * PDF scorecard summaries and grade reports are strictly available ONLY for completed (attended) examinations AFTER submission. Unattended exams show status "Unattended" with zero score and no generated scorecard PDF.

### 4. INVIGILATOR PORTAL (Manual, High-Contrast UI)
- Login via Examiner-assigned Invigilator Name + Passcode.
- Scoped Monitoring: Monitor ONLY candidates matching assigned Reg No ranges.
- Real-Time Alert Feeds: Segregated into "Needing Action" and "Handled" with one-click Approve / Deny / Resolve buttons for Restroom, Water, Face Check Failures, and Early Submissions.
- Audit Trail Export: Downloadable candidate proctoring activity logs as formatted PDF reports.

### 5. CANDIDATE DASHBOARD & ACTIVE EXAM SESSION
- Dashboard Tabs: Completed (clearly separated into "Completed (Attended)" vs "Completed (Unattended)"), Current, and Upcoming.
- Pre-Exam Redirect: Auto-launches facial check 3 minutes prior to exam start.
- Exam Lockdown Screen: PC = 2-Column Layout (Left: Question/Options; Right: Question Status Matrix [Green = Done, Yellow = Visited/Unanswered, Red = Unvisited] + Voice Cheat Card). Mobile = Responsive single-column sticky header.
- In-Exam Controls: "Next", "Previous" (reads back question + recorded answer), "Repeat Question", "Review Unattempted". Emergency Restroom (pauses timer + alerts invigilator) and Water (alerts invigilator, timer keeps running) controls.

### 6. SEED MOCK DATA
Pre-populate localStorage on boot with 2 default exams (Maths & General Science with Set A/Set B rules), 1 candidate profile, 1 examiner profile, and 2 invigilator allocations so all portals are 100% testable out of the box.