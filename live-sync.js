import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getDatabase, ref, set, get, onValue, remove, update, serverTimestamp, onDisconnect }  from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';

const $ = id => document.getElementById(id);
const ui = {
  status: $('liveStatus'), badge: $('connectionBadge'), start: $('liveStartControls'),
  showJoin: $('showJoinControls'), joinBox: $('joinControls'), codeInput: $('roomCodeInput'),
  join: $('joinLiveGame'), cancel: $('cancelJoin'), host: $('hostLiveGame'),
  details: $('liveRoomDetails'), code: $('liveRoomCode'), qr: $('qrCode'),
  copy: $('copyRoomCode'), share: $('shareLiveRoom'), leave: $('leaveLiveRoom'), viewer: $('viewerNotice'),
  viewerCount: $('viewerCount'), expandQr: $('expandQr'), qrOverlay: $('qrOverlay'), closeQrOverlay: $('closeQrOverlay'),
  overlayQr: $('overlayQr'), overlayRoomCode: $('overlayRoomCode'), scoreboardMode: $('scoreboardMode')
};

let auth, db, user, roomId = null, roomCode = null, role = null, unsubscribe = null, syncTimer = null, applyingRemote = false, presenceDisconnect = null, serverTimeOffset = 0, connectedCount = 1, serverOffsetUnsubscribe = null;
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('PASTE_');

function status(text, kind='offline') {
  ui.status.textContent = text;
  ui.badge.textContent = kind === 'connected' ? 'Connected' : kind === 'connecting' ? 'Connecting…' : 'Offline';
  ui.badge.className = `connection-badge ${kind}`;
}
function randomId(bytes=16) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return [...data].map(v => v.toString(16).padStart(2,'0')).join('');
}
function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const data = crypto.getRandomValues(new Uint8Array(6));
  return [...data].map(v => alphabet[v % alphabet.length]).join('');
}
function joinUrl(id) {
  const url = new URL(location.href);
  url.hash = `live=${id}`;
  return url.toString();
}
async function registerPresence() {
  if (!db || !user || !roomId || !role) return;
  const presenceRef = ref(db, `rooms/${roomId}/presence/${user.uid}`);
  try {
    presenceDisconnect = onDisconnect(presenceRef);
    await presenceDisconnect.remove();
    await set(presenceRef, { role, connectedAt: serverTimestamp() });
  } catch (error) { console.error('Presence registration failed', error); }
}

function renderQr(target, size=170) {
  target.innerHTML = '';
  if (window.QRCode && roomId) new window.QRCode(target, { text: joinUrl(roomId), width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M });
}

