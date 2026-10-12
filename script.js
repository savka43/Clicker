const $ = (selector) => document.querySelector(selector);

// ---------- DOM ----------
const ui = {
  count: $("#count"),
  clickButton: $("#click-button"),
  character: $("#character"),
  battleCry: $("#battle-cry"),
  gold: $("#gold"),
  heroStats: $("#hero-stats"),
  levelProgress: $("#level-progress"),
  hookProgress: $("#hook-progress"),
  attackButton: $("#attack-button"),
  hookButton: $("#hook-button"),
  creep: $("#creep"),
  enemyTitle: $("#enemy-title"),
  emptyArena: $("#empty-arena"),
  creepNumber: $("#creep-number"),
  healthBar: $("#creep-health"),
  healthFill: $("#health-fill"),
  healthLabel: $("#health-label"),
  spawnTimer: $("#spawn-timer"),
  queueLabel: $("#queue-label"),
  comboLabel: $("#combo-label"),
  combatStatus: $("#combat-status"),
  combatEffects: $("#combat-effects"),
  shopPanel: $("#shop-panel"),
  shopToggle: $("#shop-toggle"),
  shopClose: $("#shop-close"),
  shopStatus: $("#shop-status"),
  questDescription: $("#quest-description"),
  questProgress: $("#quest-progress"),
  claimQuest: $("#claim-quest"),
};

// ---------- Config ----------
const SAVE_KEY = "fresh-meat-progress-v1";
const SPAWN_INTERVAL = 10000;
const HELPER_INTERVAL = 1200;
const COMBO_WINDOW = 2000;
const COMBO_DEFAULT_LABEL = "5 быстрых ударов — критический удар ×2";
const MAX_UPGRADE = 20;
const MAX_HOOK_CHARGES = 3;
const KILLS_PER_LEVEL = 5;
const BOSS_EVERY = 5;

const UPGRADES = {
  damage: {
    baseCost: 40,
    describe: (n) => `+10 к урону · куплено ${n}`,
    message: "Тесак заточен! +10 урона",
  },
  bounty: {
    baseCost: 60,
    describe: (n) => `+10 золота за крипа · куплено ${n}`,
    message: "Награда выросла! +10 золота за крипа",
  },
  helper: {
    baseCost: 150,
    describe: (n) => (n ? `Сейчас ${n * 10} урона / 1,2 с · купить ещё +10` : "Автоатака: 10 урона каждые 1,2 с"),
    message: "Помощник усилен! +10 урона автоатаки",
  },
};

const QUESTS = [
  { key: "kills", target: 5, reward: 50, label: "Убить крипов" },
  { key: "clicks", target: 100, reward: 40, label: "Сделать кликов" },
  { key: "bossKills", target: 1, reward: 100, label: "Победить боссов" },
];

// ---------- State ----------
const state = { gold: 0, kills: 0, clicks: 0, damage: 0, bounty: 0, helper: 0, hookCharges: 0, bossKills: 0, questStep: 0 };
const creeps = [];
let attackLocked = false;
let hookTimeout;
let combo = 0;
let lastAttackAt = -Infinity;
let nextSpawnAt = Date.now() + SPAWN_INTERVAL;
let nextHelperAt = Date.now() + HELPER_INTERVAL;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && typeof saved === "object") {
      for (const key of Object.keys(state)) {
        if (Number.isSafeInteger(saved[key]) && saved[key] >= 0) state[key] = saved[key];
      }
      for (const key of Object.keys(UPGRADES)) state[key] = Math.min(MAX_UPGRADE, state[key]);
      state.hookCharges = Math.min(MAX_HOOK_CHARGES, state.hookCharges);
      if (saved.bossKills === undefined) state.bossKills = Math.floor(state.kills / BOSS_EVERY);
    } else {
      const oldGold = Number(localStorage.getItem("fresh-meat-gold"));
      if (Number.isSafeInteger(oldGold) && oldGold >= 0) state.gold = oldGold;
    }
  } catch { /* Play normally when storage is unavailable or the save is malformed. */ }
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Storage is optional. */ }
}

load();
let spawnedCount = state.kills;

const level = () => 1 + Math.floor(state.kills / KILLS_PER_LEVEL);
const damage = () => 20 + state.damage * 10 + (level() - 1) * 5;
const upgradeCost = (key) => Math.ceil(UPGRADES[key].baseCost * 1.6 ** state[key]);

function currentQuest() {
  const quest = QUESTS[state.questStep % QUESTS.length];
  const round = Math.floor(state.questStep / QUESTS.length) + 1;
  return { ...quest, target: quest.target * round, reward: quest.reward * round };
}

