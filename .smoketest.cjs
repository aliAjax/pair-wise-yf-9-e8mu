// 临时冒烟测试：桩 DOM + localStorage，跑 app.js 的核心流程
const fs = require("fs");
const path = require("path");

function makeEl(id) {
  const listeners = {};
  return {
    id: id || "",
    value: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    files: [],
    style: {},
    dataset: {},
    classList: { add() {}, remove() {} },
    querySelector: () => makeEl(""),
    closest: () => null,
    reset() {},
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    dispatch(type, event) {
      (listeners[type] || []).forEach((fn) => fn(event));
    },
    _listeners: listeners,
    elements: { text: { value: "" } }
  };
}

const elsById = {};
const ids = [
  "searchInput", "playerFilter", "complexityFilter", "sortMode", "gameForm",
  "nameInput", "minPlayersInput", "maxPlayersInput", "durationInput",
  "complexityInput", "lastPlayedInput", "coverInput", "gameList", "detailView",
  "gameCount", "ruleCount", "staleGame", "visibleCount", "checklist",
  "checkProgressText", "progressFill", "clearChecklistBtn"
];
ids.forEach((id) => (elsById[id] = makeEl(id)));
// 默认下拉框值
elsById.playerFilter.value = "all";
elsById.complexityFilter.value = "all";
elsById.sortMode.value = "stale";

const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => (store[k] = String(v)),
  removeItem: (k) => delete store[k]
};

global.document = {
  querySelector: (sel) => elsById[sel.replace("#", "")] || makeEl(""),
  querySelectorAll: () => []
};

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓", msg);
  else {
    console.error("  ✗", msg);
    failures++;
  }
}

const code = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
// 在独立作用域执行，并拿到内部 state 和函数
const moduleScope = new Function(
  "module", "exports", "document", "localStorage", "structuredClone",
  code + "\n;module.exports = { state: () => state, getChecklistGames, isRuleChecked, findRuleInAnyGame, getAllRules, saveState };"
);
const moduleObj = { exports: {} };
moduleScope(moduleObj, moduleObj.exports, global.document, global.localStorage, structuredClone);
const api = moduleObj.exports;
const state = api.state();

console.log("1) 默认数据与规则 ID 迁移");
const game = state.games[0];
const rule0 = game.forgets[0];
assert(typeof rule0.id === "string" && rule0.text, "规则已升级为 {id, text} 结构");
assert(state.checklist.length === 0 && state.checks, "清单与勾选记录字段存在");

console.log("2) 加入今晚清单并勾选规则");
state.checklist.push(game.id);
api.state; // noop
const found = api.findRuleInAnyGame(rule0.id);
state.checks[rule0.id] = { text: rule0.text };
assert(api.isRuleChecked(found.rule), "文本一致时勾选有效");

console.log("3) 原有提醒换了内容 -> 勾选必须失效");
found.rule.text = rule0.text + "（修订版）";
assert(api.isRuleChecked(found.rule) === false, "内容变更后勾选失效");

console.log("4) 规则被移走 -> 勾选失效（记录被清掉）");
state.checks[rule0.id] = { text: found.rule.text };
assert(api.isRuleChecked(found.rule), "重新勾选后有效");
delete state.checks[rule0.id]; // app 中删除规则时会一并 delete checks[ruleId]
assert(state.checks[rule0.id] === undefined, "删除规则时勾选记录被移除");

console.log("5) 清单顺序可调整且持久化");
state.checklist = [state.games[1].id, game.id];
api.saveState();
const ordered = api.getChecklistGames();
assert(ordered[0].id === state.games[1].id && ordered[1].id === game.id, "顺序按 checklist 数组排列");
assert(store["zfl18-boardgame-rule-cards"], "每次 render 都写入 localStorage");
const persisted = JSON.parse(store["zfl18-boardgame-rule-cards"]);
assert(JSON.stringify(persisted.checklist) === JSON.stringify(state.checklist), "清单顺序已持久化");

console.log("6) 旧版纯字符串数据自动迁移");
store["zfl18-boardgame-rule-cards"] = JSON.stringify({
  games: [{
    id: "g1", name: "旧游戏", minPlayers: 2, maxPlayers: 4, duration: 30,
    complexity: "轻", lastPlayed: "2026-01-01", cover: "",
    forgets: ["旧字符串规则"], disputes: [], setup: [], scoring: []
  }]
});
// 重新执行一次模拟刷新
const scope2 = new Function(
  "module", "exports", "document", "localStorage", "structuredClone",
  code + "\n;module.exports = { state: () => state };"
);
const m2 = { exports: {} };
scope2(m2, m2.exports, global.document, global.localStorage, structuredClone);
const migrated = m2.exports.state();
const oldRule = migrated.games[0].forgets[0];
assert(oldRule.id && oldRule.text === "旧字符串规则", "旧字符串规则被迁移成带 id 的对象");
assert(Array.isArray(migrated.checklist) && migrated.checklist.length === 0, "旧数据补齐 checklist 字段");

console.log(failures === 0 ? "\n全部通过" : `\n${failures} 条失败`);
process.exit(failures === 0 ? 0 : 1);
