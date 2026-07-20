import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getDatabase, ref, set, get, onValue, remove, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';

const $ = id => document.getElementById(id);
const ui = {
  status: $('liveStatus'), badge: $('connectionBadge'), start: $('liveStartControls'),
  showJoin: $('showJoinControls'), joinBox: $('joinControls'), codeInput: $('roomCodeInput'),
  join: $('joinLiveGame'), cancel: $('cancelJoin'), host: $('hostLiveGame'),
  details: $('liveRoomDetails'), code: $('liveRoomCode'), qr: $('qrCode'),
  copy: $('copyRoomCode'), share: $('shareLiveRoom'), leave: $('leaveLiveRoom'), viewer: $('viewerNotice')
};

let auth, db, user, roomId = null, roomCode = null, role = null, unsubscribe = null, syncTimer = null, applyingRemote = false;
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
function showRoom() {
  ui.start.classList.add('hidden'); ui.joinBox.classList.add('hidden'); ui.details.classList.remove('hidden');
  ui.code.textContent = roomCode || '------';
  ui.viewer.classList.toggle('hidden', role !== 'viewer');
  window.setLiveViewerMode?.(role === 'viewer');
  ui.qr.innerHTML = '';
  if (role === 'host' && window.QRCode) new window.QRCode(ui.qr, { text: joinUrl(roomId), width: 170, height: 170, correctLevel: window.QRCode.CorrectLevel.M });
  else ui.qr.classList.add('hidden');
}
function resetUi() {
  unsubscribe?.(); unsubscribe = null; roomId = roomCode = role = null;
  localStorage.removeItem('uno-live-session-v1');
  ui.start.classList.remove('hidden'); ui.details.classList.add('hidden'); ui.joinBox.classList.add('hidden'); ui.viewer.classList.add('hidden'); ui.qr.classList.remove('hidden');
  window.setLiveViewerMode?.(false); status('Local game only.');
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
    roomId=randomId(); roomCode=await makeUniqueCode(roomId); role='host';
    await set(ref(db, `rooms/${roomId}`), { hostUid:user.uid, code:roomCode, createdAt:serverTimestamp(), updatedAt:serverTimestamp(), game:window.getLiveGameState() });
    localStorage.setItem('uno-live-session-v1', JSON.stringify({roomId,roomCode,role}));
    showRoom(); status(`Hosting room ${roomCode}. Viewers are read-only.`,'connected');
  } catch(e) { console.error(e); status(e.message || 'Could not create room.'); alert(e.message || 'Could not create live room.'); }
}
async function joinByRoomId(id) {
  try {
    status('Joining room…','connecting'); await ensureAuth();
    const snap=await get(ref(db, `rooms/${id}`));
    if (!snap.exists()) throw new Error('That live room does not exist or has ended.');
    roomId=id; roomCode=snap.val().code || '------'; role='viewer';
    localStorage.setItem('uno-live-session-v1', JSON.stringify({roomId,roomCode,role}));
    subscribe(); showRoom(); status(`Watching room ${roomCode}.`,'connected');
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
    if (role === 'viewer') { applyingRemote=true; window.applyLiveGameState?.(snap.val().game); applyingRemote=false; }
    status(role === 'host' ? `Hosting room ${roomCode}. Viewers are read-only.` : `Watching room ${roomCode}.`,'connected');
  }, err => { console.error(err); status('Connection lost. Reconnecting…','connecting'); });
}
async function pushHostState() {
  if (role !== 'host' || !roomId || applyingRemote) return;
  try { await set(ref(db, `rooms/${roomId}/game`), window.getLiveGameState()); await set(ref(db, `rooms/${roomId}/updatedAt`), serverTimestamp()); }
  catch(e) { console.error(e); status('Could not sync. Check connection.','connecting'); }
}
window.liveSync = { hostStateChanged() { if (role !== 'host' || applyingRemote) return; clearTimeout(syncTimer); syncTimer=setTimeout(pushHostState,180); } };
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

if (!configured) {
  status('Live mode needs Firebase setup. Local features still work.');
  ui.host.disabled=true; ui.showJoin.disabled=true;
} else {
  const app=initializeApp(firebaseConfig); auth=getAuth(app); db=getDatabase(app);
  onAuthStateChanged(auth,u=>{user=u;});
  const hashMatch=location.hash.match(/^#live=([a-f0-9]{32})$/i);
  if (hashMatch) joinByRoomId(hashMatch[1]);
  else {
    try {
      const saved=JSON.parse(localStorage.getItem('uno-live-session-v1'));
      if (saved?.roomId && saved?.role === 'host') { roomId=saved.roomId; roomCode=saved.roomCode; role='host'; ensureAuth().then(async()=>{ const snap=await get(ref(db,`rooms/${roomId}`)); if(snap.exists() && snap.val().hostUid===user.uid){showRoom();subscribe();status(`Hosting room ${roomCode}. Viewers are read-only.`,'connected');} else resetUi(); }); }
    } catch {}
  }
}
