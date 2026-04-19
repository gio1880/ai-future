(() => {
  "use strict";

  const STORAGE_KEY = "fllPlacementAssessment.v3";
  const REPORT_HISTORY_KEY = "fllPlacementReports.v1";
  const APP_CONFIG = window.FLL_ASSESSMENT_CONFIG || {};
  const RAW_QUESTIONS = Array.isArray(window.FLL_QUESTIONS) ? window.FLL_QUESTIONS : [];
  const DOMAINS = Array.isArray(APP_CONFIG.domains) ? APP_CONFIG.domains : [];
  const TRACKS = Array.isArray(APP_CONFIG.tracks) ? APP_CONFIG.tracks : ["general", "spike-block", "pybricks", "fll"];
  const LEVELS = APP_CONFIG.levels || {
    1: "Level 1 Early Foundations",
    2: "Level 2 Developing Builder",
    3: "Level 3 Independent Problem Solver",
    4: "Level 4 Competition Ready"
  };

  const numericLevels = Object.keys(LEVELS)
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value));
  const MAX_DIFFICULTY = numericLevels.length ? Math.max(...numericLevels) : 4;

  const QUESTIONS = normalizeQuestionBank(RAW_QUESTIONS);

  const questionById = new Map();
  const questionsByDomain = new Map();

  const ui = {};

  // 75-minute class-period time limit (ms)
  const ASSESSMENT_TIME_LIMIT_MS = 75 * 60 * 1000;

  const runtime = {
    session: null,
    activeQuestion: null,
    selectedOptionIndex: null,
    questionLocked: false,
    timerInterval: null
  };

  const simulationProfiles = buildSimulationProfiles();

  const domainCoachingNotes = {
    "Programming Fundamentals": "Strengthen sequencing, loops, and variable-based tuning through short repeatable tasks.",
    "SPIKE Prime Block Coding": "Practice motor/sensor block calibration and reusable My Blocks for reliable match code.",
    "Pybricks / Python Coding": "Build confidence with Pybricks syntax, functions, and sensor-driven control loops.",
    "Debugging & Code Analysis": "Use one-variable-at-a-time debugging logs and targeted reproducibility checks.",
    "Robot Building Fundamentals": "Improve chassis stability, center of gravity, and bracing for repeatable runs.",
    "SPIKE Prime Hardware & Sensors": "Build familiarity with hub ports, sensor modes, gyro readings, motor encoders, and firmware updates.",
    "Attachments": "Use keyed quick-swap mounts with alignment guides for faster and more reliable transitions.",
    "Drivetrain & Wheels": "Focus on drift diagnosis, traction tuning, and wheel calibration consistency.",
    "Gears & Mechanisms": "Develop stronger understanding of ratio selection, torque tradeoffs, and reliable power transfer.",
    "Engineering Process & GitHub": "Keep structured test logs, use version control for code, and tie iteration evidence to measurable outcomes.",
    "FLL Competition Strategy": "Prioritize reliable run plans, risk-aware mission grouping, and time-managed execution.",
    "Robot Behavior Prediction": "Practice predicting path, sensor behavior, and mission outcomes from code before testing.",
    "Teamwork & Innovation Project": "Strengthen collaboration skills, practice presenting ideas, and follow the Innovation Project cycle of identify-research-create-share.",
    "Robotics Math": "Apply gear ratio calculations, distance and circumference formulas, angle measurement, and proportional thinking to real robot problems.",
    "Safety & Kit Care": "Build habits around proper battery care, cable handling, kit organization, sensor cleaning, and safe workspace practices."
  };

  // Domain weighting model used to estimate readiness across tracks from one unified assessment.
  const TRACK_READINESS_MODELS = {
    general: {
      label: "General Robotics",
      domains: {
        "Programming Fundamentals": 1.15,
        "Debugging & Code Analysis": 1.1,
        "Robot Building Fundamentals": 1,
        "SPIKE Prime Hardware & Sensors": 1.05,
        "Robot Behavior Prediction": 0.95,
        "Engineering Process & GitHub": 1,
        "Robotics Math": 0.9,
        "Safety & Kit Care": 0.8
      }
    },
    "spike-block": {
      label: "SPIKE Prime Block Coding",
      domains: {
        "Programming Fundamentals": 1.1,
        "SPIKE Prime Block Coding": 1.45,
        "Debugging & Code Analysis": 1.2,
        "SPIKE Prime Hardware & Sensors": 1.1,
        "Robot Behavior Prediction": 0.95
      }
    },
    pybricks: {
      label: "Pybricks / Python",
      domains: {
        "Programming Fundamentals": 1.05,
        "Pybricks / Python Coding": 1.55,
        "Debugging & Code Analysis": 1.2,
        "Robot Behavior Prediction": 1,
        "SPIKE Prime Hardware & Sensors": 0.9
      }
    },
    fll: {
      label: "FLL Competition",
      domains: {
        "Attachments": 1.15,
        "Drivetrain & Wheels": 1.1,
        "Gears & Mechanisms": 1.1,
        "Engineering Process & GitHub": 1,
        "FLL Competition Strategy": 1.2,
        "Robot Building Fundamentals": 1,
        "Teamwork & Innovation Project": 1.1
      }
    }
  };

  const DOMAIN_COVERAGE_BANDS = {
    programming: [
      "Programming Fundamentals",
      "SPIKE Prime Block Coding",
      "Pybricks / Python Coding",
      "Debugging & Code Analysis",
      "Robot Behavior Prediction",
      "Robotics Math"
    ],
    mechanical: [
      "Robot Building Fundamentals",
      "SPIKE Prime Hardware & Sensors",
      "Attachments",
      "Drivetrain & Wheels",
      "Gears & Mechanisms",
      "Safety & Kit Care"
    ],
    competition: [
      "Engineering Process & GitHub",
      "FLL Competition Strategy",
      "Teamwork & Innovation Project"
    ]
  };

  // ── Three-phase adaptive assessment system ────────────────────────────────
  // Phase 1 SCREENER  : 1 question per domain at difficulty 2 (15 total)
  // Phase 2 DEEP_DIVE : 3–5 adaptive questions in every domain; early-stop on
  //                     3 consecutive correct (→ MASTERY) or 3 consecutive wrong
  // Phase 3 MASTERY   : 2–3 questions at difficulty 4-5 for high performers
  const PHASE = Object.freeze({
    SCREENER:  "screener",
    DEEP_DIVE: "deep-dive",
    MASTERY:   "mastery",
    COMPLETE:  "complete"
  });

  const SCREENER_DIFFICULTY     = 2;   // fixed difficulty used in screener
  const DEEP_DIVE_MAX           = 5;   // max extra questions per domain in deep dive
  const DEEP_DIVE_CORRECT_STOP  = 3;   // consecutive correct streak → advance to mastery
  const DEEP_DIVE_WRONG_STOP    = -3;  // consecutive wrong streak  → mark complete
  const MASTERY_DIFFICULTY      = 4;   // minimum difficulty for mastery questions
  const MASTERY_MAX             = 3;   // max mastery questions per domain

  function buildSimulationProfiles() {
    return {
      beginner: {
        label: "Beginner",
        defaultTrack: "general",
        domainSkill: {
          "Programming Fundamentals": 0.44,
          "SPIKE Prime Block Coding": 0.38,
          "Pybricks / Python Coding": 0.2,
          "Debugging & Code Analysis": 0.34,
          "Robot Building Fundamentals": 0.4,
          "SPIKE Prime Hardware & Sensors": 0.35,
          "Attachments": 0.33,
          "Drivetrain & Wheels": 0.34,
          "Gears & Mechanisms": 0.3,
          "Engineering Process & GitHub": 0.36,
          "FLL Competition Strategy": 0.32,
          "Robot Behavior Prediction": 0.3,
          "Teamwork & Innovation Project": 0.45,
          "Robotics Math": 0.35,
          "Safety & Kit Care": 0.5
        }
      },
      "strong-coder-weak-builder": {
        label: "Strong Coder / Weak Builder",
        defaultTrack: "spike-block",
        domainSkill: {
          "Programming Fundamentals": 0.82,
          "SPIKE Prime Block Coding": 0.84,
          "Pybricks / Python Coding": 0.62,
          "Debugging & Code Analysis": 0.78,
          "Robot Building Fundamentals": 0.38,
          "SPIKE Prime Hardware & Sensors": 0.34,
          "Attachments": 0.42,
          "Drivetrain & Wheels": 0.45,
          "Gears & Mechanisms": 0.4,
          "Engineering Process & GitHub": 0.7,
          "FLL Competition Strategy": 0.55,
          "Robot Behavior Prediction": 0.72,
          "Teamwork & Innovation Project": 0.55,
          "Robotics Math": 0.68,
          "Safety & Kit Care": 0.6
        }
      },
      "strong-builder-weak-coder": {
        label: "Strong Builder / Weak Coder",
        defaultTrack: "fll",
        domainSkill: {
          "Programming Fundamentals": 0.4,
          "SPIKE Prime Block Coding": 0.46,
          "Pybricks / Python Coding": 0.24,
          "Debugging & Code Analysis": 0.48,
          "Robot Building Fundamentals": 0.84,
          "SPIKE Prime Hardware & Sensors": 0.86,
          "Attachments": 0.8,
          "Drivetrain & Wheels": 0.82,
          "Gears & Mechanisms": 0.76,
          "Engineering Process & GitHub": 0.72,
          "FLL Competition Strategy": 0.78,
          "Robot Behavior Prediction": 0.6,
          "Teamwork & Innovation Project": 0.7,
          "Robotics Math": 0.55,
          "Safety & Kit Care": 0.75
        }
      },
      "competition-ready": {
        label: "Competition Ready",
        defaultTrack: "fll",
        domainSkill: {
          "Programming Fundamentals": 0.82,
          "SPIKE Prime Block Coding": 0.84,
          "Pybricks / Python Coding": 0.58,
          "Debugging & Code Analysis": 0.82,
          "Robot Building Fundamentals": 0.82,
          "SPIKE Prime Hardware & Sensors": 0.8,
          "Attachments": 0.84,
          "Drivetrain & Wheels": 0.82,
          "Gears & Mechanisms": 0.8,
          "Engineering Process & GitHub": 0.86,
          "FLL Competition Strategy": 0.9,
          "Robot Behavior Prediction": 0.8,
          "Teamwork & Innovation Project": 0.85,
          "Robotics Math": 0.78,
          "Safety & Kit Care": 0.82
        }
      },
      "pybricks-ready": {
        label: "Pybricks Ready",
        defaultTrack: "pybricks",
        domainSkill: {
          "Programming Fundamentals": 0.86,
          "SPIKE Prime Block Coding": 0.72,
          "Pybricks / Python Coding": 0.92,
          "Debugging & Code Analysis": 0.84,
          "Robot Building Fundamentals": 0.66,
          "SPIKE Prime Hardware & Sensors": 0.64,
          "Attachments": 0.65,
          "Drivetrain & Wheels": 0.68,
          "Gears & Mechanisms": 0.72,
          "Engineering Process & GitHub": 0.8,
          "FLL Competition Strategy": 0.72,
          "Robot Behavior Prediction": 0.86,
          "Teamwork & Innovation Project": 0.6,
          "Robotics Math": 0.82,
          "Safety & Kit Care": 0.7
        }
      }
    };
  }

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (!validateQuestionBank()) {
      alert("Question data is invalid. Please review questions.js.");
      return;
    }

    buildQuestionIndexes();
    cacheUi();
    bindEvents();

    const savedSession = loadSession();
    if (savedSession && savedSession.status === "in-progress") {
      runtime.session = ensurePhaseState(savedSession);
      hydrateSetupForm(savedSession.student);
      toggleResumeBanner(true);
      setSessionPill("Session Available", false);
    } else {
      toggleResumeBanner(false);
      setSessionPill("Not Started", true);
    }

    showView("setup");
  }

  function cacheUi() {
    ui.views = {
      setup: document.getElementById("setup-view"),
      assessment: document.getElementById("assessment-view"),
      results: document.getElementById("results-view")
    };

    ui.sessionStatusPill = document.getElementById("session-status-pill");

    ui.setupForm = document.getElementById("setup-form");
    ui.studentName = document.getElementById("student-name");
    ui.studentGrade = document.getElementById("student-grade");
    ui.studentTeam = document.getElementById("student-team");
    ui.resumeBanner = document.getElementById("resume-banner");
    ui.resumeButton = document.getElementById("resume-btn");
    ui.startNewButton = document.getElementById("start-new-btn");

    ui.progressLabel  = document.getElementById("progress-label");
    ui.timerDisplay   = document.getElementById("timer-display");
    ui.timerContainer = document.getElementById("timer-container");
    ui.currentDomainLabel = document.getElementById("current-domain-label");
    ui.domainDifficultyLabel = document.getElementById("domain-difficulty-label");
    ui.progressFill = document.getElementById("progress-fill");
    ui.questionTypePill = document.getElementById("question-type-pill");
    ui.questionTrackPill = document.getElementById("question-track-pill");
    ui.questionLevelPill = document.getElementById("question-level-pill");
    ui.questionMetaLine = document.getElementById("question-meta-line");
    ui.questionPrompt = document.getElementById("question-prompt");
    ui.questionImageWrap = document.getElementById("question-image-wrap");
    ui.questionImage = document.getElementById("question-image");
    ui.questionImageCaption = document.getElementById("question-image-caption");
    ui.questionCodeWrap = document.getElementById("question-code-wrap");
    ui.questionCode = document.getElementById("question-code");
    ui.optionsList = document.getElementById("options-list");
    ui.hintToggleButton = document.getElementById("hint-toggle-btn");
    ui.hintText = document.getElementById("hint-text");
    ui.feedbackPanel = document.getElementById("feedback-panel");
    ui.submitButton = document.getElementById("submit-answer-btn");
    ui.nextButton = document.getElementById("next-question-btn");

    ui.resultStudentName = document.getElementById("result-student-name");
    ui.resultDateCompleted = document.getElementById("result-date-completed");
    ui.resultTrack = document.getElementById("result-track");
    ui.overallScore = document.getElementById("overall-score");
    ui.placementRecommendation = document.getElementById("placement-recommendation");
    ui.strongestDomains = document.getElementById("strongest-domains");
    ui.weakestDomains = document.getElementById("weakest-domains");
    ui.domainsNeedingPractice = document.getElementById("domains-needing-practice");
    ui.trackReadinessList = document.getElementById("track-readiness-list");
    ui.teacherSummary = document.getElementById("teacher-summary");
    ui.domainProfiles = document.getElementById("domain-profiles");
    ui.historyBody = document.getElementById("history-body");
    ui.htmlReportButton  = document.getElementById("html-report-btn");
    ui.phaseStep1        = document.getElementById("phase-step-1");
    ui.phaseStep2        = document.getElementById("phase-step-2");
    ui.phaseStep3        = document.getElementById("phase-step-3");
    ui.phaseDetailLabel  = document.getElementById("phase-detail-label");
    ui.exportJsonButton = document.getElementById("export-json-btn");
    ui.exportCsvButton = document.getElementById("export-csv-btn");
    ui.restartButton = document.getElementById("restart-btn");

    ui.simProfileSelect = document.getElementById("sim-profile-select");
    ui.simStudentCount = document.getElementById("sim-student-count");
    ui.runSingleSimButton = document.getElementById("run-single-sim-btn");
    ui.runBatchSimButton = document.getElementById("run-batch-sim-btn");
    ui.simSummaryPanel = document.getElementById("sim-summary-panel");
    ui.simSummaryLine = document.getElementById("sim-summary-line");
    ui.simPlacementDistribution = document.getElementById("sim-placement-distribution");
    ui.simDomainInsights = document.getElementById("sim-domain-insights");
    ui.simTrackReadiness = document.getElementById("sim-track-readiness");

    ui.reportStudentName = document.getElementById("report-student-name");
    ui.reportDateCompleted = document.getElementById("report-date-completed");
    ui.reportTrack = document.getElementById("report-track");
    ui.reportPlacement = document.getElementById("report-placement");
    ui.reportScore = document.getElementById("report-score");
    ui.reportNextPlacement = document.getElementById("report-next-placement");
    ui.reportStrongestDomains = document.getElementById("report-strongest-domains");
    ui.reportWeakestDomains = document.getElementById("report-weakest-domains");
    ui.reportNeedingPractice = document.getElementById("report-needing-practice");
    ui.reportTrackReadinessList = document.getElementById("report-track-readiness-list");
    ui.reportTeacherSummary = document.getElementById("report-teacher-summary");
    ui.reportFamilySummary = document.getElementById("report-family-summary");
    ui.printReportButton = document.getElementById("print-report-btn");
    ui.saveReportButton = document.getElementById("save-report-btn");
    ui.reportSaveFeedback = document.getElementById("report-save-feedback");
    ui.savedReportList = document.getElementById("saved-report-list");
  }

  function bindEvents() {
    ui.setupForm.addEventListener("submit", handleSetupSubmit);
    ui.resumeButton.addEventListener("click", resumeSession);
    ui.startNewButton.addEventListener("click", startFreshFromBanner);
    ui.optionsList.addEventListener("click", handleOptionSelection);
    ui.hintToggleButton.addEventListener("click", toggleHint);
    ui.submitButton.addEventListener("click", submitCurrentAnswer);
    ui.nextButton.addEventListener("click", advanceToNextQuestion);
    ui.htmlReportButton.addEventListener("click", handleHtmlReport);
    ui.exportJsonButton.addEventListener("click", exportJson);
    ui.exportCsvButton.addEventListener("click", exportCsv);
    ui.restartButton.addEventListener("click", resetToSetup);

    if (ui.runSingleSimButton) {
      ui.runSingleSimButton.addEventListener("click", handleRunSingleSimulation);
    }

    if (ui.runBatchSimButton) {
      ui.runBatchSimButton.addEventListener("click", handleRunBatchSimulation);
    }

    if (ui.printReportButton) {
      ui.printReportButton.addEventListener("click", handlePrintReport);
    }

    if (ui.saveReportButton) {
      ui.saveReportButton.addEventListener("click", handleSaveReportToHistory);
    }

    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-report-mode");
    });
  }

  function normalizeQuestionBank(rawQuestions) {
    if (!Array.isArray(rawQuestions)) {
      return [];
    }

    return rawQuestions
      .map((entry) => normalizeQuestion(entry))
      .filter(Boolean);
  }

  function normalizeQuestion(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const domain = normalizeDomain(entry.domain || mapLegacyCategoryToDomain(entry.category));
    if (!domain) {
      return null;
    }

    const choices = Array.isArray(entry.choices)
      ? entry.choices
      : (Array.isArray(entry.options) ? entry.options : []);

    const correctAnswer = typeof entry.correctAnswer === "number"
      ? entry.correctAnswer
      : entry.answerIndex;

    const imagePath = typeof entry.image === "string"
      ? entry.image
      : (entry.image && typeof entry.image.src === "string" ? entry.image.src : "");

    const imageAlt = entry.imageAlt || (entry.image && entry.image.alt) || "";

    const difficulty = Number(entry.difficulty);

    return {
      id: String(entry.id || "").trim(),
      domain,
      subtopic: String(entry.subtopic || "general").trim(),
      difficulty: Number.isFinite(difficulty) ? difficulty : 2,
      track: normalizeTrack(entry.track),
      type: String(entry.type || "mcq").trim(),
      question: String(entry.question || entry.prompt || "").trim(),
      code: String(entry.code || ""),
      choices: choices.map((choice) => String(choice)),
      correctAnswer: Number(correctAnswer),
      hint: String(entry.hint || "").trim(),
      explanation: String(entry.explanation || "").trim(),
      image: imagePath,
      imageAlt: String(imageAlt),
      tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag)) : []
    };
  }

  function mapLegacyCategoryToDomain(category) {
    const legacyMap = {
      coding: "Programming Fundamentals",
      debugging: "Debugging & Code Analysis",
      building: "Robot Building Fundamentals",
      mechanisms: "Gears & Mechanisms",
      "problem-solving": "Engineering Process & GitHub",
      strategy: "FLL Competition Strategy"
    };

    return legacyMap[category] || "";
  }

  function normalizeDomain(domain) {
    if (!domain || typeof domain !== "string") {
      return "";
    }

    const exactMatch = DOMAINS.find((entry) => entry === domain);
    if (exactMatch) {
      return exactMatch;
    }

    const lowered = domain.trim().toLowerCase();
    const fuzzyMatch = DOMAINS.find((entry) => entry.toLowerCase() === lowered);
    return fuzzyMatch || "";
  }

  function validateQuestionBank() {
    if (!QUESTIONS.length || !DOMAINS.length) {
      return false;
    }

    const ids = new Set();
    const domainCounts = {};

    for (const domain of DOMAINS) {
      domainCounts[domain] = 0;
    }

    for (const question of QUESTIONS) {
      if (!question.id || ids.has(question.id)) {
        return false;
      }
      ids.add(question.id);

      if (!DOMAINS.includes(question.domain)) {
        return false;
      }

      domainCounts[question.domain] += 1;

      if (!Array.isArray(question.choices) || question.choices.length < 2) {
        return false;
      }

      if (!Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer >= question.choices.length) {
        return false;
      }

      if (!Number.isInteger(question.difficulty) || question.difficulty < 1 || question.difficulty > MAX_DIFFICULTY) {
        return false;
      }

      if (!TRACKS.includes(question.track)) {
        return false;
      }

      if (!question.question || !question.hint || !question.explanation || !question.subtopic) {
        return false;
      }
    }

    return DOMAINS.every((domain) => domainCounts[domain] >= 2);
  }

  function buildQuestionIndexes() {
    for (const domain of DOMAINS) {
      questionsByDomain.set(domain, []);
    }

    for (const question of QUESTIONS) {
      questionById.set(question.id, question);
      questionsByDomain.get(question.domain).push(question);
    }

    for (const domain of DOMAINS) {
      const domainQuestions = questionsByDomain.get(domain) || [];
      domainQuestions.sort((left, right) => left.difficulty - right.difficulty);
    }
  }

  function handleSetupSubmit(event) {
    event.preventDefault();

    const student = {
      name: ui.studentName.value.trim(),
      grade: ui.studentGrade.value.trim(),
      team: ui.studentTeam.value.trim(),
      track: "general"
    };

    if (!student.name) {
      ui.studentName.focus();
      return;
    }

    runtime.session = createNewSession(student);
    saveSession(runtime.session);
    toggleResumeBanner(false);
    startSessionFlow();
  }

  function startFreshFromBanner() {
    clearSession();
    runtime.session = null;
    runtime.activeQuestion = null;
    runtime.selectedOptionIndex = null;
    runtime.questionLocked = false;
    toggleResumeBanner(false);
    setSessionPill("Not Started", true);
  }

  function createNewSession(student) {
    const domainState = {};
    const domainPhase = {};
    const domainPhaseAsked = {};
    const domainPhaseCorrect = {};

    for (const domain of DOMAINS) {
      domainState[domain]        = createEmptyDomainMeta();
      domainPhase[domain]        = PHASE.SCREENER;
      domainPhaseAsked[domain]   = 0;
      domainPhaseCorrect[domain] = 0;
    }

    return {
      schemaVersion: 3,
      sessionId: `session-${Date.now()}`,
      status: "in-progress",
      startedAt: new Date().toISOString(),
      completedAt: null,
      student,
      // kept for backward-compat export fields; not used as stopping criterion
      targetQuestionCount: APP_CONFIG.targetQuestionCount || 24,
      currentQuestionId: null,
      questionStartedAt: null,
      askedIds: [],
      history: [],
      domainState,
      domainPhase,
      domainPhaseAsked,
      domainPhaseCorrect,
      bandCoverage: createCoverageBandState(),
      analytics: null
    };
  }

  function createEmptyDomainMeta() {
    return {
      difficulty: Math.min(2, MAX_DIFFICULTY),
      asked: 0,
      correct: 0,
      streak: 0,
      lastOutcome: null,
      lastAskedTurn: -1
    };
  }

  function createCoverageBandState() {
    return {
      programming: { asked: 0, correct: 0 },
      mechanical: { asked: 0, correct: 0 },
      competition: { asked: 0, correct: 0 }
    };
  }

  // ── Phase helpers ─────────────────────────────────────────────────────────

  /**
   * Migrate a session loaded from localStorage that predates the phase system.
   * Infers domain phases from existing history so the assessment can continue.
   */
  function ensurePhaseState(session) {
    if (!session.domainPhase) {
      session.domainPhase        = Object.fromEntries(DOMAINS.map(d => [d, PHASE.SCREENER]));
      session.domainPhaseAsked   = Object.fromEntries(DOMAINS.map(d => [d, 0]));
      session.domainPhaseCorrect = Object.fromEntries(DOMAINS.map(d => [d, 0]));

      // Mark every domain that already has at least one answered question as deep-dive.
      for (const domain of DOMAINS) {
        const ds = session.domainState[domain];
        const asked = ds?.asked || 0;
        if (asked >= 1) {
          session.domainPhase[domain]        = PHASE.DEEP_DIVE;
          session.domainPhaseAsked[domain]   = Math.max(0, asked - 1);
          session.domainPhaseCorrect[domain] = ds?.correct || 0;
        }
      }
    }
    // Backfill domainPhaseCorrect if missing from older v3 sessions
    if (!session.domainPhaseCorrect) {
      session.domainPhaseCorrect = Object.fromEntries(DOMAINS.map(d => [d, 0]));
    }
    return session;
  }

  /**
   * Called immediately after applyAnswerToSession records the response.
   * Advances the domain's phase based on performance evidence.
   */
  function updateDomainPhase(session, domain) {
    const state        = session.domainState[domain];
    const phase        = session.domainPhase[domain];
    const phaseAsked   = session.domainPhaseAsked[domain] || 0;
    const isCorrect    = state.lastOutcome;

    if (phase === PHASE.SCREENER) {
      // After the screener question, always enter deep dive
      session.domainPhase[domain]        = PHASE.DEEP_DIVE;
      session.domainPhaseAsked[domain]   = 0;
      session.domainPhaseCorrect[domain] = 0;
      return;
    }

    if (phase === PHASE.DEEP_DIVE) {
      const next = phaseAsked + 1;
      session.domainPhaseAsked[domain] = next;
      if (isCorrect) session.domainPhaseCorrect[domain] = (session.domainPhaseCorrect[domain] || 0) + 1;
      const phaseCorrect = session.domainPhaseCorrect[domain] || 0;

      // 3+ correct in deep-dive phase AND reached difficulty ≥ 3 → elevate to mastery
      if (next >= 2 && phaseCorrect >= DEEP_DIVE_CORRECT_STOP && state.difficulty >= 3) {
        session.domainPhase[domain]        = PHASE.MASTERY;
        session.domainPhaseAsked[domain]   = 0;
        session.domainPhaseCorrect[domain] = 0;
        return;
      }

      // Hit max deep-dive questions or a losing streak → done
      if (next >= DEEP_DIVE_MAX || state.streak <= DEEP_DIVE_WRONG_STOP) {
        session.domainPhase[domain] = PHASE.COMPLETE;
      }
      return;
    }

    if (phase === PHASE.MASTERY) {
      const next = phaseAsked + 1;
      session.domainPhaseAsked[domain] = next;
      if (next >= MASTERY_MAX) {
        session.domainPhase[domain] = PHASE.COMPLETE;
      }
    }
  }

  /** Returns the current overall assessment phase (drives the phase indicator). */
  function getAssessmentPhase(session) {
    const phases = Object.values(session.domainPhase || {});
    if (phases.some(p => p === PHASE.SCREENER))  return PHASE.SCREENER;
    if (phases.some(p => p === PHASE.DEEP_DIVE)) return PHASE.DEEP_DIVE;
    if (phases.some(p => p === PHASE.MASTERY))   return PHASE.MASTERY;
    return PHASE.COMPLETE;
  }

  /** Assessment is done when every domain has reached COMPLETE (or has no questions). */
  function isAssessmentComplete(session) {
    return DOMAINS.every(d => session.domainPhase[d] === PHASE.COMPLETE);
  }

  /**
   * Picks a domain that is currently in `phase` AND still has unasked questions.
   * Uses the same oldest-turn rotation logic as the original engine.
   */
  function chooseDomainForPhase(session, phase) {
    const askedSet = new Set(session.askedIds);
    const eligible = DOMAINS.filter(d =>
      session.domainPhase[d] === phase &&
      (questionsByDomain.get(d) || []).some(q => !askedSet.has(q.id))
    );

    if (!eligible.length) return null;

    const oldest = Math.min(...eligible.map(d => session.domainState[d].lastAskedTurn));
    const candidates = eligible.filter(d => session.domainState[d].lastAskedTurn === oldest);
    return pickRandom(candidates);
  }

  function getDomainCoverageBand(domain) {
    for (const [band, domains] of Object.entries(DOMAIN_COVERAGE_BANDS)) {
      if (domains.includes(domain)) {
        return band;
      }
    }
    return null;
  }

  function resumeSession() {
    if (!runtime.session) {
      return;
    }

    startSessionFlow(true);
  }

  // ── Timer helpers ──────────────────────────────────────────────────────────

  function startTimer(session) {
    stopTimer(); // clear any existing interval first
    updateTimerDisplay(getRemainingMs(session));

    runtime.timerInterval = setInterval(function () {
      const remaining = getRemainingMs(session);
      updateTimerDisplay(remaining);
      if (remaining <= 0) {
        stopTimer();
        session.timedOut = true;
        completeAssessment();
      }
    }, 1000);
  }

  function stopTimer() {
    if (runtime.timerInterval !== null) {
      clearInterval(runtime.timerInterval);
      runtime.timerInterval = null;
    }
  }

  function getRemainingMs(session) {
    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    return Math.max(0, ASSESSMENT_TIME_LIMIT_MS - elapsed);
  }

  function updateTimerDisplay(remainingMs) {
    if (!ui.timerDisplay || !ui.timerContainer) return;
    const totalSec = Math.ceil(remainingMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    ui.timerDisplay.textContent = min + ":" + String(sec).padStart(2, "0");

    // Visual state: normal → warning (≤10 min) → danger (≤5 min)
    ui.timerContainer.classList.remove("timer-warning", "timer-danger");
    if (remainingMs <= 5 * 60 * 1000) {
      ui.timerContainer.classList.add("timer-danger");
    } else if (remainingMs <= 10 * 60 * 1000) {
      ui.timerContainer.classList.add("timer-warning");
    }
  }

  // ── Session flow ───────────────────────────────────────────────────────────

  function startSessionFlow(isResume = false) {
    showView("assessment");
    setSessionPill("In Progress", false);
    startTimer(runtime.session);

    if (isResume && runtime.session.currentQuestionId) {
      const pendingQuestion = questionById.get(runtime.session.currentQuestionId);
      if (pendingQuestion && !runtime.session.askedIds.includes(pendingQuestion.id)) {
        renderQuestion(pendingQuestion);
        return;
      }
    }

    advanceToNextQuestion();
  }

  function advanceToNextQuestion() {
    const session = runtime.session;
    if (!session) {
      return;
    }

    if (isAssessmentComplete(session) || !hasUnaskedQuestionsForSession(session)) {
      completeAssessment();
      return;
    }

    const nextQuestion = chooseNextQuestionForSession(session);
    if (!nextQuestion) {
      completeAssessment();
      return;
    }

    renderQuestion(nextQuestion);
  }

  function hasUnaskedQuestionsForSession(session) {
    const askedSet = new Set(session.askedIds);
    return QUESTIONS.some((question) => !askedSet.has(question.id));
  }

  function chooseNextQuestionForSession(session) {
    const askedSet      = new Set(session.askedIds);
    const selectedTrack = normalizeTrack(session.student.track);

    // Auto-complete any domain that has exhausted its question pool
    for (const domain of DOMAINS) {
      if (session.domainPhase[domain] !== PHASE.COMPLETE) {
        const available = (questionsByDomain.get(domain) || []).filter(q => !askedSet.has(q.id));
        if (!available.length) {
          session.domainPhase[domain] = PHASE.COMPLETE;
        }
      }
    }

    if (isAssessmentComplete(session)) return null;

    // Walk phases in priority order: screener → deep-dive → mastery
    for (const phase of [PHASE.SCREENER, PHASE.DEEP_DIVE, PHASE.MASTERY]) {
      const domain = chooseDomainForPhase(session, phase);
      if (!domain) continue;

      const domainMeta = session.domainState[domain];

      let targetDifficulty;
      let lastOutcome;

      if (phase === PHASE.SCREENER) {
        targetDifficulty = SCREENER_DIFFICULTY;
        lastOutcome      = null;           // always start fresh
      } else if (phase === PHASE.MASTERY) {
        targetDifficulty = MASTERY_DIFFICULTY;
        lastOutcome      = domainMeta.lastOutcome;
      } else {
        targetDifficulty = domainMeta.difficulty;
        lastOutcome      = domainMeta.lastOutcome;
      }

      const question = selectQuestionFromDomain(domain, targetDifficulty, lastOutcome, askedSet, selectedTrack);
      if (question) return question;
    }

    return null;
  }

  function prioritizeDomainsForCoverage(session, candidateDomains) {
    if (!candidateDomains.length) {
      return [];
    }

    const target = session.targetQuestionCount;
    const bandTargets = {
      programming: Math.max(4, Math.round(target * 0.32)),
      mechanical: Math.max(4, Math.round(target * 0.32)),
      competition: Math.max(3, Math.round(target * 0.18))
    };

    if (!session.bandCoverage) {
      session.bandCoverage = createCoverageBandState();
    }

    const underCoveredBands = Object.keys(bandTargets)
      .filter((band) => (session.bandCoverage[band]?.asked || 0) < bandTargets[band])
      .sort((left, right) => {
        const leftDeficit = bandTargets[left] - (session.bandCoverage[left]?.asked || 0);
        const rightDeficit = bandTargets[right] - (session.bandCoverage[right]?.asked || 0);
        return rightDeficit - leftDeficit;
      });

    if (!underCoveredBands.length) {
      return [];
    }

    for (const band of underCoveredBands) {
      const inBand = candidateDomains.filter((domain) => getDomainCoverageBand(domain) === band);
      if (inBand.length) {
        return inBand;
      }
    }

    return [];
  }

  function selectQuestionFromDomain(domain, targetDifficulty, lastOutcome, askedSet, selectedTrack) {
    const pool = (questionsByDomain.get(domain) || []).filter((question) => !askedSet.has(question.id));
    if (!pool.length) {
      return null;
    }

    const difficultyPriority = buildDifficultyPriority(targetDifficulty, lastOutcome);

    for (const level of difficultyPriority) {
      const candidates = pool.filter((question) => question.difficulty === level);
      if (!candidates.length) {
        continue;
      }

      return pickWeightedByTrackPreference(candidates, selectedTrack);
    }

    const sorted = [...pool].sort(
      (left, right) => trackPreferenceScore(right.track, selectedTrack) - trackPreferenceScore(left.track, selectedTrack)
    );
    return sorted[0] || null;
  }

  function buildDifficultyPriority(targetDifficulty, lastOutcome) {
    const baseOffsets = lastOutcome === true
      ? [0, 1, -1, 2, -2, 3, -3, 4, -4]
      : (lastOutcome === false ? [0, -1, 1, -2, 2, -3, 3, -4, 4] : [0, -1, 1, -2, 2, -3, 3]);

    const ordered = [];
    for (const offset of baseOffsets) {
      const candidate = targetDifficulty + offset;
      if (candidate >= 1 && candidate <= MAX_DIFFICULTY && !ordered.includes(candidate)) {
        ordered.push(candidate);
      }
    }

    if (!ordered.length) {
      ordered.push(Math.max(1, Math.min(MAX_DIFFICULTY, targetDifficulty || 2)));
    }

    return ordered;
  }

  function trackPreferenceScore(questionTrack, selectedTrack) {
    if (selectedTrack === "general") {
      return 0.2;
    }

    if (questionTrack === selectedTrack) {
      return 0.45;
    }

    if (questionTrack === "general") {
      return 0.2;
    }

    if (selectedTrack === "fll" && questionTrack === "spike-block") {
      return 0.12;
    }

    if (selectedTrack === "spike-block" && questionTrack === "fll") {
      return 0.12;
    }

    if (selectedTrack === "pybricks" && questionTrack === "fll") {
      return 0.1;
    }

    return 0;
  }

  function pickWeightedByTrackPreference(candidates, selectedTrack) {
    if (!candidates.length) {
      return null;
    }

    const weighted = candidates.map((question) => ({
      question,
      weight: 1 + trackPreferenceScore(question.track, selectedTrack)
    }));

    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) {
        return item.question;
      }
    }

    return weighted[weighted.length - 1].question;
  }

  function renderQuestion(question) {
    const session = runtime.session;

    runtime.activeQuestion = question;
    runtime.selectedOptionIndex = null;
    runtime.questionLocked = false;

    session.currentQuestionId = question.id;
    session.questionStartedAt = Date.now();
    saveSession(session);

    ui.questionPrompt.textContent = question.question;
    ui.questionTypePill.textContent = (question.type || "mcq").toUpperCase();
    ui.questionTrackPill.textContent = `Track: ${formatTrack(question.track)}`;
    ui.questionLevelPill.textContent = LEVELS[question.difficulty] || `Level ${question.difficulty}`;
    ui.questionMetaLine.textContent = `Domain: ${question.domain} • Subtopic: ${humanizeSubtopic(question.subtopic)}`;

    updateAssessmentStatus(question.domain, session.domainState[question.domain].difficulty);
    renderQuestionImage(question);
    renderQuestionCode(question);
    renderOptions(question);

    ui.hintText.textContent = question.hint;
    ui.hintText.classList.add("hidden");
    ui.hintToggleButton.textContent = "Show Hint";

    ui.feedbackPanel.classList.add("hidden");
    ui.feedbackPanel.classList.remove("correct", "incorrect");
    ui.feedbackPanel.textContent = "";

    ui.submitButton.disabled = true;
    ui.nextButton.classList.add("hidden");
  }

  function updateAssessmentStatus(domain, domainDifficulty) {
    const session   = runtime.session;
    const completed = session.history.length;

    // Progress label: show question number + phase info
    const phase = getAssessmentPhase(session);
    const phaseLabel = phase === PHASE.SCREENER  ? "Screener"
                     : phase === PHASE.DEEP_DIVE ? "Deep Dive"
                     : phase === PHASE.MASTERY   ? "Mastery Check"
                     : "Finishing";

    ui.progressLabel.textContent        = `Question ${completed + 1} • ${phaseLabel}`;
    ui.currentDomainLabel.textContent   = domain;
    ui.domainDifficultyLabel.textContent = `Level ${domainDifficulty}`;

    // Estimate progress: screener = 0–33%, deep-dive = 33–66%, mastery = 66–100%
    const screenerDone  = DOMAINS.every(d => session.domainPhase[d] !== PHASE.SCREENER);
    const deepDiveDone  = DOMAINS.every(d => session.domainPhase[d] === PHASE.MASTERY || session.domainPhase[d] === PHASE.COMPLETE);
    const domainsComplete = DOMAINS.filter(d => session.domainPhase[d] === PHASE.COMPLETE).length;
    let pct;
    if (!screenerDone) {
      const screened = DOMAINS.filter(d => session.domainState[d].asked >= 1).length;
      pct = (screened / DOMAINS.length) * 33;
    } else if (!deepDiveDone) {
      pct = 33 + (domainsComplete / DOMAINS.length) * 33;
    } else {
      pct = 66 + (domainsComplete / DOMAINS.length) * 34;
    }
    ui.progressFill.style.width = `${Math.min(Math.round(pct), 98)}%`;

    updatePhaseIndicator(session);
  }

  function updatePhaseIndicator(session) {
    if (!ui.phaseStep1) return;

    const phase = getAssessmentPhase(session);
    const screenerDone = DOMAINS.every(d => session.domainPhase[d] !== PHASE.SCREENER);
    const deepDiveDone = DOMAINS.every(d =>
      session.domainPhase[d] === PHASE.MASTERY || session.domainPhase[d] === PHASE.COMPLETE);

    // Step 1
    ui.phaseStep1.className = "phase-step" +
      (phase === PHASE.SCREENER ? " active" : screenerDone ? " done" : "");
    // Step 2
    ui.phaseStep2.className = "phase-step" +
      (phase === PHASE.DEEP_DIVE ? " active" : deepDiveDone ? " done" : "");
    // Step 3
    ui.phaseStep3.className = "phase-step" +
      (phase === PHASE.MASTERY ? " active" : "");

    // Detail label
    if (ui.phaseDetailLabel) {
      if (phase === PHASE.SCREENER) {
        const screened = DOMAINS.filter(d => session.domainState[d].asked >= 1).length;
        ui.phaseDetailLabel.textContent = `${screened} of ${DOMAINS.length} domains screened`;
      } else if (phase === PHASE.DEEP_DIVE) {
        const inDive = DOMAINS.filter(d => session.domainPhase[d] === PHASE.DEEP_DIVE).length;
        ui.phaseDetailLabel.textContent = `${inDive} domain${inDive !== 1 ? "s" : ""} left`;
      } else if (phase === PHASE.MASTERY) {
        const inMastery = DOMAINS.filter(d => session.domainPhase[d] === PHASE.MASTERY).length;
        ui.phaseDetailLabel.textContent = `${inMastery} mastery check${inMastery !== 1 ? "s" : ""} left`;
      } else {
        ui.phaseDetailLabel.textContent = "Wrapping up…";
      }
    }
  }

  function renderQuestionImage(question) {
    if (question.image) {
      ui.questionImage.src = question.image;
      ui.questionImage.alt = question.imageAlt || "Question illustration";
      ui.questionImageCaption.textContent = `${question.domain} • ${humanizeSubtopic(question.subtopic)}`;
      ui.questionImageWrap.classList.remove("hidden");
      return;
    }

    ui.questionImage.src = "";
    ui.questionImage.alt = "";
    ui.questionImageCaption.textContent = "";
    ui.questionImageWrap.classList.add("hidden");
  }

  function renderQuestionCode(question) {
    if (question.code) {
      ui.questionCode.textContent = question.code;
      ui.questionCodeWrap.classList.remove("hidden");
      return;
    }

    ui.questionCode.textContent = "";
    ui.questionCodeWrap.classList.add("hidden");
  }

  function renderOptions(question) {
    ui.optionsList.innerHTML = "";

    question.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-btn";
      button.dataset.optionIndex = String(index);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");
      button.textContent = `${String.fromCharCode(65 + index)}. ${choice}`;
      ui.optionsList.appendChild(button);
    });
  }

  function handleOptionSelection(event) {
    const optionButton = event.target.closest(".option-btn");
    if (!optionButton || runtime.questionLocked) {
      return;
    }

    runtime.selectedOptionIndex = Number(optionButton.dataset.optionIndex);

    const buttons = ui.optionsList.querySelectorAll(".option-btn");
    buttons.forEach((button) => {
      const isSelected = Number(button.dataset.optionIndex) === runtime.selectedOptionIndex;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });

    ui.submitButton.disabled = false;
  }

  function toggleHint() {
    const isHidden = ui.hintText.classList.contains("hidden");
    ui.hintText.classList.toggle("hidden", !isHidden);
    ui.hintToggleButton.textContent = isHidden ? "Hide Hint" : "Show Hint";
  }

  function submitCurrentAnswer() {
    const session = runtime.session;
    const question = runtime.activeQuestion;

    if (!session || !question || runtime.selectedOptionIndex === null || runtime.questionLocked) {
      return;
    }

    runtime.questionLocked = true;

    const timeSpentSec = session.questionStartedAt
      ? Math.max(1, Math.round((Date.now() - session.questionStartedAt) / 1000))
      : null;

    const response = applyAnswerToSession(session, question, runtime.selectedOptionIndex, {
      timeSpentSec,
      answeredAt: new Date().toISOString()
    });

    saveSession(session);
    renderFeedback(question, response);

    ui.submitButton.disabled = true;
    ui.nextButton.classList.remove("hidden");

    if (isAssessmentComplete(session) || !hasUnaskedQuestionsForSession(session)) {
      ui.nextButton.textContent = "Finish Assessment";
    } else {
      ui.nextButton.textContent = "Next Question";
    }

    updateAssessmentStatus(question.domain, session.domainState[question.domain].difficulty);
  }

  function applyAnswerToSession(session, question, selectedIndex, meta = {}) {
    const isCorrect = selectedIndex === question.correctAnswer;
    const domainState = session.domainState[question.domain];

    domainState.asked += 1;
    domainState.correct += isCorrect ? 1 : 0;
    domainState.lastOutcome = isCorrect;
    domainState.lastAskedTurn = session.history.length;
    adaptDomainDifficulty(domainState, isCorrect);

    const domainBand = getDomainCoverageBand(question.domain);
    if (domainBand) {
      if (!session.bandCoverage) {
        session.bandCoverage = createCoverageBandState();
      }
      session.bandCoverage[domainBand].asked += 1;
      session.bandCoverage[domainBand].correct += isCorrect ? 1 : 0;
    }

    const response = {
      questionId: question.id,
      domain: question.domain,
      subtopic: question.subtopic,
      track: question.track,
      tags: question.tags.join("|"),
      difficulty: question.difficulty,
      questionType: question.type,
      questionText: question.question,
      domainBand,
      selectedIndex,
      selectedText: question.choices[selectedIndex],
      correctIndex: question.correctAnswer,
      correctText: question.choices[question.correctAnswer],
      isCorrect,
      timeSpentSec: meta.timeSpentSec ?? null,
      answeredAt: meta.answeredAt || new Date().toISOString()
    };

    session.history.push(response);
    session.askedIds.push(question.id);
    session.currentQuestionId  = null;
    session.questionStartedAt  = null;

    // Advance the domain's phase based on new evidence
    updateDomainPhase(session, question.domain);

    return response;
  }

  function adaptDomainDifficulty(domainState, isCorrect) {
    if (isCorrect) {
      domainState.streak = domainState.streak >= 0 ? domainState.streak + 1 : 1;
      if (domainState.streak >= 2 && domainState.difficulty < MAX_DIFFICULTY) {
        domainState.difficulty += 1;
        domainState.streak = 0;
      }
      return;
    }

    domainState.streak = domainState.streak <= 0 ? domainState.streak - 1 : -1;
    if (domainState.streak <= -2 && domainState.difficulty > 1) {
      domainState.difficulty -= 1;
      domainState.streak = 0;
    }
  }

  function renderFeedback(question, response) {
    const correctnessText = response.isCorrect ? "Correct" : "Not yet";

    ui.feedbackPanel.classList.remove("hidden", "correct", "incorrect");
    ui.feedbackPanel.classList.add(response.isCorrect ? "correct" : "incorrect");
    ui.feedbackPanel.textContent = `${correctnessText}. ${question.explanation}`;

    const optionButtons = ui.optionsList.querySelectorAll(".option-btn");
    optionButtons.forEach((button) => {
      const optionIndex = Number(button.dataset.optionIndex);
      button.disabled = true;

      if (optionIndex === question.correctAnswer) {
        button.classList.add("option-correct");
      }

      if (!response.isCorrect && optionIndex === response.selectedIndex) {
        button.classList.add("option-incorrect");
      }
    });
  }

  function completeAssessment() {
    const session = runtime.session;
    if (!session) {
      return;
    }

    stopTimer();

    session.status = "complete";
    session.completedAt = new Date().toISOString();
    session.analytics = buildAnalytics(session);

    saveSession(session);
    showResults(session.analytics);
    showView("results");
    setSessionPill("Complete", false);

    // Show timed-out notice if applicable
    const notice = document.getElementById("timeout-notice");
    if (notice) notice.classList.toggle("hidden", !session.timedOut);
  }

  function buildAnalytics(session) {
    const questionWeight = (difficulty) => 1 + (difficulty - 1) * 0.35;

    let weightedEarned = 0;
    let weightedPossible = 0;

    const domainProfiles = DOMAINS.map((domain) => {
      const responses = session.history.filter((entry) => entry.domain === domain);
      const weightedDomainPossible = responses.reduce((sum, entry) => sum + questionWeight(entry.difficulty), 0);
      const weightedDomainEarned = responses.reduce(
        (sum, entry) => sum + (entry.isCorrect ? questionWeight(entry.difficulty) : 0),
        0
      );

      const scorePercent = weightedDomainPossible > 0
        ? Math.round((weightedDomainEarned / weightedDomainPossible) * 100)
        : 0;

      weightedEarned += weightedDomainEarned;
      weightedPossible += weightedDomainPossible;

      return {
        domain,
        answered: responses.length,
        correct: responses.filter((entry) => entry.isCorrect).length,
        scorePercent,
        currentDifficulty: session.domainState[domain].difficulty
      };
    });

    const overallScore = weightedPossible > 0 ? Math.round((weightedEarned / weightedPossible) * 100) : 0;

    const answeredProfiles = domainProfiles
      .filter((profile) => profile.answered > 0)
      .sort((left, right) => right.scorePercent - left.scorePercent);

    const strongestDomains = answeredProfiles.slice(0, 3).map((profile) => profile.domain);
    const weakestDomains = [...answeredProfiles].reverse().slice(0, 3).map((profile) => profile.domain);
    const domainsNeedingPractice = answeredProfiles
      .filter((profile) => profile.scorePercent < 58)
      .map((profile) => profile.domain);

    const prioritizedPracticeDomains = domainsNeedingPractice.length
      ? domainsNeedingPractice
      : weakestDomains.slice(0, 2);

    const placement = determinePlacement(overallScore, domainProfiles);
    const trackReadiness = buildTrackReadiness(domainProfiles, session.targetQuestionCount);
    const teacherSummary = generateTeacherSummary(
      session,
      overallScore,
      placement,
      domainProfiles,
      strongestDomains,
      weakestDomains,
      trackReadiness
    );
    const recommendedNextPlacement = buildRecommendedNextPlacement(placement, trackReadiness, prioritizedPracticeDomains);
    const familySummary = buildFamilySummary(session, overallScore, placement, strongestDomains, prioritizedPracticeDomains);

    return {
      overallScore,
      placement,
      domainProfiles,
      strongestDomains,
      weakestDomains,
      domainsNeedingPractice: prioritizedPracticeDomains,
      trackReadiness,
      teacherSummary,
      familySummary,
      recommendedNextPlacement,
      answeredCount: session.history.length,
      generatedAt: new Date().toISOString()
    };
  }

  function determinePlacement(overallScore, domainProfiles) {
    const domainScores = domainProfiles.map((profile) => profile.scorePercent);
    const minDomain = Math.min(...domainScores);
    const countBelow40 = domainScores.filter((score) => score < 40).length;

    let level;
    if (LEVELS[5] && overallScore >= 92) {
      level = 5;
    } else if (overallScore >= 82) {
      level = 4;
    } else if (overallScore >= 66) {
      level = 3;
    } else if (overallScore >= 46) {
      level = 2;
    } else {
      level = 1;
    }

    if (countBelow40 >= 3) {
      level = Math.min(level, 2);
    }

    if (minDomain < 25) {
      level = 1;
    }

    if (level === 5) {
      const pybricksScore = getDomainScore(domainProfiles, "Pybricks / Python Coding");
      const fundamentalsScore = getDomainScore(domainProfiles, "Programming Fundamentals");
      if (pybricksScore < 70 || fundamentalsScore < 70) {
        level = 4;
      }
    }

    let rationale;
    if (level === 5) {
      rationale = "Demonstrates advanced coding depth, including strong readiness for Pybricks-focused work.";
    } else if (level === 4) {
      rationale = "Shows strong cross-domain consistency and competition-ready reliability.";
    } else if (level === 3) {
      rationale = "Demonstrates independent problem-solving with specific domains to strengthen.";
    } else if (level === 2) {
      rationale = "Developing builder profile; benefits from structured coaching in weaker domains.";
    } else {
      rationale = "Needs foundational support and scaffolded practice before advanced tasks.";
    }

    return {
      level,
      label: LEVELS[level] || `Level ${level}`,
      rationale
    };
  }

  function getDomainScore(domainProfiles, domainName) {
    const profile = domainProfiles.find((entry) => entry.domain === domainName);
    return profile ? profile.scorePercent : 0;
  }

  function buildTrackReadiness(domainProfiles, targetQuestionCount) {
    const domainMap = new Map(domainProfiles.map((profile) => [profile.domain, profile]));
    const perDomainExpected = targetQuestionCount / Math.max(1, DOMAINS.length);
    const readiness = {};

    Object.entries(TRACK_READINESS_MODELS).forEach(([trackKey, model]) => {
      const weightedScores = Object.entries(model.domains).map(([domain, weight]) => {
        const profile = domainMap.get(domain);
        return {
          domain,
          weight,
          score: profile ? profile.scorePercent : 0,
          answered: profile ? profile.answered : 0
        };
      });

      const weightedTotal = weightedScores.reduce((sum, entry) => sum + (entry.score * entry.weight), 0);
      const totalWeight = weightedScores.reduce((sum, entry) => sum + entry.weight, 0) || 1;
      const baseScore = weightedTotal / totalWeight;

      const expectedEvidence = weightedScores.length * perDomainExpected;
      const answeredEvidence = weightedScores.reduce((sum, entry) => sum + entry.answered, 0);
      const evidenceRatio = expectedEvidence > 0 ? clamp(answeredEvidence / expectedEvidence, 0.62, 1) : 1;
      const adjustedScore = Math.round(baseScore * evidenceRatio * 10) / 10;

      readiness[trackKey] = {
        key: trackKey,
        label: model.label,
        score: adjustedScore,
        band: getReadinessBand(adjustedScore),
        evidenceRatio: Math.round(evidenceRatio * 100),
        contributingDomains: weightedScores.map((entry) => entry.domain)
      };
    });

    return readiness;
  }

  function getReadinessBand(score) {
    if (score >= 82) {
      return "Advanced";
    }
    if (score >= 68) {
      return "Ready";
    }
    if (score >= 50) {
      return "Developing";
    }
    return "Emerging";
  }

  function generateTeacherSummary(session, overallScore, placement, domainProfiles, strongestDomains, weakestDomains, trackReadiness) {
    const strongText = strongestDomains.slice(0, 2).join(" and ") || "no clear strengths yet";
    const weakText = weakestDomains.slice(0, 2).join(" and ") || "no clear support areas yet";

    const coachingNotes = weakestDomains
      .slice(0, 2)
      .map((domain) => domainCoachingNotes[domain])
      .filter(Boolean)
      .join(" ");

    const pybricksProfile = domainProfiles.find((profile) => profile.domain === "Pybricks / Python Coding");
    const pybricksObservation = pybricksProfile && pybricksProfile.scorePercent <= 45
      ? " Limited experience with Pybricks syntax and structure is currently evident."
      : "";

    const readinessHighlights = [
      formatReadinessHighlight(trackReadiness.general),
      formatReadinessHighlight(trackReadiness["spike-block"]),
      formatReadinessHighlight(trackReadiness.pybricks),
      formatReadinessHighlight(trackReadiness.fll)
    ].filter(Boolean).join(" ");

    const studentLabel = session.student.name
      ? `${session.student.name}${session.student.grade ? ` (Grade ${session.student.grade})` : ""}`
      : "This student";

    return `${studentLabel} completed ${session.history.length} adaptive questions with an overall weighted score of ${overallScore}%. Recommended placement: ${placement.label}. Strongest domains observed: ${strongText}. Developing domains: ${weakText}.${pybricksObservation} ${readinessHighlights} ${coachingNotes}`.trim();
  }

  function formatReadinessHighlight(readiness) {
    if (!readiness) {
      return "";
    }
    return `${readiness.label} readiness is ${readiness.band.toLowerCase()} (${readiness.score}%).`;
  }

  function buildRecommendedNextPlacement(placement, trackReadiness, practiceDomains) {
    const rankedTracks = Object.values(trackReadiness || {}).sort((left, right) => right.score - left.score);
    const strongestTrack = rankedTracks[0] || { label: "General Robotics" };
    const trackLabel = strongestTrack.label;

    if (placement.level <= 1) {
      return `Place in ${trackLabel} Foundations with guided practice in ${practiceDomains.slice(0, 2).join(" and ")}.`;
    }

    if (placement.level === 2) {
      return `Place in Developing Builder Lab (${trackLabel}) and schedule focused support for ${practiceDomains.slice(0, 2).join(" and ")}.`;
    }

    if (placement.level === 3) {
      return `Place in Independent Problem Solver Studio (${trackLabel}) with targeted extension in ${practiceDomains.slice(0, 2).join(" and ")}.`;
    }

    if (placement.level === 4) {
      return `Place in Competition Ready Team Prep (${trackLabel}) and assign advanced mission reliability work.`;
    }

    return "Place in Advanced Coding / Pybricks Team and provide challenge projects with mentorship opportunities.";
  }

  function buildFamilySummary(session, overallScore, placement, strongestDomains, practiceDomains) {
    const studentName = session.student.name || "The student";
    const strengths = strongestDomains.slice(0, 2).join(" and ") || "several core robotics domains";
    const growth = practiceDomains.slice(0, 2).join(" and ") || "a few targeted domains";

    return `${studentName} is currently placed at ${placement.label} with a weighted score of ${overallScore}%. They are showing strong progress in ${strengths}, and the next growth focus is ${growth}. This placement helps build confidence while preparing for higher-level SPIKE Prime and FLL challenges.`;
  }

  function showResults(analytics) {
    const session = runtime.session;
    const completedAt = session.completedAt || analytics.generatedAt;
    const strongestDomains = Array.isArray(analytics.strongestDomains) ? analytics.strongestDomains : [];
    const weakestDomains = Array.isArray(analytics.weakestDomains) ? analytics.weakestDomains : [];
    const domainsNeedingPractice = Array.isArray(analytics.domainsNeedingPractice) ? analytics.domainsNeedingPractice : [];

    ui.resultStudentName.textContent = session.student.name
      ? `${session.student.name}${session.student.grade ? ` • Grade ${session.student.grade}` : ""}${session.student.team ? ` • ${session.student.team}` : ""}`
      : "-";
    ui.resultDateCompleted.textContent = formatReportDate(completedAt);
    ui.resultTrack.textContent = formatTrack(session.student.track);
    ui.overallScore.textContent = `${analytics.overallScore}%`;
    ui.placementRecommendation.textContent = `${analytics.placement.label} — ${analytics.placement.rationale}`;
    ui.strongestDomains.textContent = strongestDomains.length ? strongestDomains.join(", ") : "-";
    ui.weakestDomains.textContent = weakestDomains.length ? weakestDomains.join(", ") : "-";
    ui.domainsNeedingPractice.textContent = domainsNeedingPractice.length ? domainsNeedingPractice.join(", ") : "-";
    ui.teacherSummary.textContent = analytics.teacherSummary;
    renderTrackReadinessList(ui.trackReadinessList, analytics.trackReadiness);

    ui.reportStudentName.textContent = session.student.name || "-";
    ui.reportDateCompleted.textContent = formatReportDate(completedAt);
    ui.reportTrack.textContent = formatTrack(session.student.track);
    ui.reportPlacement.textContent = analytics.placement.label;
    ui.reportScore.textContent = `${analytics.overallScore}%`;
    ui.reportNextPlacement.textContent = analytics.recommendedNextPlacement || "-";
    ui.reportStrongestDomains.textContent = strongestDomains.length ? strongestDomains.join(", ") : "-";
    ui.reportWeakestDomains.textContent = weakestDomains.length ? weakestDomains.join(", ") : "-";
    ui.reportNeedingPractice.textContent = domainsNeedingPractice.length ? domainsNeedingPractice.join(", ") : "-";
    renderTrackReadinessList(ui.reportTrackReadinessList, analytics.trackReadiness);
    ui.reportTeacherSummary.textContent = analytics.teacherSummary;
    ui.reportFamilySummary.textContent = analytics.familySummary || "-";
    ui.reportSaveFeedback.textContent = "";
    ui.reportSaveFeedback.classList.add("hidden");

    renderDomainProfiles(analytics.domainProfiles);
    renderHistory(session.history);
    renderSavedReportHistory();
  }

  function renderTrackReadinessList(targetElement, trackReadiness) {
    if (!targetElement) {
      return;
    }

    targetElement.innerHTML = "";
    const items = Object.values(trackReadiness || {}).sort((left, right) => right.score - left.score);

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "readiness-item";
      empty.textContent = "No readiness data available.";
      targetElement.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "readiness-item";

      const label = document.createElement("span");
      label.textContent = `${item.label}: ${item.band}`;

      const score = document.createElement("span");
      score.className = "readiness-score";
      score.textContent = `${item.score}%`;

      row.appendChild(label);
      row.appendChild(score);
      targetElement.appendChild(row);
    });
  }

  function renderDomainProfiles(domainProfiles) {
    ui.domainProfiles.innerHTML = "";

    for (const profile of domainProfiles) {
      const profileCard = document.createElement("div");
      profileCard.className = "profile-card";

      const title = document.createElement("h4");
      title.textContent = profile.domain;

      const stat = document.createElement("p");
      stat.className = "profile-stats";
      stat.textContent = `${profile.scorePercent}% • ${profile.correct}/${profile.answered} correct • adaptive level ${profile.currentDifficulty}`;

      const meter = document.createElement("div");
      meter.className = "profile-meter";

      const meterFill = document.createElement("div");
      meterFill.className = "profile-meter-fill";
      meterFill.style.width = `${profile.scorePercent}%`;

      meter.appendChild(meterFill);
      profileCard.appendChild(title);
      profileCard.appendChild(stat);
      profileCard.appendChild(meter);
      ui.domainProfiles.appendChild(profileCard);
    }
  }

  function renderHistory(history) {
    ui.historyBody.innerHTML = "";

    history.forEach((entry, index) => {
      const row = document.createElement("tr");

      const values = [
        String(index + 1),
        entry.domain,
        humanizeSubtopic(entry.subtopic),
        `Level ${entry.difficulty}`,
        formatTrack(entry.track),
        entry.isCorrect ? "Correct" : "Needs Review",
        entry.selectedText,
        entry.correctText
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      ui.historyBody.appendChild(row);
    });
  }

  function handlePrintReport() {
    document.body.classList.add("print-report-mode");
    window.print();
  }

  function handleSaveReportToHistory() {
    const session = runtime.session;
    if (!session || !session.analytics) {
      return;
    }

    const reportRecord = {
      savedAt: new Date().toISOString(),
      studentName: session.student.name || "Unnamed Student",
      track: formatTrack(session.student.track),
      placement: session.analytics.placement.label,
      weightedScore: session.analytics.overallScore,
      strongestDomains: session.analytics.strongestDomains,
      weakestDomains: session.analytics.weakestDomains,
      domainsNeedingPractice: session.analytics.domainsNeedingPractice,
      nextPlacement: session.analytics.recommendedNextPlacement
    };

    const existingHistory = loadReportHistory();
    existingHistory.unshift(reportRecord);

    const trimmedHistory = existingHistory.slice(0, 40);
    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(trimmedHistory));
    renderSavedReportHistory(trimmedHistory);

    ui.reportSaveFeedback.textContent = `Report saved locally (${trimmedHistory.length} stored).`;
    ui.reportSaveFeedback.classList.remove("hidden");
  }

  function loadReportHistory() {
    const raw = localStorage.getItem(REPORT_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Failed to parse report history", error);
      return [];
    }
  }

  function renderSavedReportHistory(historyOverride) {
    if (!ui.savedReportList) {
      return;
    }

    const history = Array.isArray(historyOverride) ? historyOverride : loadReportHistory();
    ui.savedReportList.innerHTML = "";

    if (!history.length) {
      const emptyRow = document.createElement("li");
      emptyRow.textContent = "No saved reports yet.";
      ui.savedReportList.appendChild(emptyRow);
      return;
    }

    history.slice(0, 6).forEach((entry) => {
      const item = document.createElement("li");
      const savedDate = formatReportDate(entry.savedAt);
      item.textContent = `${savedDate} • ${entry.studentName} • ${entry.placement} • ${entry.weightedScore}%`;
      ui.savedReportList.appendChild(item);
    });
  }

  function formatReportDate(dateValue) {
    if (!dateValue) {
      return "-";
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function handleRunSingleSimulation() {
    const profileKey = getSimulationProfileKey();
    const profile = simulationProfiles[profileKey];
    if (!profile) {
      return;
    }

    const simulatedSession = runSingleSimulatedStudent(profileKey, 1);
    const summary = summarizeSimulationBatch([simulatedSession], profile);
    renderSimulationSummary(summary, profile);
  }

  function handleRunBatchSimulation() {
    const profileKey = getSimulationProfileKey();
    const profile = simulationProfiles[profileKey];
    if (!profile) {
      return;
    }

    const count = getSimulationCount();
    const sessions = runBatchSimulatedStudents(profileKey, count);
    const summary = summarizeSimulationBatch(sessions, profile);
    renderSimulationSummary(summary, profile);
  }

  function getSimulationProfileKey() {
    const selected = ui.simProfileSelect?.value;
    return simulationProfiles[selected] ? selected : "beginner";
  }

  function getSimulationCount() {
    const raw = Number(ui.simStudentCount?.value);
    if (!Number.isFinite(raw)) {
      return 1;
    }

    return Math.max(1, Math.min(250, Math.round(raw)));
  }

  // Runs one synthetic student through the exact adaptive domain engine.
  function runSingleSimulatedStudent(profileKey, runNumber) {
    const profile = simulationProfiles[profileKey];
    const student = {
      name: `Sim ${profile.label} ${String(runNumber).padStart(3, "0")}`,
      grade: "",
      team: "Simulation",
      track: profile.defaultTrack
    };

    const simSession = createNewSession(student);
    const baseTime = Date.now();

    while (!isAssessmentComplete(simSession) && hasUnaskedQuestionsForSession(simSession) && simSession.history.length < 120) {
      const question = chooseNextQuestionForSession(simSession);
      if (!question) {
        break;
      }

      const selectedIndex = pickSimulatedAnswerIndex(profile, simSession, question);
      applyAnswerToSession(simSession, question, selectedIndex, {
        timeSpentSec: randomInteger(4, 25),
        answeredAt: new Date(baseTime + simSession.history.length * 13000).toISOString()
      });
    }

    simSession.status = "complete";
    simSession.completedAt = new Date().toISOString();
    simSession.analytics = buildAnalytics(simSession);
    return simSession;
  }

  function runBatchSimulatedStudents(profileKey, count) {
    const sessions = [];
    for (let index = 1; index <= count; index += 1) {
      sessions.push(runSingleSimulatedStudent(profileKey, index));
    }
    return sessions;
  }

  function pickSimulatedAnswerIndex(profile, session, question) {
    const probability = calculateSimulationSuccessProbability(profile, session, question);
    const isCorrect = Math.random() < probability;

    if (isCorrect) {
      return question.correctAnswer;
    }

    const incorrectIndexes = question.choices
      .map((_, idx) => idx)
      .filter((idx) => idx !== question.correctAnswer);

    return pickRandom(incorrectIndexes);
  }

  function calculateSimulationSuccessProbability(profile, session, question) {
    const domainSkill = getSimulationDomainSkill(profile, question.domain);
    const difficultyModifiers = {
      1: 0.16,
      2: 0.06,
      3: -0.08,
      4: -0.2,
      5: -0.3
    };

    const trackMatch = question.track === session.student.track
      ? 0.05
      : (question.track === "general" ? 0.02 : -0.06);

    const domainStreak = session.domainState[question.domain]?.streak || 0;
    const streakAdjustment = domainStreak > 0
      ? Math.min(0.06, domainStreak * 0.02)
      : Math.max(-0.06, domainStreak * 0.02);

    const raw = domainSkill + (difficultyModifiers[question.difficulty] || -0.12) + trackMatch + streakAdjustment;
    return clamp(raw, 0.03, 0.97);
  }

  function getSimulationDomainSkill(profile, domain) {
    if (!profile || !profile.domainSkill) {
      return 0.5;
    }
    return typeof profile.domainSkill[domain] === "number" ? profile.domainSkill[domain] : 0.5;
  }

  // Aggregates batch-level score and domain trends for teacher planning.
  function summarizeSimulationBatch(simulatedSessions, profile) {
    const count = simulatedSessions.length;
    const placementDistribution = {};
    const domainTotals = {};
    const readinessTotals = {
      general: 0,
      "spike-block": 0,
      pybricks: 0,
      fll: 0
    };
    let totalScore = 0;

    for (const levelLabel of Object.values(LEVELS)) {
      placementDistribution[levelLabel] = 0;
    }
    for (const domain of DOMAINS) {
      domainTotals[domain] = 0;
    }

    for (const session of simulatedSessions) {
      totalScore += session.analytics.overallScore;

      const placementLabel = session.analytics.placement.label;
      placementDistribution[placementLabel] = (placementDistribution[placementLabel] || 0) + 1;

      Object.keys(readinessTotals).forEach((key) => {
        readinessTotals[key] += session.analytics.trackReadiness?.[key]?.score || 0;
      });

      for (const profileItem of session.analytics.domainProfiles) {
        domainTotals[profileItem.domain] += profileItem.scorePercent;
      }
    }

    const averageScore = count ? Math.round((totalScore / count) * 10) / 10 : 0;

    const domainAverages = DOMAINS.map((domain) => ({
      domain,
      avgScore: count ? Math.round((domainTotals[domain] / count) * 10) / 10 : 0
    })).sort((left, right) => right.avgScore - left.avgScore);

    const strongestDomains = domainAverages.slice(0, 3).map((entry) => entry.domain);
    const weakestDomains = [...domainAverages].reverse().slice(0, 3).map((entry) => entry.domain);
    const domainsNeedingPractice = domainAverages
      .filter((entry) => entry.avgScore < 55)
      .map((entry) => entry.domain);

    const avgTrackReadiness = Object.keys(readinessTotals).reduce((acc, key) => {
      const score = count ? Math.round((readinessTotals[key] / count) * 10) / 10 : 0;
      acc[key] = {
        label: TRACK_READINESS_MODELS[key].label,
        score,
        band: getReadinessBand(score)
      };
      return acc;
    }, {});

    return {
      profileLabel: profile.label,
      totalStudents: count,
      averageScore,
      placementDistribution,
      strongestDomains,
      weakestDomains,
      avgTrackReadiness,
      domainsNeedingPractice: domainsNeedingPractice.length ? domainsNeedingPractice : weakestDomains
    };
  }

  function renderSimulationSummary(summary, profile) {
    if (!ui.simSummaryPanel) {
      return;
    }

    ui.simSummaryPanel.classList.remove("hidden");
    ui.simSummaryLine.textContent = `${summary.totalStudents} simulated ${summary.totalStudents === 1 ? "student" : "students"} using profile \"${profile.label}\". Average weighted score: ${summary.averageScore}%.`;

    ui.simPlacementDistribution.innerHTML = "";
    Object.keys(summary.placementDistribution).forEach((label) => {
      const value = summary.placementDistribution[label];
      if (!value) {
        return;
      }

      const row = document.createElement("div");
      row.className = "sim-distribution-row";

      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;
      const valueSpan = document.createElement("span");
      valueSpan.textContent = String(value);

      row.appendChild(labelSpan);
      row.appendChild(valueSpan);
      ui.simPlacementDistribution.appendChild(row);
    });

    ui.simDomainInsights.textContent = `Strongest domains: ${summary.strongestDomains.join(", ")}. Weakest domains: ${summary.weakestDomains.join(", ")}. Domains needing practice: ${summary.domainsNeedingPractice.join(", ")}.`;

    if (ui.simTrackReadiness) {
      const readinessText = Object.values(summary.avgTrackReadiness || {})
        .map((item) => `${item.label}: ${item.score}% (${item.band})`)
        .join(" | ");
      ui.simTrackReadiness.textContent = `Average track readiness: ${readinessText}`;
    }
  }

  function exportJson() {
    const session = runtime.session;
    if (!session) {
      return;
    }

    const analytics = session.analytics || buildAnalytics(session);

    const payload = {
      metadata: {
        app: APP_CONFIG.assessmentTitle || "SPIKE Prime + FLL Adaptive Placement Assessment",
        exportedAt: new Date().toISOString(),
        schemaVersion: 3
      },
      student: session.student,
      selectedTrack: session.student.track,
      completedAt: session.completedAt || analytics.generatedAt,
      placement: analytics.placement,
      overallScore: analytics.overallScore,
      trackReadiness: analytics.trackReadiness,
      strongestDomains: analytics.strongestDomains,
      weakestDomains: analytics.weakestDomains,
      domainsNeedingPractice: analytics.domainsNeedingPractice,
      domainProfiles: analytics.domainProfiles,
      teacherSummary: analytics.teacherSummary,
      familySummary: analytics.familySummary,
      recommendedNextPlacement: analytics.recommendedNextPlacement,
      questionHistory: session.history
    };

    const fileName = buildExportFileName(session.student.name || "student", session.student.track, "json");
    downloadFile(fileName, "application/json;charset=utf-8", JSON.stringify(payload, null, 2));
  }

  function exportCsv() {
    const session = runtime.session;
    if (!session) {
      return;
    }

    const analytics = session.analytics || buildAnalytics(session);

    const header = [
      "student_name",
      "grade",
      "team",
      "selected_track",
      "completed_at",
      "overall_placement",
      "overall_weighted_score",
      "teacher_summary",
      "domain_performance_summary",
      "readiness_general",
      "readiness_spike_block",
      "readiness_pybricks",
      "readiness_fll",
      "question_number",
      "question_id",
      "domain",
      "subtopic",
      "question_track",
      "difficulty",
      "question_type",
      "result",
      "selected_answer",
      "correct_answer",
      "tags",
      "time_spent_sec",
      "answered_at"
    ];

    const readiness = analyticsTrackReadinessForExport(analytics);
    const domainSummary = analytics.domainProfiles
      .map((entry) => `${entry.domain}:${entry.scorePercent}%`)
      .join(" | ");
    const teacherSummary = analytics.teacherSummary;
    const placementLabel = analytics.placement.label;
    const overallScore = analytics.overallScore;
    const completedAt = session.completedAt || analytics.generatedAt || new Date().toISOString();

    const rows = session.history.map((entry, index) => [
      session.student.name || "",
      session.student.grade || "",
      session.student.team || "",
      session.student.track || "",
      completedAt,
      placementLabel,
      String(overallScore),
      teacherSummary,
      domainSummary,
      readiness.general,
      readiness.spikeBlock,
      readiness.pybricks,
      readiness.fll,
      String(index + 1),
      entry.questionId,
      entry.domain,
      entry.subtopic,
      entry.track,
      String(entry.difficulty),
      entry.questionType,
      entry.isCorrect ? "correct" : "incorrect",
      entry.selectedText,
      entry.correctText,
      entry.tags || "",
      entry.timeSpentSec === null || entry.timeSpentSec === undefined ? "" : String(entry.timeSpentSec),
      entry.answeredAt
    ]);

    const csvLines = [header, ...rows].map((row) => row.map(escapeCsvCell).join(","));
    const csvContent = csvLines.join("\n");

    const fileName = buildExportFileName(session.student.name || "student", session.student.track, "csv");
    downloadFile(fileName, "text/csv;charset=utf-8", csvContent);
  }

  // ── HTML Report Generator ─────────────────────────────────────────────────

  function handleHtmlReport() {
    const session = runtime.session;
    if (!session || !session.analytics) {
      return;
    }

    const html = buildReportHtml(session);
    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow pop-ups for this page, then click 'View Full Report' again.");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  function buildReportHtml(session) {
    const a = session.analytics;
    const s = session.student;

    function esc(v) {
      return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function simpleHumanize(subtopic) {
      return String(subtopic || "general")
        .replace(/[_-]/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }

    const completedDate = session.completedAt
      ? new Date(session.completedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
      : "-";
    const generatedDate = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

    // ── Chart data ────────────────────────────────────────────────────────
    const sortedProfiles = [
      ...a.domainProfiles.filter((p) => p.answered > 0).sort((x, y) => y.scorePercent - x.scorePercent),
      ...a.domainProfiles.filter((p) => p.answered === 0)
    ];

    const domainLabels = sortedProfiles.map((p) => p.domain);
    const domainScores = sortedProfiles.map((p) => p.scorePercent);
    const domainCorrects = sortedProfiles.map((p) => p.correct);
    const domainAnswered = sortedProfiles.map((p) => p.answered);
    const domainColors = domainScores.map((score) => score >= 70 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444");

    const sortedTracks = Object.values(a.trackReadiness).sort((x, y) => y.score - x.score);
    const trackLabels = sortedTracks.map((t) => t.label);
    const trackScores = sortedTracks.map((t) => t.score);
    const trackBands = sortedTracks.map((t) => t.band);
    const trackColors = trackScores.map((score) => score >= 82 ? "#1e40af" : score >= 68 ? "#3b82f6" : score >= 50 ? "#f59e0b" : "#ef4444");

    const bandDomains = {
      programming: ["Programming Fundamentals", "SPIKE Prime Block Coding", "Pybricks / Python Coding", "Debugging & Code Analysis", "Robot Behavior Prediction", "Robotics Math"],
      mechanical: ["Robot Building Fundamentals", "SPIKE Prime Hardware & Sensors", "Attachments", "Drivetrain & Wheels", "Gears & Mechanisms", "Safety & Kit Care"],
      competition: ["Engineering Process & GitHub", "FLL Competition Strategy", "Teamwork & Innovation Project"]
    };

    function bandAvg(domains) {
      const profiles = a.domainProfiles.filter((p) => domains.includes(p.domain) && p.answered > 0);
      if (!profiles.length) {
        return 0;
      }
      return Math.round(profiles.reduce((sum, p) => sum + p.scorePercent, 0) / profiles.length);
    }

    const radarScores = [bandAvg(bandDomains.programming), bandAvg(bandDomains.mechanical), bandAvg(bandDomains.competition)];

    const correctCount = session.history.filter((h) => h.isCorrect).length;
    const incorrectCount = session.history.length - correctCount;

    // ── Styling helpers ───────────────────────────────────────────────────
    const level = a.placement.level;
    const placementBg = level >= 4 ? "#15803d" : level === 3 ? "#1d4ed8" : level === 2 ? "#b45309" : "#6b7280";
    const scoreColor = a.overallScore >= 82 ? "#15803d" : a.overallScore >= 66 ? "#1d4ed8" : a.overallScore >= 46 ? "#b45309" : "#6b7280";

    const strongList = (a.strongestDomains || []).slice(0, 3);
    const practiceList = (a.domainsNeedingPractice || []).slice(0, 4);

    // ── History table rows ────────────────────────────────────────────────
    const historyRows = session.history.map((h, i) => `<tr style="background:${h.isCorrect ? "#f0fdf4" : "#fff7f7"}">
        <td style="text-align:center;font-weight:700;color:#64748b">${i + 1}</td>
        <td style="font-size:11px">${esc(h.domain)}</td>
        <td style="font-size:11px;color:#64748b">${esc(simpleHumanize(h.subtopic))}</td>
        <td style="text-align:center;font-size:11px">Lv ${h.difficulty}</td>
        <td style="text-align:center;font-weight:800;font-size:14px;color:${h.isCorrect ? "#16a34a" : "#dc2626"}">${h.isCorrect ? "✓" : "✗"}</td>
        <td style="font-size:11px;max-width:180px">${esc(h.selectedText)}</td>
        <td style="font-size:11px;color:#16a34a;max-width:180px">${esc(h.correctText)}</td>
        <td style="text-align:center;color:#94a3b8;font-size:11px">${h.timeSpentSec != null ? h.timeSpentSec + "s" : "—"}</td>
      </tr>`).join("");

    const chartDataJson = JSON.stringify({
      domainLabels, domainScores, domainCorrects, domainAnswered, domainColors,
      trackLabels, trackScores, trackColors, trackBands,
      radarScores, correctCount, incorrectCount,
      totalQuestions: session.history.length
    });

    // ── HTML ──────────────────────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FLL Placement Report – ${esc(s.name || "Student")}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 13px; color: #1e293b; background: #f1f5f9; }
    .page { max-width: 980px; margin: 0 auto; padding: 24px 24px 56px; background: #fff; }

    /* Header */
    .rpt-header { background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); color: #fff; padding: 28px 32px; border-radius: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    .rpt-header .prog-name { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.75; margin-bottom: 4px; }
    .rpt-header h1 { font-size: 21px; font-weight: 800; letter-spacing: -0.3px; line-height: 1.2; margin-bottom: 16px; }
    .stu-grid { display: flex; flex-wrap: wrap; gap: 20px; }
    .stu-field strong { display: block; font-size: 15px; font-weight: 700; }
    .stu-field span { font-size: 11px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.6px; }
    .score-badge { background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.35); border-radius: 12px; padding: 14px 20px; text-align: center; min-width: 100px; flex-shrink: 0; }
    .score-badge .big { font-size: 36px; font-weight: 900; line-height: 1; }
    .score-badge .lbl { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 3px; }

    /* Summary strip */
    .strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    .strip-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; background: #fff; }
    .strip-card .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 5px; font-weight: 700; }
    .strip-card .val { font-size: 16px; font-weight: 800; line-height: 1.2; }
    .strip-card .sub { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4; }

    /* Two-column */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }

    /* Cards */
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; background: #fff; }
    .card h3, .card-wide h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.9px; color: #64748b; margin-bottom: 14px; font-weight: 700; }
    .card-wide { border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; background: #fff; margin-bottom: 14px; }

    /* Chart containers */
    .ch-200 { position: relative; height: 200px; }
    .ch-380 { position: relative; height: 390px; }
    .ch-230 { position: relative; height: 230px; }

    /* Findings */
    .findings { list-style: none; }
    .findings li { display: flex; align-items: flex-start; gap: 8px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; line-height: 1.4; }
    .findings li:last-child { border-bottom: none; }
    .tag { display: inline-block; border-radius: 4px; padding: 2px 7px; font-size: 10px; font-weight: 800; white-space: nowrap; flex-shrink: 0; }
    .tag-g { background: #dcfce7; color: #15803d; }
    .tag-y { background: #fef3c7; color: #92400e; }
    .tag-b { background: #dbeafe; color: #1e40af; }

    /* Summaries */
    .sbox { border-left: 4px solid #1d4ed8; background: #f8fafc; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 12px; }
    .sbox.green { border-left-color: #16a34a; }
    .sbox h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.9px; color: #64748b; font-weight: 700; margin-bottom: 6px; }
    .sbox p { font-size: 12.5px; line-height: 1.7; color: #334155; }

    /* History table */
    .hist-wrap { overflow-x: auto; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #1e3a8a; color: #fff; padding: 9px 10px; text-align: left; font-size: 11px; font-weight: 700; }
    tbody td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }

    /* Print bar */
    .print-bar { display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 18px; }
    .btn-p { background: #1d4ed8; color: #fff; border: none; border-radius: 8px; padding: 10px 22px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-p:hover { background: #1e40af; }
    .btn-o { background: #fff; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-o:hover { background: #f8fafc; }

    /* Footer */
    .rpt-footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }

    /* Legend dots */
    .legend { display: flex; gap: 16px; font-size: 11px; color: #64748b; margin-top: 10px; }
    .legend span { display: flex; align-items: center; gap: 5px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

    @media print {
      body { background: #fff; }
      .page { padding: 0; max-width: 100%; box-shadow: none; }
      .print-bar { display: none !important; }
      .rpt-header { border-radius: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .card, .card-wide, .strip-card { break-inside: avoid; }
      .hist-section { break-before: page; }
      .two-col { break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="print-bar">
    <button class="btn-o" onclick="window.close()">✕ Close</button>
    <button class="btn-p" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <!-- ── Header ─────────────────────────────────────── -->
  <div class="rpt-header">
    <div>
      <div class="prog-name">FLL Robotics Program</div>
      <h1>SPIKE Prime + FLL<br>Adaptive Placement Report</h1>
      <div class="stu-grid">
        <div class="stu-field"><strong>${esc(s.name || "Student")}</strong><span>Student</span></div>
        ${s.grade ? `<div class="stu-field"><strong>${esc(s.grade)}</strong><span>Grade</span></div>` : ""}
        ${s.team ? `<div class="stu-field"><strong>${esc(s.team)}</strong><span>Team / Class</span></div>` : ""}
        <div class="stu-field"><strong>${esc(completedDate)}</strong><span>Completed</span></div>
      </div>
    </div>
    <div class="score-badge">
      <div class="big">${a.overallScore}%</div>
      <div class="lbl">Weighted<br>Score</div>
    </div>
  </div>

  <!-- ── Summary strip ──────────────────────────────── -->
  <div class="strip">
    <div class="strip-card" style="border-top:4px solid ${esc(placementBg)}">
      <div class="lbl">Recommended Placement</div>
      <div class="val" style="font-size:14px;color:${esc(placementBg)}">${esc(a.placement.label)}</div>
      <div class="sub">${esc(a.placement.rationale)}</div>
    </div>
    <div class="strip-card" style="border-top:4px solid ${esc(scoreColor)}">
      <div class="lbl">Overall Weighted Score</div>
      <div class="val" style="color:${esc(scoreColor)}">${a.overallScore}%</div>
      <div class="sub">${correctCount} correct out of ${session.history.length} questions (${Math.round(correctCount / session.history.length * 100)}% accuracy)</div>
    </div>
    <div class="strip-card" style="border-top:4px solid #6366f1">
      <div class="lbl">Recommended Next Step</div>
      <div class="val" style="font-size:11.5px;font-weight:600;color:#334155;line-height:1.45">${esc(a.recommendedNextPlacement || "—")}</div>
    </div>
  </div>

  <!-- ── Row 1: Doughnut + Track Readiness ──────────── -->
  <div class="two-col">
    <div class="card">
      <h3>Overall Accuracy</h3>
      <div class="ch-200"><canvas id="doughnutChart"></canvas></div>
    </div>
    <div class="card">
      <h3>Track Readiness — All 4 Tracks</h3>
      <div class="ch-200"><canvas id="trackChart"></canvas></div>
    </div>
  </div>

  <!-- ── Domain bars (full width) ───────────────────── -->
  <div class="card-wide">
    <h3>Domain Performance — All 15 Subject Areas</h3>
    <div class="ch-380"><canvas id="domainChart"></canvas></div>
    <div class="legend">
      <span><span class="dot" style="background:#22c55e"></span>Strong (70%+)</span>
      <span><span class="dot" style="background:#f59e0b"></span>Developing (45–69%)</span>
      <span><span class="dot" style="background:#ef4444"></span>Needs Practice (&lt;45%)</span>
    </div>
  </div>

  <!-- ── Row 2: Radar + Key findings ────────────────── -->
  <div class="two-col">
    <div class="card">
      <h3>Subject Area Balance</h3>
      <div class="ch-230"><canvas id="radarChart"></canvas></div>
    </div>
    <div class="card">
      <h3>Key Findings</h3>
      <ul class="findings">
        ${strongList.map((d) => `<li><span class="tag tag-g">★ Strong</span>${esc(d)}</li>`).join("")}
        ${practiceList.slice(0, 3).map((d) => `<li><span class="tag tag-y">▲ Practice</span>${esc(d)}</li>`).join("")}
        <li><span class="tag tag-b">→ Next</span>${esc(a.recommendedNextPlacement || "—")}</li>
      </ul>
    </div>
  </div>

  <!-- ── Teacher summary ────────────────────────────── -->
  <div class="sbox">
    <h4>Teacher Summary</h4>
    <p>${esc(a.teacherSummary)}</p>
  </div>

  <!-- ── Family summary ─────────────────────────────── -->
  <div class="sbox green">
    <h4>Family-Friendly Summary</h4>
    <p>${esc(a.familySummary || "—")}</p>
  </div>

  <!-- ── Question history ───────────────────────────── -->
  <div class="hist-section" style="margin-top:28px">
    <div class="card-wide" style="padding-top:16px">
      <h3>Question-by-Question Answer History</h3>
      <div class="hist-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:36px">#</th>
              <th>Domain</th>
              <th>Subtopic</th>
              <th style="width:48px">Level</th>
              <th style="width:44px">Result</th>
              <th>Student's Answer</th>
              <th>Correct Answer</th>
              <th style="width:48px">Time</th>
            </tr>
          </thead>
          <tbody>${historyRows}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- ── Footer ─────────────────────────────────────── -->
  <div class="rpt-footer">
    FLL Robotics Program &nbsp;•&nbsp; SPIKE Prime + FLL Adaptive Placement Assessment &nbsp;•&nbsp; Generated ${esc(generatedDate)} &nbsp;•&nbsp; Offline-capable
  </div>

</div>

<script>const D=${chartDataJson};<\/script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<script>
document.addEventListener("DOMContentLoaded", function () {
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = "#475569";

  // 1. Doughnut — correct vs incorrect
  new Chart(document.getElementById("doughnutChart"), {
    type: "doughnut",
    data: {
      labels: ["Correct", "Needs Review"],
      datasets: [{ data: [D.correctCount, D.incorrectCount], backgroundColor: ["#22c55e", "#f87171"], borderWidth: 3, borderColor: "#fff", hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "68%",
      plugins: {
        legend: { position: "bottom", labels: { padding: 14 } },
        tooltip: { callbacks: { label: (c) => c.label + ": " + c.raw + " questions (" + Math.round(c.raw / D.totalQuestions * 100) + "%)" } }
      }
    },
    plugins: [{
      id: "centerLabel",
      afterDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta.data.length) return;
        const cx = meta.data[0].x, cy = meta.data[0].y;
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 26px -apple-system, Arial, sans-serif";
        ctx.fillText(D.correctCount + "/" + D.totalQuestions, cx, cy - 2);
        ctx.font = "12px -apple-system, Arial, sans-serif";
        ctx.fillStyle = "#64748b";
        ctx.fillText("Correct", cx, cy + 16);
        ctx.restore();
      }
    }]
  });

  // 2. Track readiness horizontal bars
  new Chart(document.getElementById("trackChart"), {
    type: "bar",
    data: {
      labels: D.trackLabels,
      datasets: [{ data: D.trackScores, backgroundColor: D.trackColors, borderRadius: 6, borderSkipped: false }]
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      scales: {
        x: { min: 0, max: 100, grid: { color: "#f1f5f9" }, ticks: { callback: (v) => v + "%" } },
        y: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => D.trackBands[c.dataIndex] + " — " + c.raw + "%" } }
      }
    }
  });

  // 3. Domain performance horizontal bars
  new Chart(document.getElementById("domainChart"), {
    type: "bar",
    data: {
      labels: D.domainLabels,
      datasets: [{ data: D.domainScores, backgroundColor: D.domainColors, borderRadius: 5, borderSkipped: false }]
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      scales: {
        x: { min: 0, max: 100, grid: { color: "#f1f5f9" }, ticks: { callback: (v) => v + "%" } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => c.raw + "% — " + D.domainCorrects[c.dataIndex] + "/" + D.domainAnswered[c.dataIndex] + " correct" } }
      }
    }
  });

  // 4. Radar — 3 subject bands
  new Chart(document.getElementById("radarChart"), {
    type: "radar",
    data: {
      labels: ["Programming\\n& Math", "Mechanical\\n& Hardware", "Competition\\n& Teamwork"],
      datasets: [{
        label: "Band Score",
        data: D.radarScores,
        backgroundColor: "rgba(29,78,216,0.12)",
        borderColor: "#1d4ed8",
        borderWidth: 2.5,
        pointBackgroundColor: "#1d4ed8",
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { stepSize: 25, font: { size: 10 }, callback: (v) => v + "%" },
          grid: { color: "#e2e8f0" },
          pointLabels: { font: { size: 11, weight: "600" }, color: "#334155" }
        }
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.raw + "% avg" } } }
    }
  });
});
<\/script>
</body>
</html>`;
  }

  function analyticsTrackReadinessForExport(analytics) {
    const readiness = analytics.trackReadiness || {};

    const render = (key) => {
      const item = readiness[key];
      if (!item) {
        return "";
      }
      return `${item.score}% (${item.band})`;
    };

    return {
      general: render("general"),
      spikeBlock: render("spike-block"),
      pybricks: render("pybricks"),
      fll: render("fll")
    };
  }

  function buildExportFileName(studentName, track, extension) {
    const safeName = studentName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "student";
    const safeTrack = normalizeTrack(track);
    const dateStamp = new Date().toISOString().slice(0, 10);
    return `fll-placement-${safeName}-${safeTrack}-${dateStamp}.${extension}`;
  }

  function downloadFile(fileName, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function escapeCsvCell(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function setSessionPill(text, muted) {
    ui.sessionStatusPill.textContent = text;
    ui.sessionStatusPill.classList.toggle("muted", Boolean(muted));
  }

  function toggleResumeBanner(show) {
    ui.resumeBanner.classList.toggle("hidden", !show);
  }

  function hydrateSetupForm(student) {
    ui.studentName.value = student?.name || "";
    ui.studentGrade.value = student?.grade || "";
    ui.studentTeam.value = student?.team || "";
  }

  function showView(name) {
    ui.views.setup.classList.toggle("hidden", name !== "setup");
    ui.views.assessment.classList.toggle("hidden", name !== "assessment");
    ui.views.results.classList.toggle("hidden", name !== "results");
  }

  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function loadSession() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);

      // Accept v3 (current) and v2 (legacy — will be migrated by ensurePhaseState)
      const validVersion = parsed.schemaVersion === 3 || parsed.schemaVersion === 2;
      if (!parsed || !validVersion || !parsed.sessionId || !parsed.domainState || !Array.isArray(parsed.history)) {
        return null;
      }

      if (!parsed.student || typeof parsed.student !== "object") {
        parsed.student = { name: "", grade: "", team: "", track: "general" };
      }

      parsed.student.track = normalizeTrack(parsed.student.track);

      for (const domain of DOMAINS) {
        if (!parsed.domainState[domain]) {
          parsed.domainState[domain] = createEmptyDomainMeta();
        }
      }

      return parsed;
    } catch (error) {
      console.error("Failed to parse saved session", error);
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function resetToSetup() {
    stopTimer();
    clearSession();
    runtime.session = null;
    runtime.activeQuestion = null;
    runtime.selectedOptionIndex = null;
    runtime.questionLocked = false;

    ui.setupForm.reset();
    toggleResumeBanner(false);
    setSessionPill("Not Started", true);
    showView("setup");
  }

  function normalizeTrack(track) {
    return TRACKS.includes(track) ? track : "general";
  }

  function pickRandom(list) {
    if (!list.length) {
      return null;
    }

    return list[Math.floor(Math.random() * list.length)];
  }

  function humanizeSubtopic(subtopic) {
    return String(subtopic || "general")
      .replace(/[_-]/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function formatTrack(track) {
    const normalized = normalizeTrack(track);
    const labels = {
      general: "General",
      "spike-block": "SPIKE Block",
      pybricks: "Pybricks",
      fll: "FLL Competition"
    };

    return labels[normalized] || "General";
  }
})();