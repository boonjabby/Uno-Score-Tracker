import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getDatabase, ref, set, get, onValue, remove, update, runTransaction, serverTimestamp, onDisconnect } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';

const $ = id => document.getElementById(id);
const ui = {
  status: $('liveStatus'), badge: $('connectionBadge'), start: $('liveStartControls'), showJoin: $('showJoinControls'), joinBox: $('joinControls'), codeInput: $('roomCodeInput'), join: $('joinLiveGame'), cancel: $('cancelJoin'), host: $('hostLiveGame'),
  details: $('liveRoomDetails'), code: $('liveRoomCode'), qr: $('qrCode'), copy: $('copyRoomCode'), share: $('shareLiveRoom'), leave: $('leaveLiveRoom'), viewer: $('viewerNotice'), viewerCount: $('viewerCount'), expandQr: $('expandQr'), qrOverlay: $('qrOverlay'), closeQrOverlay: $('closeQrOverlay'), overlayQr: $('overlayQr'), overlayRoomCode: $('overlayRoomCode'), scoreboardMode: $('scoreboardMode'),
  collaboration: $('collaborationArea'), displayName: $('memberDisplayName'), memberMode: $('memberMode'), roleBadge: $('memberRoleBadge'), memberControls: $('memberControls'), reverse: $('collaborativeReverse'), actionType: $('requestActionType'), player: $('requestPlayer'), amount: $('requestAmount'), amountLabel: $('requestAmountLabel'), playerField: $('requestPlayerField'), amountField: $('requestAmountField'), roundField: $('requestRoundField'), round: $('requestRound'), submitRequest: $('submitActionRequest'), feedback: $('requestFeedback'), pendingPanel: $('pendingActionsPanel'), pendingCount: $('pendingCount'), pendingList: $('pendingActionsList'), permissionPanel: $('permissionPanel'), permissionList: $('permissionList'), activityList: $('activityList')
};

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('PASTE_');
const MEMBER_NAME_KEY = 'uno-live-member-name-v1';
const MEMBER_MODE_KEY = 'uno-live-member-mode-v1';
const SESSION_KEY = 'uno-live-session-v1';
const REQUEST_TTL = 10 * 60 * 1000;
const COMMAND_TTL = 2 * 60 * 1000;
const ACTIVITY_LIMIT = 100;
const capabilities = ['scoring', 'starter', 'timer', 'history', 'gameManagement'];
const capabilityFor = { addRound: 'scoring', correctScore: 'scoring', starter: 'starter', timerStart: 'timer', timerPause: 'timer', timerResume: 'timer', timerReset: 'timer', undoRound: 'history', editRound: 'history', deleteRound: 'history', endGame: 'gameManagement', resetGame: 'gameManagement' };
const destructiveActions = new Set(['deleteRound', 'endGame', 'resetGame', 'timerReset']);
const actionLabels = { reverse: 'Reverse direction', addRound: 'Add completed round', correctScore: 'Correct score', starter: 'Change starter', timerStart: 'Start timer', timerPause: 'Pause timer', timerResume: 'Resume timer', timerReset: 'Reset timer', undoRound: 'Undo latest round', editRound: 'Edit round', deleteRound: 'Delete round', endGame: 'End game', resetGame: 'Reset game' };

let auth, db, user, roomId = null, roomCode = null, role = null, currentRoom = null;
let roomUnsubscribe = null, presenceDisconnect = null, serverOffsetUnsubscribe = null;
let syncTimer = null, applyingRemote = false, applyingCommand = false, serverTimeOffset = 0, connectedCount = 1, reverseCooldownUntil = 0;
const processing = new Set();
const knownRequestStatuses = new Map();

function safeText(value, fallback = '', max = 30) { return String(value ?? fallback).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max) || fallback; }
function randomId(bytes = 16) { const data = crypto.getRandomValues(new Uint8Array(bytes)); return [...data].map(value => value.toString(16).padStart(2, '0')).join(''); }
function randomCode() { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const data = crypto.getRandomValues(new Uint8Array(6)); return [...data].map(value => alphabet[value % alphabet.length]).join(''); }
function now() { return Date.now() + serverTimeOffset; }
function memberName() { return safeText(ui.displayName?.value || localStorage.getItem(MEMBER_NAME_KEY), role === 'host' ? 'Host' : 'Guest'); }
function memberMode() { return ui.memberMode?.value === 'viewer' ? 'viewer' : 'player'; }
function isConnected() { return Boolean(roomId && role); }
function status(message, kind = 'offline') { ui.status.textContent = message; ui.badge.textContent = kind === 'connected' ? 'Connected' : kind === 'connecting' ? 'Connecting…' : 'Offline'; ui.badge.className = `connection-badge ${kind}`; }
function notify(message) { ui.feedback.textContent = message; window.unoCore?.elements?.announcement && (window.unoCore.elements.announcement.textContent = message); }
function joinUrl(id = roomId) { const url = new URL(location.href); url.hash = `live=${id}`; return url.toString(); }
function gameRevision() { return Math.max(0, Number(window.getLiveGameState?.().revision) || 0); }
function roomPath(child = '') { return `rooms/${roomId}${child ? `/${child}` : ''}`; }

