(() => {
  'use strict';

  const core = window.unoCore;
  if (!core) return;
  const { state, elements } = core;
  const GAMES_KEY = 'uno-score-tracker-v5-games';
  const PROFILES_KEY = 'uno-score-tracker-v5-profiles';
  const MIGRATION_KEY = 'uno-score-tracker-v5-migrated';
  const palette = ['#d71920', '#177bd1', '#2ca24c', '#8b4bb5', '#d97706', '#0f766e'];

  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
  const text = (value, fallback = '', max = 60) => String(value ?? fallback).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) || fallback;
  const number = (value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : fallback));
  const readJson = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
  };
  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { core.elements.announcement.textContent = 'Local saving is unavailable or storage is full.'; return false; }
  };

  function normalizeProfiles(raw) {
    const seen = new Set();
    return (Array.isArray(raw) ? raw : []).slice(0, 50).map((item, index) => {
      const source = typeof item === 'string' ? { name: item } : item || {};
      const name = text(source.name, `Player ${index + 1}`, 30);
      const key = name.toLocaleLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: text(source.id, uid(), 80), name,
        avatar: text(source.avatar, name.slice(0, 2).toUpperCase(), 3),
        colour: /^#[0-9a-f]{6}$/i.test(source.colour) ? source.colour : palette[index % palette.length],
        wins: number(source.wins), gamesPlayed: number(source.gamesPlayed),
        lifetime: source.lifetime && typeof source.lifetime === 'object' ? source.lifetime : {}
      };
    }).filter(Boolean);
  }

  function normalizeHistory() {
    const names = state.names;
    const legacy = state.history.slice(0, 200);
    state.history = legacy.map((raw, index) => {
      const winnerIndex = Number.isInteger(raw.winnerIndex) && raw.winnerIndex < names.length ? raw.winnerIndex : Math.max(0, names.findIndex(name => name === raw.winner));
      const points = number(raw.points, 0, 0, 100000);
      const timestamp = number(raw.timestamp || Date.parse(raw.createdAt), Date.now(), 1);
      return {
        id: text(raw.id, uid(), 100), roundNumber: number(raw.roundNumber, legacy.length - index, 1, 10000),
        winner: text(names[winnerIndex] || raw.winner, `Player ${winnerIndex + 1}`, 30), winnerIndex, points,
        changes: names.map((name, playerIndex) => ({ name, delta: playerIndex === winnerIndex ? points : 0, total: number(raw.resultingTotals?.[playerIndex] ?? raw.changes?.[playerIndex]?.total) })),
        totalsBefore: Array.isArray(raw.totalsBefore) ? raw.totalsBefore.map(v => number(v)) : [],
        resultingTotals: Array.isArray(raw.resultingTotals) ? raw.resultingTotals.map(v => number(v)) : [],
        cards: Array.isArray(raw.cards) ? raw.cards.slice(0, 100).map(card => {
          const known = state.activeCards.find(item => item.id === card.id || item.label === card.label) || {};
          return { id: text(card.id || known.id, '', 40), label: text(card.label || known.label, 'Card', 30), count: number(card.count, 0, 0, 999), value: number(card.value ?? known.value, 0, 0, 100000), sprite: text(card.sprite ?? known.sprite, '?', 10), color: /^#[0-9a-f]{6}$/i.test(card.color) ? card.color : known.color || '#d71920' };
        }) : [],
        timestamp, createdAt: new Date(timestamp).toISOString(), durationMs: raw.durationMs == null ? null : number(raw.durationMs)
      };
    });
    state.history.sort((a, b) => b.timestamp - a.timestamp);
    state.history.forEach((round, index) => { round.roundNumber = state.history.length - index; });
    if (state._legacyMigration || !Array.isArray(state.scoreBaseline) || !state.scoreBaseline.length) {
      state.scoreBaseline = state.scores.map((score, playerIndex) => Math.max(0, score - state.history.reduce((sum, round) => sum + number(round.changes[playerIndex]?.delta), 0)));
    }
    while (state.scoreBaseline.length < state.names.length) state.scoreBaseline.push(0);
    delete state._legacyMigration;
    recalculateScores(false);
  }

  function recalculateScores(save = true) {
    const totals = state.names.map((_, index) => number(state.scoreBaseline[index]));
    [...state.history].reverse().forEach((round, reverseIndex) => {
      round.roundNumber = reverseIndex + 1;
      round.totalsBefore = [...totals];
      round.changes = state.names.map((name, index) => {
        const delta = index === round.winnerIndex ? number(round.points, 0, 0, 100000) : 0;
        totals[index] += delta;
        return { name, delta, total: totals[index] };
      });
      round.resultingTotals = [...totals];
      round.winner = state.names[round.winnerIndex] || round.winner;
    });
    state.scores = totals;
    core.renderScoreboard();
    renderHistory();
    renderStats();
    renderProfiles();
    renderPresentation();
    if (save) core.saveState();
  }

  function fullSnapshot() {
    const stored = readJson('uno-score-tracker-v5-current', {});
    return {
      ...stored, schemaVersion: 5, id: state.id, title: state.title, createdAt: state.createdAt,
      updatedAt: state.updatedAt, completedAt: state.completedAt, names: [...state.names], scores: [...state.scores],
      history: clone(state.history), starterIndex: state.starterIndex, scoreBaseline: [...state.scoreBaseline],
      settings: { ...state.settings }, gameClock: clone(state.gameClock)
    };
  }

  function games() {
    const value = readJson(GAMES_KEY, []);
    return Array.isArray(value) ? value.filter(game => game && typeof game === 'object').slice(0, 100) : [];
  }

  function askText(title, label, value, inputMode = 'text') {
    const overlay = document.getElementById('inputOverlay');
    const form = document.getElementById('inputDialogForm');
    const input = document.getElementById('inputDialogValue');
    document.getElementById('inputDialogTitle').textContent = title;
    document.getElementById('inputDialogLabel').textContent = label;
    input.value = value; input.inputMode = inputMode;
    overlay.classList.remove('hidden'); input.focus(); input.select();
    return new Promise(resolve => {
      const finish = result => { overlay.classList.add('hidden'); form.removeEventListener('submit', submit); document.getElementById('cancelInputDialog').removeEventListener('click', cancel); resolve(result); };
      const submit = event => { event.preventDefault(); finish(input.value); };
      const cancel = () => finish(null);
      form.addEventListener('submit', submit); document.getElementById('cancelInputDialog').addEventListener('click', cancel);
    });
  }

  function captureCurrentGame() {
    if (window.liveSync?.isViewer?.()) return;
    const list = games();
    const snapshot = fullSnapshot();
    const index = list.findIndex(game => game.id === snapshot.id);
    if (index >= 0) list[index] = snapshot; else list.unshift(snapshot);
    list.sort((a, b) => number(b.updatedAt) - number(a.updatedAt));
    writeJson(GAMES_KEY, list.slice(0, 100));
    renderSavedGames();
    renderPresentation();
  }

  function resumeGame(id) {
    const game = games().find(item => item.id === id);
    if (!game) return;
    writeJson('uno-score-tracker-v5-current', game);
    location.reload();
  }

  function renderSavedGames() {
    const root = document.getElementById('savedGamesList');
    if (!root) return;
    const list = games();
    root.replaceChildren();
    if (!list.length) { root.innerHTML = '<p class="note">No saved games yet.</p>'; return; }
    list.forEach(game => {
      const card = document.createElement('article'); card.className = 'saved-game-card';
      const info = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = text(game.title, 'UNO Game');
      const meta = document.createElement('small'); meta.textContent = `${(game.names || []).length} players · ${(game.history || []).length} rounds · ${new Date(number(game.updatedAt, Date.now())).toLocaleString()}`;
      info.append(title, meta);
      const actions = document.createElement('div'); actions.className = 'compact-actions';
      const add = (label, action, className = 'secondary') => { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label; button.addEventListener('click', action); actions.appendChild(button); };
      add('Resume', () => resumeGame(game.id), game.id === state.id ? 'primary' : 'secondary');
      add('Rename', async () => { const name = await askText('Rename saved game', 'Game name', game.title || 'UNO Game'); if (name == null) return; game.title = text(name, game.title || 'UNO Game'); game.updatedAt = Date.now(); writeJson(GAMES_KEY, list); if (game.id === state.id) { state.title = game.title; core.saveState(); } renderSavedGames(); });
      add('Duplicate', () => { const copy = clone(game); copy.id = uid(); copy.title = `${text(game.title, 'UNO Game', 48)} Copy`; copy.createdAt = copy.updatedAt = Date.now(); copy.completedAt = null; list.unshift(copy); writeJson(GAMES_KEY, list); renderSavedGames(); });
      add('Delete', () => { if (!confirm(`Delete “${text(game.title, 'UNO Game')}” from this device?`)) return; writeJson(GAMES_KEY, list.filter(item => item.id !== game.id)); renderSavedGames(); }, 'danger');
      card.append(info, actions); root.appendChild(card);
    });
  }

  function addProfile() {
    const name = text(elements.profileName.value, '', 30);
    if (!name) return;
    const profiles = normalizeProfiles(readJson(PROFILES_KEY, state.profiles));
    if (profiles.some(profile => profile.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return alert('A profile with that name already exists.');
    profiles.push({ id: uid(), name, avatar: text(elements.profileAvatar?.value, name.slice(0, 2).toUpperCase(), 3), colour: /^#[0-9a-f]{6}$/i.test(elements.profileColour?.value) ? elements.profileColour.value : palette[profiles.length % palette.length], wins: 0, gamesPlayed: 0, lifetime: {} });
    state.profiles = profiles; writeJson(PROFILES_KEY, profiles); elements.profileName.value = ''; if (elements.profileAvatar) elements.profileAvatar.value = ''; renderProfiles(); core.saveState();
  }

  function renderProfiles() {
    const derived = deriveStatistics();
    state.profiles = normalizeProfiles(readJson(PROFILES_KEY, state.profiles)).map(profile => {
      const stats = Object.entries(derived.players).find(([name]) => name.toLocaleLowerCase() === profile.name.toLocaleLowerCase())?.[1] || {};
      return { ...profile, wins: stats.wins || 0, gamesPlayed: stats.gamesPlayed || 0, lifetime: stats };
    });
    writeJson(PROFILES_KEY, state.profiles);
    elements.profileList.replaceChildren();
    if (!state.profiles.length) { elements.profileList.innerHTML = '<p class="note">No saved players yet.</p>'; return; }
    state.profiles.forEach(profile => {
      const card = document.createElement('article'); card.className = 'profile-card'; card.style.setProperty('--profile-colour', profile.colour);
      const use = document.createElement('button'); use.type = 'button'; use.className = 'profile-use'; use.setAttribute('aria-label', `Use ${profile.name}`);
      const avatar = document.createElement('span'); avatar.className = 'profile-avatar'; avatar.textContent = profile.avatar;
      const info = document.createElement('span');
      const lifetime = profile.lifetime || {};
      info.innerHTML = `<strong></strong><small>${lifetime.points || 0} pts · ${lifetime.rounds || 0} rounds · ${profile.gamesPlayed} games · ${profile.wins} wins</small>`;
      info.querySelector('strong').textContent = profile.name; use.append(avatar, info);
      use.addEventListener('click', () => { const slot = state.names.findIndex((name, index) => name === `Player ${index + 1}` || name === `Team ${index + 1}`); state.names[slot >= 0 ? slot : 0] = profile.name; core.renderScoreboard(); core.saveState(); });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'profile-remove'; remove.textContent = 'Delete'; remove.setAttribute('aria-label', `Delete profile ${profile.name}`); remove.addEventListener('click', () => { if (!confirm(`Delete the local profile for ${profile.name}?`)) return; state.profiles = state.profiles.filter(item => item.id !== profile.id); writeJson(PROFILES_KEY, state.profiles); renderProfiles(); core.saveState(); });
      card.append(use, remove); elements.profileList.appendChild(card);
    });
  }

  function allUniqueGames() {
    const map = new Map(games().map(game => [game.id, game]));
    map.set(state.id, fullSnapshot());
    return [...map.values()];
  }

  function deriveStatistics() {
    const result = { gamesPlayed: 0, averageDuration: 0, players: {} };
    const durations = [];
    allUniqueGames().filter(game => number(game.updatedAt) >= number(state.settings.statsSince)).forEach(game => {
      const history = Array.isArray(game.history) ? game.history : [];
      if (!history.length) return;
      result.gamesPlayed += 1;
      const names = Array.isArray(game.names) ? game.names : [];
      const scores = Array.isArray(game.scores) ? game.scores.map(v => number(v)) : [];
      const maxScore = Math.max(0, ...scores);
      const duration = game.completedAt ? number(game.completedAt) - number(game.createdAt) : 0;
      if (duration > 0) durations.push(duration);
      names.forEach((name, playerIndex) => {
        const ps = result.players[name] ||= { gamesPlayed: 0, wins: 0, rounds: 0, points: 0, highestRound: 0, lowestRound: null, longestWinningStreak: 0 };
        ps.gamesPlayed += 1; if (game.completedAt && scores[playerIndex] === maxScore) ps.wins += 1;
        let streak = 0;
        [...history].reverse().forEach(round => {
          const delta = number(round.changes?.[playerIndex]?.delta ?? (round.winnerIndex === playerIndex ? round.points : 0));
          if (delta > 0) { ps.rounds += 1; ps.points += delta; ps.highestRound = Math.max(ps.highestRound, delta); ps.lowestRound = ps.lowestRound == null ? delta : Math.min(ps.lowestRound, delta); streak += 1; ps.longestWinningStreak = Math.max(ps.longestWinningStreak, streak); } else streak = 0;
        });
      });
    });
    result.averageDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    Object.values(result.players).forEach(ps => { ps.winPercentage = ps.gamesPlayed ? ps.wins / ps.gamesPlayed * 100 : 0; ps.averageScorePerRound = ps.rounds ? ps.points / ps.rounds : 0; });
    return result;
  }

  function renderStats() {
    const data = deriveStatistics();
    const currentDuration = core.currentClockElapsed();
    elements.statsGrid.innerHTML = [
      ['Games played', data.gamesPlayed], ['Players tracked', Object.keys(data.players).length], ['Current rounds', state.history.length],
      ['Average game duration', core.formatClock(data.averageDuration)], ['Current duration', core.formatClock(currentDuration)]
    ].map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`).join('');
    elements.playerStats.replaceChildren();
    const entries = Object.entries(data.players);
    if (!entries.length) { elements.playerStats.innerHTML = '<p class="note">Statistics are derived from completed rounds and saved games.</p>'; return; }
    entries.sort((a, b) => b[1].wins - a[1].wins || b[1].points - a[1].points).forEach(([name, ps]) => {
      const card = document.createElement('article'); card.className = 'player-stat-card';
      const title = document.createElement('strong'); title.textContent = name;
      const grid = document.createElement('div'); grid.className = 'mini-stats';
      [['Games', ps.gamesPlayed], ['Wins', ps.wins], ['Win %', `${ps.winPercentage.toFixed(0)}%`], ['Avg / round', ps.averageScorePerRound.toFixed(1)], ['Highest', ps.highestRound], ['Lowest', ps.lowestRound ?? '—'], ['Best streak', ps.longestWinningStreak]].forEach(([label, value]) => { const item = document.createElement('span'); item.innerHTML = `<small></small><b></b>`; item.querySelector('small').textContent = label; item.querySelector('b').textContent = value; grid.appendChild(item); });
      card.append(title, grid); elements.playerStats.appendChild(card);
    });
  }

  function resetStats() {
    if (!confirm('Reset the statistics view from this point forward? Saved games and scores will not be deleted.')) return;
    state.settings.statsSince = Date.now(); renderStats(); renderProfiles(); core.saveState();
  }

  function renderHistory() {
    elements.historyList.replaceChildren();
    const undo = document.getElementById('undoLastRound'); if (undo) undo.disabled = !state.history.length;
    if (!state.history.length) { elements.historyList.innerHTML = '<p class="note">No rounds recorded yet.</p>'; return; }
    state.history.forEach(round => {
      const item = document.createElement('details'); item.className = 'history-item';
      const summary = document.createElement('summary');
      const label = document.createElement('span'); label.innerHTML = `<strong></strong><small></small>`; label.querySelector('strong').textContent = `Round ${round.roundNumber}: ${round.winner}`; label.querySelector('small').textContent = `${new Date(round.timestamp).toLocaleString()}${round.durationMs == null ? '' : ` · ${core.formatClock(round.durationMs)}`}`;
      const points = document.createElement('span'); points.className = 'history-points'; points.textContent = `+${round.points}`; summary.append(label, points);
      const body = document.createElement('div'); body.className = 'history-detail';
      const changes = document.createElement('ul'); round.changes.forEach(change => { const li = document.createElement('li'); li.textContent = `${change.name}: ${change.delta >= 0 ? '+' : ''}${change.delta} → ${change.total}`; changes.appendChild(li); });
      if (round.cards.length) {
        const cardArea = document.createElement('div'); cardArea.className = 'round-card-area';
        const cardHeading = document.createElement('strong'); cardHeading.textContent = 'Cards remaining'; cardArea.appendChild(cardHeading);
        const cards = document.createElement('div'); cards.className = `round-cards${state.settings.roundCardSprites ? '' : ' text-only'}`;
        round.cards.forEach(card => {
          const group = document.createElement('div'); group.className = 'round-card-group';
          if (state.settings.roundCardSprites) group.innerHTML = core.spriteMarkup(card);
          const caption = document.createElement('span'); caption.textContent = `${card.count}× ${card.label}${card.value ? ` · ${card.count * card.value} pts` : ''}`; group.appendChild(caption); cards.appendChild(group);
        });
        cardArea.appendChild(cards); body.appendChild(cardArea);
      }
      const actions = document.createElement('div'); actions.className = 'compact-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary'; edit.textContent = 'Edit points'; edit.addEventListener('click', async () => { const value = await askText(`Edit round ${round.roundNumber}`, 'Points (0–100000)', String(round.points), 'numeric'); if (value == null) return; const next = Number(value); if (!Number.isInteger(next) || next < 0 || next > 100000) return alert('Enter a whole number from 0 to 100000.'); round.points = next; recalculateScores(); window.liveSync?.recordHostAction?.('editRound', { roundId: round.id, points: next }); });
      const del = document.createElement('button'); del.type = 'button'; del.className = 'danger'; del.textContent = 'Delete round'; del.addEventListener('click', () => { if (!confirm(`Delete round ${round.roundNumber} and recalculate all scores?`)) return; state.history = state.history.filter(item => item.id !== round.id); recalculateScores(); window.liveSync?.recordHostAction?.('deleteRound', { roundId: round.id }); });
      actions.append(edit, del); body.prepend(changes); body.append(actions); item.append(summary, body); elements.historyList.appendChild(item);
    });
  }

  function undoLastRound() {
    if (!state.history.length || !confirm('Undo the most recently completed round and recalculate all scores?')) return;
    state.history.shift(); state.winnerRecorded = false; state.completedAt = null; recalculateScores(); core.elements.announcement.textContent = 'Last round undone.';
    window.liveSync?.recordHostAction?.('undoRound', {});
  }

  function applyCollaborativeAction(type, payload = {}, actor = 'Connected device') {
    const playerIndex = Math.min(state.names.length - 1, Math.max(0, Number(payload.playerIndex ?? payload.winnerIndex) || 0));
    if (type === 'reverse') { core.applyDirectionReverse(); return { message: `${actor} reversed direction.` }; }
    if (type === 'starter') { core.setStarter(payload.starterIndex); return { message: `${actor} changed the starter.` }; }
    if (['timerStart', 'timerResume'].includes(type)) { core.setTimerAction('start'); return { message: `${actor} started the timer.` }; }
    if (type === 'timerPause') { core.setTimerAction('pause'); return { message: `${actor} paused the timer.` }; }
    if (type === 'timerReset') { core.setTimerAction('reset'); return { message: `${actor} reset the timer.` }; }
    if (type === 'addRound') {
      const points = number(payload.points, 0, 1, 100000);
      const now = Date.now(); const before = [...state.scores]; state.scores[playerIndex] += points;
      state.history.unshift({ id: uid(), roundNumber: state.history.length + 1, winner: state.names[playerIndex], winnerIndex: playerIndex, points, changes: state.names.map((name, index) => ({ name, delta: index === playerIndex ? points : 0, total: state.scores[index] })), totalsBefore: before, resultingTotals: [...state.scores], cards: [], timestamp: now, createdAt: new Date(now).toISOString(), durationMs: state.settings.roundDuration ? Math.max(0, now - (state.history[0]?.timestamp || state.createdAt)) : null, source: 'collaborative', actor });
      const target = number(elements.targetScore.value, 500, 1, 100000); if (state.scores[playerIndex] >= target) { state.winnerRecorded = true; state.completedAt = now; }
      recalculateScores(); return { roundId: state.history[0].id, message: `${actor} added ${points} points to ${state.names[playerIndex]}.` };
    }
    if (type === 'correctScore') {
      const next = number(payload.score, 0, 0, 1000000); const historyPoints = state.history.reduce((sum, round) => sum + number(round.changes?.[playerIndex]?.delta), 0); state.scoreBaseline[playerIndex] = Math.max(0, next - historyPoints); recalculateScores(); return { message: `${actor} corrected ${state.names[playerIndex]}'s score to ${next}.` };
    }
    if (type === 'undoRound') { if (!state.history.length) throw new Error('There is no round to undo.'); state.history.shift(); state.winnerRecorded = false; state.completedAt = null; recalculateScores(); return { message: `${actor} undid the latest round.` }; }
    if (type === 'editRound') { const round = state.history.find(item => item.id === payload.roundId); if (!round) throw new Error('That round no longer exists.'); round.points = number(payload.points, round.points, 0, 100000); recalculateScores(); return { message: `${actor} edited round ${round.roundNumber}.` }; }
    if (type === 'deleteRound') { const round = state.history.find(item => item.id === payload.roundId); if (!round) throw new Error('That round no longer exists.'); state.history = state.history.filter(item => item.id !== round.id); recalculateScores(); return { message: `${actor} deleted round ${round.roundNumber}.` }; }
    if (type === 'resetGame') { state.scores = state.names.map(() => 0); state.scoreBaseline = state.names.map(() => 0); state.history = []; state.winnerRecorded = false; state.completedAt = null; state.starterIndex = null; state.gameClock = { elapsedMs: 0, running: false, startedAt: null }; core.renderAll(); core.saveState(); return { message: `${actor} reset the game.` }; }
    if (type === 'endGame') { state.completedAt = Date.now(); state.winnerRecorded = true; core.saveState(); return { message: `${actor} ended the game.` }; }
    throw new Error('Unsupported action.');
  }

  function showWinner() {
    const overlay = document.getElementById('winnerOverlay');
    if (!overlay || !state.winnerRecorded || overlay.dataset.gameId === state.id) return;
    overlay.dataset.gameId = state.id;
    const standings = state.names.map((name, index) => ({ name, score: state.scores[index] })).sort((a, b) => b.score - a.score);
    document.getElementById('winnerTitle').textContent = `🏆 ${standings[0].name} wins!`;
    const summary = document.getElementById('winnerSummary'); summary.replaceChildren();
    const meta = document.createElement('p'); meta.textContent = `${state.history.length} rounds · ${core.formatClock(core.currentClockElapsed())}`;
    const list = document.createElement('ol'); standings.forEach(item => { const li = document.createElement('li'); li.textContent = `${item.name} — ${item.score}`; list.appendChild(li); }); summary.append(meta, list);
    overlay.classList.remove('hidden'); document.getElementById('closeWinner').focus();
  }

  function rematch() {
    state.id = uid(); state.title = `${text(state.title, 'UNO Game', 48)} Rematch`; state.createdAt = Date.now(); state.updatedAt = Date.now(); state.completedAt = null;
    state.scores = state.names.map(() => 0); state.scoreBaseline = state.names.map(() => 0); state.history = []; state.winnerRecorded = false; state.starterIndex = null; state.gameClock = { elapsedMs: 0, running: false, startedAt: null };
    document.getElementById('winnerOverlay').classList.add('hidden'); core.renderAll(); core.saveState();
  }

  async function shareResults() {
    const standings = state.names.map((name, index) => `${index + 1}. ${name}: ${state.scores[index]}`).join('\n');
    const message = `${state.title}\n${standings}\n${state.history.length} rounds · ${core.formatClock(core.currentClockElapsed())}`;
    try { if (navigator.share) await navigator.share({ title: `${state.title} results`, text: message }); else { await navigator.clipboard.writeText(message); core.elements.announcement.textContent = 'Results copied to the clipboard.'; } } catch (error) { if (error.name !== 'AbortError') core.elements.announcement.textContent = 'Could not share results.'; }
  }

  function renderPresentation() {
    const root = document.getElementById('scoreboardPresentation');
    if (!root) return;
    const liveMeta = window.liveSync?.presentationMeta?.() || {};
    const connected = liveMeta.connected ?? 1;
    const showQr = Boolean(state.settings.scoreboardQr && liveMeta.roomCode);
    root.dataset.players = String(state.names.length);
    root.innerHTML = `<header><div><p class="eyebrow">${text(state.title, 'UNO Game')}</p><h2>Round ${state.history.length + 1}</h2></div><div class="presentation-meta"><span>🎲 ${state.starterIndex == null ? 'Starter not chosen' : text(state.names[state.starterIndex])}</span><span>⏱ <b id="presentationClock">${core.formatClock(core.currentClockElapsed())}</b></span><span>👥 ${connected}</span></div></header><div class="presentation-direction-card ${state.clockwise ? 'clockwise' : 'counterclockwise'}" role="status" aria-label="Current direction: ${state.clockwise ? 'clockwise' : 'counter-clockwise'}"><span class="presentation-direction-oval"></span><b>${state.clockwise ? '↻' : '↺'}</b><strong>${state.clockwise ? 'CLOCKWISE' : 'COUNTER-CLOCKWISE'}</strong></div><div class="presentation-scores"></div><div id="presentationQr" class="presentation-qr ${showQr ? '' : 'hidden'}"></div>`;
    const scores = root.querySelector('.presentation-scores');
    state.names.forEach((name, index) => { const card = document.createElement('article'); card.innerHTML = `<span class="score-place">${index + 1}</span><strong></strong><b>${state.scores[index]}</b>`; card.querySelector('strong').textContent = name; if (index === state.starterIndex) card.setAttribute('aria-label', `${name}, current starter, ${state.scores[index]} points`); scores.appendChild(card); });
    if (showQr) window.liveSync?.renderPresentationQr?.(root.querySelector('#presentationQr'));
  }

  function toggleStandaloneScoreboard() {
    const enabled = !document.body.classList.contains('scoreboard-display');
    document.body.classList.toggle('scoreboard-display', enabled);
    document.getElementById('scoreboardPresentation')?.classList.toggle('hidden', !enabled);
    document.getElementById('openScoreboard').textContent = enabled ? 'Exit Scoreboard' : 'Fullscreen Scoreboard';
    document.getElementById('scoreboardExit')?.remove();
    if (enabled) { renderPresentation(); const exit = document.createElement('button'); exit.id = 'scoreboardExit'; exit.className = 'primary scoreboard-exit'; exit.textContent = 'Exit Scoreboard'; exit.addEventListener('click', toggleStandaloneScoreboard); document.body.appendChild(exit); }
  }

  function bindPreferences() {
    const controls = {
      highContrast: document.getElementById('highContrast'), reducedMotion: document.getElementById('reducedMotion'), confetti: document.getElementById('confettiEnabled'), vibration: document.getElementById('vibrationEnabled'), scoreboardQr: document.getElementById('scoreboardQrEnabled'), roundDuration: document.getElementById('roundDurationEnabled'), roundCardSprites: document.getElementById('roundCardSpritesEnabled')
    };
    const theme = document.getElementById('themeSelect'); theme.value = ['system', 'light', 'dark'].includes(state.theme) ? state.theme : 'system';
    theme.addEventListener('change', () => { state.theme = theme.value; core.applyTheme(); core.saveState(); });
    Object.entries(controls).forEach(([key, control]) => { control.checked = Boolean(state.settings[key]); control.addEventListener('change', () => { state.settings[key] = control.checked; core.applyTheme(); if (key === 'roundCardSprites') renderHistory(); if (key === 'scoreboardQr') renderPresentation(); core.saveState(); }); });
  }

  function initialize() {
    state.id ||= uid(); state.title = text(state.title, 'UNO Game'); state.createdAt = number(state.createdAt, Date.now(), 1); state.updatedAt = number(state.updatedAt, Date.now(), 1);
    state.profiles = normalizeProfiles(readJson(PROFILES_KEY, state.profiles)); writeJson(PROFILES_KEY, state.profiles);
    normalizeHistory(); bindPreferences(); core.applyTheme();
    document.getElementById('undoLastRound')?.addEventListener('click', undoLastRound);
    document.getElementById('resumeLastGame')?.addEventListener('click', () => { const list = games().sort((a, b) => number(b.updatedAt) - number(a.updatedAt)); if (!list.length) return alert('No saved game is available yet.'); resumeGame(list[0].id); });
    document.getElementById('rematchGame')?.addEventListener('click', rematch);
    document.getElementById('openScoreboard')?.addEventListener('click', toggleStandaloneScoreboard);
    document.getElementById('shareResults')?.addEventListener('click', shareResults);
    document.getElementById('closeWinner')?.addEventListener('click', () => document.getElementById('winnerOverlay').classList.add('hidden'));
    writeJson(MIGRATION_KEY, { version: 5, migratedAt: Date.now(), source: localStorage.getItem('uno-score-tracker-v4') ? 'v4.7' : 'fresh' });
    core.renderAll(); core.saveState(); renderSavedGames(); renderPresentation();
    setInterval(() => { const clock = document.getElementById('presentationClock'); if (clock) clock.textContent = core.formatClock(core.currentClockElapsed()); }, 500);
  }

  window.v5Features = { captureCurrentGame, addProfile, renderProfiles, renderStats, resetStats, renderHistory, showWinner, onRoundCompleted: showWinner, renderPresentation, recalculateScores, applyCollaborativeAction };
  initialize();
})();