function showRoom() {
  ui.start.classList.add('hidden'); ui.joinBox.classList.add('hidden'); ui.details.classList.remove('hidden');
  ui.code.textContent = roomCode || '------';
  ui.viewer.classList.toggle('hidden', role !== 'viewer');
  window.setLiveViewerMode?.(role === 'viewer');
  ui.qr.innerHTML = '';
  if (role === 'host') { renderQr(ui.qr, 170); ui.qr.classList.remove('hidden'); ui.expandQr.classList.remove('hidden'); }
  else { ui.qr.classList.add('hidden'); ui.expandQr.classList.add('hidden'); }
  ui.scoreboardMode.textContent = document.body.classList.contains('scoreboard-display') ? 'Exit Scoreboard' : 'Full-screen Scoreboard';
}
function resetUi() {
  window.rebaseLiveTimer?.(Date.now());
  clearTimeout(syncTimer); syncTimer = null; unsubscribe?.(); unsubscribe = null; presenceDisconnect?.cancel?.(); presenceDisconnect = null; roomId = roomCode = role = null; connectedCount = 1;
  localStorage.removeItem('uno-live-session-v1');
  ui.start.classList.remove('hidden'); ui.details.classList.add('hidden'); ui.joinBox.classList.add('hidden'); ui.viewer.classList.add('hidden'); ui.qr.classList.remove('hidden');
  window.setLiveViewerMode?.(false); document.body.classList.remove('scoreboard-display'); ui.viewerCount.classList.add('hidden'); status('Local game only.');
  history.replaceState(null, '', `${location.pathname}${location.search}`);
}
async function ensureAuth() {
  if (!configured) throw new Error('Firebase has not been configured yet.');
  if (user) return user;
  await signInAnonymously(auth);
  return new Promise(resolve => { const stop = onAuthStateChanged(auth, u => { if (u) { user=u; stop(); resolve(u); } }); });
}
async function makeUniqueCode(id) {
  for (let i=0;i<12;i++) {
    const code=randomCode(); const snap=await get(ref(db, `roomCodes/${code}`));
    if (!snap.exists()) { await set(ref(db, `roomCodes/${code}`), { roomId:id, hostUid:user.uid, createdAt:serverTimestamp() }); return code; }
  }
  throw new Error('Could not generate a room code. Please try again.');
}
async function hostRoom() {
  try {
    status('Creating secure live room…','connecting'); await ensureAuth();
    roomId=randomId(); roomCode=await makeUniqueCode(roomId); window.rebaseLiveTimer?.(Date.now() + serverTimeOffset); role='host';
    await set(ref(db, `rooms/${roomId}`), { hostUid:user.uid, code:roomCode, createdAt:serverTimestamp(), updatedAt:serverTimestamp(), game:window.getLiveGameState() });
    localStorage.setItem('uno-live-session-v1', JSON.stringify({roomId,roomCode,role,savedAt:Date.now()}));
    showRoom(); subscribe(); await registerPresence(); status(`Hosting room ${roomCode}. Viewers are read-only.`,'connected');
  } catch(e) { console.error(e); status(e.message || 'Could not create room.'); alert(e.message || 'Could not create live room.'); }
}
async function joinByRoomId(id) {
  try {
    status('Joining room…','connecting'); await ensureAuth();
    const snap=await get(ref(db, `rooms/${id}`));
    if (!snap.exists()) throw new Error('That live room does not exist or has ended.');
    roomId=id; roomCode=snap.val().code || '------'; role='viewer';
    localStorage.setItem('uno-live-session-v1', JSON.stringify({roomId,roomCode,role,savedAt:Date.now()}));
    subscribe(); showRoom(); await registerPresence(); status(`Watching room ${roomCode}.`,'connected');
  } catch(e) { console.error(e); status(e.message || 'Could not join room.'); alert(e.message || 'Could not join room.'); }
}
async function joinByCode() {
  const code=ui.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
  if (code.length !== 6) return alert('Enter the 6-character room code.');
  try {
    status('Looking up room…','connecting'); await ensureAuth();
    const snap=await get(ref(db, `roomCodes/${code}`));
    if (!snap.exists()) throw new Error('Room code not found or the game has ended.');
    await joinByRoomId(snap.val().roomId);
  } catch(e) { console.error(e); status(e.message || 'Could not join room.'); alert(e.message || 'Could not join room.'); }
}
function subscribe() {
  unsubscribe?.();
  unsubscribe=onValue(ref(db, `rooms/${roomId}`), snap => {
    if (!snap.exists()) { alert('The host ended this live game.'); resetUi(); return; }
    const room = snap.val();
    if (role === 'viewer') { applyingRemote=true; window.applyLiveGameState?.(room.game); applyingRemote=false; }
    const connected = Object.keys(room.presence || {}).length; connectedCount = Math.max(1, connected);
    const hostConnected = Object.values(room.presence || {}).some(entry => entry?.role === 'host');
    ui.viewerCount.textContent = `👥 ${connected} connected`; ui.viewerCount.classList.remove('hidden');
    status(role === 'host' ? `Hosting room ${roomCode}. Viewers are read-only.` : hostConnected ? `Watching room ${roomCode}.` : 'Host disconnected. Waiting for the host to reconnect…', hostConnected || role === 'host' ? 'connected' : 'connecting');
    window.v5Features?.renderPresentation?.();
  }, err => { console.error(err); status('Connection lost. Reconnecting…','connecting'); });
}
async function pushHostState() {
  if (role !== 'host' || !roomId || applyingRemote) return;
  const game = window.getLiveGameState();
  if (!game || !Array.isArray(game.names) || game.names.length < 2 || game.names.length > 10 || !Array.isArray(game.scores) || game.scores.length !== game.names.length) return status('Invalid game state was not synchronized.','connecting');
  try { await update(ref(db, `rooms/${roomId}`), { game, updatedAt: serverTimestamp() }); }
  catch(e) { console.error(e); status('Could not sync. Check connection.','connecting'); }
}
window.liveSync = {
  hostStateChanged() { if (role !== 'host' || applyingRemote) return; clearTimeout(syncTimer); syncTimer=setTimeout(pushHostState,180); },
  serverNow() { return role ? Date.now() + serverTimeOffset : Date.now(); },
  isViewer() { return role === 'viewer'; },
  isHost() { return role === 'host'; },
  presentationMeta() { return { connected: connectedCount, roomCode, role }; },
  renderPresentationQr(target) { if (target && roomId) renderQr(target, 150); }
};
async function leaveRoom() {
  if (role === 'host' && roomId) {
    if (!confirm('End this live room for every viewer?')) return;
    try { await remove(ref(db, `rooms/${roomId}`)); if (roomCode) await remove(ref(db, `roomCodes/${roomCode}`)); } catch(e) { console.error(e); }
  }
  resetUi();
}
async function shareRoom() {
  const url=joinUrl(roomId); const data={title:'Live Score Tracker',text:`Join room ${roomCode} as a viewer`,url};
  try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(url); alert('Join link copied.'); } } catch(e) { if (e.name !== 'AbortError') alert('Could not share the room.'); }
}

