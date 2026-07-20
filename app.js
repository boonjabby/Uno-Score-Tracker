const $ = (id) => document.getElementById(id);

const gameType = $('gameType');
const participantCount = $('participantCount');
const participantLabel = $('participantLabel');
const targetScore = $('targetScore');
const gameNote = $('gameNote');
const directionSymbol = $('directionSymbol');
const directionLabel = $('directionLabel');
const scoreboard = $('scoreboard');
const roundWinner = $('roundWinner');
const cardButtons = $('cardButtons');
const calculatorTotal = $('calculatorTotal');
const roundSummary = $('roundSummary');
const valueEditor = $('valueEditor');
const leaderText = $('leaderText');
const winnerCallout = $('winnerCallout');
const announcement = $('announcement');
const installButton = $('installButton');
const themeButton = $('themeButton');
const historyList = $('historyList');
const clearHistoryButton = $('clearHistory');
const updateBanner = $('updateBanner');
const reloadAppButton = $('reloadApp');
const undoActionButton = $('undoAction');
const randomStarterButton = $('randomStarter');
const shareGameButton = $('shareGame');
const soundButton = $('soundButton');
const soundIcon = $('soundIcon');
const starterCallout = $('starterCallout');
const profileName = $('profileName');
const profileAvatar = $('profileAvatar');
const profileColour = $('profileColour');
const addProfileButton = $('addProfile');
const profileList = $('profileList');
const statsGrid = $('statsGrid');
const playerStats = $('playerStats');
const resetStatsButton = $('resetStats');
const confettiLayer = $('confettiLayer');
const toast = $('toast');
const gameClockDisplay = $('gameClockDisplay');
const gameClockStatus = $('gameClockStatus');
const toggleGameClockButton = $('toggleGameClock');
const resetGameClockButton = $('resetGameClock');
const keepAwakeButton = $('keepAwakeButton');

const STORAGE_KEY = 'uno-score-tracker-v5-current';
const SECTION_STATE_KEY = 'uno-section-state-v1';
const LEGACY_STORAGE_KEYS = ['uno-score-tracker-v4', 'uno-score-tracker-v3', 'uno-score-tracker-v2', 'uno-score-tracker-v1'];
let deferredPrompt = null;

const colours = ['#d71920', '#177bd1', '#2ca24c', '#f2b900'];
const numberCards = Array.from({ length: 10 }, (_, value) => ({
  id: `number${value}`,
  label: String(value),
  value,
  sprite: String(value),
  color: colours[value % colours.length]
}));

