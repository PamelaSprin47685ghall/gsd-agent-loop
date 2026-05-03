# Agent Loop Spec

Version: `5.1.0`.

`README.md` covers usage. This file defines the state, restoration, prompt injection, and compatibility contract.

## Public surface

| Capability | Names |
|---|---|
| Tools | `loop_control` |
| Commands | `/loop`, `/loop-stop` |
| Shortcuts | `Ctrl+Shift+X` |
| Hooks | `session_start`, `session_switch`, `session_fork`, `session_tree`, `before_agent_start` |

## Loop-state machine

```
empty → active → done
         ↑  ↓
         └─next
```

- `empty`: no loop running. `/loop` transitions to `active`.
- `active`: loop is running. `loop_control` with `next` keeps the loop; `done` transitions to `done`.
- `done`: loop finished. The reason (goal met, stopped by user, stopped by shortcut) is stored in `reasonDone`.

State is persisted to tool-result `details` so reconstruction from branch entries replays accurately.

## Session restoration contract

On `session_start`, `session_switch`, `session_fork`, and `session_tree`, the extension replays branch entries to reconstruct loop state.

Rules:

- Only `loop_control` tool results with non-null `details` update state.
- Reconstruction always starts from `emptyState()` — no cross-session leakage.
- The `done` flag is checked in `before_agent_start` to stop injecting prompts after the loop finishes.

## Prompt injection contract

Agent Loop injects a system prompt via `before_agent_start` when a loop is `active` and not `done`.

Rules:

- The prompt describes the current loop mode, iteration count, and goal.
- Inactive or done loops must not inject a prompt.
- The injected text is appended to the existing system prompt, not replacing it.
- Related tools (e.g., `manage_todo_list`) must coexist in the same prompt.

## Full-suite compatibility

Agent Loop must coexist with the rest of the suite:

- `before_agent_start` composition: Agent Loop appends its prompt; other extensions must not strip it.
- `loop_control` tool registration is idempotent (guarded by WeakSet).
- Shortcut registration is idempotent (guarded by WeakSet).
- Forked sessions and subagents must inherit the extension through bundled-extension self-injection.

## Verification

```bash
npm test
```