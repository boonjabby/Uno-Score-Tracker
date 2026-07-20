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

const STORAGE_KEY = 'uno-score-tracker-v2';
const LEGACY_STORAGE_KEY = 'uno-score-tracker-v1';
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
  clockwise: true,
  names: [],
  scores: [],
  activeCards: [],
  selected: {},
  cardHistory: [],
  history: [],
  theme: 'system'
};

function isTeamsMode() { return gameType.value === 'teams'; }
function defaultName(index) { return `${isTeamsMode() ? 'Team' : 'Player'} ${index + 1}`; }

function saveState() {
  const data = {
    gameType: gameType.value,
    participantCount: participantCount.value,
    targetScore: targetScore.value,
    clockwise: state.clockwise,
    names: state.names,
    scores: state.scores,
    cardValues: Object.fromEntries(state.activeCards.map(card => [card.id, card.value])),
    history: state.history,
    theme: state.theme
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
    if (!saved) return false;
    gameType.value = saved.gameType || 'classic';
    participantCount.value = saved.participantCount || '4';
    targetScore.value = saved.targetScore || presets[gameType.value].target;
    state.clockwise = saved.clockwise !== false;
    state.history = Array.isArray(saved.history) ? saved.history : [];
    state.theme = saved.theme || 'system';
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
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return false;
  }
}

function rebuildParticipants(preserve = true) {
  const count = Number(participantCount.value);
  const oldNames = [...state.names];
  const oldScores = [...state.scores];
  state.names = Array.from({ length: count }, (_, i) => preserve && oldNames[i] ? oldNames[i] : defaultName(i));
  state.scores = Array.from({ length: count }, (_, i) => preserve && Number.isFinite(oldScores[i]) ? oldScores[i] : 0);
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
    nameInput.value = name;
    nameInput.addEventListener('input', () => {
      state.names[index] = nameInput.value.trim() || defaultName(index);
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
    scoreInput.step = '1';
    scoreInput.value = state.scores[index];
    scoreInput.addEventListener('input', () => {
      state.scores[index] = Math.max(0, Number(scoreInput.value) || 0);
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
  const total = calculateRound();
  const winnerIndex = Number(roundWinner.value);
  if (!total) {
    announcement.textContent = 'Select at least one remaining card first.';
    return;
  }
  state.scores[winnerIndex] += total;
  const winnerName = state.names[winnerIndex];
  const cardsAwarded = state.activeCards
    .filter(card => state.selected[card.id])
    .map(card => ({ label: card.label, count: state.selected[card.id] }));
  state.history.unshift({
    id: Date.now(),
    winner: winnerName,
    points: total,
    cards: cardsAwarded,
    createdAt: new Date().toISOString()
  });
  state.history = state.history.slice(0, 50);
  renderScoreboard();
  clearCards();
  renderHistory();
  saveState();
  announcement.textContent = `${winnerName} received ${total} points.`;
}

function renderHistory() {
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
  state.clockwise = !state.clockwise;
  updateDirection();
  saveState();
  if (navigator.vibrate) navigator.vibrate(40);
}

function updateLeader() {
  if (!state.scores.length) return;
  const highest = Math.max(...state.scores);
  const leaders = state.names.filter((_, index) => state.scores[index] === highest);
  const target = Math.max(1, Number(targetScore.value) || 500);
  if (highest === 0) leaderText.textContent = `All ${isTeamsMode() ? 'teams' : 'players'} are tied on 0.`;
  else if (leaders.length > 1) leaderText.textContent = `${leaders.join(' and ')} are tied on ${highest}.`;
  else leaderText.textContent = `${leaders[0]} leads with ${highest}.`;

  const winners = state.names.filter((_, index) => state.scores[index] >= target);
  winnerCallout.classList.toggle('hidden', !winners.length);
  winnerCallout.textContent = winners.length ? `🏆 ${winners.join(' and ')} reached ${target} points.` : '';
}

function resetGame() {
  const confirmed = window.confirm('Start a new game and reset all scores?');
  if (!confirmed) return;
  state.scores = state.scores.map(() => 0);
  state.history = [];
  clearCards();
  renderScoreboard();
  renderHistory();
  saveState();
  announcement.textContent = 'New game started. Scores and round history reset.';
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
}

$('reverseButton').addEventListener('click', reverseDirection);
$('reverseAction').addEventListener('click', reverseDirection);
$('clearCards').addEventListener('click', clearCards);
$('undoCard').addEventListener('click', undoCard);
$('awardRound').addEventListener('click', awardRound);
$('resetGame').addEventListener('click', resetGame);
themeButton.addEventListener('click', toggleTheme);
clearHistoryButton.addEventListener('click', clearHistory);

gameType.addEventListener('change', () => applyPreset(true));
participantCount.addEventListener('change', () => rebuildParticipants(true));
targetScore.addEventListener('input', () => { updateLeader(); saveState(); });

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
