const $ = (selector) => document.querySelector(selector);
const countDisplay = $("#count");
const button = $("#click-button");
const character = $("#character");
const battleCry = $("#battle-cry");
const goldDisplay = $("#gold");
const attackButton = $("#attack-button");
const creepElement = $("#creep");
const emptyArena = $("#empty-arena");
const creepNumber = $("#creep-number");
const healthBar = $("#creep-health");
const healthFill = $("#health-fill");
const healthLabel = $("#health-label");
const spawnTimer = $("#spawn-timer");
const queueLabel = $("#queue-label");
const combatStatus = $("#combat-status");
const combatEffects = $("#combat-effects");
const hookButton = $("#hook-button");
const SAVE_KEY = "fresh-meat-progress-v1";
const SPAWN_INTERVAL = 10000;
const MAX_UPGRADE = 20;
const creeps = [];
const state = { gold: 0, kills: 0, clicks: 0, damage: 0, bounty: 0, helper: 0, hookCharges: 0, bossKills: 0, questStep: 0 };
let attackLocked = false;
let hookTimeout;
let combo = 0;
let lastAttackAt = -Infinity;
let nextSpawnAt = Date.now() + SPAWN_INTERVAL;
let nextHelperAt = Date.now() + 1200;

try {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
  if (saved && typeof saved === "object") {
    for (const key of Object.keys(state)) {
      if (Number.isSafeInteger(saved[key]) && saved[key] >= 0) state[key] = saved[key];
    }
    for (const key of ["damage", "bounty", "helper"]) state[key] = Math.min(MAX_UPGRADE, state[key]);
    state.hookCharges = Math.min(3, state.hookCharges);
    if (saved.bossKills === undefined) state.bossKills = Math.floor(state.kills / 5);
  } else {
    const oldGold = Number(localStorage.getItem("fresh-meat-gold"));
    if (Number.isSafeInteger(oldGold) && oldGold >= 0) state.gold = oldGold;
  }
} catch { /* Play normally when storage is unavailable or the save is malformed. */ }
let spawnedCount = state.kills;

const level = () => 1 + Math.floor(state.kills / 5);
const damage = () => 20 + state.damage * 10 + (level() - 1) * 5;
const upgradeCost = (key) => Math.ceil(({ damage: 40, bounty: 60, helper: 150 }[key]) * 1.6 ** state[key]);

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* Storage is optional. */ }
}

function renderStats() {
  goldDisplay.textContent = state.gold;
  countDisplay.textContent = state.clicks;
  $("#hero-stats").textContent = `Уровень ${level()} · Урон ${damage()} · Убийств ${state.kills}`;
  $("#level-progress").textContent = `До уровня ${level() + 1}: ${5 - state.kills % 5} убийств · +5 урона`;
  $("#hook-progress").textContent = `Заряд хука через ${25 - state.clicks % 25} кликов · +25 🪙 каждые 100`;
  const descriptions = {
    damage: `+10 к урону · куплено ${state.damage}`,
    bounty: `+10 золота за крипа · куплено ${state.bounty}`,
    helper: state.helper ? `Сейчас ${state.helper * 10} урона / 1,2 с · купить ещё +10` : "Автоатака: 10 урона каждые 1,2 с",
  };
  for (const key of ["damage", "bounty", "helper"]) {
    const maxed = state[key] >= MAX_UPGRADE;
    $(`#${key}-description`).textContent = descriptions[key];
    $(`#${key}-price`).textContent = maxed ? "МАКС" : `${upgradeCost(key)} 🪙`;
    $(`#buy-${key}`).disabled = maxed || state.gold < upgradeCost(key);
  }
  renderHookControls();
  renderQuest();
}

function renderHookControls() {
  hookButton.textContent = `Хук ×3 · ${state.hookCharges}/3`;
  hookButton.disabled = !creeps.length || attackLocked || state.hookCharges === 0;
}

const QUESTS = [
  { key: "kills", target: 5, reward: 50, label: "Убить крипов" },
  { key: "clicks", target: 100, reward: 40, label: "Сделать кликов" },
  { key: "bossKills", target: 1, reward: 100, label: "Победить боссов" },
];

