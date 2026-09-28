const storageKey = "zfl18-boardgame-rule-cards";
const today = new Date();

const ruleLabels = {
  forgets: "易忘",
  disputes: "争议",
  setup: "准备",
  scoring: "计分"
};

const defaultState = {
  selectedId: "",
  checklist: [],
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
if (!Array.isArray(state.checklist)) state.checklist = [];
if (!state.selectedId) state.selectedId = state.games[0]?.id || "";

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
  checklistView: document.querySelector("#checklistView"),
  checklistProgress: document.querySelector("#checklistProgress"),
  progressBar: document.querySelector("#progressBar"),
  invalidCount: document.querySelector("#invalidCount"),
  clearChecklistBtn: document.querySelector("#clearChecklistBtn")
};

let editingRule = null;

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function buildChecklistItems(game) {
  return Object.keys(ruleLabels).flatMap((key) =>
    game[key].map((text) => ({ key, text, checked: false, stale: false }))
  );
}

// 以加入清单时的规则快照为基准同步：游戏里新增的规则追加进清单，
// 快照里已被删除或被改写的规则标记为失效，勾选随之作废。
function syncChecklist() {
  state.checklist = state.checklist.map((entry) => {
    const game = state.games.find((item) => item.id === entry.gameId);
    if (!game) {
      return {
        ...entry,
        removed: true,
        items: entry.items.map((item) => ({ ...item, checked: false, stale: true }))
      };
    }
    const items = entry.items.map((item) => {
      const live = game[item.key]?.includes(item.text);
      return { ...item, stale: !live, checked: live ? !!item.checked : false };
    });
    Object.keys(ruleLabels).forEach((key) => {
      game[key].forEach((text) => {
        if (!items.some((item) => item.key === key && item.text === text)) {
          items.push({ key, text, checked: false, stale: false });
        }
      });
    });
    return { ...entry, removed: false, items };
  });
}

function toggleChecklistGame(gameId) {
  const exists = state.checklist.some((entry) => entry.gameId === gameId);
  if (exists) {
    state.checklist = state.checklist.filter((entry) => entry.gameId !== gameId);
  } else {
    const game = state.games.find((item) => item.id === gameId);
    if (!game) return;
    state.checklist.push({ gameId, items: buildChecklistItems(game) });
  }
  syncChecklist();
  renderAll();
}

function daysSince(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Math.max(0, Math.floor((today - date) / 86400000));
}

function getAllRules(game) {
  return [...game.forgets, ...game.disputes, ...game.setup, ...game.scoring];
}

