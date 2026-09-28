const storageKey = "zfl18-boardgame-rule-cards";
const today = new Date();

const ruleCategories = [
  { key: "forgets", title: "容易忘的规则" },
  { key: "disputes", title: "常见争议" },
  { key: "setup", title: "开局准备" },
  { key: "scoring", title: "计分提醒" }
];

const defaultState = {
  selectedId: "",
  // 今晚清单：游戏 id 的有序列表
  checklist: [],
  // 勾选记录：ruleId -> { text: 勾选当时的规则文本 }
  checks: {},
  games: [
    {
      id: crypto.randomUUID(),
      name: "奥尔良",
      minPlayers: 2,
      maxPlayers: 4,
      duration: 90,
      complexity: "中",
      lastPlayed: "2025-11-20",
      cover: "",
      forgets: ["商站建造前先确认道路或水路连接", "袋中随从抽完后不是重洗弃堆，而是从已回袋内容继续抽"],
      disputes: ["事件顺序和玩家动作结算先后", "科技板是否能替代所有同类随从"],
      setup: ["按人数放置货物板块", "每位玩家拿起始随从、商人和个人板"],
      scoring: ["货物分数", "商站和市民乘区块", "金币和建筑剩余加分"]
    },
    {
      id: crypto.randomUUID(),
      name: "盖亚计划",
      minPlayers: 1,
      maxPlayers: 4,
      duration: 150,
      complexity: "重",
      lastPlayed: "2025-08-02",
      cover: "",
      forgets: ["联邦连接时卫星数量和能量消耗要一起核对", "研究升到顶必须拿对应科技板限制"],
      disputes: ["被动充能是否能拒绝", "星球改造费用受哪些能力影响"],
      setup: ["随机终局计分板和回合得分板", "按种族设置起始资源和母星"],
      scoring: ["终局计分板", "科技轨排名", "联邦和建筑分"]
    },
    {
      id: crypto.randomUUID(),
      name: "花砖物语",
      minPlayers: 2,
      maxPlayers: 4,
      duration: 45,
      complexity: "轻",
      lastPlayed: "2026-03-15",
      cover: "",
      forgets: ["每轮结束先铺墙再补工厂展示区", "地板线扣分后清空对应砖"],
      disputes: ["同色砖放置限制是否看整面墙", "中央区起始玩家标记是否必须拿"],
      setup: ["按人数放工厂圆盘", "每个圆盘补4块砖"],
      scoring: ["横竖相邻即时分", "完整行列和颜色终局加分"]
    }
  ]
};

let state = loadState();
normalizeState();
if (!state.selectedId) state.selectedId = state.games[0]?.id || "";
// 正在内联编辑的规则，{gameId, ruleId}；仅本次打开期间有效
let editingRule = null;