function renderQr(target, size = 170) { target.innerHTML = ''; if (window.QRCode && roomId) new window.QRCode(target, { text: joinUrl(), width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M }); }

async function ensureAuth() {
  if (!configured) throw new Error('Firebase has not been configured yet.');
  if (user) return user;
  await signInAnonymously(auth);
  return new Promise(resolve => { const stop = onAuthStateChanged(auth, next => { if (next) { user = next; stop(); resolve(next); } }); });
}

async function makeUniqueCode(id) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCode(); const snapshot = await get(ref(db, `roomCodes/${code}`));
    if (!snapshot.exists()) { await set(ref(db, `roomCodes/${code}`), { roomId: id, hostUid: user.uid, createdAt: serverTimestamp() }); return code; }
  }
  throw new Error('Could not generate a room code. Please try again.');
}

async function registerMember() {
  if (!db || !user || !roomId) return;
  const name = memberName(); localStorage.setItem(MEMBER_NAME_KEY, name);
  await update(ref(db, roomPath(`members/${user.uid}`)), { displayName: name, memberType: memberMode(), joinedAt: currentRoom?.members?.[user.uid]?.joinedAt || serverTimestamp(), lastSeenAt: serverTimestamp() });
  await registerPresence();
}

async function registerPresence() {
  if (!db || !user || !roomId || !role) return;
  const presenceRef = ref(db, roomPath(`presence/${user.uid}`));
  presenceDisconnect?.cancel?.();
  presenceDisconnect = onDisconnect(presenceRef); await presenceDisconnect.remove();
  await set(presenceRef, { role, connectedAt: serverTimestamp() });
}

function effectiveRole(room = currentRoom) {
  if (!room || !user) return 'viewer';
  if (room.hostUid === user.uid) return 'host';
  const grants = room.permissions?.[user.uid] || {};
  if (capabilities.some(capability => grants[capability] === true)) return 'controller';
  return room.members?.[user.uid]?.memberType === 'player' ? 'player' : 'viewer';
}

function updateRole(room) {
  const next = effectiveRole(room); const changed = next !== role; role = next;
  const collaborative = Number(room?.schemaVersion) >= 6 && Number(room?.game?.version) >= 6;
  ui.roleBadge.textContent = role === 'host' ? 'Host' : role === 'controller' ? 'Controller' : role === 'player' ? 'Player' : 'Viewer';
  ui.roleBadge.className = `role-badge ${role}`;
  ui.memberControls.classList.toggle('hidden', role === 'host' || !collaborative);
  ui.pendingPanel.classList.toggle('hidden', role !== 'host');
  ui.permissionPanel.classList.toggle('hidden', role !== 'host');
  ui.viewer.classList.toggle('hidden', role === 'host');
  ui.viewer.textContent = !collaborative ? 'Compatibility mode — this v5 room remains view-only. Start a new v6 room to use collaborative controls.' : role === 'controller' ? '🎛 Controller mode — granted actions apply automatically; other actions become requests.' : role === 'player' ? '🃏 Player mode — Reverse is immediate; protected changes are sent to the host for approval.' : '👀 Viewer mode — Reverse is immediate; protected changes are sent to the host for approval.';
  window.setLiveViewerMode?.(role !== 'host');
  if (changed && roomId) registerPresence().catch(console.error);
}

function showRoom() {
  ui.start.classList.add('hidden'); ui.joinBox.classList.add('hidden'); ui.details.classList.remove('hidden'); ui.collaboration.classList.remove('hidden');
  ui.code.textContent = roomCode || '------'; ui.qr.innerHTML = '';
  if (role === 'host') { renderQr(ui.qr); ui.qr.classList.remove('hidden'); ui.expandQr.classList.remove('hidden'); }
  else { ui.qr.classList.add('hidden'); ui.expandQr.classList.add('hidden'); }
  ui.scoreboardMode.textContent = document.body.classList.contains('scoreboard-display') ? 'Exit Scoreboard' : 'Full-screen Scoreboard';
  populateRequestFields();
}

function cleanupSessionUi() {
  window.rebaseLiveTimer?.(Date.now()); clearTimeout(syncTimer); syncTimer = null; roomUnsubscribe?.(); roomUnsubscribe = null; presenceDisconnect?.cancel?.(); presenceDisconnect = null;
  roomId = roomCode = role = null; currentRoom = null; connectedCount = 1; processing.clear(); knownRequestStatuses.clear(); localStorage.removeItem(SESSION_KEY);
  ui.start.classList.remove('hidden'); ui.details.classList.add('hidden'); ui.joinBox.classList.add('hidden'); ui.collaboration.classList.add('hidden'); ui.viewer.classList.add('hidden'); ui.qr.classList.remove('hidden'); ui.viewerCount.classList.add('hidden');
  window.setLiveViewerMode?.(false); document.body.classList.remove('scoreboard-display'); document.getElementById('scoreboardPresentation')?.classList.add('hidden'); document.getElementById('scoreboardExit')?.remove(); status('Local game only.'); history.replaceState(null, '', `${location.pathname}${location.search}`);
}