const presets = {
  classic: {
    target: 500, teams: false,
    note: 'Classic scoring: number cards use face value, action cards 20, and Wild cards 50.',
    cards: [...numberCards,
      { id: 'skip', label: 'Skip', value: 20, sprite: '⊘', color: '#d71920' },
      { id: 'reverse', label: 'Reverse', value: 20, sprite: '↻', color: '#177bd1' },
      { id: 'draw2', label: 'Draw 2', value: 20, sprite: '+2', color: '#2ca24c' },
      { id: 'wild', label: 'Wild', value: 50, sprite: 'wild', color: '#161616' },
      { id: 'wild4', label: 'Wild +4', value: 50, sprite: '+4', color: '#161616' }
    ]
  },
  teams: {
    target: 500, teams: true,
    note: 'Add all cards remaining in the opposing team’s hands to the winning team.',
    cards: [...numberCards,
      { id: 'skip', label: 'Skip', value: 20, sprite: '⊘', color: '#d71920' },
      { id: 'reverse', label: 'Reverse', value: 20, sprite: '↻', color: '#177bd1' },
      { id: 'draw2', label: 'Draw 2', value: 20, sprite: '+2', color: '#2ca24c' },
      { id: 'wild', label: 'Wild', value: 50, sprite: 'wild', color: '#161616' },
      { id: 'wild4', label: 'Wild +4', value: 50, sprite: '+4', color: '#161616' }
    ]
  },
  flipLight: {
    target: 500, teams: false,
    note: 'UNO Flip light-side scoring. Adjust values below to match your deck’s rule sheet.',
    cards: [...numberCards.slice(1),
      { id: 'draw1', label: 'Draw 1', value: 10, sprite: '+1', color: '#d71920' },
      { id: 'skip', label: 'Skip', value: 20, sprite: '⊘', color: '#177bd1' },
      { id: 'reverse', label: 'Reverse', value: 20, sprite: '↻', color: '#2ca24c' },
      { id: 'flip', label: 'Flip', value: 20, sprite: '⇄', color: '#f2b900' },
      { id: 'wild', label: 'Wild', value: 40, sprite: 'wild', color: '#161616' },
      { id: 'wild2', label: 'Wild +2', value: 50, sprite: '+2', color: '#161616' }
    ]
  },
  flipDark: {
    target: 500, teams: false,
    note: 'UNO Flip dark-side scoring. Use this when the dark side is active at round end.',
    cards: [...numberCards.slice(1),
      { id: 'draw5', label: 'Draw 5', value: 20, sprite: '+5', color: '#7a2b91' },
      { id: 'skipAll', label: 'Skip All', value: 30, sprite: '⊘⊘', color: '#e07b24' },
      { id: 'reverse', label: 'Reverse', value: 20, sprite: '↻', color: '#267a68' },
      { id: 'flip', label: 'Flip', value: 20, sprite: '⇄', color: '#b33b57' },
      { id: 'wild', label: 'Wild', value: 40, sprite: 'wild', color: '#161616' },
      { id: 'wildColour', label: 'Wild Draw Colour', value: 60, sprite: '◉', color: '#161616' }
    ]
  },
  allWild: {
    target: 500, teams: false,
    note: 'UNO All Wild values are editable below for different editions.',
    cards: [
      { id: 'wild', label: 'Wild', value: 20, sprite: 'wild', color: '#161616' },
      { id: 'wild2', label: 'Wild +2', value: 20, sprite: '+2', color: '#161616' },
      { id: 'wild4', label: 'Wild +4', value: 20, sprite: '+4', color: '#161616' },
      { id: 'target2', label: 'Targeted +2', value: 20, sprite: '◎+2', color: '#161616' },
      { id: 'forcedSwap', label: 'Forced Swap', value: 20, sprite: '⇄', color: '#161616' },
      { id: 'skip2', label: 'Double Skip', value: 20, sprite: '⊘⊘', color: '#161616' },
      { id: 'reverse', label: 'Reverse', value: 20, sprite: '↻', color: '#161616' }
    ]
  },
  flex: {
    target: 500, teams: false,
    note: 'UNO Flex includes normal and Flex action cards. Adjust values for your edition.',
    cards: [...numberCards,
      { id: 'skip', label: 'Skip', value: 20, sprite: '⊘', color: '#d71920' },
      { id: 'reverse', label: 'Reverse', value: 20, sprite: '↻', color: '#177bd1' },
      { id: 'draw2', label: 'Draw 2', value: 20, sprite: '+2', color: '#2ca24c' },
      { id: 'flexAction', label: 'Flex Action', value: 20, sprite: 'F', color: '#f2b900' },
      { id: 'wild', label: 'Wild', value: 50, sprite: 'wild', color: '#161616' },
      { id: 'flexWild', label: 'Flex Wild', value: 50, sprite: 'F★', color: '#161616' },
      { id: 'power', label: 'Power Card', value: 50, sprite: '⚡', color: '#161616' }
    ]
  },
  noMercy: {
    target: 1000, teams: false,
    note: 'No Mercy often uses elimination, but this calculator also supports point-based house rules.',
    cards: [...numberCards,
      { id: 'skip', label: 'Skip', value: 20, sprite: '⊘', color: '#d71920' },
      { id: 'reverse', label: 'Reverse', value: 20, sprite: '↻', color: '#177bd1' },
      { id: 'draw2', label: 'Draw 2', value: 20, sprite: '+2', color: '#2ca24c' },
      { id: 'draw4', label: 'Draw 4', value: 40, sprite: '+4', color: '#161616' },
      { id: 'draw6', label: 'Draw 6', value: 60, sprite: '+6', color: '#161616' },
      { id: 'draw10', label: 'Draw 10', value: 100, sprite: '+10', color: '#161616' },
      { id: 'wild', label: 'Wild', value: 50, sprite: 'wild', color: '#161616' },
      { id: 'discardAll', label: 'Discard All', value: 50, sprite: '⇊', color: '#d71920' },
      { id: 'skipAll', label: 'Skip Everyone', value: 50, sprite: '⊘⊘', color: '#177bd1' },
      { id: 'roulette', label: 'Colour Roulette', value: 50, sprite: '◉', color: '#161616' }
    ]
  },
  custom: {
    target: 500, teams: false,
    note: 'Custom mode starts with Classic cards. Edit any value below.',
    cards: [...numberCards,
      { id: 'skip', label: 'Skip', value: 20, sprite: '⊘', color: '#d71920' },
      { id: 'reverse', label: 'Reverse', value: 20, sprite: '↻', color: '#177bd1' },
      { id: 'draw2', label: 'Draw 2', value: 20, sprite: '+2', color: '#2ca24c' },
      { id: 'wild', label: 'Wild', value: 50, sprite: 'wild', color: '#161616' },
      { id: 'wild4', label: 'Wild +4', value: 50, sprite: '+4', color: '#161616' },
      { id: 'customAction', label: 'Custom Action', value: 20, sprite: '?', color: '#7a2b91' }
    ]
  }
};

let state = {
  schemaVersion: 5,
  id: '',
  title: 'UNO Game',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  completedAt: null,
  clockwise: true,
  names: [],
  scores: [],
  activeCards: [],
  selected: {},
  cardHistory: [],
  history: [],
  theme: 'system',
  sound: true,
  profiles: [],
  starterIndex: null,
  scoreBaseline: [],
  settings: { highContrast: false, reducedMotion: false, confetti: true, vibration: true, scoreboardQr: false, roundDuration: true },
  stats: { gamesPlayed: 0, roundsPlayed: 0, totalPoints: 0, highestRound: 0, players: {} },
  undoStack: [],
  winnerRecorded: false,
  gameClock: { elapsedMs: 0, running: false, startedAt: null }
};

function isTeamsMode() { return gameType.value === 'teams'; }
function defaultName(index) { return `${isTeamsMode() ? 'Team' : 'Player'} ${index + 1}`; }

