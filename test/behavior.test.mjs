import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleLoopControlTool } from "../src/tool.js";
import { emptyState } from "../src/state.js";

describe("tool behavior", () => {
  it("handleLoopControlTool signals done", () => {
    const state = emptyState();
    state.active = true;
    state.mode = "goal";
    
    const piMock = {};
    const ctxMock = {};
    
    const result = handleLoopControlTool(
      { status: "done", summary: "all finished", reason: "goal met" },
      state,
      piMock,
      ctxMock
    );
    
    assert.strictEqual(result.newState.done, true);
    assert.strictEqual(result.newState.active, false);
    assert.strictEqual(result.newState.reasonDone, "goal met");
    assert.ok(result.content[0].text.includes("Loop complete"));
  });

  it("handleLoopControlTool advances iteration", async () => {
    const state = emptyState();
    state.active = true;
    state.mode = "goal";
    state.currentStep = 0;
    
    let messageSent = false;
    const piMock = {
      sendMessage: () => { messageSent = true; }
    };
    const ctxMock = {};
    
    const result = handleLoopControlTool(
      { status: "next", summary: "step one done" },
      state,
      piMock,
      ctxMock
    );
    
    assert.strictEqual(result.newState.currentStep, 1);
    assert.strictEqual(result.newState.active, true);
    
    // Wait for the setTimeout in handleLoopControlTool
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.strictEqual(messageSent, true);
  });

  it("handleLoopControlTool respects passes limit", () => {
    const state = emptyState();
    state.active = true;
    state.mode = "passes";
    state.maxSteps = 2;
    state.currentStep = 1; // On the last step
    
    const piMock = {};
    const ctxMock = {};
    
    const result = handleLoopControlTool(
      { status: "next", summary: "final pass" },
      state,
      piMock,
      ctxMock
    );
    
    assert.strictEqual(result.newState.done, true);
    assert.strictEqual(result.newState.active, false);
    assert.strictEqual(result.newState.reasonDone.includes("Completed all passes"), true);
  });
});