async function hostRoom() {
  try {
    status('Creating secure live room…', 'connecting'); await ensureAuth(); roomId = randomId(); roomCode = await makeUniqueCode(roomId); window.rebaseLiveTimer?.(now()); role = 'host';
    const name = memberName();
    await set(ref(db, roomPath()), { hostUid: user.uid, code: roomCode, schemaVersion: 6, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), game: window.getLiveGameState(), members: { [user.uid]: { displayName: name, memberType: 'player', joinedAt: serverTimestamp(), lastSeenAt: serverTimestamp() } }, permissions: { [user.uid]: { scoring: true, starter: true, timer: true, history: true, gameManagement: true, updatedAt: serverTimestamp() } } });
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, roomCode, role, savedAt: Date.now() })); subscribe(); showRoom(); await registerPresence(); await addActivity('sessionStarted', {}, 'created the live game'); status(`Hosting room ${roomCode}.`, 'connected');
  } catch (error) { console.error(error); status(error.message || 'Could not create room.'); alert(error.message || 'Could not create live room.'); }
}

async function joinByRoomId(id) {
  try {
    status('Joining room…', 'connecting'); await ensureAuth(); const snapshot = await get(ref(db, `rooms/${id}`)); if (!snapshot.exists() || snapshot.val().active === false) throw new Error('That live room does not exist or has ended.');
    roomId = id; currentRoom = snapshot.val(); roomCode = currentRoom.code || '------'; role = effectiveRole(currentRoom); localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, roomCode, role, savedAt: Date.now() }));
    await registerMember(); subscribe(); showRoom(); status(`Connected to room ${roomCode}.`, 'connected');
  } catch (error) { console.error(error); status(error.message || 'Could not join room.'); alert(error.message || 'Could not join room.'); }
}

async function joinByCode() {
  const code = ui.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length !== 6) return alert('Enter the 6-character room code.');
  try { status('Looking up room…', 'connecting'); await ensureAuth(); const snapshot = await get(ref(db, `roomCodes/${code}`)); if (!snapshot.exists()) throw new Error('Room code not found or the game has ended.'); await joinByRoomId(snapshot.val().roomId); }
  catch (error) { console.error(error); status(error.message || 'Could not join room.'); alert(error.message || 'Could not join room.'); }
}

function subscribe() {
  roomUnsubscribe?.();
  roomUnsubscribe = onValue(ref(db, roomPath()), snapshot => {
    if (!snapshot.exists()) { alert('The host ended this live game.'); cleanupSessionUi(); return; }
    currentRoom = snapshot.val(); roomCode = currentRoom.code || roomCode; updateRole(currentRoom); showRoom();
    if (role !== 'host') { applyingRemote = true; window.applyLiveGameState?.(currentRoom.game); applyingRemote = false; }
    connectedCount = Math.max(1, Object.keys(currentRoom.presence || {}).length); ui.viewerCount.textContent = `👥 ${connectedCount} connected`; ui.viewerCount.classList.remove('hidden');
    const hostConnected = Object.entries(currentRoom.presence || {}).some(([uid]) => uid === currentRoom.hostUid);
    status(role === 'host' ? `Hosting room ${roomCode}.` : hostConnected ? `Connected as ${role}.` : 'Host disconnected. Requests are waiting for reconnect…', role === 'host' || hostConnected ? 'connected' : 'connecting');
    renderCollaboration(currentRoom); notifyRequestStatus(currentRoom.requests || {}); window.v5Features?.renderPresentation?.();
    if (role === 'host' && Number(currentRoom.game?.version) >= 6) processHostQueue(currentRoom).catch(console.error);
  }, error => { console.error(error); status('Connection lost. Reconnecting…', 'connecting'); });
}