function saveState() {
  state.updatedAt = Date.now();
  const data = {
    schemaVersion: 5,
    id: state.id,
    title: state.title,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    completedAt: state.completedAt,
    gameType: gameType.value,
    participantCount: participantCount.value,
    targetScore: targetScore.value,
    clockwise: state.clockwise,
    names: state.names,
    scores: state.scores,
    cardValues: Object.fromEntries(state.activeCards.map(card => [card.id, card.value])),
    history: state.history,
    theme: state.theme,
    sound: state.sound,
    profiles: state.profiles,
    starterIndex: state.starterIndex,
    scoreBaseline: state.scoreBaseline,
    settings: state.settings,
    stats: state.stats,
    winnerRecorded: state.winnerRecorded,
    gameClock: state.gameClock
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.v5Features?.captureCurrentGame?.();
  window.liveSync?.hostStateChanged?.();
}

function loadState() {
  try {
    let saved = null;
    for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try { const candidate = JSON.parse(raw); if (candidate && typeof candidate === 'object') { saved = candidate; break; } }
      catch { try { localStorage.setItem(`uno-corrupt-backup-${Date.now()}`, raw); } catch {} }
    }
    if (!saved) return false;
    gameType.value = saved.gameType || 'classic';
    participantCount.value = saved.participantCount || '4';
    targetScore.value = Math.min(100000, Math.max(1, Number(saved.targetScore) || presets[gameType.value].target));
    state._legacyMigration = Number(saved.schemaVersion) !== 5;
    state.schemaVersion = 5;
    state.id = String(saved.id || '');
    state.title = String(saved.title || 'UNO Game').slice(0, 60);
    state.createdAt = Number(saved.createdAt) || Date.now();
    state.updatedAt = Number(saved.updatedAt) || Date.now();
    state.completedAt = Number(saved.completedAt) || null;
    state.clockwise = saved.clockwise !== false;
    state.history = Array.isArray(saved.history) ? saved.history : [];
    state.theme = saved.theme || 'system';
    state.sound = saved.sound !== false;
    state.profiles = Array.isArray(saved.profiles) ? saved.profiles : [];
    state.starterIndex = Number.isInteger(saved.starterIndex) ? saved.starterIndex : null;
    state.scoreBaseline = Array.isArray(saved.scoreBaseline) ? saved.scoreBaseline.map(v => Math.max(0, Number(v) || 0)) : [];
    state.settings = { ...state.settings, ...(saved.settings && typeof saved.settings === 'object' ? saved.settings : {}) };
    state.stats = saved.stats && typeof saved.stats === 'object' ? saved.stats : state.stats;
    state.stats.players ||= {};
    state.winnerRecorded = saved.winnerRecorded === true;
    state.gameClock = saved.gameClock && typeof saved.gameClock === 'object' ? saved.gameClock : { elapsedMs: 0, running: false, startedAt: null };
    if (state.gameClock.running && !Number.isFinite(state.gameClock.startedAt)) state.gameClock.running = false;
    applyTheme();
    applyPreset(false);
    state.names = Array.isArray(saved.names) ? saved.names.slice(0, Number(participantCount.value)) : state.names;
    state.scores = Array.isArray(saved.scores) ? saved.scores.slice(0, Number(participantCount.value)) : state.scores;
    while (state.names.length < Number(participantCount.value)) state.names.push(defaultName(state.names.length));
    while (state.scores.length < Number(participantCount.value)) state.scores.push(0);
    if (saved.cardValues) {
      state.activeCards.forEach(card => {
        if (Number.isFinite(saved.cardValues[card.id])) card.value = saved.cardValues[card.id];
      });
    }
    renderAll();
    return true;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
}


function cloneSnapshot(label) {
  return {
    label,
    clockwise: state.clockwise,
    names: [...state.names],
    scores: [...state.scores],
    selected: { ...state.selected },
    cardHistory: [...state.cardHistory],
    history: JSON.parse(JSON.stringify(state.history)),
    scoreBaseline: [...state.scoreBaseline],
    starterIndex: state.starterIndex,
    completedAt: state.completedAt,
    stats: JSON.parse(JSON.stringify(state.stats)),
    winnerRecorded: state.winnerRecorded,
    gameClock: { ...state.gameClock }
  };
}

function pushUndo(label) {
  state.undoStack.push(cloneSnapshot(label));
  state.undoStack = state.undoStack.slice(-30);
  undoActionButton.disabled = false;
}

function undoLastAction() {
  const snap = state.undoStack.pop();
  if (!snap) return showToast('Nothing to undo.');
  Object.assign(state, snap);
  renderAll();
  saveState();
  undoActionButton.disabled = state.undoStack.length === 0;
  showToast(`Undid: ${snap.label}`);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2400);
}

function playTone(frequency = 440, duration = 0.08) {
  if (!state.sound) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  } catch {}
}

function updateSoundButton() {
  soundIcon.textContent = state.sound ? '🔊' : '🔇';
  soundButton.setAttribute('aria-pressed', String(state.sound));
}

