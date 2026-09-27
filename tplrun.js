// tplrun.js：按处理预算处理事件并留账，收尾时不限预算补齐（原生实现，零依赖）
import { keysOf, fillOf } from "./tpl.js";

function fail(code, message) {
  const error = new Error(message || code);
  error.code = code;
  throw error;
}

function cloneState(state) {
  const src = state || {};
  return {
    templates: (src.templates || []).map(function (row) { return [row[0], row[1]]; }),
    rendered: (src.rendered || []).map(function (row) { return [row[0], row[1]]; }),
    ledger: (src.ledger || []).map(function (row) { return [row[0], row[1], row[2], row[3]]; }),
    applied: (src.applied || []).slice()
  };
}

// 与 tpl.scan 同一套成对规则：缺右半边或多出右半边都算不成对。
function balancedText(text) {
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{" && text[i + 1] === "{") {
      const end = text.indexOf("}}", i + 2);
      if (end === -1) {
        return false;
      }
      i = end + 2;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      return false;
    } else {
      i += 1;
    }
  }
  return true;
}

function isBlank(name) {
  return typeof name !== "string" || name.length === 0;
}

// 三类结构/文本校验先做，与预算无关：E_BAD_EVENT → E_BAD_NAME → E_BAD_TEXT。
function preflight(events) {
  for (const event of events) {
    if (event === null || typeof event !== "object" || Array.isArray(event)) {
      fail("E_BAD_EVENT", "事件不是对象");
    }
    if (event.kind !== "tpl" && event.kind !== "render") {
      fail("E_BAD_EVENT", "事件 kind 只能是 tpl 或 render");
    }
    if (isBlank(event.name)) {
      fail("E_BAD_NAME", "模板名不能为空");
    }
    if (event.kind === "tpl") {
      if (typeof event.text !== "string" || event.text.length === 0) {
        fail("E_BAD_TEXT", "模板文本不能为空");
      }
      if (!balancedText(event.text)) {
        fail("E_BAD_TEXT", "双大括号必须成对出现");
      }
    } else if (!Array.isArray(event.args)) {
      fail("E_BAD_EVENT", "render 事件的 args 必须是键值对数组");
    }
  }
}

function toTuple(event) {
  if (event.kind === "tpl") {
    return ["tpl", event.name, event.text, null];
  }
  return ["render", event.name, null, event.args.map(function (pair) {
    return [pair[0], pair[1]];
  })];
}

function signature(tuple) {
  return JSON.stringify(tuple);
}

// 语义处理：重复登记、模板缺失、缺参数都在真正花预算处理时才判定。
function applyTuple(state, tuple) {
  const kind = tuple[0];
  const name = tuple[1];
  if (kind === "tpl") {
    for (const row of state.templates) {
      if (row[0] === name) {
        fail("E_DUP_TPL", "模板名已登记：" + name);
      }
    }
    state.templates.push([name, tuple[2]]);
    return;
  }
  let text = null;
  for (const row of state.templates) {
    if (row[0] === name) {
      text = row[1];
      break;
    }
  }
  if (text === null) {
    fail("E_NO_TPL", "模板未登记：" + name);
  }
  const args = tuple[3] || [];
  for (const key of keysOf(text)) {
    let has = false;
    for (const pair of args) {
      if (Array.isArray(pair) && String(pair[0]) === key) {
        has = true;
        break;
      }
    }
    if (!has) {
      fail("E_MISSING_ARG", "缺少键值对：" + key);
    }
  }
  state.rendered.push([name, fillOf(text, args)]);
}

function budgetOf(spec) {
  const value = Math.floor(Number(spec.budget));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = spec.events || [];
  preflight(events);
  const tuples = events.map(toTuple);
  const incomingLedger = state.ledger.length;
  let served = 0;
  let budget = budgetOf(spec);
  for (const tuple of tuples) {
    const sig = signature(tuple);
    if (state.applied.indexOf(sig) !== -1) {
      continue;
    }
    if (budget <= 0) {
      state.ledger.push(tuple);
      continue;
    }
    applyTuple(state, tuple);
    state.applied.push(sig);
    budget -= 1;
    served += 1;
  }
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger,
    judged: served + state.ledger.length - incomingLedger,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;
  const pending = state.ledger;
  state.ledger = [];
  for (const tuple of pending) {
    const sig = signature(tuple);
    if (state.applied.indexOf(sig) !== -1) {
      continue;
    }
    applyTuple(state, tuple);
    state.applied.push(sig);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
