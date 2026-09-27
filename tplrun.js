// tplrun.js：按处理预算处理并留账，收尾不限预算补齐
import { scanPlaceholders, fillOf } from "./tpl.js";

class TplError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "TplError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new TplError(code, message);
}

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

// 与预算无关的结构校验：事件结构 → 名字 → 文本
function inspectEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    fail("E_BAD_EVENT", "事件必须是对象");
  }
  if (event.kind !== "tpl" && event.kind !== "render") {
    fail("E_BAD_EVENT", "事件 kind 只能是 tpl 或 render");
  }
  if (isBlank(event.name)) fail("E_BAD_NAME", "模板名不能为空");
  if (event.kind === "tpl") {
    if (typeof event.text !== "string") fail("E_BAD_EVENT", "tpl 事件必须带 text");
    if (event.text.trim() === "") fail("E_BAD_TEXT", "模板文本不能为空");
    if (!scanPlaceholders(event.text).balanced) {
      fail("E_BAD_TEXT", "双大括号必须成对出现");
    }
  } else if (!Array.isArray(event.args)) {
    fail("E_BAD_EVENT", "render 事件必须带 args 数组");
  }
}

function applyEvent(state, event) {
  if (event.kind === "tpl") {
    if (state.templates.some((row) => row[0] === event.name)) {
      fail("E_DUP_TPL", "模板名重复登记：" + event.name);
    }
    state.templates.push([event.name, event.text]);
    return "tpl";
  }
  const row = state.templates.find((item) => item[0] === event.name);
  if (!row) fail("E_NO_TPL", "模板未登记：" + event.name);
  const values = new Map(event.args.map((pair) => [String(pair[0]), pair[1]]));
  for (const key of scanPlaceholders(row[1]).keys) {
    if (!values.has(key)) fail("E_MISSING_ARG", "缺少键值对：" + key);
  }
  state.rendered.push([event.name, fillOf(row[1], event.args)]);
  return "render";
}

function cloneState(state) {
  const src = state || {};
  return {
    templates: (src.templates || []).map((row) => [row[0], row[1]]),
    rendered: (src.rendered || []).map((row) => [row[0], row[1]]),
    ledger: (src.ledger || []).map((row) => [
      row[0], row[1],
      row[2] == null ? null : row[2],
      Array.isArray(row[3]) ? row[3].map((pair) => [pair[0], pair[1]]) : null
    ]),
    applied: (src.applied || []).slice()
  };
}

function toLedger(event) {
  return [
    event.kind,
    event.name,
    event.kind === "tpl" ? event.text : null,
    event.kind === "render" ? event.args.map((pair) => [pair[0], pair[1]]) : null
  ];
}

function budgetOf(spec) {
  const value = Number(spec.budget);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function step(spec) {
  const state = cloneState(spec.state);
  const events = Array.isArray(spec.events) ? spec.events : [];
  // 三类结构错误先于预算、先于处理一次性校验
  for (const event of events) inspectEvent(event);

  let budget = budgetOf(spec);
  let served = 0;
  let queued = 0;

  for (const event of events) {
    if (state.applied.indexOf(event.id) !== -1) continue;
    state.applied.push(event.id);
    if (budget > 0) {
      applyEvent(state, event);
      budget -= 1;
      served += 1;
    } else {
      state.ledger.push(toLedger(event));
      queued += 1;
    }
  }

  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map((row) => [
      row[0], row[1],
      row[2] == null ? null : row[2],
      Array.isArray(row[3]) ? row[3].map((pair) => [pair[0], pair[1]]) : null
    ]),
    judged: served + queued,
    judged_bound: events.length
  };
}

export function close(spec) {
  const state = cloneState(spec.state);
  let catchup = 0;
  while (state.ledger.length > 0) {
    const row = state.ledger.shift();
    const event = {
      kind: row[0],
      name: row[1],
      text: row[2] == null ? undefined : row[2],
      args: Array.isArray(row[3]) ? row[3].map((pair) => [pair[0], pair[1]]) : []
    };
    applyEvent(state, event);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