function validateAction(type, payload = {}, room = currentRoom) {
  const game = room?.game || window.getLiveGameState?.(); if (!room?.active || !game) throw new Error('The game is no longer active.');
  if (!actionLabels[type]) throw new Error('Unsupported action.');
  const playerCount = Number(game.participantCount) || game.names?.length || 0;
  if (['addRound', 'correctScore'].includes(type)) { const index = Number(payload.playerIndex ?? payload.winnerIndex); if (!Number.isInteger(index) || index < 0 || index >= playerCount) throw new Error('Invalid player.'); const value = Number(type === 'addRound' ? payload.points : payload.score); if (!Number.isInteger(value) || value < (type === 'addRound' ? 1 : 0) || value > (type === 'addRound' ? 100000 : 1000000)) throw new Error('Invalid score value.'); }
  if (type === 'starter') { const index = Number(payload.starterIndex); if (!Number.isInteger(index) || index < 0 || index >= playerCount) throw new Error('Invalid starting player.'); }
  if (['editRound', 'deleteRound'].includes(type)) { const round = (game.history || []).find(item => item.id === payload.roundId); if (!round) throw new Error('That round no longer exists.'); if (type === 'editRound' && (!Number.isInteger(Number(payload.points)) || Number(payload.points) < 0 || Number(payload.points) > 100000)) throw new Error('Invalid round points.'); }
  if (type === 'undoRound' && !(game.history || []).length) throw new Error('There is no round to undo.');
  return true;
}

function buildPayload() {
  const type = ui.actionType.value; const playerIndex = Number(ui.player.value); const amount = Number(ui.amount.value); const roundId = ui.round.value;
  if (type === 'addRound') return { winnerIndex: playerIndex, playerIndex, points: amount };
  if (type === 'correctScore') return { playerIndex, score: amount };
  if (type === 'starter') return { starterIndex: playerIndex };
  if (type === 'editRound') return { roundId, points: amount };
  if (type === 'deleteRound') return { roundId };
  return {};
}

function requestView(node) { return node?.submission ? { ...node.submission, ...(node.review || {}), status: node.review?.status || node.submission.status || 'pending' } : node; }

function populateRequestFields() {
  const game = currentRoom?.game || window.getLiveGameState?.(); if (!game) return;
  const previousPlayer = ui.player.value; ui.player.replaceChildren(); (game.names || []).forEach((name, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = safeText(name, `Player ${index + 1}`); ui.player.appendChild(option); }); if ([...ui.player.options].some(option => option.value === previousPlayer)) ui.player.value = previousPlayer;
  const previousRound = ui.round.value; ui.round.replaceChildren(); (game.history || []).forEach(round => { const option = document.createElement('option'); option.value = round.id; option.textContent = `Round ${round.roundNumber}: ${safeText(round.winner)}`; ui.round.appendChild(option); }); if ([...ui.round.options].some(option => option.value === previousRound)) ui.round.value = previousRound;
  updateRequestBuilder();
}

function updateRequestBuilder() {
  const type = ui.actionType.value; const needsPlayer = ['addRound', 'correctScore', 'starter'].includes(type); const needsAmount = ['addRound', 'correctScore', 'editRound'].includes(type); const needsRound = ['editRound', 'deleteRound'].includes(type);
  ui.playerField.classList.toggle('hidden', !needsPlayer); ui.amountField.classList.toggle('hidden', !needsAmount); ui.roundField.classList.toggle('hidden', !needsRound); ui.amountLabel.textContent = type === 'correctScore' ? 'New total score' : 'Points'; ui.amount.min = type === 'addRound' ? '1' : '0';
}

async function submitCommand(type, payload, mode = 'capability') {
  validateAction(type, payload); const id = randomId(); const command = { id, sessionId: roomId, gameId: currentRoom.game?.id || '', requesterUid: user.uid, requesterName: memberName(), actionType: type, payload, mode, expectedRevision: gameRevision(), createdAt: serverTimestamp() };
  await set(ref(db, roomPath(`commands/${id}`)), command); return id;
}

async function submitReverse() {
  if (!isConnected()) return window.unoCore?.applyDirectionReverse?.();
  if (Date.now() < reverseCooldownUntil) return notify('Reverse is already being submitted.');
  reverseCooldownUntil = Date.now() + 900; ui.reverse.disabled = true;
  try { await submitCommand('reverse', {}, 'universal'); notify('Reverse submitted.'); }
  catch (error) { console.error(error); notify(error.message || 'Could not reverse direction.'); }
  finally { setTimeout(() => { ui.reverse.disabled = false; }, 900); }
}

async function requestAction(type, suppliedPayload = null) {
  if (!isConnected() || role === 'host') return false;
  const payload = suppliedPayload || buildPayload();
  try {
    validateAction(type, payload); ui.submitRequest.disabled = true;
    const capability = capabilityFor[type]; const granted = capability && currentRoom.permissions?.[user.uid]?.[capability] === true;
    if (granted) { await submitCommand(type, payload, 'capability'); notify(`${actionLabels[type]} submitted using your permission.`); }
    else {
      const id = randomId(); const request = { id, sessionId: roomId, gameId: currentRoom.game?.id || '', requesterUid: user.uid, requesterName: memberName(), actionType: type, payload, createdAt: serverTimestamp(), status: 'pending', expectedRevision: gameRevision() };
      await set(ref(db, roomPath(`requests/${id}/submission`)), request); knownRequestStatuses.set(id, 'pending'); notify(`${actionLabels[type]} request sent to the host.`);
    }
    return true;
  } catch (error) { console.error(error); notify(error.message || 'Could not submit request.'); return false; }
  finally { ui.submitRequest.disabled = false; }
}

