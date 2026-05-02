import { describe, it } from "node:test";
import assert from "node:assert/strict";
import agentLoopPlugin from "../index.js";

describe("plugin registration", () => {
  it("registers /loop and /loop-stop commands", () => {
    const commands = {};
    const pi = {
      on: () => {},
      registerTool: () => {},
      registerCommand: (name, config) => { commands[name] = config; },
      registerShortcut: () => {}
    };
    
    agentLoopPlugin(pi);
    
    assert.ok(commands.loop);
    assert.ok(commands["loop-stop"]);
    assert.equal(typeof commands.loop.handler, "function");
  });

  it("registers required session hooks", () => {
    const hooks = [];
    const pi = {
      on: (name) => { hooks.push(name); },
      registerTool: () => {},
      registerCommand: () => {},
      registerShortcut: () => {}
    };
    
    agentLoopPlugin(pi);
    
    assert.ok(hooks.includes("session_start"));
    assert.ok(hooks.includes("session_switch"));
    assert.ok(hooks.includes("session_fork"));
    assert.ok(hooks.includes("session_tree"));
    assert.ok(hooks.includes("before_agent_start"));
  });
});