function getFilteredGames() {
  const keyword = els.searchInput.value.trim();
  const player = els.playerFilter.value;
  const complexity = els.complexityFilter.value;
  const games = state.games.filter((game) => {
    const text = `${game.name}${getAllRules(game).join("")}`;
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
        const inList = state.checklist.some((entry) => entry.gameId === game.id);
        return `
          <article class="game-card ${selected}" data-game-id="${game.id}">
            <button type="button" class="add-tonight ${inList ? "in-list" : ""}" data-toggle-checklist="${game.id}">
              ${inList ? "✓ 已在今晚" : "＋ 加入今晚"}
            </button>
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
  const inList = state.checklist.some((entry) => entry.gameId === game.id);
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
      ${renderRuleSection("容易忘的规则", "forgets", game.forgets)}
      ${renderRuleSection("常见争议", "disputes", game.disputes)}
      ${renderRuleSection("开局准备", "setup", game.setup)}
      ${renderRuleSection("计分提醒", "scoring", game.scoring)}
      <form class="add-rule" id="ruleForm">
        <select id="ruleTypeInput">
          <option value="forgets">容易忘的规则</option>
          <option value="disputes">常见争议</option>
          <option value="setup">开局准备</option>
          <option value="scoring">计分提醒</option>
        </select>
        <textarea id="ruleTextInput" rows="3" placeholder="补充一条聚会前要看的提醒" required></textarea>
        <button class="primary" type="submit">加入规则卡片</button>
      </form>
      <div class="detail-actions">
        <button id="playedTodayBtn" type="button">标记今天玩过</button>
        <button id="toggleChecklistDetailBtn" type="button">${inList ? "移出今晚清单" : "加入今晚清单"}</button>
        <button id="deleteGameBtn" type="button">删除桌游</button>
      </div>
    </div>
  `;
}

function renderRuleSection(title, key, items) {
  return `
    <section class="rule-section">
      <h3>${title}</h3>
      <ul class="rule-list">
        ${
          items
            .map((item, index) => {
              const isEditing = editingRule && editingRule.key === key && editingRule.index === index;
              if (isEditing) {
                return `
                  <li>
                    <form class="rule-editor" data-rule-key="${key}" data-rule-index="${index}">
                      <textarea rows="2" data-edit-textarea>${escapeHtml(item)}</textarea>
                      <div class="editor-actions">
                        <button class="primary" type="submit">保存</button>
                        <button type="button" data-edit-cancel>取消</button>
                      </div>
                    </form>
                  </li>
                `;
              }
              return `
                <li>
                  <span class="rule-text">${escapeHtml(item)}</span>
                  <span class="rule-row-actions">
                    <button type="button" title="编辑" data-rule-edit-key="${key}" data-rule-edit-index="${index}">✎</button>
                    <button type="button" title="删除" data-rule-key="${key}" data-rule-index="${index}">×</button>
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
  if (state.checklist.length === 0) {
    els.checklistView.innerHTML = `<p class="empty">从下方收藏里点「＋ 加入今晚」，按聚会顺序排成复习清单。</p>`;
    els.checklistProgress.textContent = "还没有游戏";
    els.invalidCount.textContent = "";
    els.progressBar.style.width = "0";
    return;
  }

  let liveDone = 0;
  let liveTotal = 0;
  let staleTotal = 0;

  const blocks = state.checklist.map((entry, gameIndex) => {
    const game = state.games.find((item) => item.id === entry.gameId);
    const liveItems = entry.items.filter((item) => !item.stale);
    const staleItems = entry.items.filter((item) => item.stale);
    liveTotal += liveItems.length;
    liveDone += liveItems.filter((item) => item.checked).length;
    staleTotal += staleItems.length;

    const renderItem = (item, itemIndex) => {
      const id = `chk-${gameIndex}-${itemIndex}-${item.key}`;
      if (item.stale) {
        return `
          <li class="check-item stale">
            <input type="checkbox" disabled />
            <label for="${id}">
              <span class="tag">${ruleLabels[item.key] || "规则"}</span>
              <span class="text">${escapeHtml(item.text)}</span>
              <span class="stale-note">
                ${entry.removed ? "该桌游已删除" : "此规则已被删除或内容已修改"}，原勾选已失效
              </span>
            </label>
            <button type="button" class="icon-btn" title="移除"
              data-remove-item="${gameIndex}" data-remove-index="${itemIndex}">×</button>
          </li>
        `;
      }
      return `
        <li class="check-item ${item.checked ? "checked" : ""}">
          <input type="checkbox" id="${id}" ${item.checked ? "checked" : ""}
            data-check-game="${gameIndex}" data-check-index="${itemIndex}" />
          <label for="${id}">
            <span class="tag">${ruleLabels[item.key]}</span>
            <span class="text">${escapeHtml(item.text)}</span>
          </label>
        </li>
      `;
    };

    const allIndices = [...entry.items.keys()];
    const staleIndices = new Set(entry.items.map((item, index) => (item.stale ? index : -1)).filter((index) => index >= 0));
    const renderByIdx = (index) => renderItem(entry.items[index], index);

    return `
      <article class="checklist-game ${staleItems.length ? "invalid" : ""}">
        <div class="checklist-game-head">
          <div class="order-controls">
            <button type="button" class="icon-btn" title="上移" data-move="${gameIndex}" data-dir="-1" ${gameIndex === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="icon-btn" title="下移" data-move="${gameIndex}" data-dir="1" ${gameIndex === state.checklist.length - 1 ? "disabled" : ""}>↓</button>
          </div>
          <h3 data-select-game="${entry.gameId}">
            ${gameIndex + 1}. ${game ? escapeHtml(game.name) : "已删除的桌游"}
          </h3>
          <button type="button" class="icon-btn" title="移出清单" data-remove-game="${gameIndex}">×</button>
        </div>
        ${entry.removed ? `<p class="game-removed">该桌游已从收藏中删除，下面的勾选已失效。</p>` : ""}
        <ul class="rule-list">
          ${allIndices.filter((index) => !staleIndices.has(index)).map(renderByIdx).join("")}
        </ul>
        ${
          staleItems.length
            ? `<div class="stale-group"><ul class="rule-list">${allIndices.filter((index) => staleIndices.has(index)).map(renderByIdx).join("")}</ul></div>`
            : ""
        }
      </article>
    `;
  });

  els.checklistView.innerHTML = blocks.join("");
  els.checklistProgress.textContent = `进度 ${liveDone}/${liveTotal}`;
  els.invalidCount.textContent = staleTotal ? `${staleTotal} 条失效待处理` : "";
  els.progressBar.style.width = `${liveTotal ? Math.round((liveDone / liveTotal) * 100) : 0}%`;
}

function renderAll() {
  syncChecklist();
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
  const game = {
    id: crypto.randomUUID(),
    name: els.nameInput.value.trim(),
    minPlayers,
    maxPlayers,
    duration: Number(els.durationInput.value),
    complexity: els.complexityInput.value,
    lastPlayed: els.lastPlayedInput.value,
    cover,
    forgets: ["本局开始前先补充容易忘的规则。"],
    disputes: [],
    setup: ["整理组件并按人数调整初始设置。"],
    scoring: ["确认终局计分项和即时得分项。"]
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
  const toggle = event.target.closest("[data-toggle-checklist]");
  if (toggle) {
    event.stopPropagation();
    toggleChecklistGame(toggle.dataset.toggleChecklist);
    return;
  }
  const card = event.target.closest("[data-game-id]");
  if (!card) return;
  state.selectedId = card.dataset.gameId;
  renderAll();
});

els.clearChecklistBtn.addEventListener("click", () => {
  if (!state.checklist.length) return;
  if (confirm("清空今晚复习清单？勾选进度会一并清除。")) {
    state.checklist = [];
    renderAll();
  }
});

els.checklistView.addEventListener("click", (event) => {
  const moveBtn = event.target.closest("[data-move]");
  if (moveBtn) {
    const index = Number(moveBtn.dataset.move);
    const dir = Number(moveBtn.dataset.dir);
    const target = index + dir;
    if (target < 0 || target >= state.checklist.length) return;
    [state.checklist[index], state.checklist[target]] = [state.checklist[target], state.checklist[index]];
    renderAll();
    return;
  }

  const removeGameBtn = event.target.closest("[data-remove-game]");
  if (removeGameBtn) {
    state.checklist.splice(Number(removeGameBtn.dataset.removeGame), 1);
    renderAll();
    return;
  }

  const removeItemBtn = event.target.closest("[data-remove-item]");
  if (removeItemBtn) {
    const entry = state.checklist[Number(removeItemBtn.dataset.removeItem)];
    entry.items.splice(Number(removeItemBtn.dataset.removeIndex), 1);
    renderAll();
    return;
  }

  const title = event.target.closest("[data-select-game]");
  if (title) {
    state.selectedId = title.dataset.selectGame;
    renderAll();
  }
});

els.checklistView.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-check-game]");
  if (!checkbox) return;
  const entry = state.checklist[Number(checkbox.dataset.checkGame)];
  const item = entry?.items[Number(checkbox.dataset.checkIndex)];
  if (!item || item.stale) return;
  item.checked = checkbox.checked;
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
    game[key].push(text);
    renderAll();
    return;
  }

  const editor = event.target.closest(".rule-editor");
  if (editor) {
    event.preventDefault();
    const game = state.games.find((item) => item.id === state.selectedId);
    if (!game) return;
    const key = editor.dataset.ruleKey;
    const index = Number(editor.dataset.ruleIndex);
    const text = editor.querySelector("[data-edit-textarea]").value.trim();
    if (text) game[key][index] = text;
    editingRule = null;
    renderAll();
  }
});