function summarizeAction(item) {
  const game = currentRoom?.game || {}; const payload = item.payload || {}; const player = game.names?.[Number(payload.playerIndex ?? payload.winnerIndex ?? payload.starterIndex)] || 'player';
  if (item.actionType === 'addRound') return `add ${payload.points} points to ${player}`;
  if (item.actionType === 'correctScore') return `set ${player}'s score to ${payload.score}`;
  if (item.actionType === 'starter') return `make ${player} the starter`;
  if (item.actionType === 'editRound') return `change a round to ${payload.points} points`;
  return actionLabels[item.actionType]?.toLocaleLowerCase() || 'change the game';
}

async function claimProcessed(id, kind = 'command') {
  const result = await runTransaction(ref(db, roomPath(`processedCommands/${id}`)), current => current ? undefined : { kind, processedAt: now(), hostUid: user.uid }, { applyLocally: false });
  return result.committed && result.snapshot.val()?.hostUid === user.uid;
}

async function addActivity(actionType, payload = {}, outcome = 'completed', actorName = memberName(), requestId = null) {
  if (role !== 'host' || !roomId) return;
  const id = randomId(12); await set(ref(db, roomPath(`activity/${id}`)), { id, timestamp: serverTimestamp(), actorName: safeText(actorName, 'Device'), actionType, payload, outcome: safeText(outcome, 'completed', 120), requestId: requestId || null });
}

async function applyCommand(command, room) {
  if (processing.has(command.id) || room.processedCommands?.[command.id]) return; processing.add(command.id);
  try {
    if (now() - Number(command.createdAt || 0) > COMMAND_TTL) throw new Error('Command expired.');
    const member = room.members?.[command.requesterUid]; if (!member) throw new Error('Requester is not an active member.');
    validateAction(command.actionType, command.payload, room);
    if (command.actionType !== 'reverse') { const capability = capabilityFor[command.actionType]; if (!capability || room.permissions?.[command.requesterUid]?.[capability] !== true) throw new Error('Permission is no longer active.'); if (Number(command.expectedRevision) !== gameRevision()) throw new Error('Game changed before this command could be applied.'); }
    if (!await claimProcessed(command.id)) return;
    applyingCommand = true; const result = window.v5Features?.applyCollaborativeAction?.(command.actionType, command.payload, safeText(member.displayName, command.requesterName)); applyingCommand = false;
    await addActivity(command.actionType, command.payload, result?.message || 'applied', member.displayName, command.id); await remove(ref(db, roomPath(`commands/${command.id}`)));
  } catch (error) { applyingCommand = false; console.error(error); if (!room.processedCommands?.[command.id]) await claimProcessed(command.id, 'failed').catch(() => {}); await addActivity(command.actionType, command.payload, error.message, command.requesterName, command.id); await remove(ref(db, roomPath(`commands/${command.id}`))).catch(() => {}); }
  finally { processing.delete(command.id); }
}

async function reviewRequest(request, approve) {
  if (role !== 'host' || request.status !== 'pending' || processing.has(request.id)) return; processing.add(request.id);
  try {
    const liveSnapshot = await get(ref(db, roomPath(`requests/${request.id}`))); const live = liveSnapshot.val(); if (!live) return;
    const resolved = requestView(live); if (resolved.status !== 'pending') return;
    if (now() - Number(resolved.createdAt || 0) > REQUEST_TTL) { await set(ref(db, roomPath(`requests/${request.id}/review`)), { status: 'expired', reviewingHostId: user.uid, reviewedAt: serverTimestamp(), reason: 'Request expired before review.' }); await addActivity(resolved.actionType, resolved.payload, 'expired', resolved.requesterName, resolved.id); return; }
    if (approve && destructiveActions.has(resolved.actionType) && !confirm(`Approve ${safeText(resolved.requesterName, 'this device')}'s request to ${summarizeAction(resolved)}?`)) return;
    if (!approve) { await set(ref(db, roomPath(`requests/${request.id}/review`)), { status: 'rejected', reviewingHostId: user.uid, reviewedAt: serverTimestamp(), reason: 'Rejected by host.' }); await addActivity(resolved.actionType, resolved.payload, 'rejected', resolved.requesterName, resolved.id); return; }
    if (Number(resolved.expectedRevision) !== gameRevision()) { await set(ref(db, roomPath(`requests/${request.id}/review`)), { status: 'expired', reviewingHostId: user.uid, reviewedAt: serverTimestamp(), reason: 'Game state changed; submit a new request.' }); await addActivity(resolved.actionType, resolved.payload, 'stale', resolved.requesterName, resolved.id); return; }
    validateAction(resolved.actionType, resolved.payload, currentRoom); if (!await claimProcessed(resolved.id, 'request')) return;
    applyingCommand = true; const result = window.v5Features?.applyCollaborativeAction?.(resolved.actionType, resolved.payload, safeText(resolved.requesterName, 'Connected device')); applyingCommand = false;
    await set(ref(db, roomPath(`requests/${request.id}/review`)), { status: 'approved', reviewingHostId: user.uid, reviewedAt: serverTimestamp(), result: safeText(result?.message, 'Applied', 120) }); await addActivity(resolved.actionType, resolved.payload, result?.message || 'approved', resolved.requesterName, resolved.id);
  } catch (error) { applyingCommand = false; console.error(error); await set(ref(db, roomPath(`requests/${request.id}/review`)), { status: 'expired', reviewingHostId: user.uid, reviewedAt: serverTimestamp(), reason: safeText(error.message, 'Could not apply request', 120) }).catch(() => {}); }
  finally { processing.delete(request.id); }
}

