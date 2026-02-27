# AI Interviewer - Project Implementation Outline

## 1. Architecture & Infrastructure
- **Stack**: React (Frontend) + Express (Backend) + SQLite (Database).
- **AI Integration**: Google Gemini API (Multimodal & Live API).
- **Database**: `better-sqlite3` for storing questions, session history, and transcripts.
- **File Storage**: Local filesystem for temporary uploads (resumes, docs).

## 2. Core Modules (Modular Design)

### A. Interview Manager (The Core)
- **State Machine**: Manages interview states (Setup -> Prep -> Interview -> Review).
- **Mode Controller**:
  - `Full Simulation`: Mimics real interview flow (Intro -> Tech -> Behavioral -> Wrap-up).
  - `Knowledge Module`: Focuses on specific tech stacks/concepts.
  - `Project Module`: Deep dives into uploaded project context/resume.
  - `Scenario Module`: Generates situational problems.

### B. Document Processor
- **File Ingestion**: Support for PDF, TXT, MD.
- **GitHub Parser**: Fetch repository READMEs or code structure for context.
- **Context Extractor**: Converts raw documents into structured context for the AI prompt.

### C. Question Engine
- **Generation**: Uses Gemini to generate 15+ questions *before* the interview starts.
- **Deduplication**: Checks SQLite DB to ensure new questions are generated each time.
- **Difficulty Scaling**: Tags questions by difficulty (Easy -> Medium -> Hard).
- **Output**: Generates a printable list for the user.

### D. Real-Time Voice Interface (Gemini Live)
- **Audio Streaming**: Bidirectional low-latency audio.
- **Persona Configuration**: Strict, professional, adaptive.
- **Transcription**: Captures text from both user (input) and AI (output) for the record.

### E. Review & Feedback System
- **Transcript Generator**: Compiles the dialogue into a structured TXT file.
- **Feedback Loop**: (Optional) Send transcript back to Gemini for a "Report Card" analysis.

## 3. Data Schema (SQLite)
- `modules`: Stores available interview modes.
- `questions`: Stores generated questions to prevent repetition.
  - Columns: `id`, `module`, `content`, `difficulty`, `used_count`.
- `sessions`: Records interview metadata.
- `transcripts`: Stores the raw text of conversations.

## 4. Implementation Steps

### Phase 1: Foundation (Current)
- Setup Express server with Vite middleware.
- Initialize SQLite database.
- Create basic UI shell.

### Phase 2: Input & Generation
- Implement File Upload & GitHub URL fetching.
- Build the "Question Generation" prompt pipeline.
- Create the "Question List" UI.

### Phase 3: The Interview (Live API)
- Integrate Gemini Live API.
- Implement Audio Recording & Playback.
- Handle real-time transcription events.

### Phase 4: Post-Processing
- Generate TXT transcripts.
- Implement "Review" UI.