// ---------- Rendering ----------
function renderStats() {
  ui.gold.textContent = state.gold;
  ui.count.textContent = state.clicks;
  ui.heroStats.textContent = `Уровень ${level()} · Урон ${damage()} · Убийств ${state.kills}`;
  ui.levelProgress.textContent = `До уровня ${level() + 1}: ${KILLS_PER_LEVEL - state.kills % KILLS_PER_LEVEL} убийств · +5 урона`;
  ui.hookProgress.textContent = `Заряд хука через ${25 - state.clicks % 25} кликов · +25 G каждые 100`;
  for (const [key, upgrade] of Object.entries(UPGRADES)) {
    const maxed = state[key] >= MAX_UPGRADE;
    $(`#${key}-description`).textContent = upgrade.describe(state[key]);
    $(`#${key}-price`).textContent = maxed ? "МАКС" : `${upgradeCost(key)} G`;
    $(`#buy-${key}`).disabled = maxed || state.gold < upgradeCost(key);
  }
  renderHookControls();
  renderQuest();
}

function renderHookControls() {
  ui.hookButton.textContent = `Хук ×3 · ${state.hookCharges}/${MAX_HOOK_CHARGES}`;
  ui.hookButton.disabled = !creeps.length || attackLocked || state.hookCharges === 0;
}

function renderQuest() {
  const quest = currentQuest();
  const progress = Math.min(state[quest.key], quest.target);
  ui.questDescription.textContent = `${quest.label}: ${progress}/${quest.target} · награда ${quest.reward} G`;
  ui.questProgress.max = quest.target;
  ui.questProgress.value = progress;
  ui.claimQuest.disabled = progress < quest.target;
  ui.claimQuest.textContent = `Забрать ${quest.reward} G`;
}

function renderCreep() {
  const target = creeps[0];
  ui.creep.hidden = !target;
  ui.emptyArena.hidden = Boolean(target);
  ui.attackButton.disabled = !target || attackLocked;
  renderHookControls();
  ui.queueLabel.textContent = creeps.length > 1 ? `Следующих крипов: ${creeps.length - 1}` : "";
  if (!target) return;
  ui.creep.classList.toggle("boss", target.boss);
  ui.enemyTitle.textContent = target.boss ? "Босс-мясник" : "Крип";
  ui.creepNumber.textContent = `#${target.id}`;
  ui.healthBar.setAttribute("aria-valuemax", target.maxHp);
  ui.healthBar.setAttribute("aria-valuenow", target.hp);
  ui.healthFill.style.width = `${target.hp / target.maxHp * 100}%`;
  ui.healthLabel.textContent = `${target.hp} / ${target.maxHp} HP · ${target.reward} G`;
}

// ---------- Effects ----------
function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function showCombatEffect(text, reward = false) {
  const effect = document.createElement("span");
  effect.className = reward ? "combat-float reward" : "combat-float";
  effect.textContent = text;
  ui.combatEffects.append(effect);
  setTimeout(() => effect.remove(), 800);
}

function playHook() {
  clearTimeout(hookTimeout);
  restartAnimation(ui.character, "hooking");
  ui.battleCry.textContent = "fresh meat!";
  hookTimeout = setTimeout(() => {
    ui.character.classList.remove("hooking");
    ui.battleCry.textContent = "";
  }, 1800);
}

// ---------- Game actions ----------
function clickHero() {
  state.clicks += 1;
  if (state.clicks % 25 === 0) state.hookCharges = Math.min(MAX_HOOK_CHARGES, state.hookCharges + 1);
  if (state.clicks % 100 === 0) {
    playHook();
    state.gold += 25;
    showCombatEffect("G +25 за хук", true);
  }
  save();
  renderStats();
}

function spawnCreep() {
  const id = ++spawnedCount;
  const wave = Math.floor((id - 1) / BOSS_EVERY);
  const boss = id % BOSS_EVERY === 0;
  const maxHp = (60 + wave * 20) * (boss ? 3 : 1);
  const reward = (25 + wave * 5 + state.bounty * 10) * (boss ? 4 : 1);
  creeps.push({ id, hp: maxHp, maxHp, boss, reward });
  if (creeps.length === 1) {
    ui.creep.classList.remove("dying", "hit");
    restartAnimation(ui.creep, "spawning");
    ui.combatStatus.textContent = boss ? "Босс! Здоровья ×3, золота ×4. Собери комбо!" : "Крип появился! Атакуй его.";
  }
  renderCreep();
}

function registerCombo() {
  const now = Date.now();
  combo = now - lastAttackAt <= COMBO_WINDOW ? combo + 1 : 1;
  lastAttackAt = now;
  const critical = combo % 5 === 0;
  ui.comboLabel.textContent = critical ? "КРИТ! Урон ×2" : `Комбо ${combo % 5}/5 · следующий удар за 2 с`;
  return critical;
}

function killCreep(target) {
  const oldLevel = level();
  state.gold += target.reward;
  state.kills += 1;
  if (target.boss) state.bossKills += 1;
  save();
  renderStats();
  const levelUp = level() > oldLevel ? ` · Уровень ${level()}! +5 урона` : "";
  ui.combatStatus.textContent = `${target.boss ? "Босс повержен!" : "Крип убит!"} +${target.reward} золота${levelUp}`;
  showCombatEffect(`G +${target.reward}`, true);
  ui.creep.classList.add("dying");
  setTimeout(() => {
    creeps.shift();
    ui.creep.classList.remove("dying", "hit", "spawning");
    ui.character.classList.remove("attacking");
    attackLocked = false;
    if (creeps.length) restartAnimation(ui.creep, "spawning");
    renderCreep();
  }, 600);
}