const els = {
  searchInput: document.querySelector("#searchInput"),
  playerFilter: document.querySelector("#playerFilter"),
  complexityFilter: document.querySelector("#complexityFilter"),
  sortMode: document.querySelector("#sortMode"),
  gameForm: document.querySelector("#gameForm"),
  nameInput: document.querySelector("#nameInput"),
  minPlayersInput: document.querySelector("#minPlayersInput"),
  maxPlayersInput: document.querySelector("#maxPlayersInput"),
  durationInput: document.querySelector("#durationInput"),
  complexityInput: document.querySelector("#complexityInput"),
  lastPlayedInput: document.querySelector("#lastPlayedInput"),
  coverInput: document.querySelector("#coverInput"),
  gameList: document.querySelector("#gameList"),
  detailView: document.querySelector("#detailView"),
  gameCount: document.querySelector("#gameCount"),
  ruleCount: document.querySelector("#ruleCount"),
  staleGame: document.querySelector("#staleGame"),
  visibleCount: document.querySelector("#visibleCount"),
  checklist: document.querySelector("#checklist"),
  checkProgressText: document.querySelector("#checkProgressText"),
  progressFill: document.querySelector("#progressFill"),
  clearChecklistBtn: document.querySelector("#clearChecklistBtn")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

// 兼容旧数据：规则可能是纯字符串数组，统一升级成 {id, text}，并补齐清单字段
function normalizeState() {
  if (!Array.isArray(state.checklist)) state.checklist = [];
  if (!state.checks || typeof state.checks !== "object") state.checks = {};
  for (const game of state.games) {
    for (const { key } of ruleCategories) {
      if (!Array.isArray(game[key])) game[key] = [];
      game[key] = game[key].map((rule) =>
        typeof rule === "string" ? { id: crypto.randomUUID(), text: rule } : rule
      );
    }
  }
  // 清单只保留仍存在的游戏
  state.checklist = state.checklist.filter((id) => state.games.some((game) => game.id === id));
  // 清理对应规则已不存在的残留勾选
  const liveRuleIds = new Set(state.games.flatMap((game) => getAllRules(game).map((rule) => rule.id)));
  for (const ruleId of Object.keys(state.checks)) {
    if (!liveRuleIds.has(ruleId)) delete state.checks[ruleId];
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function daysSince(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Math.max(0, Math.floor((today - date) / 86400000));
}

function getAllRules(game) {
  return ruleCategories.flatMap(({ key }) => game[key]);
}

function findRule(gameId, ruleId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return null;
  for (const { key, title } of ruleCategories) {
    const rule = game[key].find((item) => item.id === ruleId);
    if (rule) return { game, key, title, rule };
  }
  return null;
}

// 勾选仍然有效的前提：规则还在，且文本与勾选时一致
function isRuleChecked(rule) {
  const record = state.checks[rule.id];
  return Boolean(record && record.text === rule.text);
}

function getChecklistGames() {
  return state.checklist
    .map((id) => state.games.find((game) => game.id === id))
    .filter(Boolean);
}

function getGameProgress(game) {
  const rules = getAllRules(game);
  const checked = rules.filter(isRuleChecked).length;
  return { checked, total: rules.length };
}

function getFilteredGames() {
  const keyword = els.searchInput.value.trim();
  const player = els.playerFilter.value;
  const complexity = els.complexityFilter.value;
  const games = state.games.filter((game) => {
    const text = `${game.name}${getAllRules(game).map((rule) => rule.text).join("")}`;
    const matchesKeyword = !keyword || text.includes(keyword);
    const matchesPlayer = player === "all" || (Number(player) >= game.minPlayers && Number(player) <= game.maxPlayers);
    const matchesComplexity = complexity === "all" || game.complexity === complexity;
    return matchesKeyword && matchesPlayer && matchesComplexity;
  });

  if (els.sortMode.value === "name") return games.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  if (els.sortMode.value === "complexity") {
    const rank = { 轻: 1, 中: 2, 重: 3 };
    return games.sort((a, b) => rank[b.complexity] - rank[a.complexity]);
  }
  return games.sort((a, b) => daysSince(b.lastPlayed) - daysSince(a.lastPlayed));
}

function renderSummary() {
  const allRuleCount = state.games.reduce((sum, game) => sum + getAllRules(game).length, 0);
  const stale = [...state.games].sort((a, b) => daysSince(b.lastPlayed) - daysSince(a.lastPlayed))[0];
  els.gameCount.textContent = state.games.length;
  els.ruleCount.textContent = allRuleCount;
  els.staleGame.textContent = stale ? `${daysSince(stale.lastPlayed)}天` : "-";
}

function renderList() {
  const games = getFilteredGames();
  els.visibleCount.textContent = `${games.length}个匹配`;
  els.gameList.innerHTML =
    games
      .map((game) => {
        const selected = game.id === state.selectedId ? "selected" : "";
        const inChecklist = state.checklist.includes(game.id);
        return `
          <article class="game-card ${selected}" data-game-id="${game.id}">
            <div class="cover">
              ${
                game.cover
                  ? `<img src="${game.cover}" alt="${escapeHtml(game.name)}封面" />`
                  : `<span>${escapeHtml(game.name.slice(0, 2))}</span>`
              }
              <span class="stale-ribbon">${daysSince(game.lastPlayed)}天未玩</span>
            </div>
            <div class="game-body">
              <h3>${escapeHtml(game.name)}</h3>
              <div class="game-meta">
                <span class="pill">${game.minPlayers}-${game.maxPlayers}人</span>
                <span class="pill">${game.duration}分钟</span>
                <span class="pill heavy">${escapeHtml(game.complexity)}</span>
              </div>
              <button
                type="button"
                class="checklist-toggle ${inChecklist ? "added" : ""}"
                data-checklist-toggle="${game.id}"
              >${inChecklist ? "✓ 已在今晚清单" : "＋ 加入今晚清单"}</button>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">没有符合筛选的桌游。</p>`;
}

function renderDetail() {
  const game = state.games.find((item) => item.id === state.selectedId) || state.games[0];
  if (!game) {
    els.detailView.innerHTML = `<p class="empty">先添加一个桌游。</p>`;
    return;
  }
  state.selectedId = game.id;
  const inChecklist = state.checklist.includes(game.id);
  els.detailView.innerHTML = `
    <div class="quick-card">
      <div class="detail-cover">
        ${game.cover ? `<img src="${game.cover}" alt="${escapeHtml(game.name)}封面" />` : `<span>${escapeHtml(game.name.slice(0, 2))}</span>`}
      </div>
      <div>
        <h2>${escapeHtml(game.name)}</h2>
        <div class="game-meta">
          <span class="pill">${game.minPlayers}-${game.maxPlayers}人</span>
          <span class="pill">${game.duration}分钟</span>
          <span class="pill heavy">${escapeHtml(game.complexity)}</span>
          <span class="pill">${daysSince(game.lastPlayed)}天未玩</span>
        </div>
      </div>
      ${ruleCategories.map(({ key, title }) => renderRuleSection(game, title, key, game[key])).join("")}
      <form class="add-rule" id="ruleForm">
        <select id="ruleTypeInput">
          ${ruleCategories.map(({ key, title }) => `<option value="${key}">${title}</option>`).join("")}
        </select>
        <textarea id="ruleTextInput" rows="3" placeholder="补充一条聚会前要看的提醒" required></textarea>
        <button class="primary" type="submit">加入规则卡片</button>
      </form>
      <div class="detail-actions">
        <button class="${inChecklist ? "added" : "primary"}" id="toggleInDetailBtn" type="button">
          ${inChecklist ? "从今晚清单移除" : "加入今晚清单"}
        </button>
        <button id="playedTodayBtn" type="button">标记今天玩过</button>
        <button id="deleteGameBtn" type="button">删除桌游</button>
      </div>
    </div>
  `;
}

function renderRuleSection(game, title, key, items) {
  return `
    <section class="rule-section">
      <h3>${title}</h3>
      <ul class="rule-list">
        ${
          items
            .map((rule) => {
              const isEditing =
                editingRule && editingRule.gameId === game.id && editingRule.ruleId === rule.id;
              if (isEditing) {
                return `
                  <li class="editing">
                    <form class="rule-edit-form" data-rule-id="${rule.id}">
                      <textarea name="text" rows="2" required>${escapeHtml(rule.text)}</textarea>
                      <div class="rule-edit-actions">
                        <button class="primary" type="submit">保存</button>
                        <button type="button" data-rule-cancel="${rule.id}">取消</button>
                      </div>
                    </form>
                  </li>
                `;
              }
              return `
                <li>
                  <span>${escapeHtml(rule.text)}</span>
                  <span class="rule-row-actions">
                    <button type="button" title="编辑" data-rule-edit="${rule.id}">改</button>
                    <button type="button" title="删除" data-rule-key="${key}" data-rule-id="${rule.id}">×</button>
                  </span>
                </li>
              `;
            })
            .join("") || `<li><span>暂无内容。</span></li>`
        }
      </ul>
    </section>
  `;
}

function renderChecklist() {
  const games = getChecklistGames();
  els.clearChecklistBtn.disabled = games.length === 0;

  if (games.length === 0) {
    els.checklist.innerHTML = `<li class="empty">从下方收藏里点“＋ 加入今晚清单”，开始排复习顺序。</li>`;
    els.checkProgressText.textContent = "还没有加入游戏";
    els.progressFill.style.width = "0%";
    return;
  }

  let totalChecked = 0;
  let totalRules = 0;

  els.checklist.innerHTML = games
    .map((game, index) => {
      const { checked, total } = getGameProgress(game);
      totalChecked += checked;
      totalRules += total;
      const done = total > 0 && checked === total;
      const groups = ruleCategories
        .map(({ key, title }) => {
          if (game[key].length === 0) return "";
          return `
            <div class="check-group">
              <h4>${title}</h4>
              <ul>
                ${game[key]
                  .map((rule) => {
                    const isChecked = isRuleChecked(rule);
                    return `
                      <li class="${isChecked ? "checked" : ""}">
                        <label>
                          <input
                            type="checkbox"
                            data-rule-check="${rule.id}"
                            ${isChecked ? "checked" : ""}
                          />
                          <span>${escapeHtml(rule.text)}</span>
                        </label>
                      </li>
                    `;
                  })
                  .join("")}
              </ul>
            </div>
          `;
        })
        .join("");

      return `
        <li class="check-item ${done ? "done" : ""}" data-check-game="${game.id}" draggable="true">
          <div class="check-item-head">
            <span class="drag-handle" title="拖动调整顺序">⠿</span>
            <span class="order-no">${index + 1}</span>
            <h3>${escapeHtml(game.name)}</h3>
            <span class="pill">${game.minPlayers}-${game.maxPlayers}人</span>
            <span class="pill">${game.duration}分钟</span>
            <span class="check-count">${checked}/${total}</span>
            <span class="order-buttons">
              <button type="button" data-move="up" ${index === 0 ? "disabled" : ""}>↑</button>
              <button type="button" data-move="down" ${index === games.length - 1 ? "disabled" : ""}>↓</button>
            </span>
            <button type="button" class="check-remove" title="移出清单" data-check-remove="${game.id}">×</button>
          </div>
          ${groups}
          ${done ? `<p class="done-hint">✓ 这款的规则已全部确认</p>` : ""}
        </li>
      `;
    })
    .join("");

  const percent = totalRules === 0 ? 0 : Math.round((totalChecked / totalRules) * 100);
  els.progressFill.style.width = `${percent}%`;
  els.checkProgressText.textContent =
    totalRules === 0
      ? `已选 ${games.length} 款，还没有规则条目`
      : `已选 ${games.length} 款 · 已确认 ${totalChecked}/${totalRules} 条（${percent}%）`;
}

function renderAll() {
  saveState();
  renderSummary();
  renderList();
  renderDetail();
  renderChecklist();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function addGame(event) {
  event.preventDefault();
  const minPlayers = Number(els.minPlayersInput.value);
  const maxPlayers = Math.max(minPlayers, Number(els.maxPlayersInput.value));
  const cover = await readFileAsDataUrl(els.coverInput.files[0]);
  const makeRule = (text) => ({ id: crypto.randomUUID(), text });
  const game = {
    id: crypto.randomUUID(),
    name: els.nameInput.value.trim(),
    minPlayers,
    maxPlayers,
    duration: Number(els.durationInput.value),
    complexity: els.complexityInput.value,
    lastPlayed: els.lastPlayedInput.value,
    cover,
    forgets: [makeRule("本局开始前先补充容易忘的规则。")],
    disputes: [],
    setup: [makeRule("整理组件并按人数调整初始设置。")],
    scoring: [makeRule("确认终局计分项和即时得分项。")]
  };
  state.games.unshift(game);
  state.selectedId = game.id;
  els.gameForm.reset();
  setDefaultDate();
  renderAll();
}

function setDefaultDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  els.lastPlayedInput.value = date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.searchInput.addEventListener("input", renderAll);
els.playerFilter.addEventListener("change", renderAll);
els.complexityFilter.addEventListener("change", renderAll);
els.sortMode.addEventListener("change", renderAll);
els.gameForm.addEventListener("submit", addGame);

els.gameList.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-checklist-toggle]");
  if (toggle) {
    event.stopPropagation();
    const id = toggle.dataset.checklistToggle;
    const pos = state.checklist.indexOf(id);
    if (pos === -1) state.checklist.push(id);
    else state.checklist.splice(pos, 1);
    renderAll();
    return;
  }

  const card = event.target.closest("[data-game-id]");
  if (!card) return;
  state.selectedId = card.dataset.gameId;
  renderAll();
});

els.detailView.addEventListener("submit", (event) => {
  if (event.target.id === "ruleForm") {
    event.preventDefault();
    const game = state.games.find((item) => item.id === state.selectedId);
    if (!game) return;
    const key = document.querySelector("#ruleTypeInput").value;
    const text = document.querySelector("#ruleTextInput").value.trim();
    if (!text) return;
    game[key].push({ id: crypto.randomUUID(), text });
    renderAll();
    return;
  }

  const editForm = event.target.closest(".rule-edit-form");
  if (editForm) {
    event.preventDefault();
    const game = state.games.find((item) => item.id === state.selectedId);
    if (!game) return;
    const ruleId = editForm.dataset.ruleId;
    const text = editForm.elements.text.value.trim();
    const found = findRule(game.id, ruleId);
    if (found && text) {
      if (found.rule.text !== text) {
        found.rule.text = text;
        // 内容已变：旧勾选失效，避免“看起来已确认”的假象
        delete state.checks[ruleId];
      }
      editingRule = null;
      renderAll();
    }
  }
});

els.detailView.addEventListener("click", (event) => {
  const game = state.games.find((item) => item.id === state.selectedId);
  if (!game) return;

  const editButton = event.target.closest("[data-rule-edit]");
  const deleteButton = event.target.closest("[data-rule-key]");
  const cancelButton = event.target.closest("[data-rule-cancel]");
  const toggleButton = event.target.closest("#toggleInDetailBtn");
  const playedButton = event.target.closest("#playedTodayBtn");
  const deleteGameButton = event.target.closest("#deleteGameBtn");

  if (editButton) {
    editingRule = { gameId: game.id, ruleId: editButton.dataset.ruleEdit };
    renderAll();
    const textarea = document.querySelector(".rule-edit-form textarea");
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }

  if (cancelButton) {
    editingRule = null;
    renderAll();
  }

  if (deleteButton) {
    const key = deleteButton.dataset.ruleKey;
    const ruleId = deleteButton.dataset.ruleId;
    game[key] = game[key].filter((rule) => rule.id !== ruleId);
    // 规则被移走：对应勾选立即失效
    delete state.checks[ruleId];
    editingRule = null;
    renderAll();
  }

  if (toggleButton) {
    const pos = state.checklist.indexOf(game.id);
    if (pos === -1) state.checklist.push(game.id);
    else state.checklist.splice(pos, 1);
    renderAll();
  }

  if (playedButton) {
    game.lastPlayed = new Date().toISOString().slice(0, 10);
    renderAll();
  }

  if (deleteGameButton) {
    state.games = state.games.filter((item) => item.id !== game.id);
    state.checklist = state.checklist.filter((id) => id !== game.id);
    state.selectedId = state.games[0]?.id || "";
    renderAll();
  }
});

// ---- 今晚清单：勾选、排序、拖拽 ----

els.checklist.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-rule-check]");
  if (!checkbox) return;
  const ruleId = checkbox.dataset.ruleCheck;
  const found = findRuleInAnyGame(ruleId);
  if (!found) return;
  if (checkbox.checked) {
    // 记录勾选当时的文本快照，之后内容一变就判定失效
    state.checks[ruleId] = { text: found.rule.text };
  } else {
    delete state.checks[ruleId];
  }
  renderAll();
});

