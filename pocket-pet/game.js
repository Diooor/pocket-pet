(function () {
  'use strict';

  var STORAGE_KEY = 'pocket-days-save-v1';
  var TIME_ZONE = 'Asia/Taipei';
  var actionBusy = false;
  var sleepTimer = null;
  var audioContext = null;
  var speechTimer = null;
  var hasSavedGame = false;

  var questDefs = [
    { id: 'feed', title: '準備兩次點心', goal: 2, reward: 25, icon: '<path d="M4 11h16c0 5-3 9-8 9s-8-4-8-9ZM7 4c2 1 2 3 0 4M12 3c2 1 2 3 0 5M17 4c2 1 2 3 0 4"/>' },
    { id: 'play', title: '一起玩耍兩次', goal: 2, reward: 30, icon: '<circle cx="12" cy="12" r="8"/><path d="M7 8c3 2 4 5 5 9M18 7c-4 2-6 5-7 10M5 14c5 0 8 2 11 5"/>' },
    { id: 'clean', title: '洗一次香香澡', goal: 1, reward: 20, icon: '<path d="M12 2c3 4 7 8 7 13a7 7 0 0 1-14 0c0-5 4-9 7-13Z"/><path d="M9 16c.7 1.3 1.7 2 3 2"/>' }
  ];

  var shopDefs = [
    { id: 'apple', name: '脆脆蘋果', description: '飽足 +16，清爽的日常點心。', cost: 12, visual: '●', className: 'item-apple', color: '#dc6259' },
    { id: 'fish', name: '海味小魚', description: '飽足 +22，還會變得更開心。', cost: 18, visual: '><>', className: 'item-fish', color: '#588da6' },
    { id: 'cookie', name: '星星餅乾', description: '飽足 +12、心情 +8。', cost: 24, visual: '✦', className: 'item-cookie', color: '#b67b29' },
    { id: 'soap', name: '雲朵香皂', description: '洗澡時需要，清潔 +24。', cost: 15, visual: '▰', className: 'item-soap', color: '#746aa2' },
    { id: 'ribbon', name: '莓果緞帶', description: '永久裝扮，讓項圈換上莓果色。', cost: 60, visual: '∞', className: 'item-ribbon', color: '#cb6385', permanent: true },
    { id: 'ball', name: '彈力小球', description: '永久玩具，玩耍效果提升。', cost: 80, visual: '◉', className: 'item-ball', color: '#4d8a70', permanent: true }
  ];

  var albumDefs = [
    { id: 'home', title: '初次相遇', note: '一起生活的第 1 天', condition: function () { return true; }, icon: '<path d="m4 11 8-7 8 7v9H4v-9Z"/><path d="M9 20v-6h6v6"/>' },
    { id: 'meal', title: '第一頓飯', note: '親手準備了點心', condition: function (s) { return s.totalActions.feed > 0; }, icon: '<path d="M4 11h16c0 5-3 9-8 9s-8-4-8-9ZM7 5c2 1 2 3 0 4M12 4c2 1 2 3 0 5M17 5c2 1 2 3 0 4"/>' },
    { id: 'bath', title: '香噴噴', note: '完成第一次洗澡', condition: function (s) { return s.totalActions.clean > 0; }, icon: '<path d="M12 2c3 4 7 8 7 13a7 7 0 0 1-14 0c0-5 4-9 7-13Z"/><path d="M9 16c1 2 2 3 4 3"/>' },
    { id: 'level3', title: '長大一點', note: '到達等級 3', condition: function (s) { return s.level >= 3; }, icon: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>' },
    { id: 'week', title: '一週紀念', note: '一起度過 7 天', condition: function (s) { return s.day >= 7 || s.streak >= 7; }, icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/>' },
    { id: 'caretaker', title: '最佳拍檔', note: '完成 20 次照顧', condition: function (s) { return totalCare(s) >= 20; }, icon: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/>' }
  ];

  function defaultState() {
    return {
      version: 1,
      petName: '小麻糬',
      petType: 'cat',
      createdAt: Date.now(),
      lastSeen: Date.now(),
      gameMinutes: 480,
      day: 1,
      level: 1,
      xp: 0,
      coins: 120,
      stats: { hunger: 78, happy: 82, energy: 70, clean: 86 },
      inventory: { apple: 2, fish: 2, cookie: 1, soap: 2, ribbon: 0, ball: 0 },
      totalActions: { feed: 0, play: 0, clean: 0, rest: 0, pet: 0 },
      quests: {
        date: taipeiDateKey(),
        progress: { feed: 0, play: 0, clean: 0 },
        claimed: { feed: false, play: false, clean: false }
      },
      streak: 1,
      lastCheckin: taipeiDateKey(),
      memory: '我們第一次在這個小房間相遇。',
      settings: { sound: true, reducedMotion: false },
      sleeping: false
    };
  }

  function mergeState(saved) {
    var base = defaultState();
    if (!saved || typeof saved !== 'object') return base;
    var result = Object.assign(base, saved);
    result.stats = Object.assign(base.stats, saved.stats || {});
    result.inventory = Object.assign(base.inventory, saved.inventory || {});
    result.totalActions = Object.assign(base.totalActions, saved.totalActions || {});
    result.settings = Object.assign(base.settings, saved.settings || {});
    result.quests = Object.assign(base.quests, saved.quests || {});
    result.quests.progress = Object.assign(base.quests.progress, (saved.quests && saved.quests.progress) || {});
    result.quests.claimed = Object.assign(base.quests.claimed, (saved.quests && saved.quests.claimed) || {});
    result.sleeping = false;
    return result;
  }

  function loadState() {
    var raw = localStorage.getItem(STORAGE_KEY);
    hasSavedGame = Boolean(raw);
    if (!raw) return defaultState();
    try {
      return mergeState(JSON.parse(raw));
    } catch (error) {
      console.warn('Save data could not be read.', error);
      return defaultState();
    }
  }

  var state = loadState();
  var lastTickAt = Date.now();

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function totalCare(s) {
    return s.totalActions.feed + s.totalActions.play + s.totalActions.clean + s.totalActions.rest;
  }

  function taipeiDateParts(date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date || new Date());
    var data = {};
    parts.forEach(function (part) { data[part.type] = part.value; });
    return data;
  }

  function taipeiDateKey(date) {
    var parts = taipeiDateParts(date);
    return parts.year + '-' + parts.month + '-' + parts.day;
  }

  function taipeiDateLabel(date) {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date || new Date());
  }

  function dayDifference(fromKey, toKey) {
    var from = Date.parse(fromKey + 'T00:00:00Z');
    var to = Date.parse(toKey + 'T00:00:00Z');
    if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
    return Math.round((to - from) / 86400000);
  }

  function saveState() {
    if (!hasSavedGame) return;
    state.lastSeen = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      hasSavedGame = true;
    } catch (error) {
      console.warn('Save data could not be written.', error);
    }
  }

  function processRealDay() {
    var today = taipeiDateKey();
    if (state.quests.date !== today) {
      state.quests = {
        date: today,
        progress: { feed: 0, play: 0, clean: 0 },
        claimed: { feed: false, play: false, clean: false }
      };
    }

    if (state.lastCheckin !== today) {
      var gap = dayDifference(state.lastCheckin, today);
      state.streak = gap === 1 ? Math.min(99, state.streak + 1) : 1;
      state.lastCheckin = today;
      var reward = Math.min(50, 15 + state.streak * 5);
      state.coins += reward;
      window.setTimeout(function () {
        toast('每日相伴', '連續 ' + state.streak + ' 天，獲得 ' + reward + ' 日和幣', 'H');
      }, 700);
    }
  }

  function applyOfflineProgress() {
    if (!hasSavedGame) return;
    var elapsed = Math.max(0, Date.now() - Number(state.lastSeen || Date.now()));
    var minutes = Math.min(4320, elapsed / 60000);
    if (minutes < 2) return;

    var hours = minutes / 60;
    state.stats.hunger = clamp(state.stats.hunger - hours * 2.8, 8, 100);
    state.stats.happy = clamp(state.stats.happy - hours * 1.25, 12, 100);
    state.stats.clean = clamp(state.stats.clean - hours * 1.1, 10, 100);
    state.stats.energy = clamp(state.stats.energy + hours * 3.5, 0, 100);

    var reward = Math.min(90, Math.floor(minutes / 12));
    if (minutes >= 15) {
      state.coins += reward;
      var hoursText = minutes >= 60 ? Math.floor(minutes / 60) + ' 小時' : Math.floor(minutes) + ' 分鐘';
      qs('#offlineText').textContent = '你離開了 ' + hoursText + '，' + state.petName + ' 在小屋裡乖乖休息。';
      qs('#offlineCoins').textContent = '+' + reward;
      openModal('offlineModal');
    }
  }

  function statLabel(value, kind) {
    var labels = {
      hunger: ['肚子餓', '有點餓', '剛剛好', '好滿足'],
      happy: ['想陪伴', '有點悶', '開心', '超開心'],
      energy: ['想睡了', '慢慢來', '精神', '活力滿滿'],
      clean: ['髒兮兮', '要整理', '乾淨', '亮晶晶']
    };
    var index = value < 25 ? 0 : value < 50 ? 1 : value < 80 ? 2 : 3;
    return labels[kind][index];
  }

  function xpGoal() {
    return 60 + (state.level - 1) * 30;
  }

  function growthStage() {
    if (state.level >= 8) return '成熟期';
    if (state.level >= 4) return '成長期';
    return '幼年期';
  }

  function moodMessage() {
    var stats = state.stats;
    var minimum = Math.min(stats.hunger, stats.happy, stats.energy, stats.clean);
    if (state.sleeping) return '噓，正在做一個甜甜的夢';
    if (minimum === stats.hunger && minimum < 35) return '肚子咕嚕咕嚕叫了';
    if (minimum === stats.energy && minimum < 35) return '眼皮開始變得重重的';
    if (minimum === stats.clean && minimum < 35) return '好像該洗個香香澡';
    if (minimum === stats.happy && minimum < 35) return '想要你多陪我一下';
    if (stats.happy > 88) return '和你在一起就是最開心的事';
    return '今天也想和你一起玩';
  }

  function setText(id, value) {
    var element = qs('#' + id);
    if (element) element.textContent = value;
  }

  function renderStats() {
    ['hunger', 'happy', 'energy', 'clean'].forEach(function (kind) {
      var rounded = Math.round(state.stats[kind]);
      setText(kind + 'Value', rounded);
      setText(kind + 'Label', statLabel(rounded, kind));
      qs('#' + kind + 'Bar').style.width = rounded + '%';
      qs('#' + kind + 'Value').closest('.stat-card').classList.toggle('critical', rounded < 25);
    });
  }

  function renderSummary() {
    setText('petNameTitle', state.petName);
    setText('petNameHint', state.petName);
    setText('levelValue', state.level);
    setText('growthBadge', growthStage());
    setText('xpValue', Math.floor(state.xp));
    setText('xpGoal', xpGoal());
    setText('moodText', moodMessage());
    setText('coinCount', state.coins);
    qs('#xpFill').style.width = clamp((state.xp / xpGoal()) * 100, 0, 100) + '%';
    qs('#petButton').setAttribute('aria-label', '摸摸' + state.petName);
  }

  function renderPet() {
    qsa('.pet').forEach(function (pet) {
      pet.classList.remove('active', 'low-mood', 'grown', 'adult', 'sleeping', 'ribbon');
    });
    var active = qs('#pet' + state.petType.charAt(0).toUpperCase() + state.petType.slice(1));
    if (!active) active = qs('#petCat');
    active.classList.add('active');
    active.classList.toggle('low-mood', state.stats.happy < 30 || state.stats.hunger < 25);
    active.classList.toggle('grown', state.level >= 4 && state.level < 8);
    active.classList.toggle('adult', state.level >= 8);
    active.classList.toggle('sleeping', state.sleeping);
    active.classList.toggle('ribbon', state.inventory.ribbon > 0);
    qs('#sleepOverlay').classList.toggle('active', state.sleeping);
    setText('restButtonLabel', state.sleeping ? '叫醒' : '睡覺');
    setText('restButtonHint', state.sleeping ? '正在補充活力' : '活力 +20');
    qsa('.action-button:not(.rest)').forEach(function (button) {
      button.disabled = state.sleeping;
    });
  }

  function renderTime() {
    var hour = Math.floor(state.gameMinutes / 60) % 24;
    var minute = Math.floor(state.gameMinutes % 60);
    setText('gameDay', '第 ' + state.day + ' 天');
    setText('gameTime', String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'));
    var room = qs('#room');
    room.classList.toggle('evening', hour >= 17 && hour < 20);
    room.classList.toggle('night', hour >= 20 || hour < 6);
  }

  function renderCheckin() {
    var row = qs('#checkinRow');
    var current = Math.min(7, Math.max(1, state.streak));
    var html = '';
    for (var index = 1; index <= 7; index += 1) {
      var status = index < current ? 'done' : index === current ? 'done today' : 'future';
      html += '<div class="checkin-day ' + status + '"><b>D' + index + '</b><span>' + (index <= current ? '✓' : (10 + index * 5)) + '</span></div>';
    }
    row.innerHTML = html;
    setText('streakText', '連續 ' + state.streak + ' 天');
  }

  function renderQuests() {
    var list = qs('#questList');
    var completedCount = 0;
    var ready = false;
    list.innerHTML = questDefs.map(function (quest) {
      var progress = Math.min(quest.goal, state.quests.progress[quest.id] || 0);
      var complete = progress >= quest.goal;
      var claimed = Boolean(state.quests.claimed[quest.id]);
      if (complete) completedCount += 1;
      if (complete && !claimed) ready = true;
      var buttonLabel = claimed ? '已領取' : complete ? '+' + quest.reward : '+' + quest.reward;
      var buttonClass = complete && !claimed ? 'reward-button ready' : 'reward-button';
      return '<div class="quest-item ' + (complete ? 'completed' : '') + '">' +
        '<span class="quest-icon"><svg viewBox="0 0 24 24">' + quest.icon + '</svg></span>' +
        '<div class="quest-copy"><b>' + quest.title + '</b><div class="quest-progress"><span><i style="width:' + (progress / quest.goal * 100) + '%"></i></span><small>' + progress + '/' + quest.goal + '</small></div></div>' +
        '<button class="' + buttonClass + '" type="button" data-claim="' + quest.id + '" ' + (!complete || claimed ? 'disabled' : '') + '>' + buttonLabel + '</button>' +
        '</div>';
    }).join('');
    setText('questCount', completedCount + ' / ' + questDefs.length);
    qs('#taskDot').classList.toggle('visible', ready);
    qs('#mobileTaskDot').classList.toggle('visible', ready);
  }

  function renderInventory() {
    var ids = ['apple', 'fish', 'cookie', 'soap'];
    var names = { apple: '蘋果', fish: '小魚', cookie: '餅乾', soap: '香皂' };
    qs('#inventoryList').innerHTML = ids.map(function (id) {
      return '<span class="inventory-item">' + names[id] + '<b>×' + state.inventory[id] + '</b></span>';
    }).join('');
  }

  function renderShop() {
    renderInventory();
    qs('#shopList').innerHTML = shopDefs.map(function (item) {
      var owned = item.permanent && state.inventory[item.id] > 0;
      var disabled = state.coins < item.cost || owned;
      return '<article class="shop-item ' + item.className + '">' +
        '<div class="item-visual"><span class="food-shape" style="color:' + item.color + '">' + item.visual + '</span></div>' +
        '<h3>' + item.name + '</h3><p>' + item.description + '</p>' +
        '<button class="buy-button" type="button" data-buy="' + item.id + '" ' + (disabled ? 'disabled' : '') + '>' +
        (owned ? '已擁有' : '<span class="coin-icon">H</span><span>' + item.cost + '</span>') +
        '</button></article>';
    }).join('');
  }

  function renderAlbum() {
    var unlocked = 0;
    var firstLocked = null;
    qs('#albumGrid').innerHTML = albumDefs.map(function (item) {
      var isUnlocked = item.condition(state);
      if (isUnlocked) unlocked += 1;
      else if (!firstLocked) firstLocked = item;
      return '<article class="album-card ' + (isUnlocked ? 'unlocked' : 'locked') + '">' +
        '<div class="album-art"><svg viewBox="0 0 24 24">' + item.icon + '</svg></div>' +
        '<b>' + item.title + '</b><small>' + (isUnlocked ? item.note : '尚未解鎖') + '</small></article>';
    }).join('');
    setText('albumProgress', unlocked + ' / ' + albumDefs.length);
    qs('#nextMilestone').innerHTML = firstLocked ?
      '<b>下一段回憶：' + firstLocked.title + '</b>' + firstLocked.note :
      '<b>回憶冊已經集滿</b>你們還會繼續寫下新的日子。';
  }

  function renderMemory() {
    setText('memoryText', state.memory);
    setText('memoryDate', taipeiDateLabel());
  }

  function renderSettings() {
    qs('#soundToggle').checked = state.settings.sound;
    qs('#motionToggle').checked = state.settings.reducedMotion;
    qs('#renameInput').value = state.petName;
    qs('#soundButton').classList.toggle('sound-muted', !state.settings.sound);
    qs('#soundButton').setAttribute('aria-label', state.settings.sound ? '關閉音效' : '開啟音效');
    document.body.classList.toggle('reduced-motion', state.settings.reducedMotion);
  }

  function renderAll() {
    renderStats();
    renderSummary();
    renderPet();
    renderTime();
    renderCheckin();
    renderQuests();
    renderShop();
    renderAlbum();
    renderMemory();
    renderSettings();
  }

  function say(message, duration) {
    var bubble = qs('#speechBubble');
    window.clearTimeout(speechTimer);
    bubble.textContent = message;
    bubble.classList.remove('hidden');
    speechTimer = window.setTimeout(function () {
      bubble.classList.add('hidden');
    }, duration || 3300);
  }

  function toast(title, detail, icon) {
    var stack = qs('#toastStack');
    var node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = '<span class="toast-icon">' + (icon || '✓') + '</span><span><b>' + title + '</b><small>' + detail + '</small></span>';
    stack.appendChild(node);
    window.setTimeout(function () { node.remove(); }, 3200);
  }

  function playTone(kind) {
    if (!state.settings.sound) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      var frequencies = { tap: 430, happy: 610, coin: 760, level: 520, clean: 560, rest: 330 };
      oscillator.type = kind === 'level' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequencies[kind] || 460, audioContext.currentTime);
      if (kind === 'level') oscillator.frequency.exponentialRampToValueAtTime(920, audioContext.currentTime + .22);
      gain.gain.setValueAtTime(.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.11, audioContext.currentTime + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .25);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + .27);
    } catch (error) {
      state.settings.sound = false;
      renderSettings();
    }
  }

  function createEffects(symbol, count, bubble) {
    var layer = qs('#effectLayer');
    for (var index = 0; index < count; index += 1) {
      (function (order) {
        window.setTimeout(function () {
          var node = document.createElement('span');
          node.className = 'effect' + (bubble ? ' bubble' : '');
          node.textContent = bubble ? '' : symbol;
          node.style.setProperty('--drift', ((order - (count - 1) / 2) * 29) + 'px');
          node.style.left = (48 + (order % 2) * 5) + '%';
          node.style.top = (55 - order * 2) + '%';
          layer.appendChild(node);
          window.setTimeout(function () { node.remove(); }, 1250);
        }, order * 90);
      }(index));
    }
  }

  function animatePet(className, duration) {
    var pet = qs('.pet.active');
    if (!pet) return;
    ['petting', 'eating', 'playing', 'cleaning'].forEach(function (name) { pet.classList.remove(name); });
    void pet.offsetWidth;
    pet.classList.add(className);
    window.setTimeout(function () { pet.classList.remove(className); }, duration || 1200);
  }

  function addXp(amount) {
    state.xp += amount;
    var didLevel = false;
    while (state.xp >= xpGoal()) {
      state.xp -= xpGoal();
      state.level += 1;
      state.coins += 45;
      didLevel = true;
    }
    if (didLevel) {
      playTone('level');
      createEffects('✦', 7);
      toast('升級了', state.petName + ' 到達等級 ' + state.level + '，獲得 45 日和幣', '↑');
      say('我好像又長大一點了！');
    }
  }

  function bumpQuest(id) {
    if (state.quests.progress[id] === undefined) return;
    var definition = questDefs.find(function (quest) { return quest.id === id; });
    state.quests.progress[id] = Math.min(definition.goal, state.quests.progress[id] + 1);
  }

  function setMemory(text) {
    state.memory = text;
  }

  function actionCooldown(button) {
    if (!button) return;
    button.classList.add('cooldown');
    window.setTimeout(function () { button.classList.remove('cooldown'); }, 1250);
  }

  function chooseFood() {
    var order = ['apple', 'fish', 'cookie'];
    return order.find(function (id) { return state.inventory[id] > 0; });
  }

  function performFeed(button) {
    var foodId = chooseFood();
    if (!foodId) {
      say('點心吃完了，要去小舖看看嗎？');
      toast('背包空了', '到日和小舖補充點心', '!');
      openTab('shop');
      return false;
    }
    var effects = {
      apple: { hunger: 16, happy: 2, name: '蘋果' },
      fish: { hunger: 22, happy: 4, name: '小魚' },
      cookie: { hunger: 12, happy: 8, name: '餅乾' }
    };
    var effect = effects[foodId];
    state.inventory[foodId] -= 1;
    state.stats.hunger = clamp(state.stats.hunger + effect.hunger, 0, 100);
    state.stats.happy = clamp(state.stats.happy + effect.happy, 0, 100);
    state.totalActions.feed += 1;
    bumpQuest('feed');
    addXp(8);
    setMemory('今天替' + state.petName + '準備了好吃的' + effect.name + '。');
    animatePet('eating', 1500);
    createEffects('+', 4);
    say('好好吃，謝謝你！');
    playTone('happy');
    actionCooldown(button);
    return true;
  }

  function performPlay(button) {
    if (state.stats.energy < 10) {
      say('今天有一點累，先休息一下好嗎？');
      toast('活力不足', '睡一覺再來玩', 'Z');
      return false;
    }
    var bonus = state.inventory.ball > 0 ? 5 : 0;
    state.stats.happy = clamp(state.stats.happy + 16 + bonus, 0, 100);
    state.stats.energy = clamp(state.stats.energy - 7, 0, 100);
    state.stats.hunger = clamp(state.stats.hunger - 3, 0, 100);
    state.stats.clean = clamp(state.stats.clean - 2, 0, 100);
    state.totalActions.play += 1;
    bumpQuest('play');
    addXp(10 + (bonus ? 2 : 0));
    setMemory('在房間裡追著小球跑，笑聲停不下來。');
    animatePet('playing', 1500);
    createEffects('♡', 6);
    say(bonus ? '這顆小球太好玩了！' : '再玩一次、再玩一次！');
    playTone('happy');
    actionCooldown(button);
    return true;
  }

  function performClean(button) {
    if (state.inventory.soap <= 0) {
      say('香皂用完了，要去小舖補充喔。');
      toast('缺少香皂', '到日和小舖補充用品', '!');
      openTab('shop');
      return false;
    }
    state.inventory.soap -= 1;
    state.stats.clean = clamp(state.stats.clean + 24, 0, 100);
    state.stats.happy = clamp(state.stats.happy + 3, 0, 100);
    state.totalActions.clean += 1;
    bumpQuest('clean');
    addXp(8);
    setMemory('洗完澡蓬蓬鬆鬆，聞起來像一朵雲。');
    animatePet('cleaning', 1400);
    createEffects('', 8, true);
    say('香香的，耳朵後面也洗乾淨了！');
    playTone('clean');
    actionCooldown(button);
    return true;
  }

  function endSleep(auto) {
    if (!state.sleeping) return;
    window.clearTimeout(sleepTimer);
    sleepTimer = null;
    state.sleeping = false;
    state.stats.energy = clamp(state.stats.energy + (auto ? 20 : 10), 0, 100);
    state.stats.hunger = clamp(state.stats.hunger - 2, 0, 100);
    state.totalActions.rest += 1;
    addXp(auto ? 7 : 4);
    setMemory(state.petName + '做了一場甜甜的夢，醒來精神好多了。');
    say(auto ? '睡飽了！今天也有好多精神。' : '我醒來了，你還在這裡。');
    playTone('rest');
    renderAll();
    saveState();
  }

  function performRest(button) {
    if (state.sleeping) {
      endSleep(false);
      return true;
    }
    state.sleeping = true;
    say('晚安，醒來再一起玩。');
    playTone('rest');
    renderPet();
    renderSummary();
    actionCooldown(button);
    sleepTimer = window.setTimeout(function () { endSleep(true); }, 8000);
    return true;
  }

  function performAction(type, button) {
    if (actionBusy && type !== 'rest') return;
    if (state.sleeping && type !== 'rest') return;
    actionBusy = true;
    var changed = false;
    if (type === 'feed') changed = performFeed(button);
    if (type === 'play') changed = performPlay(button);
    if (type === 'clean') changed = performClean(button);
    if (type === 'rest') changed = performRest(button);
    if (changed) {
      renderAll();
      saveState();
    }
    window.setTimeout(function () { actionBusy = false; }, 550);
  }

  function petPet() {
    if (state.sleeping) {
      say('呼……呼……');
      return;
    }
    if (actionBusy) return;
    actionBusy = true;
    state.stats.happy = clamp(state.stats.happy + 2.5, 0, 100);
    state.totalActions.pet += 1;
    if (state.totalActions.pet % 5 === 0) addXp(2);
    animatePet('petting', 700);
    createEffects('♡', 4);
    say(['嘿嘿，好癢！', '再摸一下也可以。', '最喜歡你了。'][state.totalActions.pet % 3]);
    playTone('tap');
    renderAll();
    saveState();
    window.setTimeout(function () { actionBusy = false; }, 650);
  }

  function claimQuest(id) {
    var definition = questDefs.find(function (quest) { return quest.id === id; });
    if (!definition) return;
    if (state.quests.claimed[id] || state.quests.progress[id] < definition.goal) return;
    state.quests.claimed[id] = true;
    state.coins += definition.reward;
    playTone('coin');
    toast('任務完成', '獲得 ' + definition.reward + ' 日和幣', 'H');
    renderAll();
    saveState();
  }

  function buyItem(id) {
    var item = shopDefs.find(function (entry) { return entry.id === id; });
    if (!item || state.coins < item.cost) return;
    if (item.permanent && state.inventory[id] > 0) return;
    state.coins -= item.cost;
    state.inventory[id] += 1;
    playTone('coin');
    toast('購買完成', item.name + ' 已放進背包', 'H');
    if (id === 'ribbon') say('新緞帶好看嗎？');
    if (id === 'ball') say('有了小球，可以玩得更開心了！');
    renderAll();
    saveState();
  }

  function openTab(name) {
    qsa('.side-tab').forEach(function (tab) { tab.classList.toggle('active', tab.dataset.tab === name); });
    qsa('.tab-page').forEach(function (page) { page.classList.toggle('active', page.dataset.page === name); });
    if (window.matchMedia('(max-width: 850px)').matches) {
      qs('#sidePanel').classList.add('mobile-open');
      qsa('.mobile-nav button').forEach(function (button) {
        button.classList.toggle('active', button.dataset.mobile === name);
      });
    }
  }

  function goHome() {
    qs('#sidePanel').classList.remove('mobile-open');
    qsa('.mobile-nav button').forEach(function (button) {
      button.classList.toggle('active', button.dataset.mobile === 'home');
    });
  }

  function openModal(id) {
    qs('#' + id).classList.add('active');
  }

  function closeModal(id) {
    qs('#' + id).classList.remove('active');
  }

  function tick() {
    var now = Date.now();
    var realSeconds = Math.min(4, (now - lastTickAt) / 1000);
    lastTickAt = now;
    if (!hasSavedGame) return;

    var previousDay = state.day;
    state.gameMinutes += realSeconds * 2;
    if (state.gameMinutes >= 1440) {
      state.gameMinutes -= 1440;
      state.day += 1;
    }

    if (state.sleeping) {
      state.stats.energy = clamp(state.stats.energy + realSeconds * .42, 0, 100);
    } else {
      state.stats.energy = clamp(state.stats.energy - realSeconds * .009, 0, 100);
    }
    state.stats.hunger = clamp(state.stats.hunger - realSeconds * .025, 0, 100);
    state.stats.happy = clamp(state.stats.happy - realSeconds * .011, 0, 100);
    state.stats.clean = clamp(state.stats.clean - realSeconds * .013, 0, 100);

    if (state.day > previousDay) {
      state.coins += 12;
      toast('新的一天', '小屋收到 12 日和幣', 'H');
      setMemory('新的一天開始了，窗外的陽光照進小屋。');
      saveState();
    }
    renderStats();
    renderSummary();
    renderPet();
    renderTime();
  }

  function startGame() {
    var input = qs('#petNameInput');
    var name = input.value.trim() || '小麻糬';
    state = defaultState();
    state.petName = name.slice(0, 8);
    state.petType = qs('input[name="petType"]:checked').value;
    state.createdAt = Date.now();
    state.lastSeen = Date.now();
    state.memory = '今天和' + state.petName + '在小房間裡第一次相遇。';
    hasSavedGame = true;
    closeModal('welcomeModal');
    processRealDay();
    renderAll();
    saveState();
    say('你好！以後請多多照顧。', 5000);
    playTone('happy');
    toast('歡迎回家', state.petName + '正在等你', '♡');
  }

  function bindEvents() {
    qsa('.pet-choice').forEach(function (choice) {
      choice.addEventListener('click', function () {
        qsa('.pet-choice').forEach(function (node) { node.classList.remove('active'); });
        choice.classList.add('active');
      });
    });

    qs('#petNameInput').addEventListener('input', function (event) {
      setText('nameCount', Array.from(event.target.value).length);
    });
    qs('#petNameInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') startGame();
    });
    qs('#startButton').addEventListener('click', startGame);
    qs('#petButton').addEventListener('click', petPet);

    qsa('.action-button').forEach(function (button) {
      button.addEventListener('click', function () { performAction(button.dataset.action, button); });
    });

    qs('#questList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-claim]');
      if (button) claimQuest(button.dataset.claim);
    });
    qs('#shopList').addEventListener('click', function (event) {
      var button = event.target.closest('[data-buy]');
      if (button) buyItem(button.dataset.buy);
    });

    qsa('.side-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { openTab(tab.dataset.tab); });
    });
    qsa('.mobile-nav button').forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.dataset.mobile === 'home') goHome();
        else openTab(button.dataset.mobile);
      });
    });

    qs('#settingsButton').addEventListener('click', function () { openModal('settingsModal'); });
    qs('.close-modal').addEventListener('click', function () { closeModal('settingsModal'); });
    qs('#settingsModal').addEventListener('click', function (event) {
      if (event.target.id === 'settingsModal') closeModal('settingsModal');
    });
    qs('#offlineButton').addEventListener('click', function () {
      closeModal('offlineModal');
      say('你回來了！');
      saveState();
    });

    qs('#soundButton').addEventListener('click', function () {
      state.settings.sound = !state.settings.sound;
      renderSettings();
      if (state.settings.sound) playTone('tap');
      saveState();
    });
    qs('#soundToggle').addEventListener('change', function (event) {
      state.settings.sound = event.target.checked;
      renderSettings();
      if (state.settings.sound) playTone('tap');
      saveState();
    });
    qs('#motionToggle').addEventListener('change', function (event) {
      state.settings.reducedMotion = event.target.checked;
      renderSettings();
      saveState();
    });
    qs('#renameButton').addEventListener('click', function () {
      var name = qs('#renameInput').value.trim();
      if (!name) return;
      state.petName = name.slice(0, 8);
      state.memory = '今天換上了新名字：' + state.petName + '。';
      renderAll();
      saveState();
      toast('名字更新了', '以後就叫我 ' + state.petName, '✓');
    });
    qs('#resetButton').addEventListener('click', function () {
      if (window.confirm('確定要清除所有進度，重新開始嗎？')) {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.target.matches('input, textarea')) return;
      if (qsa('.modal-backdrop.active').length) {
        if (event.key === 'Escape' && qs('#settingsModal').classList.contains('active')) closeModal('settingsModal');
        return;
      }
      var actions = { '1': 'feed', '2': 'play', '3': 'clean', '4': 'rest' };
      if (actions[event.key]) {
        var button = qs('[data-action="' + actions[event.key] + '"]');
        performAction(actions[event.key], button);
      }
    });

    window.addEventListener('beforeunload', saveState);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) saveState();
      else lastTickAt = Date.now();
    });
  }

  function init() {
    bindEvents();
    processRealDay();
    if (hasSavedGame) {
      closeModal('welcomeModal');
      applyOfflineProgress();
    } else {
      openModal('welcomeModal');
    }
    renderAll();
    window.setInterval(tick, 1000);
    window.setInterval(saveState, 15000);
  }

  init();
}());