function currentQuest() {
  const quest = QUESTS[state.questStep % QUESTS.length];
  const round = Math.floor(state.questStep / QUESTS.length) + 1;
  return { ...quest, target: quest.target * round, reward: quest.reward * round };
}

function renderQuest() {
  const quest = currentQuest();
  const progress = Math.min(state[quest.key], quest.target);
  $("#quest-description").textContent = `${quest.label}: ${progress}/${quest.target} · награда ${quest.reward} 🪙`;
  $("#quest-progress").max = quest.target;
  $("#quest-progress").value = progress;
  $("#claim-quest").disabled = progress < quest.target;
  $("#claim-quest").textContent = `Забрать ${quest.reward} 🪙`;
}

$("#claim-quest").addEventListener("click", () => {
  const quest = currentQuest();
  if (state[quest.key] < quest.target) return;
  state.gold += quest.reward;
  state.questStep += 1;
  save();
  renderStats();
  $("#shop-status").textContent = `Контракт выполнен! +${quest.reward} золота. Доступно новое задание.`;
});

function playHook() {
  clearTimeout(hookTimeout);
  restartAnimation(character, "hooking");
  battleCry.textContent = "fresh meat!";
  hookTimeout = setTimeout(() => {
    character.classList.remove("hooking");
    battleCry.textContent = "";
  }, 1800);
}