function findRuleInAnyGame(ruleId) {
  for (const game of state.games) {
    const found = findRule(game.id, ruleId);
    if (found) return found;
  }
  return null;
}

els.checklist.addEventListener("click", (event) => {
  const moveButton = event.target.closest("[data-move]");
  const removeButton = event.target.closest("[data-check-remove]");

  if (moveButton) {
    const item = event.target.closest("[data-check-game]");
    const id = item.dataset.checkGame;
    const index = state.checklist.indexOf(id);
    const dir = moveButton.dataset.move === "up" ? -1 : 1;
    const target = index + dir;
    if (index === -1 || target < 0 || target >= state.checklist.length) return;
    [state.checklist[index], state.checklist[target]] = [state.checklist[target], state.checklist[index]];
    renderAll();
    return;
  }

  if (removeButton) {
    state.checklist = state.checklist.filter((id) => id !== removeButton.dataset.checkRemove);
    renderAll();
  }
});

els.clearChecklistBtn.addEventListener("click", () => {
  if (state.checklist.length === 0) return;
  state.checklist = [];
  renderAll();
});

let draggedGameId = null;

els.checklist.addEventListener("dragstart", (event) => {
  const item = event.target.closest("[data-check-game]");
  if (!item) return;
  draggedGameId = item.dataset.checkGame;
  event.dataTransfer.effectAllowed = "move";
});

els.checklist.addEventListener("dragover", (event) => {
  const item = event.target.closest("[data-check-game]");
  if (!item || !draggedGameId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  item.classList.add("dragover");
});

els.checklist.addEventListener("dragleave", (event) => {
  const item = event.target.closest("[data-check-game]");
  if (item) item.classList.remove("dragover");
});

els.checklist.addEventListener("drop", (event) => {
  const item = event.target.closest("[data-check-game]");
  if (!item || !draggedGameId) return;
  event.preventDefault();
  item.classList.remove("dragover");
  const targetId = item.dataset.checkGame;
  if (targetId === draggedGameId) return;
  const from = state.checklist.indexOf(draggedGameId);
  state.checklist.splice(from, 1);
  const to = state.checklist.indexOf(targetId);
  state.checklist.splice(to, 0, draggedGameId);
  draggedGameId = null;
  renderAll();
});

els.checklist.addEventListener("dragend", () => {
  draggedGameId = null;
  document.querySelectorAll(".check-item.dragover").forEach((node) => node.classList.remove("dragover"));
});

setDefaultDate();
renderAll();