function attack({ auto = false, hook = false } = {}) {
  const target = creeps[0];
  if (!target || attackLocked) return;
  attackLocked = true;
  const critical = !auto && !hook && registerCombo();
  const hitDamage = auto ? state.helper * 10 : damage() * (hook ? 3 : critical ? 2 : 1);
  target.hp = Math.max(0, target.hp - hitDamage);
  restartAnimation(ui.character, "attacking");
  restartAnimation(ui.creep, "hit");
  showCombatEffect(`${hook ? "ХУК! " : critical ? "КРИТ! " : auto ? "АВТО " : ""}−${hitDamage}`);
  renderCreep();

  if (target.hp === 0) {
    killCreep(target);
    return;
  }
  ui.combatStatus.textContent = `${auto ? "Помощник атакует" : critical ? "Критический удар!" : "Удар!"} Осталось ${target.hp} HP`;
  setTimeout(() => {
    ui.character.classList.remove("attacking");
    ui.creep.classList.remove("hit");
    attackLocked = false;
    renderCreep();
  }, 300);
}

function useHook() {
  if (!creeps.length || attackLocked || state.hookCharges === 0) return;
  state.hookCharges -= 1;
  playHook();
  attack({ hook: true });
  save();
  renderStats();
}

function buyUpgrade(key) {
  const cost = upgradeCost(key);
  if (state[key] >= MAX_UPGRADE || state.gold < cost) return;
  state.gold -= cost;
  state[key] += 1;
  if (key === "bounty") {
    // The new bounty also applies to enemies already waiting in the arena.
    for (const target of creeps) target.reward += 10 * (target.boss ? 4 : 1);
  }
  save();
  renderStats();
  renderCreep();
  ui.shopStatus.textContent = UPGRADES[key].message;
}

function claimQuest() {
  const quest = currentQuest();
  if (state[quest.key] < quest.target) return;
  state.gold += quest.reward;
  state.questStep += 1;
  save();
  renderStats();
  ui.shopStatus.textContent = `Контракт выполнен! +${quest.reward} золота. Доступно новое задание.`;
}

function tick() {
  const now = Date.now();
  // A paused/background tab resumes with one new creep, without a huge backlog.
  if (now >= nextSpawnAt) {
    spawnCreep();
    nextSpawnAt = now + SPAWN_INTERVAL;
  }
  const untilBoss = BOSS_EVERY - spawnedCount % BOSS_EVERY;
  ui.spawnTimer.textContent = `Новый ${untilBoss === 1 ? "босс" : "крип"} через ${Math.ceil((nextSpawnAt - now) / 1000)} с · босс каждый 5-й`;
  if (state.helper && now >= nextHelperAt && !attackLocked) {
    attack({ auto: true });
    nextHelperAt = now + HELPER_INTERVAL;
  }
  if (combo && now - lastAttackAt > COMBO_WINDOW) {
    combo = 0;
    ui.comboLabel.textContent = COMBO_DEFAULT_LABEL;
  }
}

// ---------- Shop panel ----------
const narrowScreen = window.matchMedia("(max-width: 980px)");

function syncShopLayout() {
  ui.shopPanel.close();
  if (!narrowScreen.matches) ui.shopPanel.show();
  ui.shopToggle.setAttribute("aria-expanded", String(ui.shopPanel.open));
}

function toggleShop() {
  if (!narrowScreen.matches) return;
  if (ui.shopPanel.open) ui.shopPanel.close();
  else ui.shopPanel.showModal();
  ui.shopToggle.setAttribute("aria-expanded", String(ui.shopPanel.open));
}

// ---------- Wiring ----------
ui.clickButton.addEventListener("click", clickHero);
ui.attackButton.addEventListener("click", () => attack());
ui.hookButton.addEventListener("click", useHook);
ui.claimQuest.addEventListener("click", claimQuest);
for (const key of Object.keys(UPGRADES)) $(`#buy-${key}`).addEventListener("click", () => buyUpgrade(key));

ui.shopToggle.addEventListener("click", toggleShop);
ui.shopClose.addEventListener("click", () => ui.shopPanel.close());
ui.shopPanel.addEventListener("close", () => ui.shopToggle.setAttribute("aria-expanded", "false"));
narrowScreen.addEventListener("change", syncShopLayout);

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest("input, textarea, select, button, [contenteditable]")) return;
  if (event.code === "KeyM") toggleShop();
  if (narrowScreen.matches && ui.shopPanel.open) return;
  const controls = { Space: ui.clickButton, KeyA: ui.attackButton, KeyQ: ui.hookButton };
  if (controls[event.code]) {
    event.preventDefault();
    controls[event.code].click();
  }
});

// ---------- Start ----------
syncShopLayout();
renderStats();
renderCreep();
ui.combatStatus.textContent = "Первый крип через 10 секунд. Каждый пятый — босс!";
setInterval(tick, 250);