async function processHostQueue(room) {
  const commands = Object.values(room.commands || {}).sort((a, b) => Number(a.createdAt) - Number(b.createdAt)); for (const command of commands) await applyCommand(command, room);
  for (const node of Object.values(room.requests || {})) {
    const request = requestView(node);
    if (request.status === 'pending' && now() - Number(request.createdAt || 0) > REQUEST_TTL) await reviewRequest(request, true);
    const activityMarker = `submitted-${request.id}`; if (!room.processedCommands?.[activityMarker] && await claimProcessed(activityMarker, 'activity')) await addActivity(request.actionType, request.payload, 'request submitted', request.requesterName, request.id);
  }
  const activity = Object.values(room.activity || {}).sort((a, b) => Number(b.timestamp) - Number(a.timestamp)); for (const entry of activity.slice(ACTIVITY_LIMIT)) await remove(ref(db, roomPath(`activity/${entry.id}`)));
  const processed = Object.entries(room.processedCommands || {}).sort((a, b) => Number(b[1].processedAt) - Number(a[1].processedAt)); for (const [id] of processed.slice(500)) await remove(ref(db, roomPath(`processedCommands/${id}`)));
}

function renderPending(room) {
  const pending = Object.values(room.requests || {}).map(requestView).filter(request => request.status === 'pending').sort((a, b) => Number(a.createdAt) - Number(b.createdAt)); ui.pendingCount.textContent = String(pending.length); ui.pendingCount.classList.toggle('active', pending.length > 0); ui.pendingList.replaceChildren();
  if (!pending.length) { ui.pendingList.innerHTML = '<p class="note">No pending actions.</p>'; return; }
  pending.forEach(request => { const card = document.createElement('article'); card.className = 'request-card'; const description = document.createElement('div'); description.innerHTML = '<strong></strong><small></small>'; description.querySelector('strong').textContent = `${safeText(request.requesterName, 'Device')} requests: ${summarizeAction(request)}`; description.querySelector('small').textContent = new Date(Number(request.createdAt)).toLocaleTimeString(); const actions = document.createElement('div'); actions.className = 'compact-actions'; const approve = document.createElement('button'); approve.type = 'button'; approve.className = 'primary'; approve.textContent = 'Approve'; approve.addEventListener('click', () => reviewRequest(request, true)); const reject = document.createElement('button'); reject.type = 'button'; reject.className = 'secondary'; reject.textContent = 'Reject'; reject.addEventListener('click', () => reviewRequest(request, false)); actions.append(approve, reject); card.append(description, actions); ui.pendingList.appendChild(card); });
}

async function setPermission(memberUid, capability, enabled) {
  if (role !== 'host' || !capabilities.includes(capability)) return; await update(ref(db, roomPath(`permissions/${memberUid}`)), { [capability]: enabled, updatedAt: serverTimestamp() }); await addActivity('permissionChange', { capability, enabled }, `${enabled ? 'granted to' : 'revoked from'} ${safeText(currentRoom.members?.[memberUid]?.displayName, 'device')}`);
}

async function transferHost(memberUid) {
  const member = currentRoom.members?.[memberUid]; if (!member || role !== 'host' || !confirm(`Transfer host control to ${safeText(member.displayName, 'this device')}? You will lose host-only control.`)) return;
  await addActivity('hostTransfer', {}, `host transferred to ${safeText(member.displayName)}`);
  const updates = { hostUid: memberUid, updatedAt: serverTimestamp(), [`permissions/${memberUid}`]: { scoring: true, starter: true, timer: true, history: true, gameManagement: true, updatedAt: serverTimestamp() }, [`permissions/${user.uid}`]: { scoring: false, starter: false, timer: false, history: false, gameManagement: false, updatedAt: serverTimestamp() } };
  await update(ref(db, roomPath()), updates); await update(ref(db, `roomCodes/${roomCode}`), { hostUid: memberUid });
}