function launchConfetti() {
  if (state.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  confettiLayer.innerHTML = '';
  const symbols = ['◆','●','▲','■','★'];
  for (let i = 0; i < 70; i += 1) {
    const piece = document.createElement('span');
    piece.textContent = symbols[i % symbols.length];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    piece.style.setProperty('--drift', `${-90 + Math.random() * 180}px`);
    confettiLayer.appendChild(piece);
  }
  setTimeout(() => { confettiLayer.innerHTML = ''; }, 3400);
}

function chooseRandomStarter() {
  if (!state.names.length) return;
  const index = Math.floor(Math.random() * state.names.length);
  state.starterIndex = index;
  const name = state.names[index];
  starterCallout.textContent = `🎲 ${name} starts this round!`;
  starterCallout.classList.remove('hidden');
  if (!state.settings.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches) starterCallout.animate([{ transform: 'scale(.92)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: 'ease-out' });
  if (state.settings.vibration && navigator.vibrate) navigator.vibrate([45, 35, 45]);
  playTone(620, 0.12);
  saveState();
}

async function shareSnapshot() {
  const snapshot = { gameType: gameType.value, names: state.names, scores: state.scores, clockwise: state.clockwise };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(snapshot))));
  const url = `${location.origin}${location.pathname}#game=${encoded}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Card Game Score Tracker', text: 'Current game snapshot', url });
    else { await navigator.clipboard.writeText(url); showToast('Snapshot link copied.'); }
  } catch (error) {
    if (error?.name !== 'AbortError') showToast('Could not share the snapshot.');
  }
}

function importSnapshotFromHash() {
  const match = location.hash.match(/^#game=(.+)$/);
  if (!match) return;
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(match[1]))));
    if (!Array.isArray(data.names) || !Array.isArray(data.scores)) return;
    gameType.value = presets[data.gameType] ? data.gameType : 'classic';
    participantCount.value = String(Math.min(10, Math.max(2, data.names.length)));
    applyPreset(false);
    state.names = data.names.slice(0, 10).map((name, index) => String(name || defaultName(index)).replace(/[<>\u0000-\u001f]/g, '').slice(0, 30) || defaultName(index));
    state.scores = data.scores.slice(0, 10).map(v => Math.max(0, Number(v) || 0));
    state.id = `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
    state.title = 'Shared UNO Snapshot';
    state.createdAt = Date.now();
    state.completedAt = null;
    state.history = [];
    state.scoreBaseline = [...state.scores];
    state.starterIndex = null;
    state.clockwise = data.clockwise !== false;
    renderAll();
    saveState();
    history.replaceState(null, '', location.pathname);
    showToast('Shared game snapshot loaded.');
  } catch {}
}

function addProfile() {
  if (window.v5Features?.addProfile) return window.v5Features.addProfile();
  const name = profileName.value.trim();
  if (!name) return;
  if (!state.profiles.some(p => p.toLowerCase() === name.toLowerCase())) state.profiles.push(name);
  profileName.value = '';
  renderProfiles();
  saveState();
}

function renderProfiles() {
  if (window.v5Features?.renderProfiles) return window.v5Features.renderProfiles();
  profileList.innerHTML = '';
  if (!state.profiles.length) {
    profileList.innerHTML = '<p class="note">No saved players yet.</p>';
    return;
  }
  state.profiles.forEach((name, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'profile-chip';
    const use = document.createElement('button');
    use.type = 'button';
    use.textContent = name;
    use.addEventListener('click', () => {
      pushUndo('apply saved player');
      const slot = state.names.findIndex((n, i) => n === defaultName(i));
      state.names[slot >= 0 ? slot : 0] = name;
      renderScoreboard(); saveState(); showToast(`${name} added to the game.`);
    });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'profile-remove'; remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${name}`);
    remove.addEventListener('click', () => { state.profiles.splice(index, 1); renderProfiles(); saveState(); });
    wrap.append(use, remove); profileList.appendChild(wrap);
  });
}

function ensurePlayerStats(name) {
  state.stats.players[name] ||= { roundsWon: 0, points: 0, gamesWon: 0 };
  return state.stats.players[name];
}

function renderStats() {
  if (window.v5Features?.renderStats) return window.v5Features.renderStats();
  const stats = state.stats;
  const entries = Object.entries(stats.players || {});
  const mostRounds = entries.sort((a,b) => b[1].roundsWon - a[1].roundsWon)[0];
  statsGrid.innerHTML = [
    ['Games played', stats.gamesPlayed || 0],
    ['Rounds played', stats.roundsPlayed || 0],
    ['Total points', stats.totalPoints || 0],
    ['Highest round', stats.highestRound || 0],
    ['Most round wins', mostRounds ? `${mostRounds[0]} (${mostRounds[1].roundsWon})` : '—']
  ].map(([label,value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`).join('');
  playerStats.innerHTML = entries.length ? entries.map(([name, ps]) => `<div class="player-stat-row"><strong>${name}</strong><span>${ps.gamesWon || 0} game wins · ${ps.roundsWon || 0} rounds · ${ps.points || 0} pts</span></div>`).join('') : '<p class="note">Statistics appear after awarding rounds.</p>';
}

function resetStats() {
  if (window.v5Features?.resetStats) return window.v5Features.resetStats();
  if (!confirm('Reset all lifetime statistics? Current scores will remain.')) return;
  state.stats = { gamesPlayed: 0, roundsPlayed: 0, totalPoints: 0, highestRound: 0, players: {} };
  renderStats(); saveState();
}

function rebuildParticipants(preserve = true) {
  const count = Number(participantCount.value);
  const oldNames = [...state.names];
  const oldScores = [...state.scores];
  state.names = Array.from({ length: count }, (_, i) => preserve && oldNames[i] ? oldNames[i] : defaultName(i));
  state.scores = Array.from({ length: count }, (_, i) => preserve && Number.isFinite(oldScores[i]) ? oldScores[i] : 0);
  state.scoreBaseline = Array.from({ length: count }, (_, i) => preserve && Number.isFinite(state.scoreBaseline[i]) ? state.scoreBaseline[i] : 0);
  renderScoreboard();
  saveState();
}

function renderScoreboard() {
  const selectedWinner = roundWinner.value;
  scoreboard.innerHTML = '';
  roundWinner.innerHTML = '';

  state.names.forEach((name, index) => {
    const row = document.createElement('div');
    row.className = 'score-row';

    const nameLabel = document.createElement('label');
    nameLabel.innerHTML = `<span>${isTeamsMode() ? 'Team' : 'Player'} ${index + 1}</span>`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 30;
    nameInput.value = name;
    nameInput.addEventListener('focus', () => pushUndo('edit player name'), { once: true });
    nameInput.addEventListener('input', () => {
      state.names[index] = nameInput.value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 30) || defaultName(index);
      updateWinnerOptions(roundWinner.value);
      updateLeader();
      saveState();
    });
    nameLabel.appendChild(nameInput);

    const scoreLabel = document.createElement('label');
    scoreLabel.innerHTML = '<span>Score</span>';
    const scoreInput = document.createElement('input');
    scoreInput.type = 'number';
    scoreInput.min = '0';
    scoreInput.max = '1000000';
    scoreInput.step = '1';
    scoreInput.value = state.scores[index];
    scoreInput.addEventListener('focus', () => pushUndo('edit score'), { once: true });
    scoreInput.addEventListener('input', () => {
      state.scores[index] = Math.min(1000000, Math.max(0, Math.round(Number(scoreInput.value) || 0)));
      const historyPoints = state.history.reduce((sum, round) => sum + (Number(round.changes?.[index]?.delta) || (round.winnerIndex === index ? Number(round.points) || 0 : 0)), 0);
      state.scoreBaseline[index] = Math.max(0, state.scores[index] - historyPoints);
      updateLeader();
      saveState();
    });
    scoreLabel.appendChild(scoreInput);

    row.append(nameLabel, scoreLabel);
    scoreboard.appendChild(row);

    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = name;
    roundWinner.appendChild(option);
  });

  if ([...roundWinner.options].some(option => option.value === selectedWinner)) roundWinner.value = selectedWinner;
  updateLeader();
}