els.detailView.addEventListener("click", (event) => {
  const editCancel = event.target.closest("[data-edit-cancel]");
  if (editCancel) {
    editingRule = null;
    renderAll();
    return;
  }

  const editButton = event.target.closest("[data-rule-edit-key]");
  if (editButton) {
    editingRule = { key: editButton.dataset.ruleEditKey, index: Number(editButton.dataset.ruleEditIndex) };
    renderDetail();
    const textarea = els.detailView.querySelector("[data-edit-textarea]");
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
    return;
  }

  const ruleButton = event.target.closest("button[data-rule-key]");
  const playedButton = event.target.closest("#playedTodayBtn");
  const toggleButton = event.target.closest("#toggleChecklistDetailBtn");
  const deleteButton = event.target.closest("#deleteGameBtn");
  const game = state.games.find((item) => item.id === state.selectedId);
  if (!game) return;

  if (ruleButton) {
    const key = ruleButton.dataset.ruleKey;
    const index = Number(ruleButton.dataset.ruleIndex);
    game[key].splice(index, 1);
    editingRule = null;
    renderAll();
  }

  if (playedButton) {
    game.lastPlayed = new Date().toISOString().slice(0, 10);
    renderAll();
  }

  if (toggleButton) {
    toggleChecklistGame(game.id);
  }

  if (deleteButton) {
    state.games = state.games.filter((item) => item.id !== game.id);
    state.checklist = state.checklist.filter((entry) => entry.gameId !== game.id);
    state.selectedId = state.games[0]?.id || "";
    editingRule = null;
    renderAll();
  }
});

setDefaultDate();
renderAll();