function renderPermissions(room) {
  ui.permissionList.replaceChildren(); const members = Object.entries(room.members || {}).filter(([uid]) => uid !== room.hostUid);
  if (!members.length) { ui.permissionList.innerHTML = '<p class="note">No other connected devices have joined.</p>'; return; }
  members.forEach(([uid, member]) => { const card = document.createElement('article'); card.className = 'permission-card'; const heading = document.createElement('div'); heading.innerHTML = '<strong></strong><small></small>'; heading.querySelector('strong').textContent = safeText(member.displayName, 'Device'); heading.querySelector('small').textContent = room.presence?.[uid] ? 'Connected' : 'Offline'; const toggles = document.createElement('div'); toggles.className = 'permission-toggles'; capabilities.forEach(capability => { const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = room.permissions?.[uid]?.[capability] === true; input.addEventListener('change', () => setPermission(uid, capability, input.checked)); const span = document.createElement('span'); span.textContent = capability === 'gameManagement' ? 'Game management' : capability[0].toUpperCase() + capability.slice(1); label.append(input, span); toggles.appendChild(label); }); const transfer = document.createElement('button'); transfer.type = 'button'; transfer.className = 'secondary'; transfer.textContent = 'Transfer Host'; transfer.addEventListener('click', () => transferHost(uid)); card.append(heading, toggles, transfer); ui.permissionList.appendChild(card); });
}

function renderActivity(room) {
  const entries = Object.values(room.activity || {}).sort((a, b) => Number(b.timestamp) - Number(a.timestamp)).slice(0, ACTIVITY_LIMIT); ui.activityList.replaceChildren(); if (!entries.length) { ui.activityList.innerHTML = '<p class="note">No live activity yet.</p>'; return; }
  entries.forEach(entry => { const item = document.createElement('article'); item.className = 'activity-item'; const title = document.createElement('strong'); title.textContent = `${safeText(entry.actorName, 'Device')}: ${actionLabels[entry.actionType] || entry.actionType}`; const detail = document.createElement('small'); detail.textContent = `${safeText(entry.outcome, 'completed', 120)} · ${new Date(Number(entry.timestamp)).toLocaleTimeString()}`; item.append(title, detail); ui.activityList.appendChild(item); });
}

function renderCollaboration(room) { populateRequestFields(); if (role === 'host') { renderPending(room); renderPermissions(room); } renderActivity(room); }

function notifyRequestStatus(requests) {
  Object.values(requests).map(requestView).filter(request => request.requesterUid === user?.uid).forEach(request => { const previous = knownRequestStatuses.get(request.id); knownRequestStatuses.set(request.id, request.status); if (previous && previous !== request.status) notify(request.status === 'approved' ? 'Your request was approved.' : request.status === 'rejected' ? 'Your request was rejected.' : request.status === 'expired' ? `Request expired: ${request.reason || 'game changed'}` : `Request is ${request.status}.`); });
}

async function pushHostState() {
  if (role !== 'host' || !roomId || applyingRemote) return; const game = window.getLiveGameState(); if (!game || !Array.isArray(game.names) || game.names.length < 2 || game.names.length > 10 || !Array.isArray(game.scores) || game.scores.length !== game.names.length) return status('Invalid game state was not synchronized.', 'connecting');
  try { await update(ref(db, roomPath()), { game, updatedAt: serverTimestamp() }); }
  catch (error) { console.error(error); status('Could not sync. Check connection.', 'connecting'); }
}

async function leaveRoom() {
  if (role === 'host' && roomId) { if (!confirm('End this live room for every connected device?')) return; try { await addActivity('endGame', {}, 'room ended'); await remove(ref(db, roomPath())); if (roomCode) await remove(ref(db, `roomCodes/${roomCode}`)); } catch (error) { console.error(error); } }
  else if (roomId && user) { await remove(ref(db, roomPath(`members/${user.uid}`))).catch(() => {}); await remove(ref(db, roomPath(`presence/${user.uid}`))).catch(() => {}); }
  cleanupSessionUi();
}

async function shareRoom() { const url = joinUrl(); const data = { title: 'Live Score Tracker', text: `Join room ${roomCode}`, url }; try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(url); alert('Join link copied.'); } } catch (error) { if (error.name !== 'AbortError') alert('Could not share the room.'); } }

window.liveSync = {
  hostStateChanged() { if (role !== 'host' || applyingRemote) return; clearTimeout(syncTimer); syncTimer = setTimeout(pushHostState, 180); },
  serverNow: () => isConnected() ? now() : Date.now(), isViewer: () => isConnected() && role !== 'host', isHost: () => role === 'host', isConnected, isApplyingCommand: () => applyingCommand,
  submitReverse, requestAction, recordHostAction(type, payload) { if (role === 'host' && !applyingCommand) addActivity(type, payload, 'host action').catch(console.error); },
  presentationMeta: () => ({ connected: connectedCount, roomCode, role }), renderPresentationQr(target) { if (target && roomId) renderQr(target, 150); }
};