function restartAnimation(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function showCombatEffect(text, reward = false) {
  const effect = document.createElement("span");
  effect.className = reward ? "combat-float reward" : "combat-float";
  effect.textContent = text;
  combatEffects.append(effect);
  setTimeout(() => effect.remove(), 800);
}

button.addEventListener("click", () => {
  state.clicks += 1;
  if (state.clicks % 25 === 0) state.hookCharges = Math.min(3, state.hookCharges + 1);
  if (state.clicks % 100 === 0) {
    playHook();
    state.gold += 25;
    showCombatEffect("🪙 +25 за хук", true);
  }
  save();
  renderStats();
});

function renderCreep() {
  const target = creeps[0];
  creepElement.hidden = !target;
  emptyArena.hidden = Boolean(target);
  attackButton.disabled = !target || attackLocked;
  renderHookControls();
  queueLabel.textContent = creeps.length > 1 ? `Следующих крипов: ${creeps.length - 1}` : "";
  if (!target) return;
  creepElement.classList.toggle("boss", target.boss);
  $("#enemy-title").textContent = target.boss ? "👑 Босс-мясник" : "Крип";
  creepNumber.textContent = `#${target.id}`;
  healthBar.setAttribute("aria-valuemax", target.maxHp);
  healthBar.setAttribute("aria-valuenow", target.hp);
  healthFill.style.width = `${target.hp / target.maxHp * 100}%`;
  healthLabel.textContent = `${target.hp} / ${target.maxHp} HP · ${target.reward} 🪙`;
}

function spawnCreep() {
  const id = ++spawnedCount;
  const wave = Math.floor((id - 1) / 5);
  const boss = id % 5 === 0;
  const maxHp = (60 + wave * 20) * (boss ? 3 : 1);
  const reward = (25 + wave * 5 + state.bounty * 10) * (boss ? 4 : 1);
  creeps.push({ id, hp: maxHp, maxHp, boss, reward });
  if (creeps.length === 1) {
    creepElement.classList.remove("dying", "hit");
    restartAnimation(creepElement, "spawning");
    combatStatus.textContent = boss ? "Босс! Здоровья ×3, золота ×4. Собери комбо!" : "Крип появился! Атакуй его.";
  }
  renderCreep();
}

function attack(auto = false, isHook = false) {
  const target = creeps[0];
  if (!target || attackLocked) return;
  attackLocked = true;
  let critical = false;
  if (!auto && !isHook) {
    const now = Date.now();
    combo = now - lastAttackAt <= 2000 ? combo + 1 : 1;
    lastAttackAt = now;
    critical = combo % 5 === 0;
    $("#combo-label").textContent = critical ? "КРИТ! Урон ×2" : `Комбо ${combo % 5}/5 · следующий удар за 2 с`;
  }
  const hitDamage = auto ? state.helper * 10 : damage() * (isHook ? 3 : critical ? 2 : 1);
  target.hp = Math.max(0, target.hp - hitDamage);
  restartAnimation(character, "attacking");
  restartAnimation(creepElement, "hit");
  showCombatEffect(`${isHook ? "ХУК! " : critical ? "КРИТ! " : auto ? "👺 " : ""}−${hitDamage}`);
  renderCreep();

  if (target.hp === 0) {
    const oldLevel = level();
    state.gold += target.reward;
    state.kills += 1;
    if (target.boss) state.bossKills += 1;
    save();
    renderStats();
    combatStatus.textContent = `${target.boss ? "Босс повержен!" : "Крип убит!"} +${target.reward} золота${level() > oldLevel ? ` · Уровень ${level()}! +5 урона` : ""}`;
    showCombatEffect(`🪙 +${target.reward}`, true);
    creepElement.classList.add("dying");
    setTimeout(() => {
      creeps.shift();
      creepElement.classList.remove("dying", "hit", "spawning");
      character.classList.remove("attacking");
      attackLocked = false;
      if (creeps.length) restartAnimation(creepElement, "spawning");
      renderCreep();
    }, 600);
  } else {
    combatStatus.textContent = `${auto ? "Помощник атакует" : critical ? "Критический удар!" : "Удар!"} Осталось ${target.hp} HP`;
    setTimeout(() => {
      character.classList.remove("attacking");
      creepElement.classList.remove("hit");
      attackLocked = false;
      renderCreep();
    }, 300);
  }
}
attackButton.addEventListener("click", () => attack());
hookButton.addEventListener("click", () => {
  if (!creeps.length || attackLocked || state.hookCharges === 0) return;
  state.hookCharges -= 1;
  playHook();
  attack(false, true);
  save();
  renderStats();
});

for (const key of ["damage", "bounty", "helper"]) {
  $(`#buy-${key}`).addEventListener("click", () => {
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
    $("#shop-status").textContent = ({ damage: "Тесак заточен! +10 урона", bounty: "Награда выросла! +10 золота за крипа", helper: "Помощник усилен! +10 урона автоатаки" })[key];
  });
}

function tick() {
  const now = Date.now();
  // A paused/background tab resumes with one new creep, without a huge backlog.
  if (now >= nextSpawnAt) {
    spawnCreep();
    nextSpawnAt = now + SPAWN_INTERVAL;
  }
  const untilBoss = 5 - spawnedCount % 5;
  spawnTimer.textContent = `Новый ${untilBoss === 1 ? "босс" : "крип"} через ${Math.ceil((nextSpawnAt - now) / 1000)} с · босс каждый 5-й`;
  if (state.helper && now >= nextHelperAt && !attackLocked) {
    attack(true);
    nextHelperAt = now + 1200;
  }
  if (combo && now - lastAttackAt > 2000) {
    combo = 0;
    $("#combo-label").textContent = "5 быстрых ударов — критический удар ×2";
  }
}
const shopPanel = $("#shop-panel");
const shopToggle = $("#shop-toggle");
const narrowScreen = window.matchMedia("(max-width: 980px)");

function syncShopLayout() {
  shopPanel.close();
  if (!narrowScreen.matches) shopPanel.show();
  shopToggle.setAttribute("aria-expanded", String(shopPanel.open));
}

function toggleShop() {
  if (!narrowScreen.matches) return;
  if (shopPanel.open) shopPanel.close();
  else shopPanel.showModal();
  shopToggle.setAttribute("aria-expanded", String(shopPanel.open));
}

shopToggle.addEventListener("click", toggleShop);
$("#shop-close").addEventListener("click", () => shopPanel.close());
shopPanel.addEventListener("close", () => shopToggle.setAttribute("aria-expanded", "false"));
narrowScreen.addEventListener("change", syncShopLayout);
syncShopLayout();

document.addEventListener("keydown", (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest("input, textarea, select, button, [contenteditable]")) return;
  if (event.code === "KeyM") toggleShop();
  if (narrowScreen.matches && shopPanel.open) return;
  const controls = { Space: button, KeyA: attackButton, KeyQ: hookButton };
  if (controls[event.code]) {
    event.preventDefault();
    controls[event.code].click();
  }
});

renderStats();
renderCreep();
combatStatus.textContent = "Первый крип через 10 секунд. Каждый пятый — босс!";
setInterval(tick, 250);
