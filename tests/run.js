import assert from "node:assert";
import { keysOf, fillOf } from "../tpl.js";
import { step, close } from "../tplrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { templates: [], rendered: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "tpl", name: "greet", text: "hi {{who}}" }],
  bad_name_code: "E_BAD_NAME", bad_text_code: "E_BAD_TEXT",
  dup_code: "E_DUP_TPL", missing_code: "E_NO_TPL",
  arg_code: "E_MISSING_ARG", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("keysOf returns a list", () => {
  assert.ok(Array.isArray(keysOf("{{a}}")));
});

check("fillOf returns text", () => {
  assert.strictEqual(typeof fillOf("{{a}}", [["a", "1"]]), "string");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