ui.host.addEventListener('click', hostRoom); ui.showJoin.addEventListener('click', () => ui.joinBox.classList.remove('hidden')); ui.cancel.addEventListener('click', () => ui.joinBox.classList.add('hidden')); ui.join.addEventListener('click', joinByCode); ui.codeInput.addEventListener('input', () => ui.codeInput.value = ui.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); ui.codeInput.addEventListener('keydown', event => { if (event.key === 'Enter') joinByCode(); }); ui.leave.addEventListener('click', leaveRoom);
ui.copy.addEventListener('click', async () => { await navigator.clipboard.writeText(roomCode); alert('Room code copied.'); }); ui.share.addEventListener('click', shareRoom); ui.expandQr.addEventListener('click', () => { ui.overlayRoomCode.textContent = roomCode; renderQr(ui.overlayQr, 380); ui.qrOverlay.classList.remove('hidden'); }); ui.closeQrOverlay.addEventListener('click', () => ui.qrOverlay.classList.add('hidden')); ui.qrOverlay.addEventListener('click', event => { if (event.target === ui.qrOverlay) ui.qrOverlay.classList.add('hidden'); });
ui.scoreboardMode.addEventListener('click', () => { const enabled = !document.body.classList.contains('scoreboard-display'); document.body.classList.toggle('scoreboard-display', enabled); document.getElementById('scoreboardPresentation')?.classList.toggle('hidden', !enabled); ui.scoreboardMode.textContent = enabled ? 'Exit Scoreboard' : 'Full-screen Scoreboard'; document.getElementById('scoreboardExit')?.remove(); if (enabled) { window.v5Features?.renderPresentation?.(); const button = document.createElement('button'); button.id = 'scoreboardExit'; button.className = 'primary scoreboard-exit'; button.textContent = 'Exit Scoreboard'; button.onclick = () => ui.scoreboardMode.click(); document.body.appendChild(button); } });
ui.displayName.value = safeText(localStorage.getItem(MEMBER_NAME_KEY), 'Guest'); ui.memberMode.value = localStorage.getItem(MEMBER_MODE_KEY) === 'viewer' ? 'viewer' : 'player'; ui.displayName.addEventListener('change', () => { const name = safeText(ui.displayName.value, 'Guest'); ui.displayName.value = name; localStorage.setItem(MEMBER_NAME_KEY, name); if (isConnected()) registerMember().catch(console.error); }); ui.memberMode.addEventListener('change', () => { localStorage.setItem(MEMBER_MODE_KEY, memberMode()); if (isConnected()) registerMember().catch(console.error); }); ui.actionType.addEventListener('change', updateRequestBuilder); ui.reverse.addEventListener('click', submitReverse); ui.submitRequest.addEventListener('click', () => requestAction(ui.actionType.value));

if (!configured) { status('Live mode needs Firebase setup. Local features still work.'); ui.host.disabled = true; ui.showJoin.disabled = true; }
else {
  const app = initializeApp(firebaseConfig); auth = getAuth(app); db = getDatabase(app); serverOffsetUnsubscribe = onValue(ref(db, '.info/serverTimeOffset'), snapshot => { serverTimeOffset = Number(snapshot.val()) || 0; }); onAuthStateChanged(auth, next => { user = next; });
  const hashMatch = location.hash.match(/^#live=([a-f0-9]{32})$/i);
  if (hashMatch) joinByRoomId(hashMatch[1]);
  else {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (saved?.roomId && Date.now() - Number(saved.savedAt || 0) < 7 * 24 * 60 * 60 * 1000) { roomId = saved.roomId; roomCode = saved.roomCode; ensureAuth().then(async () => { const snapshot = await get(ref(db, roomPath())); if (!snapshot.exists()) return cleanupSessionUi(); currentRoom = snapshot.val(); const fresh = !Number(currentRoom.updatedAt) || now() - Number(currentRoom.updatedAt) < 7 * 24 * 60 * 60 * 1000; if (!fresh || currentRoom.active === false) return cleanupSessionUi(); role = effectiveRole(currentRoom); await registerMember(); subscribe(); showRoom(); status(`Reconnected to room ${roomCode}.`, 'connected'); }).catch(cleanupSessionUi); }
      else if (saved) cleanupSessionUi();
    } catch { localStorage.removeItem(SESSION_KEY); }
  }
}

window.addEventListener('online', () => { if (role) status('Connection restored. Synchronizing…', 'connecting'); if (role === 'host') pushHostState(); }); window.addEventListener('offline', () => status(role ? 'Offline. Requests will resume when connected.' : 'Offline. Standalone mode is available.', 'offline')); window.addEventListener('pagehide', () => { clearTimeout(syncTimer); roomUnsubscribe?.(); roomUnsubscribe = null; }); window.addEventListener('pageshow', event => { if (event.persisted && role && roomId && !roomUnsubscribe) subscribe(); });
