// loop-tool.js — Tool definition, execution, and rendering for loop_control

import { buildPrompt } from "./state.js";

/**
 * @typedef {import('./state.js').LoopState} LoopState
 */

/**
 * @param {{ status: "next" | "done", summary: string, reason?: string }} params
 * @param {LoopState} state
 * @param {any} pi
 * @param {any} _ctx
 */
export function handleLoopControlTool(params, state, pi, _ctx) {
  if (!state.active) {
    return {
      content: [
        { type: "text", text: "No active loop. Start one with /loop." },
      ],
      details: undefined,
      newState: state,
    };
  }

  if (params.status === "done") {
    // Guard: passes/count/pipeline 模式必须完成所有迭代才能调用 done
    const requiresCompletion = state.mode !== "goal" && state.currentStep < state.maxSteps - 1;
    if (requiresCompletion) {
      const newState = { ...state, currentStep: state.currentStep + 1 };
      setTimeout(() => {
        pi.sendMessage(
          {
            customType: "loop-iteration",
            content: buildPrompt(newState),
            display: false,
          },
          { triggerTurn: true, deliverAs: "steer" },
        );
      }, 100);
      return {
        content: [
          {
            type: "text",
            text: `⚠️ Cannot end early. Must complete all ${state.maxSteps} iterations. Forcing continue to step ${newState.currentStep + 1}.`,
          },
        ],
        details: { ...newState },
        newState,
      };
    }

    const newState = {
      ...state,
      done: true,
      reasonDone: params.reason ?? params.summary,
      active: false,
    };
    return {
      content: [
        {
          type: "text",
          text: `✓ Loop complete after ${state.currentStep + 1} iteration(s). Reason: ${newState.reasonDone}`,
        },
      ],
      details: { ...newState },
      newState,
    };
  }

  // status === "next" — advance
  const newState = { ...state, currentStep: state.currentStep + 1 };

  const atEnd =
    state.mode === "passes"
      ? newState.currentStep >= state.maxSteps
      : state.mode === "pipeline"
        ? newState.currentStep >= state.stages.length
        : false;

  if (atEnd) {
    const finalState = {
      ...newState,
      done: true,
      active: false,
      reasonDone: `Completed all ${state.mode === "passes" ? "passes" : "stages"}`,
    };
    return {
      content: [
        {
          type: "text",
          text: `✓ Loop complete — all ${state.maxSteps} iterations done.`,
        },
      ],
      details: { ...finalState },
      newState: finalState,
    };
  }

  setTimeout(() => {
    pi.sendMessage(
      {
        customType: "loop-iteration",
        content: buildPrompt(newState),
        display: false,
      },
      { triggerTurn: true, deliverAs: "steer" },
    );
  }, 100);

  return {
    content: [
      {
        type: "text",
        text: `→ Advancing to step ${newState.currentStep + 1}. Summary: ${params.summary}`,
      },
    ],
    details: { ...newState },
    newState,
  };
}

/**
 * @param {any} pi
 * @param {{ current: LoopState }} stateRef
 */
export async function registerLoopControlTool(pi, stateRef) {
  const [{ StringEnum }, { Text }, { Type }] = await Promise.all([
    import("@gsd/pi-ai").catch(() => ({ StringEnum: values => ({ type: "string", enum: values }) })),
    import("@gsd/pi-tui").catch(() => ({ Text: class Text { constructor(text, x, y) { this.text = text; this.x = x; this.y = y; } } })),
    import("@sinclair/typebox").catch(() => ({
      Type: {
        Object: properties => ({ type: "object", properties }),
        String: options => ({ type: "string", ...options }),
        Optional: schema => schema,
      },
    })),
  ]);
  
  pi.registerTool({
    name: "loop_control",
    label: "Loop Control",
    description: [
      "Signal loop progress. Call this when you finish a loop iteration.",
      "status 'next': advance to the next step/pass/stage.",
      "status 'done': the goal is met or the final stage/pass is complete.",
      "Only available when a loop is active.",
    ].join(" "),
    parameters: Type.Object({
      status: StringEnum(["next", "done"]),
      summary: Type.String({
        description: "Brief summary of what was accomplished this iteration",
      }),
      reason: Type.Optional(
        Type.String({ description: "Why the goal is met (for 'done')" }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const result = handleLoopControlTool(params, stateRef.current, pi, ctx);
      stateRef.current = result.newState;
      const { updateWidget } = await import("./state.js");
      updateWidget(stateRef.current, ctx);
      return {
        content: result.content,
        details: result.details,
      };
    },
    renderCall(args, theme) {
      const t = theme;
      return new Text(
        t.fg("toolTitle", t.bold("loop_control ")) +
          t.fg(args.status === "done" ? "success" : "accent", args.status),
        0,
        0,
      );
    },
    renderResult(result, _opts, theme) {
      const d = result.details;
      if (!d) return new Text("", 0, 0);
      const t = theme;
      return new Text(
        t.fg(
          d.done ? "success" : "accent",
          `${d.done ? "✓" : "→"} step ${d.currentStep + 1} — ${d.mode}`,
        ),
        0,
        0,
      );
    },
  });
}
