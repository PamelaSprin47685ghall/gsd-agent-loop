import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyState, parseGoalArgs, parsePassesArgs, parsePipelineArgs, buildPrompt } from "../src/state.js";

describe("state logic", () => {
  it("emptyState returns initialized state", () => {
    const state = emptyState();
    assert.strictEqual(state.active, false);
    assert.strictEqual(state.currentStep, 0);
    assert.strictEqual(state.done, false);
  });

  describe("argument parsing", () => {
    it("parseGoalArgs creates goal mode", () => {
      const parts = ["goal", "fix", "the", "tests"];
      const result = parseGoalArgs(parts);
      assert.notStrictEqual(typeof result, "string");
      if (typeof result !== "string") {
        assert.strictEqual(result.mode, "goal");
        assert.strictEqual(result.goal, "fix the tests");
        assert.strictEqual(result.maxSteps, Infinity);
      }
    });

    it("parsePassesArgs creates passes mode", () => {
      const parts = ["passes", "3", "review", "code"];
      const result = parsePassesArgs(parts);
      assert.notStrictEqual(typeof result, "string");
      if (typeof result !== "string") {
        assert.strictEqual(result.mode, "passes");
        assert.strictEqual(result.maxSteps, 3);
        assert.strictEqual(result.goal, "review code");
      }
    });

    it("parsePipelineArgs creates pipeline mode", () => {
      const parts = ["pipeline", "plan|code|test", "refactor"];
      const result = parsePipelineArgs(parts);
      assert.notStrictEqual(typeof result, "string");
      if (typeof result !== "string") {
        assert.strictEqual(result.mode, "pipeline");
        assert.deepEqual(result.stages, ["plan", "code", "test"]);
        assert.strictEqual(result.goal, "refactor");
      }
    });
  });

  it("buildPrompt includes mode-specific info", () => {
    const state = parseGoalArgs(["goal", "be", "awesome"]);
    const prompt = buildPrompt(state);
    assert.ok(prompt.includes("Goal: be awesome"));
    assert.ok(prompt.includes("Iteration 1"));
  });
});
