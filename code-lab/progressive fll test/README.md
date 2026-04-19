# SPIKE Prime + FLL Adaptive Placement Assessment (Vanilla JavaScript)

This is an offline, production-style adaptive assessment app for student placement in LEGO SPIKE Prime and FLL contexts.

## Core behavior

- Runs directly by opening index.html (no build tools, no dependencies)
- Uses one unified adaptive, domain-based assessment session
- Tracks independent difficulty per domain
- Prevents repeated questions
- Supports resume from localStorage
- Exports JSON and CSV teacher-ready records

## Domain model

The assessment now uses 12 domains:

1. Programming Fundamentals
2. SPIKE Prime Block Coding
3. Pybricks / Python Coding
4. Debugging & Code Analysis
5. Robot Building Fundamentals
6. SPIKE Prime Structural Knowledge
7. Attachments
8. Drivetrain & Wheels
9. Gears & Mechanisms
10. Engineering Process
11. FLL Competition Strategy
12. Robot Behavior Prediction

## Tracks

Student setup includes a **focus track preference** selector:

- general
- spike-block
- pybricks
- fll

The focus track is a soft preference signal only. A single assessment session still collects broad cross-domain evidence and produces readiness estimates for all tracks:

- General Robotics
- SPIKE Prime Block Coding
- Pybricks / Python
- FLL Competition

## Adaptive engine (domain-based)

For each domain, the app keeps:

- difficulty
- asked count
- correct count
- streak
- last outcome
- last asked turn

Selection flow:

1. Pick domains with the fewest asked questions (balanced rotation)
2. Break ties by least recently used domain
3. Apply coverage-band guardrails to maintain a healthy spread across programming, mechanical, and competition domains
4. Choose question near current domain difficulty
5. Apply soft focus-track weighting (not hard filtering)
6. Fall back to nearest difficulty if exact match is unavailable

Difficulty adapts independently in each domain:

- sustained correct answers push domain difficulty upward
- sustained incorrect answers reduce domain difficulty for scaffolded items

## Question schema

Each question in questions.js now supports:

- id
- domain
- subtopic
- difficulty
- track
- type
- question
- code
- choices
- correctAnswer
- hint
- explanation
- image
- imageAlt
- tags

The current bank includes 30 SPIKE Prime / FLL-focused sample questions with at least 2 per domain.

## Results and reporting

Results screen includes:

- student name
- selected track
- weighted score
- overall placement
- strongest domains
- weakest domains
- domains needing practice
- domain-by-domain performance cards
- track-readiness section with score + readiness band:
	- Emerging
	- Developing
	- Ready
	- Advanced
- teacher summary (domain strengths/weaknesses)
- question history

The results area now also includes a printable **End-of-Assessment Report** with:

- student name
- completion date
- selected track
- placement level
- weighted score
- strongest and weakest domains
- domains needing practice
- teacher summary
- family-friendly summary
- recommended next placement / class

Report actions:

- Print Report (optimized for browser print and Print to PDF)
- Save Report to Local History (stored in browser localStorage)

## Teacher simulation mode

The app includes a teacher-only simulation panel (collapsed by default) called **Teacher Simulation Mode**.

Simulation features:

- predefined profiles:
	- beginner
	- strong coder / weak builder
	- strong builder / weak coder
	- competition ready
	- pybricks ready
- profile-specific success probability per domain
- simulated answer correctness influenced by:
	- selected profile's domain skill
	- question difficulty
	- track alignment
	- ongoing domain streak effects

Simulation actions:

- run single simulated student
- run batch simulation with configurable student count
- review summarized output including:
	- total simulated students
	- average weighted score
	- placement distribution
	- average track readiness across General / SPIKE Block / Pybricks / FLL
	- strongest domains
	- weakest domains
	- domains needing practice

Placement bands:

- Level 1 Early Foundations
- Level 2 Developing Builder
- Level 3 Independent Problem Solver
- Level 4 Competition Ready
- Level 5 Advanced Coding / Pybricks Ready

## Export format

JSON export includes:

- student profile and selected track
- completion date
- placement and weighted score
- track readiness object (General, SPIKE Block, Pybricks, FLL)
- strongest/weakest domains
- domains needing practice
- domain profiles
- teacher summary
- family summary
- recommended next placement
- full question history

CSV export includes one row per question with:

- student info
- selected track and completion date
- overall placement and weighted score
- teacher summary
- compact domain-performance summary
- readiness scores/bands for all tracks
- domain/subtopic/track/difficulty
- result and answer comparison
- tags
- timing data

## Files

- index.html — UI structure and views
- styles.css — polished responsive styling
- questions.js — domain config + question bank
- script.js — adaptive engine, scoring, reporting, exports, storage
- assets/ — local SVG diagrams used by image questions

## Run

1. Open the folder
2. Open index.html in a browser
3. Complete assessment
4. Export JSON/CSV from results screen