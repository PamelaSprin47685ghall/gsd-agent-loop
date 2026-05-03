// loop-state.js - Types and utilities for the loop extension

/**
 * @typedef {"goal" | "passes" | "pipeline"} LoopMode
 *
 * @typedef {Object} LoopState
 * @property {boolean} active
 * @property {LoopMode} mode
 * @property {number} currentStep
 * @property {number} maxSteps
 * @property {string} goal
 * @property {string[]} stages
 * @property {boolean} done
 * @property {string} reasonDone
 */

/** @returns {LoopState} */
export function emptyState() {
  return {
    active: false,
    mode: "goal",
    currentStep: 0,
    maxSteps: 0,
    goal: "",
    stages: [],
    done: false,
    reasonDone: "",
  };
}

/**
 * @param {LoopState} state
 * @returns {string}
 */
export function buildPrompt(state) {
  const step = state.currentStep;

  if (state.mode === "pipeline") {
    const stage = state.stages[step];
    const remaining = state.stages.length - step - 1;
    return [
      `## Loop - Pipeline stage ${step + 1}/${state.stages.length}`,
      `Overall goal: ${state.goal}`,
      `Current stage: **${stage}**`,
      remaining > 0
        ? `Remaining stages: ${state.stages.slice(step + 1).join(" → ")}`
        : `This is the **final stage**. Call loop_control with status "done" when complete.`,
      `\nExecute this stage now. When finished, call loop_control with status "done" if this is the last stage, or "next" to advance.`,
    ].join("\n");
  }

  if (state.mode === "passes") {
    return [
      `## Loop - Pass ${step + 1} of ${state.maxSteps}`,
      `Task: ${state.goal}`,
      step === 0
        ? `This is the first pass. Do an initial implementation/analysis.`
        : step < state.maxSteps - 1
          ? `This is a refinement pass. Review and improve on the previous pass.`
          : `This is the **final pass**. Do a final polish, then call loop_control with status "done".`,
      `\nWhen this pass is complete, call loop_control with status "next" (or "done" on the final pass).`,
    ].join("\n");
  }

  // Goal mode - open-ended
  return [
    `## Loop - Iteration ${step + 1}`,
    `Goal: ${state.goal}`,
    `Work toward the goal. When the goal is fully met, call loop_control with status "done" and explain why.`,
    `If more work is needed, call loop_control with status "next" describing what's left.`,
  ].join("\n");
}

/**
 * @param {string[]} parts
 * @returns {LoopState | string}
 */
export function parseGoalArgs(parts) {
  const goal = parts.slice(1).join(" ");
  if (!goal) {
    return "Provide a goal description";
  }
  return {
    active: true,
    mode: "goal",
    currentStep: 0,
    maxSteps: Infinity,
    goal,
    stages: [],
    done: false,
    reasonDone: "",
  };
}

/**
 * @param {string[]} parts
 * @returns {LoopState | string}
 */
export function parsePassesArgs(parts) {
  const MAX_PASSES = 100;
  const n = parseInt(parts[1], 10);
  if (isNaN(n) || n < 1) {
    return "Provide a valid number of passes";
  }
  if (n > MAX_PASSES) {
    return `Too many passes (max ${MAX_PASSES})`;
  }
  const task = parts.slice(2).join(" ");
  if (!task) {
    return "Provide a task description";
  }
  return {
    active: true,
    mode: "passes",
    currentStep: 0,
    maxSteps: n,
    goal: task,
    stages: [],
    done: false,
    reasonDone: "",
  };
}

/**
 * @param {string[]} parts
 * @returns {LoopState | string}
 */
export function parsePipelineArgs(parts) {
  const stagesStr = parts[1];
  if (!stagesStr) {
    return "Provide stages separated by |";
  }
  const stages = stagesStr
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (stages.length === 0) {
    return "Need at least one stage";
  }
  if (stages.length > 20) {
    return "Too many stages (max 20)";
  }
  for (const stage of stages) {
    if (stage.length > 50) {
      return `Stage name too long: "${stage.slice(0, 20)}..." (max 50 chars)`;
    }
    if (!/^[\w\s\-:]+$/.test(stage)) {
      return `Invalid stage name: "${stage}" (letters, numbers, spaces, hyphens, colons only)`;
    }
  }
  const goal = parts.slice(2).join(" ") || stages.join(" → ");
  return {
    active: true,
    mode: "pipeline",
    currentStep: 0,
    maxSteps: stages.length,
    goal,
    stages,
    done: false,
    reasonDone: "",
  };
}

/**
 * @param {LoopState} state
 * @param {any} ctx
 */
export function updateWidget(state, ctx) {
  if (!state.active) {
    ctx.ui.setStatus("loop", undefined);
    ctx.ui.setWidget("loop", undefined);
    return;
  }

  const label =
    state.mode === "pipeline"
      ? `stage ${state.currentStep + 1}/${state.stages.length}: ${state.stages[state.currentStep] ?? "?"}`
      : state.mode === "passes"
        ? `pass ${state.currentStep + 1}/${state.maxSteps}`
        : `iteration ${state.currentStep + 1} (until goal met)`;

  ctx.ui.setStatus("loop", `🔄 ${label}`);
  ctx.ui.setWidget("loop", [
    `┌─ Loop: ${state.mode} ──────────`,
    `│ ${state.goal}`,
    `│ ${label}`,
    `└─ Ctrl+Shift+X to stop ────────`,
  ]);
}

/**
 * @param {LoopState} state
 * @returns {string}
 */
export function getSystemPromptAddition(state) {
  return [
    "",
    "",
    "## Active Loop",
    `Mode: ${state.mode} | Step: ${state.currentStep + 1}/${state.maxSteps === Infinity ? "∞" : state.maxSteps}`,
    `Goal: ${state.goal}`,
    "You MUST call `loop_control` when you finish your work for this iteration.",
    'Use status "next" to advance or "done" when the goal is fully met.',
  ].join("\n");
}
