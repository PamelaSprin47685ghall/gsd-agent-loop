import { ensureBundledExtensionPath } from "./src/self-injection.js";

ensureBundledExtensionPath(import.meta.url);

import { 
  emptyState, 
  getSystemPromptAddition, 
  updateWidget, 
  buildPrompt,
  parseGoalArgs,
  parsePassesArgs,
  parsePipelineArgs
} from "./src/state.js";
import { registerLoopControlTool } from "./src/tool.js";

let state = emptyState();
const stateRef = { get current() { return state; }, set current(v) { state = v; } };
const registeredPluginApis = new WeakSet();
const registeredToolApis = new WeakSet();
const registeredShortcutApis = new WeakSet();

async function ensureLoopTool(pi) {
  if (registeredToolApis.has(pi)) return;
  await registerLoopControlTool(pi, stateRef);
  registeredToolApis.add(pi);
}

async function ensureLoopShortcut(pi) {
  if (registeredShortcutApis.has(pi)) return;
  const { Key } = await import("@gsd/pi-tui").catch(() => ({
    Key: { ctrlShift: key => `ctrl+shift+${key}` },
  }));
  pi.registerShortcut?.(Key.ctrlShift("x"), {
    description: "Stop the active loop",
    handler: async (ctx) => {
      if (!state.active) return;
      state = { ...state, active: false, done: true, reasonDone: "Stopped by shortcut" };
      updateWidget(state, ctx);
      ctx.abort();
      ctx.ui.notify("Loop aborted", "warning");
    },
  });
  registeredShortcutApis.add(pi);
}

export default async function agentLoopPlugin(pi) {
  if (registeredPluginApis.has(pi)) return;
  registeredPluginApis.add(pi);

  await ensureLoopTool(pi);
  await ensureLoopShortcut(pi);
  
  const reconstruct = (ctx) => {
    state = emptyState();
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (msg.role === "toolResult" && msg.toolName === "loop_control") {
        const d = msg.details;
        if (d) state = { ...d };
      }
    }
  };

  pi.on("session_start", async (_e, ctx) => {
    reconstruct(ctx);
    updateWidget(state, ctx);
  });
  
  pi.on("session_switch", async (_e, ctx) => reconstruct(ctx));
  pi.on("session_fork", async (_e, ctx) => reconstruct(ctx));
  pi.on("session_tree", async (_e, ctx) => reconstruct(ctx));

  pi.on("before_agent_start", async (event, _ctx) => {
    if (!state.active || state.done) return;
    return {
      systemPrompt: (event.systemPrompt || "") + getSystemPromptAddition(state),
    };
  });

  pi.registerCommand("loop", {
    description: "Start a loop. Usage: /loop goal <desc> | /loop passes <N> <task> | /loop pipeline <s1|s2|s3> <goal>",
    getArgumentCompletions: (input) => {
      const trimmed = input?.trim();
      if (!trimmed || trimmed === "goal" || trimmed === "passes" || trimmed === "pipeline") {
        return [
          { value: "goal ", label: "goal <description>", description: "Loop until goal is met" },
          { value: "passes ", label: "passes <N> <task>", description: "Run exactly N passes" },
          { value: "pipeline ", label: "pipeline <s1|s2|s3> <goal>", description: "Run stages in order" },
        ];
      }
      return [];
    },
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify("Usage:\n  /loop goal <description>\n  /loop passes <N> <task>\n  /loop pipeline <s1|s2|s3> <goal>", "info");
        return;
      }

      await ctx.waitForIdle();

      const parts = args.trim().split(/\s+/);
      const mode = parts[0];

      let result;

      if (mode === "goal") {
        result = parseGoalArgs(parts);
      } else if (mode === "passes") {
        result = parsePassesArgs(parts);
      } else if (mode === "pipeline") {
        result = parsePipelineArgs(parts);
      } else {
        ctx.ui.notify(`Unknown mode "${mode}". Use: goal, passes, or pipeline`, "error");
        return;
      }

      if (typeof result === "string") {
        ctx.ui.notify(result, "error");
        return;
      }

      state = result;
      updateWidget(state, ctx);
      pi.sendUserMessage(buildPrompt(state));
    },
  });

  pi.registerCommand("loop-stop", {
    description: "Stop the active loop",
    handler: async (_args, ctx) => {
      if (!state.active) {
        ctx.ui.notify("No active loop", "info");
        return;
      }
      state = { ...state, active: false, done: true, reasonDone: "Stopped by user" };
      updateWidget(state, ctx);
      ctx.ui.notify(`Loop stopped after ${state.currentStep + 1} iteration(s)`, "warning");
    },
  });
}
