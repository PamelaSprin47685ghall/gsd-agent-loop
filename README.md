# Agent Loop

Agent Loop adds explicit loop control to GSD and pi sessions. Use it when an agent should keep working across multiple turns instead of stopping after one response.

Version: `5.1.0`.

## What it provides

| Capability | Name |
|---|---|
| Tool | `loop_control` |
| Commands | `/loop`, `/loop-stop` |
| Shortcut | `Ctrl+Shift+X` |
| Hooks | session restore and system prompt injection |

## Loop modes

| Mode | Command | Behavior |
|---|---|---|
| Goal | `/loop goal <description>` | Runs until the agent calls `loop_control` with `done`. |
| Passes | `/loop passes <N> <task>` | Runs exactly `N` iterations. |
| Pipeline | `/loop pipeline <s1\|s2\|s3> <goal>` | Runs named stages in order. |

## Examples

```text
/loop goal Refactor all test files to use the new assertion API
/loop passes 3 Review and improve the README
/loop pipeline analyze|implement|test Write and test the auth module
```

## Operational notes

- The agent continues by calling `loop_control` with `next`.
- Goal loops finish when the agent calls `loop_control` with `done` and a reason.
- Fixed-pass and pipeline loops do not end early.
- `Ctrl+Shift+X` stops the active loop and aborts the current turn.
- Forked sessions inherit the extension automatically.

## Maintainer spec

See [`SPEC.md`](./SPEC.md) for loop-state, restoration, prompt, and full-suite compatibility rules.

## Test

```bash
npm test
```