ui.host.addEventListener('click',hostRoom); ui.showJoin.addEventListener('click',()=>ui.joinBox.classList.remove('hidden'));
ui.cancel.addEventListener('click',()=>ui.joinBox.classList.add('hidden')); ui.join.addEventListener('click',joinByCode);
ui.codeInput.addEventListener('input',()=>ui.codeInput.value=ui.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
ui.codeInput.addEventListener('keydown',e=>{if(e.key==='Enter')joinByCode();}); ui.leave.addEventListener('click',leaveRoom);
ui.copy.addEventListener('click',async()=>{await navigator.clipboard.writeText(roomCode); alert('Room code copied.');}); ui.share.addEventListener('click',shareRoom);
ui.expandQr.addEventListener('click',()=>{ ui.overlayRoomCode.textContent=roomCode; renderQr(ui.overlayQr, 380); ui.qrOverlay.classList.remove('hidden'); });
ui.closeQrOverlay.addEventListener('click',()=>ui.qrOverlay.classList.add('hidden'));
ui.qrOverlay.addEventListener('click',e=>{ if(e.target===ui.qrOverlay) ui.qrOverlay.classList.add('hidden'); });
ui.scoreboardMode.addEventListener('click',()=>{ const enabled = !document.body.classList.contains('scoreboard-display'); document.body.classList.toggle('scoreboard-display', enabled); document.getElementById('scoreboardPresentation')?.classList.toggle('hidden', !enabled); ui.scoreboardMode.textContent=enabled?'Exit Scoreboard':'Full-screen Scoreboard'; if(enabled) { window.v5Features?.renderPresentation?.(); const b=document.createElement('button'); b.id='scoreboardExit'; b.className='primary scoreboard-exit'; b.textContent='Exit Scoreboard'; b.onclick=()=>ui.scoreboardMode.click(); document.body.appendChild(b); } else document.getElementById('scoreboardExit')?.remove(); });

if (!configured) {
  status('Live mode needs Firebase setup. Local features still work.');
  ui.host.disabled=true; ui.showJoin.disabled=true;
} else {
  const app=initializeApp(firebaseConfig); auth=getAuth(app); db=getDatabase(app);
  serverOffsetUnsubscribe = onValue(ref(db, '.info/serverTimeOffset'), snap => { serverTimeOffset = Number(snap.val()) || 0; });
  onAuthStateChanged(auth,u=>{user=u;});
  const hashMatch=location.hash.match(/^#live=([a-f0-9]{32})$/i);
  if (hashMatch) joinByRoomId(hashMatch[1]);
  else {
    try {
      const saved=JSON.parse(localStorage.getItem('uno-live-session-v1'));
      if (saved?.roomId && ['host','viewer'].includes(saved?.role) && (!saved.savedAt || Date.now()-saved.savedAt < 7*24*60*60*1000)) { roomId=saved.roomId; roomCode=saved.roomCode; role=saved.role; ensureAuth().then(async()=>{ const snap=await get(ref(db,`rooms/${roomId}`)); const room=snap.val(); const fresh=room && (!Number(room.updatedAt) || Date.now()+serverTimeOffset-Number(room.updatedAt) < 7*24*60*60*1000); const allowed=snap.exists() && fresh && (role==='viewer' || room.hostUid===user.uid); if(allowed){ roomCode=room.code || roomCode; showRoom(); subscribe(); await registerPresence(); status(role==='host' ? `Hosting room ${roomCode}. Viewers are read-only.` : `Reconnected to room ${roomCode}.`,'connected'); } else resetUi(); }).catch(resetUi); }
      else if (saved) resetUi();
    } catch {}
  }
}

window.addEventListener('online', () => { if (role) status('Connection restored. Synchronizing…','connecting'); if (role === 'host') pushHostState(); });
window.addEventListener('offline', () => status(role ? 'Offline. Changes remain saved on this device.' : 'Offline. Standalone mode is available.','offline'));
window.addEventListener('pagehide', () => { clearTimeout(syncTimer); unsubscribe?.(); unsubscribe = null; });
window.addEventListener('pageshow', event => { if (event.persisted && role && roomId && !unsubscribe) subscribe(); });