function updateWinnerOptions(selectedWinner) {
  roundWinner.innerHTML = '';
  state.names.forEach((name, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = name;
    roundWinner.appendChild(option);
  });
  if ([...roundWinner.options].some(option => option.value === selectedWinner)) roundWinner.value = selectedWinner;
}

function spriteMarkup(card) {
  const safe = String(card.sprite).replace(/[<>&"']/g, '');
  if (card.sprite === 'wild') {
    return `<span class="mini-card" style="--card-color:${card.color}"><span class="mini-corner top">W</span><span class="wild-wheel"><span></span><span></span><span></span><span></span></span><span class="mini-corner bottom">W</span></span>`;
  }
  const small = safe.length > 2 ? ' small' : '';
  return `<span class="mini-card" style="--card-color:${card.color}"><span class="mini-corner top">${safe}</span><span class="mini-symbol${small}">${safe}</span><span class="mini-corner bottom">${safe}</span></span>`;
}

function applyPreset(resetParticipants = true) {
  const preset = presets[gameType.value];
  participantLabel.textContent = preset.teams ? 'Teams' : 'Players';
  if (resetParticipants) targetScore.value = preset.target;
  gameNote.textContent = preset.note;
  state.activeCards = preset.cards.map(card => ({ ...card }));
  state.selected = {};
  state.cardHistory = [];
  if (resetParticipants) {
    state.names = [];
    state.scores = [];
    rebuildParticipants(false);
  }
  renderCardButtons();
  renderValueEditor();
  updateCalculator();
  updateDirection();
  saveState();
}

function renderCardButtons() {
  cardButtons.innerHTML = '';
  state.activeCards.forEach(card => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `card-button${state.selected[card.id] ? ' active' : ''}`;
    button.setAttribute('aria-label', `Add one ${card.label} card worth ${card.value} points`);
    button.innerHTML = `${spriteMarkup(card)}<div class="card-name"></div><div class="card-points">${card.value} pts</div>`;
    button.querySelector('.card-name').textContent = card.label;
    if (state.selected[card.id]) {
      const badge = document.createElement('span');
      badge.className = 'card-count';
      badge.textContent = state.selected[card.id];
      button.appendChild(badge);
    }
    button.addEventListener('click', () => {
      state.selected[card.id] = (state.selected[card.id] || 0) + 1;
      state.cardHistory.push(card.id);
      playTone(360 + Math.min(card.value, 100) * 2, 0.05);
      renderCardButtons();
      updateCalculator();
    });
    cardButtons.appendChild(button);
  });
}

function calculateRound() {
  return state.activeCards.reduce((total, card) => total + (state.selected[card.id] || 0) * card.value, 0);
}

function updateCalculator() {
  const total = calculateRound();
  calculatorTotal.textContent = `${total} points`;
  const groups = state.activeCards
    .filter(card => state.selected[card.id])
    .map(card => `${state.selected[card.id]} × ${card.label} (${state.selected[card.id] * card.value})`);
  roundSummary.textContent = groups.length ? `${groups.join(' + ')} = ${total} points` : 'No cards selected.';
}

function clearCards() {
  state.selected = {};
  state.cardHistory = [];
  renderCardButtons();
  updateCalculator();
}

function undoCard() {
  const cardId = state.cardHistory.pop();
  if (!cardId) return;
  state.selected[cardId] -= 1;
  if (state.selected[cardId] <= 0) delete state.selected[cardId];
  renderCardButtons();
  updateCalculator();
}

function awardRound() {
  if (awardRound.submitting) return;
  const total = calculateRound();
  const winnerIndex = Number(roundWinner.value);
  if (!total) {
    announcement.textContent = 'Select at least one remaining card first.';
    return;
  }
  awardRound.submitting = true;
  pushUndo('award round points');
  const before = [...state.scores];
  state.scores[winnerIndex] += total;
  const winnerName = state.names[winnerIndex];
  const cardsAwarded = state.activeCards
    .filter(card => state.selected[card.id])
    .map(card => ({ label: card.label, count: state.selected[card.id] }));
  const now = Date.now();
  const previousAt = state.history.length ? Number(state.history[0].timestamp || Date.parse(state.history[0].createdAt)) : state.createdAt;
  state.history.unshift({
    id: `${now}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16)}`,
    roundNumber: state.history.length + 1,
    winner: winnerName,
    winnerIndex,
    points: total,
    changes: state.names.map((name, index) => ({ name, delta: index === winnerIndex ? total : 0, total: state.scores[index] })),
    totalsBefore: before,
    resultingTotals: [...state.scores],
    cards: cardsAwarded,
    timestamp: now,
    createdAt: new Date(now).toISOString(),
    durationMs: state.settings.roundDuration ? Math.max(0, now - previousAt) : null
  });
  state.history = state.history.slice(0, 50);
  state.stats.roundsPlayed = (state.stats.roundsPlayed || 0) + 1;
  state.stats.totalPoints = (state.stats.totalPoints || 0) + total;
  state.stats.highestRound = Math.max(state.stats.highestRound || 0, total);
  const winnerStats = ensurePlayerStats(winnerName);
  winnerStats.roundsWon += 1;
  winnerStats.points += total;
  const target = Math.min(100000, Math.max(1, Number(targetScore.value) || 500));
  if (state.scores[winnerIndex] >= target && !state.winnerRecorded) {
    state.winnerRecorded = true;
    state.stats.gamesPlayed = (state.stats.gamesPlayed || 0) + 1;
    winnerStats.gamesWon += 1;
    state.completedAt = now;
    if (state.settings.confetti) launchConfetti();
    playTone(784, 0.25);
    if (state.settings.vibration && navigator.vibrate) navigator.vibrate([100, 60, 180]);
  }
  renderScoreboard();
  clearCards();
  renderHistory();
  renderStats();
  saveState();
  window.v5Features?.onRoundCompleted?.(state.history[0]);
  announcement.textContent = `${winnerName} received ${total} points.`;
  setTimeout(() => { awardRound.submitting = false; }, 300);
}

function renderHistory() {
  if (window.v5Features?.renderHistory) return window.v5Features.renderHistory();
  historyList.innerHTML = '';
  if (!state.history.length) {
    historyList.innerHTML = '<p class="note">No rounds recorded yet.</p>';
    return;
  }
  state.history.forEach((round, index) => {
    const item = document.createElement('article');
    item.className = 'history-item';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `Round ${state.history.length - index}: ${round.winner}`;
    const cardText = (round.cards || []).map(card => `${card.count}× ${card.label}`).join(', ');
    const meta = document.createElement('small');
    const date = new Date(round.createdAt);
    meta.textContent = `${date.toLocaleString()}${cardText ? ` · ${cardText}` : ''}`;
    details.append(title, meta);
    const points = document.createElement('span');
    points.className = 'history-points';
    points.textContent = `+${round.points}`;
    item.append(details, points);
    historyList.appendChild(item);
  });
}

function clearHistory() {
  if (!state.history.length) return;
  if (!window.confirm('Clear the recorded round history? Scores will remain unchanged.')) return;
  state.history = [];
  renderHistory();
  saveState();
}

function applyTheme() {
  const dark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('high-contrast', Boolean(state.settings.highContrast));
  document.documentElement.classList.toggle('reduce-motion', Boolean(state.settings.reducedMotion));
  themeButton.textContent = dark ? '☀️' : '🌙';
  themeButton.setAttribute('aria-label', dark ? 'Use light mode' : 'Use dark mode');
}

function toggleTheme() {
  const darkNow = document.documentElement.dataset.theme === 'dark';
  state.theme = darkNow ? 'light' : 'dark';
  applyTheme();
  saveState();
}

function renderValueEditor() {
  valueEditor.innerHTML = '';
  state.activeCards.forEach((card, index) => {
    const label = document.createElement('label');
    const title = document.createElement('span');
    title.textContent = card.label;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '100000';
    input.step = '1';
    input.value = card.value;
    input.addEventListener('input', () => {
      state.activeCards[index].value = Math.max(0, Number(input.value) || 0);
      renderCardButtons();
      updateCalculator();
      saveState();
    });
    label.append(title, input);
    valueEditor.appendChild(label);
  });
}

function updateDirection() {
  directionSymbol.textContent = state.clockwise ? '↻' : '↺';
  directionLabel.textContent = state.clockwise ? 'Clockwise' : 'Counter-clockwise';
  announcement.textContent = `Direction is ${state.clockwise ? 'clockwise' : 'counter-clockwise'}.`;
}

function reverseDirection() {
  pushUndo('reverse direction');
  state.clockwise = !state.clockwise;
  updateDirection();
  saveState();
  if (state.settings.vibration && navigator.vibrate) navigator.vibrate(40);
  playTone(state.clockwise ? 520 : 420, 0.08);
}

function updateLeader() {
  if (!state.scores.length) return;
  const highest = Math.max(...state.scores);
  const leaders = state.names.filter((_, index) => state.scores[index] === highest);
  const target = Math.min(100000, Math.max(1, Number(targetScore.value) || 500));
  if (highest === 0) leaderText.textContent = `All ${isTeamsMode() ? 'teams' : 'players'} are tied on 0.`;
  else if (leaders.length > 1) leaderText.textContent = `${leaders.join(' and ')} are tied on ${highest}.`;
  else leaderText.textContent = `${leaders[0]} leads with ${highest}.`;

  const winners = state.names.filter((_, index) => state.scores[index] >= target);
  winnerCallout.classList.toggle('hidden', !winners.length);
  winnerCallout.textContent = winners.length ? `🏆 ${winners.join(' and ')} reached ${target} points.` : '';
  if (winners.length && state.winnerRecorded) window.v5Features?.showWinner?.();
}

function resetGame() {
  const confirmed = window.confirm('Start a new game and reset all scores?');
  if (!confirmed) return;
  pushUndo('start new game');
  state.id = `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
  state.title = `UNO Game ${new Date().toLocaleDateString()}`;
  state.createdAt = Date.now();
  state.updatedAt = Date.now();
  state.scores = state.scores.map(() => 0);
  state.history = [];
  state.scoreBaseline = state.scores.map(() => 0);
  state.completedAt = null;
  state.starterIndex = null;
  state.gameClock = { elapsedMs: 0, running: false, startedAt: null };
  state.winnerRecorded = false;
  clearCards();
  renderScoreboard();
  renderHistory();
  saveState();
  announcement.textContent = 'New game started. Scores and round history reset.';
}

let clockInterval = null;
let wakeLock = null;

function currentClockElapsed() {
  const base = Math.max(0, Number(state.gameClock?.elapsedMs) || 0);
  const now = window.liveSync?.serverNow?.() ?? Date.now();
  return state.gameClock?.running && Number.isFinite(state.gameClock.startedAt)
    ? base + Math.max(0, now - state.gameClock.startedAt)
    : base;
}

function formatClock(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

function renderGameClock() {
  if (!gameClockDisplay) return;
  gameClockDisplay.textContent = formatClock(currentClockElapsed());
  gameClockStatus.textContent = state.gameClock.running ? 'Timer running.' : currentClockElapsed() ? 'Timer paused.' : 'Ready to start.';
  toggleGameClockButton.textContent = state.gameClock.running ? 'Pause Timer' : (currentClockElapsed() ? 'Resume Timer' : 'Start Timer');
}

function toggleGameClock() {
  if (state.gameClock.running) {
    state.gameClock.elapsedMs = currentClockElapsed();
    state.gameClock.running = false;
    state.gameClock.startedAt = null;
  } else {
    state.gameClock.startedAt = window.liveSync?.serverNow?.() ?? Date.now();
    state.gameClock.running = true;
  }
  renderGameClock(); saveState();
}

function resetGameClock() {
  if (currentClockElapsed() > 0 && !confirm('Reset the game timer?')) return;
  state.gameClock = { elapsedMs: 0, running: false, startedAt: null };
  renderGameClock(); saveState();
}

async function toggleWakeLock() {
  if (!('wakeLock' in navigator)) return showToast('Screen wake lock is not supported on this device.');
  try {
    if (wakeLock) { await wakeLock.release(); wakeLock = null; keepAwakeButton.textContent = 'Keep Screen Awake'; }
    else { wakeLock = await navigator.wakeLock.request('screen'); keepAwakeButton.textContent = 'Allow Screen Sleep'; wakeLock.addEventListener('release', () => { wakeLock = null; keepAwakeButton.textContent = 'Keep Screen Awake'; }); }
  } catch { showToast('Could not change the screen wake setting.'); }
}

function renderAll() {
  gameNote.textContent = presets[gameType.value].note;
  participantLabel.textContent = isTeamsMode() ? 'Teams' : 'Players';
  renderScoreboard();
  renderCardButtons();
  renderValueEditor();
  updateCalculator();
  updateDirection();
  renderHistory();
  renderProfiles();
  renderStats();
  updateSoundButton();
  renderGameClock();
}



window.getLiveGameState = function getLiveGameState() {
  return {
    version: 5,
    id: state.id,
    title: state.title,
    createdAt: state.createdAt,
    completedAt: state.completedAt,
    gameType: gameType.value,
    participantCount: Number(participantCount.value),
    targetScore: Math.min(100000, Math.max(1, Number(targetScore.value) || 500)),
    clockwise: state.clockwise,
    names: [...state.names],
    scores: [...state.scores],
    history: JSON.parse(JSON.stringify(state.history)),
    starterIndex: state.starterIndex,
    scoreBaseline: [...state.scoreBaseline],
    settings: { ...state.settings },
    winnerRecorded: state.winnerRecorded,
    gameClock: {
      elapsedMs: state.gameClock.running ? Math.max(0, Number(state.gameClock.elapsedMs) || 0) : currentClockElapsed(),
      running: state.gameClock.running,
      startedAt: state.gameClock.running ? state.gameClock.startedAt : null
    },
    updatedAtClient: Date.now()
  };
};

window.applyLiveGameState = function applyLiveGameState(live) {
  if (!live || !Array.isArray(live.names) || !Array.isArray(live.scores)) return;
  gameType.value = presets[live.gameType] ? live.gameType : 'classic';
  participantCount.value = String(Math.min(10, Math.max(2, Number(live.participantCount) || live.names.length || 4)));
  targetScore.value = Math.min(100000, Math.max(1, Number(live.targetScore) || presets[gameType.value].target));
  state.activeCards = presets[gameType.value].cards.map(card => ({ ...card }));
  state.names = live.names.slice(0, 10).map((name, i) => String(name || defaultName(i)).slice(0, 30));
  state.scores = live.scores.slice(0, 10).map(score => Math.max(0, Number(score) || 0));
  while (state.names.length < Number(participantCount.value)) state.names.push(defaultName(state.names.length));
  while (state.scores.length < Number(participantCount.value)) state.scores.push(0);
  state.clockwise = live.clockwise !== false;
  state.history = Array.isArray(live.history) ? live.history.slice(0, 50) : [];
  state.id = String(live.id || state.id || '');
  state.title = String(live.title || state.title || 'UNO Game').slice(0, 60);
  state.createdAt = Number(live.createdAt) || state.createdAt || Date.now();
  state.completedAt = Number(live.completedAt) || null;
  state.starterIndex = Number.isInteger(live.starterIndex) ? live.starterIndex : null;
  state.scoreBaseline = Array.isArray(live.scoreBaseline) ? live.scoreBaseline.slice(0, 10).map(v => Math.max(0, Number(v) || 0)) : state.scores.map(() => 0);
  state.settings = { ...state.settings, ...(live.settings && typeof live.settings === 'object' ? live.settings : {}) };
  state.winnerRecorded = live.winnerRecorded === true;
  const remoteClock = live.gameClock && typeof live.gameClock === 'object' ? live.gameClock : null;
  state.gameClock = remoteClock ? {
    elapsedMs: Math.max(0, Number(remoteClock.elapsedMs) || 0),
    running: remoteClock.running === true && Number.isFinite(Number(remoteClock.startedAt)),
    startedAt: remoteClock.running && Number.isFinite(Number(remoteClock.startedAt)) ? Number(remoteClock.startedAt) : null
  } : { elapsedMs: 0, running: false, startedAt: null };
  state.selected = {};
  state.cardHistory = [];
  renderAll();
  if (document.body.classList.contains('viewer-mode')) window.setLiveViewerMode(true);
};

window.setLiveViewerMode = function setLiveViewerMode(enabled) {
  document.body.classList.toggle('viewer-mode', Boolean(enabled));
  document.querySelectorAll('.settings-grid, .direction-stage, main > section.panel:not(.live-panel), main > details.panel').forEach(region => {
    region.querySelectorAll('button, input, select, textarea').forEach(control => {
      if (enabled && !control.disabled) { control.disabled = true; control.dataset.viewerDisabled = 'true'; }
      else if (!enabled && control.dataset.viewerDisabled === 'true') { control.disabled = false; delete control.dataset.viewerDisabled; }
    });
  });
  if (enabled) $('resumeLastGame')?.setAttribute('disabled', ''); else $('resumeLastGame')?.removeAttribute('disabled');
};

window.rebaseLiveTimer = function rebaseLiveTimer(nextNow) {
  if (!state.gameClock.running) return;
  state.gameClock.elapsedMs = currentClockElapsed();
  state.gameClock.startedAt = Number(nextNow) || Date.now();
};

function initialiseCollapsibleSections() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SECTION_STATE_KEY)) || {}; } catch {}
  document.querySelectorAll('details[data-section]').forEach(section => {
    if (typeof saved[section.dataset.section] === 'boolean') section.open = saved[section.dataset.section];
    section.addEventListener('toggle', () => {
      saved[section.dataset.section] = section.open;
      localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(saved));
    });
  });
}

initialiseCollapsibleSections();

window.unoCore = {
  state,
  elements: { gameType, participantCount, targetScore, historyList, profileList, profileName, profileAvatar, profileColour, statsGrid, playerStats, roundWinner, announcement },
  saveState, renderAll, renderScoreboard, renderHistory, renderProfiles, renderStats, renderGameClock, currentClockElapsed, formatClock, clearCards, updateLeader,
  applyTheme,
  serialize: () => window.getLiveGameState()
};

clockInterval = setInterval(renderGameClock, 500);
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && keepAwakeButton?.textContent === 'Allow Screen Sleep' && !wakeLock && 'wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }
});

$('reverseButton').addEventListener('click', reverseDirection);
$('reverseAction').addEventListener('click', reverseDirection);
$('clearCards').addEventListener('click', clearCards);
$('undoCard').addEventListener('click', undoCard);
$('awardRound').addEventListener('click', awardRound);
$('resetGame').addEventListener('click', resetGame);
themeButton.addEventListener('click', toggleTheme);
clearHistoryButton?.addEventListener('click', clearHistory);
undoActionButton.addEventListener('click', undoLastAction);
randomStarterButton.addEventListener('click', chooseRandomStarter);
shareGameButton.addEventListener('click', shareSnapshot);
soundButton.addEventListener('click', () => { state.sound = !state.sound; updateSoundButton(); saveState(); playTone(600, 0.06); });
addProfileButton.addEventListener('click', addProfile);
profileName.addEventListener('keydown', event => { if (event.key === 'Enter') addProfile(); });
resetStatsButton.addEventListener('click', resetStats);
toggleGameClockButton.addEventListener('click', toggleGameClock);
resetGameClockButton.addEventListener('click', resetGameClock);
keepAwakeButton.addEventListener('click', toggleWakeLock);

gameType.addEventListener('change', () => applyPreset(true));
participantCount.addEventListener('change', () => rebuildParticipants(true));
targetScore.addEventListener('input', () => { if (Number(targetScore.value) > 100000) targetScore.value = '100000'; updateLeader(); saveState(); });

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.classList.remove('hidden');
});

installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  installButton.classList.add('hidden');
  announcement.textContent = 'UNO Score Tracker installed.';
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('service-worker.js');
    if (registration.waiting) updateBanner.classList.remove('hidden');
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          updateBanner.classList.remove('hidden');
        }
      });
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
}

reloadAppButton.addEventListener('click', async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme();
});

if (!loadState()) {
  applyTheme();
  applyPreset(true);
}
undoActionButton.disabled = true;
importSnapshotFromHash();
