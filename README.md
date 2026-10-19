# scribemate

# ScribeMate 🎓🎙️
*An AI-Powered Scribe cum Proctoring Platform*

## 1. The Core Problem
In traditional educational and professional testing environments, disabled or visually impaired candidates often rely on human scribes to take exams. However, this system is fundamentally flawed and unfair:
- **Human Bias & Influence:** Human scribes can unintentionally (or intentionally) influence answers through tone of voice, body language, or leading cues.
- **Inconsistent Standards:** Varying reading speeds and comprehension support from different human scribes create unequal playing fields.
- **Lack of Autonomy:** Candidates are forced to sacrifice their privacy and independence during high-stakes evaluations.

## 2. The Solution: AI Digital Scribe
**ScribeMate** solves this by replacing subjective human intervention with an autonomous, neutral, and consistent **AI Digital Scribe (Web Speech API)**. It guarantees standardized question delivery, objective answer capture, and secure anti-cheating proctoring without human bias.

### Key Technical & AI Mechanisms:
- **Punctuation-Chunked TTS Pacing:** Converts test papers into spoken audio using precise sentence parsing and controlled speech rates (`utterance.rate = 1.1`), paired with structured pause gaps to ensure fair comprehension time.
- **Fuzzy Speech Matcher:** Continuously listens via background `SpeechRecognition`, mapping spoken responses (e.g., "Option A", "A", "First") securely to option keys and auto-advancing questions.
- **Biometric & Roster Security:** Combines camera stream baseline face capture with strict registrar validation before granting portal entry.
- **Real-Time Invigilator Sync:** Scoped supervision panels handle live break requests (restroom, water, or emergency help) and timer-pause sync seamlessly.

## 3. Tech Stack
- **Frontend & Routing:** React, Next.js (App Router), TypeScript
- **Styling:** Tailwind CSS, responsive accessible layouts
- **AI/Audio Engine:** Web Speech API (`SpeechSynthesis`, `SpeechRecognition`)
- **Persistence & State:** LocalStorage schema with strict role-based session locking

## 4. Setup and Installation
Clone the repository and run the project locally:

```bash
git clone [https://github.com/shrirambg/scribemate-agent.git](https://github.com/shrirambg/scribemate-agent.git)
cd scribemate-agent
pnpm install
pnpm dev

Open http://localhost:3000 in your browser.

5. AI Methodology & API Usage
ScribeMate utilizes the browser-native Web Speech API (SpeechSynthesis for Text-to-Speech synthesis and SpeechRecognition for continuous voice parsing). AI-assisted workflows were used during development to optimize speech-chunking regex, fuzzy-matching algorithms, and real-time state synchronization across multi-role storage events.

6. Product Screenshots
Screenshots showcasing the Candidate Portal, Biometric Camera Gateway, Examiner Question Paper Editor, and Invigilator Alert Dashboard are included in the submitted Google Drive folder link.

7. Team Member Contributions
Shriram B G (Lead Developer, AI Architect & UI/UX Designer): Core architecture, full-stack implementation, UI/UX design, Web Speech API integration, state management, automated time triggers, and live deployment pipeline.
Prathish T (AI Prompt Engineer & QA): Prompt engineering workflows.
Livin S (Testing Lead & Workflow Validation): User workflow validation.

This is an [eve](https://eve.dev) agent bootstrapped with [`eve init`](https://eve.dev/docs/reference/cli#eve-init).

## Getting started

First, run the development server:

```bash
eve dev
```
##
The development TUI opens an interactive session where you can send messages to your agent.

Start by editing `agent/instructions.md` to define the agent's identity, purpose, tone, and response guidelines. Configure its model and runtime behavior in `agent/agent.ts`.

Add capabilities under `agent/`, including tools, connections, channels, skills, subagents, and schedules. eve reloads your changes as you work.

## Learn more

To learn more about eve, explore these resources:

- [eve documentation](https://eve.dev/docs) — learn about eve's features and authoring APIs.
- [Build an Agent tutorial](https://eve.dev/docs/tutorial/first-agent) — build and deploy an agent step by step.
- [eve on GitHub](https://github.com/vercel/eve) — view the source and contribute.

## Deploy on Vercel

Deploy your agent to [Vercel](https://vercel.com) from the project root:

```bash
eve deploy
```

`eve deploy` links a Vercel project if needed and deploys the agent to production. See the [eve deployment documentation](https://eve.dev/docs/guides/deployment/vercel) for authentication, environment variables, and deployment options.
