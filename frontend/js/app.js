/* =================== ICONS (Lucide-style, stroke) =================== */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  barChart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  map: '<path d="M14.1 5.6a2 2 0 0 0 1.8 0l3.7-1.9a1 1 0 0 1 1.4.9v12.8a1 1 0 0 1-.6.9l-4.5 2.3a2 2 0 0 1-1.8 0l-4.2-2.1a2 2 0 0 0-1.8 0l-3.7 1.9a1 1 0 0 1-1.4-.9V6.6a1 1 0 0 1 .6-.9l4.5-2.3a2 2 0 0 1 1.8 0z"/><path d="M15 5.8v15"/><path d="M9 3.2v15"/>',
  package: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><line x1="2" y1="12" x2="22" y2="12"/>',
  fileCode: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 12-2 2 2 2"/><path d="m14 16 2-2-2-2"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  play: '<path d="m6 3 14 9-14 9V3z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  crown: '<path d="M11.6 3.3a.5.5 0 0 1 .8 0l3 5.6a1 1 0 0 0 1.5.3l2.3-2a.5.5 0 0 1 .8.5l-2.8 10.2a1 1 0 0 1-1 .7H7.8a1 1 0 0 1-1-.7L4 7.7a.5.5 0 0 1 .8-.5l2.3 2a1 1 0 0 0 1.5-.3z"/><path d="M5 21h14"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M1 9h3"/><path d="M1 15h3"/><path d="M20 9h3"/><path d="M20 15h3"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  activity: '<path d="M22 12h-2.5a2 2 0 0 0-1.9 1.5l-2.4 8.4a.25.25 0 0 1-.5 0L9.2 2.2a.25.25 0 0 0-.4 0L6.3 10.5A2 2 0 0 1 4.5 12H2"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.86a10 10 0 0 1 14 0"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronsUpDown: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sliders: '<line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="2" x2="14" y2="6"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="16" y1="18" x2="16" y2="22"/>',
  bell: '<path d="M10.3 21a2 2 0 0 0 3.4 0"/><path d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3"/>',
  umbrella: '<path d="M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2z"/><path d="M12 12v7a2 2 0 0 0 4 0"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  pickaxe: '<path d="M14.5 3.5 12 6 9.5 3.5a1 1 0 0 0-1.4 0L6.7 4.9a1 1 0 0 0 0 1.4L9.2 8.8 3 15v6h6l6.2-6.2 2.5 2.5a1 1 0 0 0 1.4 0l1.4-1.4a1 1 0 0 0 0-1.4L18 12l2.5-2.5"/>',
};
function icon(name, size=16){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||ICONS.box}</svg>`;
}
function hydrateIcons(root=document){
  root.querySelectorAll('i[data-icon]').forEach(el=>{
    el.outerHTML = icon(el.dataset.icon, parseInt(el.dataset.size||'16'));
  });
}

/* =================== STATE =================== */
const state = {
  online: false,
  players: [],
  backups: [],
  events: [],
  crashes: [],
  audit: [],
  servers: [],
  currentServerId: null,
  uptimeSec: 0,
  playersHistory: [], cpuHistory: [], ramHistory: [],
  autoscroll: true,
  currentFile: 'server.properties',
  currentCrash: 0,
  modTab: 'explore',
  lastHits: [],
};
/* servidor seleccionado, buscado por id (los índices bailan al crear/borrar) */
function curServer(){ return state.servers.find(s=>s.id===state.currentServerId) || state.servers[0]; }

/* =================== NAV =================== */
const NAV = [
  { group:'SERVIDOR', items:[
    { id:'dashboard', label:'Dashboard', ic:'dashboard' },
    { id:'console', label:'Consola', ic:'terminal' },
    { id:'players', label:'Jugadores', ic:'users', badge:'navPlayerCount' },
    { id:'stats', label:'Estadísticas', ic:'barChart' },
    { id:'map', label:'Mapa en vivo', ic:'map', soon:true },
  ]},
  { group:'CONTENIDO', items:[
    { id:'mods', label:'Mods', ic:'package', badge:'navModCount', badgeWarn:true },
    { id:'world', label:'Mundo', ic:'globe' },
    { id:'files', label:'Archivos', ic:'fileCode' },
  ]},
  { group:'OPERACIONES', items:[
    { id:'events', label:'Eventos', ic:'calendar' },
    { id:'backups', label:'Backups', ic:'database' },
    { id:'crashes', label:'Diagnóstico', ic:'alert' },
  ]},
  { group:'SISTEMA', items:[
    { id:'integrations', label:'Integraciones', ic:'share' },
    { id:'audit', label:'Auditoría', ic:'list' },
  ]},
];
const titles = {};
document.getElementById('navContainer').innerHTML = NAV.map(g =>
  `<div class="nav-group">${g.group}</div>` +
  g.items.map(it=>{
    titles[it.id] = it.label;
    return `<div class="nav-item${it.id==='dashboard'?' active':''}" data-section="${it.id}">
      ${icon(it.ic,16)} ${it.label}
      ${it.demo?'<span class="nav-badge" style="background:rgba(255,255,255,.06);color:var(--muted)">demo</span>':''}
      ${it.soon?'<span class="nav-badge" style="background:var(--violet-dim);color:var(--violet)">próximamente</span>':''}
      ${it.badge?`<span class="nav-badge${it.badgeWarn?' warn':''}" id="${it.badge}"></span>`:''}
    </div>`;
  }).join('')
).join('');

function go(id){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.section===id));
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('visible'));
  const el = document.getElementById('sec-'+id);
  el.classList.remove('visible'); void el.offsetWidth;
  el.classList.add('visible');
  document.getElementById('pageTitle').textContent = titles[id];
  if(id==='map') requestAnimationFrame(drawMapBase);
  if(id==='world' && typeof loadWorld==='function'){ loadWorld(); loadResources(); }
  if(id==='files') loadFiles();
  if(id==='audit') loadAudit();
  if(id==='backups') loadBackups();
  if(id==='stats') loadStats();
  if(id==='crashes') loadCrashes();
  if(id==='events') loadEvents();
  if(id==='integrations') loadIntegrations();
  if(id==='mods'){ renderModFilters(); loadInstalledMods(); if(state.modTab==='explore') searchModrinth(document.getElementById('modSearch').value.trim(), 0); }
  if(id==='players' && typeof refreshPlayerLists==='function'){ refreshPlayerLists().then(()=>renderWhitelist()); loadPlayersExtras(); }
}
document.querySelectorAll('.nav-item').forEach(item=>{
  item.addEventListener('click', ()=>go(item.dataset.section));
});

/* =================== SERVER SWITCHER =================== */
document.getElementById('logoMark').innerHTML = icon('pickaxe',17);
document.getElementById('umbrelIcon').innerHTML = icon('umbrella',13);
document.getElementById('ssChevron').innerHTML = icon('chevronsUpDown',14);
function renderServerMenu(){
  document.getElementById('ssMenu').innerHTML = state.servers.map((s,i)=>`
    <div class="ss-item" onclick="pickServer(${i})">
      <span class="ss-dot" style="background:${s.status==='online'?'var(--accent)':'var(--danger)'}"></span>
      ${s.name}<small>${s.status==='online'?'en línea':'detenido'}</small>
    </div>`).join('') +
    `<div class="ss-item" style="color:var(--muted2)" onclick="openCreateWizard()">${icon('plus',14)} Crear servidor…</div>`;
}
function toggleServerMenu(e){ e.stopPropagation(); document.getElementById('ssMenu').classList.toggle('open'); }
document.addEventListener('click', ()=>document.getElementById('ssMenu').classList.remove('open'));
function pickServer(i){
  const s = state.servers[i];
  if(!s) return;
  state.currentServerId = s.id;
  document.getElementById('ssName').textContent = s.name;
  document.getElementById('ssSub').textContent = s.sub;
  document.getElementById('ssDot').style.background = s.status==='online'?'var(--accent)':'var(--danger)';
  if(typeof onServerSwitched==='function') onServerSwitched();
}
renderServerMenu();

/* =================== TOASTS =================== */
const TOAST_COLORS = { ok:['var(--accent-dim)','var(--accent)'], warn:['var(--warn-dim)','var(--warn)'], err:['var(--danger-dim)','var(--danger)'], info:['var(--info-dim)','var(--info)'] };
function toast(ic, msg, type='ok'){
  const [bg,color] = TOAST_COLORS[type]||TOAST_COLORS.ok;
  const zone = document.getElementById('toastZone');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="t-icon" style="background:${bg};color:${color}">${icon(ic,15)}</span><span>${msg}</span>`;
  zone.appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),340); }, 4200);
}
function copied(){ toast('check','Copiado al portapapeles','ok'); }

/* =================== AUDIT =================== */
const AUDIT_COLORS = { info:['var(--info-dim)','var(--info)'], warn:['var(--warn-dim)','var(--warn)'], err:['var(--danger-dim)','var(--danger)'], ok:['var(--accent-dim)','var(--accent)'] };
function addAudit(ic, text, type='info', when=null){
  state.audit.unshift({ ic, text, type, when: when || new Date().toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) });
  if(state.audit.length>60) state.audit.pop();
  renderAudit();
}
function renderAudit(){
  document.getElementById('auditList').innerHTML = state.audit.map((a,i)=>{
    const [bg,color] = AUDIT_COLORS[a.type]||AUDIT_COLORS.info;
    return `<div class="audit-row" style="animation-delay:${Math.min(i*0.03,.3)}s">
      <span class="audit-time">${a.when}</span>
      <span class="audit-icon" style="background:${bg};color:${color}">${icon(a.ic,13)}</span>
      <span><b style="font-weight:620">isma</b> · ${a.text}</span>
    </div>`;
  }).join('') || '<div class="empty">Sin actividad registrada</div>';
}
async function loadAudit(){
  try {
    const rows = await API.get('/audit');
    state.audit = rows.map(r=>({
      ic: ICONS[r.action] ? r.action : 'list',
      text: r.detail,
      type: r.level,
      when: new Date(r.at).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}),
    }));
    renderAudit();
    renderActivity();
  } catch { /* backend no disponible */ }
}
function renderActivity(){
  const colors = { info:'var(--info)', warn:'var(--warn)', err:'var(--danger)', ok:'var(--accent)' };
  document.getElementById('activityFeed').innerHTML = state.audit.slice(0,5).map(a=>`
    <div style="display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12.5px;">
      <span style="color:${colors[a.type]||'var(--muted2)'};display:flex">${icon(a.ic,14)}</span>
      <span style="flex:1">${a.text}</span>
      <span style="color:var(--muted);font-size:11.5px">${a.when}</span>
    </div>`).join('') || '<div class="empty" style="padding:16px">Sin actividad todavía</div>';
}

/* =================== SERVER LIFECYCLE =================== */
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnRestart = document.getElementById('btnRestart');
btnStop.innerHTML = icon('stop',14)+' Detener';
btnRestart.innerHTML = icon('refresh',14)+' Reiniciar';
btnStart.innerHTML = icon('play',14)+' Iniciar';

function setStatus(mode){
  statusDot.className = 'dot '+mode;
  if(mode==='online'){ statusText.textContent='En línea'; state.online=true; btnStart.disabled=true; btnStop.disabled=false; btnRestart.disabled=false; }
  if(mode==='offline'){ statusText.textContent='Detenido'; state.online=false; btnStart.disabled=false; btnStop.disabled=true; btnRestart.disabled=true; }
  // Detener sigue disponible durante el arranque: si se atasca, hay salida
  if(mode==='starting'){ statusText.textContent='Arrancando…'; btnStart.disabled=true; btnStop.disabled=false; btnRestart.disabled=true; }
}
btnStop.onclick = async ()=>{
  try { btnStop.disabled = true; await API.post(`/servers/${curServerId()}/stop`); toast('stop','Servidor detenido','warn'); }
  catch(err){ toast('alert', err.message, 'err'); btnStop.disabled = false; }
};
btnStart.onclick = async ()=>{
  try { btnStart.disabled = true; toast('play','Arrancando servidor…','info'); await API.post(`/servers/${curServerId()}/start`); }
  catch(err){ toast('alert', err.message, 'err'); btnStart.disabled = false; }
};
btnRestart.onclick = async ()=>{
  try { btnRestart.disabled = true; toast('refresh','Reiniciando servidor…','info'); await API.post(`/servers/${curServerId()}/restart`); }
  catch(err){ toast('alert', err.message, 'err'); btnRestart.disabled = false; }
};

/* =================== CONSOLE =================== */
const consoleBody = document.getElementById('consoleBody');
function ts(){ return new Date().toTimeString().slice(0,8); }
function logLine(type,text){
  const cls = {info:'tag-info',warn:'tag-warn',err:'tag-err',cmd:'tag-cmd'}[type];
  const tag = {info:'INFO',warn:'WARN',err:'ERROR',cmd:'CMD'}[type];
  const line = document.createElement('div');
  line.className = 'console-line';
  line.innerHTML = `<span class="time">${ts()}</span> <span class="${cls}">${tag}</span> ${text}`;
  consoleBody.appendChild(line);
  if(consoleBody.children.length>300) consoleBody.firstChild.remove();
  if(state.autoscroll) consoleBody.scrollTop = consoleBody.scrollHeight;
}
function clearConsole(){ consoleBody.innerHTML=''; logLine('info','Consola limpiada'); }
function toggleAutoscroll(){
  state.autoscroll = !state.autoscroll;
  document.getElementById('btnAutoscroll').textContent = 'Auto-scroll: '+(state.autoscroll?'ON':'OFF');
}
const cmdInput = document.getElementById('cmdInput');
cmdInput.addEventListener('keydown', e=>{ if(e.key==='Enter') sendCommand(); });
async function sendCommand(){
  const cmd = cmdInput.value.trim();
  if(!cmd) return;
  cmdInput.value='';
  try { await API.post(`/servers/${curServerId()}/command`, { command: cmd }); }
  catch(err){ toast('alert', err.message, 'err'); }
}

/* =================== PLAYERS =================== */
function fmtDur(ms){
  const m = Math.floor(ms/60000);
  if(m<1) return 'recién conectado';
  if(m<60) return `${m} min`;
  return `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;
}
function renderPlayers(){
  const lists = state.playerLists || { ops:[], whitelist:[], banned:[] };
  const list = document.getElementById('playerList');
  if(!state.players.length) list.innerHTML = '<div class="empty">No hay nadie conectado ahora mismo</div>';
  else list.innerHTML = state.players.map((p,i)=>{
    const op = lists.ops.includes(p.name);
    return `
    <div class="player-row" style="animation-delay:${i*0.05}s">
      <div class="avatar">${p.name[0].toUpperCase()}</div>
      <div class="player-info">
        <div class="player-name">${p.name}
          ${op?'<span class="chip amber">OP</span>':''}
        </div>
        <div class="player-meta">${fmtDur(Date.now()-p.joinedAt)} en línea</div>
      </div>
      <div class="player-actions">
        <button class="icon-btn" title="${op?'Quitar OP':'Dar OP'}" onclick="playerAction('${p.name}','${op?'deop':'op'}')">${icon('crown',14)}</button>
        <button class="icon-btn red" title="Expulsar" onclick="playerAction('${p.name}','kick')">${icon('logout',14)}</button>
        <button class="icon-btn red" title="Banear" onclick="playerAction('${p.name}','ban')">${icon('ban',14)}</button>
      </div>
    </div>`;
  }).join('');
  document.getElementById('navPlayerCount').textContent = state.players.length;
  document.getElementById('statPlayers').textContent = state.players.length;
  document.getElementById('playersSubtitle').textContent =
    `${state.players.length} en línea · ${lists.whitelist.length} en whitelist · ${lists.banned.length} baneado${lists.banned.length===1?'':'s'}`;
}
async function playerAction(name, action){
  try {
    await API.post(`/servers/${curServerId()}/players/${encodeURIComponent(name)}/${action}`);
    const msgs = { op:`${name} ahora es operador`, deop:`${name} ya no es operador`, kick:`${name} expulsado`, ban:`${name} baneado` };
    toast(action==='ban'?'ban':action==='kick'?'logout':'crown', msgs[action]||name, action==='ban'?'err':action==='kick'?'warn':'ok');
    setTimeout(()=>{ if(typeof refreshPlayerLists==='function') refreshPlayerLists(); }, 600);
  } catch(err){ toast('alert', err.message, 'err'); }
}

/* ---- whitelist y cuentas ---- */
function renderWhitelist(){
  const wl = state.playerLists?.whitelist || [];
  const el = document.getElementById('wlList');
  el.innerHTML = wl.map(n=>`
    <span class="day-chip on" style="display:inline-flex; align-items:center; gap:7px;">${esc(n)}
      <a onclick="removeWhitelistName('${esc(n)}')" title="Quitar" style="cursor:pointer; display:flex; opacity:.7;">${icon('x',11)}</a>
    </span>`).join('') || '<div class="empty" style="padding:6px; font-size:12px;">Lista vacía — añade el primer nick</div>';
}
function setWlChip(on){
  const chip = document.getElementById('wlChip');
  chip.textContent = on ? 'ACTIVADA' : 'DESACTIVADA';
  chip.className = 'chip ' + (on ? 'green' : 'gray');
  document.getElementById('wlToggle').checked = on;
}
async function loadPlayersExtras(){
  const id = curServerId(); if(!id) return;
  renderWhitelist();
  try {
    state.props = await API.get(`/servers/${id}/properties`);
    setWlChip(state.props['white-list'] === 'true');
    const premium = state.props['online-mode'] !== 'false';
    document.getElementById('pmToggle').checked = premium;
    document.getElementById('pmWarn').style.display = premium ? 'none' : '';
  } catch { /* server recién creado */ }
}
async function addWhitelistName(){
  const inp = document.getElementById('wlName');
  const name = inp.value.trim();
  if(!name) return;
  try {
    await API.post(`/servers/${curServerId()}/whitelist`, { name });
    inp.value = '';
    toast('shield', `${name} añadido a la whitelist`, 'ok');
    setTimeout(async ()=>{ await refreshPlayerLists(); renderWhitelist(); }, 500);
  } catch(err){ toast('alert', err.message, 'err'); }
}
async function removeWhitelistName(name){
  try {
    await API.del(`/servers/${curServerId()}/whitelist/${encodeURIComponent(name)}`);
    toast('shield', `${name} quitado de la whitelist`, 'warn');
    setTimeout(async ()=>{ await refreshPlayerLists(); renderWhitelist(); }, 500);
  } catch(err){ toast('alert', err.message, 'err'); }
}
async function toggleWhitelistEnabled(on){
  try {
    const r = await API.put(`/servers/${curServerId()}/properties`, { 'white-list': String(on), 'enforce-whitelist': String(on) });
    setWlChip(on);
    toast(on?'shield':'x', on
      ? (r.appliedLive.length ? 'Whitelist activada — aplicada al momento' : 'Whitelist activada — se aplica al arrancar')
      : 'Whitelist desactivada — cualquiera puede entrar', on?'ok':'warn');
  } catch(err){ toast('alert', err.message, 'err'); setWlChip(!on); }
}
async function togglePremium(on){
  try {
    await API.put(`/servers/${curServerId()}/properties`, { 'online-mode': String(on) });
    document.getElementById('pmWarn').style.display = on ? 'none' : '';
    toast(on?'check':'alert', on
      ? 'Solo cuentas premium — se aplica al reiniciar el servidor'
      : 'Modo no premium activado — se aplica al reiniciar. Ojo: los nicks dejan de estar verificados', on?'ok':'warn');
  } catch(err){ toast('alert', err.message, 'err'); }
}

/* ---- rendimiento (RAM / núcleos / auto-reinicio) ---- */
function loadResources(){
  const meta = curServer()?.meta;
  if(!meta) return;
  const gb = Math.round((meta.memoryMb || 4096) / 1024);
  document.getElementById('resRam').value = gb;
  document.getElementById('resRamVal').textContent = gb;
  document.getElementById('resCores').value = String(meta.cpuCores || 0);
  document.getElementById('resAutoRestart').checked = meta.autoRestart !== false;
}
async function saveResources(){
  const memoryMb = parseInt(document.getElementById('resRam').value) * 1024;
  const cpuCores = parseInt(document.getElementById('resCores').value);
  const autoRestart = document.getElementById('resAutoRestart').checked;
  try {
    const r = await API.put(`/servers/${curServerId()}/settings`, { memoryMb, cpuCores, autoRestart });
    const meta = curServer()?.meta;
    if(meta){ meta.memoryMb = memoryMb; meta.cpuCores = cpuCores; meta.autoRestart = autoRestart; }
    toast('cpu', `Rendimiento guardado${r.needsRestart ? ' — se aplica al reiniciar' : ''}`, 'ok');
  } catch(err){ toast('alert', err.message, 'err'); }
}

/* =================== STATS TABLE =================== */
async function loadStats(){
  const id = curServerId(); if(!id) return;
  let players = [];
  try { ({ players } = await API.get(`/servers/${id}/stats`)); } catch { /* sin datos */ }
  document.getElementById('statsBody').innerHTML = players.map((r,i)=>`
    <tr>
      <td><span class="rank r${Math.min(i+1,3)}">${i+1}</span></td>
      <td style="font-weight:600">${esc(r.name)}</td>
      <td>${r.playTimeHours} h</td><td>${r.deaths}</td><td>${fmtNum(r.blocksMined)}</td><td>${fmtNum(r.mobKills)}</td>
      <td><span class="chip green">${r.advancements}</span></td>
    </tr>`).join('') || '<tr><td colspan="7"><div class="empty">Sin datos todavía: los jugadores tienen que entrar y jugar un rato</div></td></tr>';
}

/* =================== MODS — MODRINTH REAL =================== */
const MODRINTH_API = 'https://api.modrinth.com/v2';
function esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtNum(n){ return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':String(n); }
function curLoader(){ return curServer()?.meta?.loader; }
function curGame(){ return curServer()?.meta?.mcVersion; }
function modUpdatesBadge(){
  const n = Object.keys(state.modUpdates||{}).length;
  const b = document.getElementById('navModCount');
  b.textContent = n; b.style.display = n?'':'none';
  const btnAll = document.getElementById('btnUpdateAll');
  if(btnAll) btnAll.style.display = n ? '' : 'none';
}
function installedTabBadge(){
  const n = (state.installedMods||[]).length;
  const b = document.getElementById('tabInstalledCount');
  if(b) b.textContent = n || '';
}

async function loadInstalledMods(){
  const id = curServerId(); if(!id) return;
  try { ({ installed: state.installedMods } = await API.get(`/servers/${id}/mods`)); }
  catch { state.installedMods = []; }
  renderInstalledMods();
  const chip = document.getElementById('modLoaderChip');
  if(chip) chip.textContent = `${(curLoader()||'').toUpperCase()} ${curGame()||''}`;
}
function renderInstalledMods(){
  const el = document.getElementById('installedMods');
  const upd = state.modUpdates || {};
  installedTabBadge();
  if(curLoader()==='vanilla'){
    el.innerHTML = '<div class="empty">Este servidor es vanilla y no admite mods. Crea un servidor Fabric, Forge o NeoForge para usarlos.</div>';
    return;
  }
  const all = state.installedMods || [];
  const q = (document.getElementById('installedSearch')?.value || '').trim().toLowerCase();
  const mods = q ? all.filter(m => (m.name+' '+m.filename).toLowerCase().includes(q)) : all;
  if(!all.length){ el.innerHTML = '<div class="empty" style="padding:16px">Sin mods instalados. Ve a la pestaña «Explorar», busca e instala: las dependencias se resuelven solas.</div>'; return; }
  if(!mods.length){ el.innerHTML = `<div class="empty" style="padding:16px">Ningún mod coincide con «${esc(q)}»</div>`; return; }
  el.innerHTML = `<div class="mini-label" style="padding:4px 8px 8px">${q?`${mods.length} DE ${all.length}`:`INSTALADOS (${all.length})`} · los cambios se cargan al reiniciar</div>` + mods.map(m=>`
    <div class="player-row">
      <div class="avatar" style="color:var(--info)">${icon('package',16)}</div>
      <div class="player-info">
        <div class="player-name">${esc(m.name)}
          ${!m.enabled?'<span class="chip gray">DESACTIVADO</span>':''}
          ${upd[m.filename]?`<span class="chip amber">HAY ${esc(upd[m.filename])}</span>`:''}
          ${m.tracked?'':'<span class="chip gray">MANUAL</span>'}
        </div>
        <div class="player-meta" style="font-family:var(--mono)">${esc(m.versionNumber||m.filename)}</div>
      </div>
      ${upd[m.filename]?`<button class="btn small primary" data-f="${esc(m.filename)}" onclick="updateModUI(this)">Actualizar</button>`:''}
      <label class="switch" title="Activar / desactivar"><input type="checkbox" ${m.enabled?'checked':''} data-f="${esc(m.filename)}" onchange="toggleModUI(this)"><span class="track"></span><span class="thumb"></span></label>
      <button class="icon-btn red" data-f="${esc(m.filename)}" onclick="armAction(this, ()=>removeModUI(this))" style="width:auto;padding:0 8px">${icon('trash',13)}</button>
    </div>`).join('');
}
/* actualizar todos los mods con versión nueva, uno a uno */
async function updateAllMods(){
  const files = Object.keys(state.modUpdates||{});
  if(!files.length) return;
  const btn = document.getElementById('btnUpdateAll');
  btn.disabled = true;
  let ok = 0, fail = 0;
  for(const f of files){
    btn.textContent = `Actualizando ${ok+fail+1}/${files.length}…`;
    try {
      await API.post(`/servers/${curServerId()}/mods/${encodeURIComponent(f)}/update`);
      delete state.modUpdates[f];
      ok++;
    } catch { fail++; }
  }
  btn.disabled = false; btn.innerHTML = icon('refresh',13)+' Actualizar todo';
  toast(fail?'alert':'check', `${ok} mod(s) actualizados${fail?` · ${fail} fallaron`:''} · se cargan al reiniciar`, fail?'warn':'ok');
  await loadInstalledMods(); modUpdatesBadge();
}
async function toggleModUI(input){
  try {
    await API.post(`/servers/${curServerId()}/mods/${encodeURIComponent(input.dataset.f)}/toggle`, { enabled: input.checked });
    toast(input.checked?'check':'x', `${input.dataset.f} ${input.checked?'activado':'desactivado'} · aplica al reiniciar`, input.checked?'ok':'warn');
    loadInstalledMods();
  } catch(err){ input.checked = !input.checked; toast('alert', err.message, 'err'); }
}
async function removeModUI(btn){
  try {
    await API.del(`/servers/${curServerId()}/mods/${encodeURIComponent(btn.dataset.f)}`);
    toast('trash', `${btn.dataset.f} eliminado`, 'warn');
    await loadInstalledMods(); renderModCards();
  } catch(err){ toast('alert', err.message, 'err'); }
}
async function updateModUI(btn){
  btn.disabled = true; btn.textContent = 'Actualizando…';
  try {
    const r = await API.post(`/servers/${curServerId()}/mods/${encodeURIComponent(btn.dataset.f)}/update`);
    delete state.modUpdates[btn.dataset.f];
    toast('check', `Actualizado a ${r.version} · se carga al reiniciar`, 'ok');
    await loadInstalledMods(); modUpdatesBadge();
  } catch(err){ toast('alert', err.message, 'err'); btn.disabled = false; btn.textContent = 'Actualizar'; }
}
/* ---- filtros y paginación ---- */
const MODS_PER_PAGE = 20;
const MOD_CATS = [
  ['optimization','Optimización'], ['technology','Tecnología'], ['magic','Magia'],
  ['adventure','Aventura'], ['worldgen','Mundo'], ['mobs','Mobs'],
  ['food','Comida'], ['equipment','Equipamiento'], ['decoration','Decoración'],
  ['storage','Almacenaje'], ['transportation','Transporte'], ['utility','Utilidades'],
  ['game-mechanics','Mecánicas'], ['social','Social'],
];
state.modCats = new Set();
state.modServerOnly = true;
state.modShowLibs = false;
state.modPage = 0;
state.modTotal = 0;

function renderModFilters(){
  const chip = (label, active, onclick, title='') =>
    `<button class="btn small${active?' primary':''}" style="border-radius:16px;" title="${title}" onclick="${onclick}">${label}</button>`;
  document.getElementById('modFilters').innerHTML =
    MOD_CATS.map(([slug,label]) => chip(label, state.modCats.has(slug), `toggleModCat('${slug}')`)).join('') +
    `<span style="width:1px;height:20px;background:var(--border);margin:0 4px"></span>` +
    chip('Solo server', state.modServerOnly, 'toggleModFlag("modServerOnly")', 'Oculta mods que solo funcionan en el cliente (shaders, minimapa…)') +
    chip('Librerías', state.modShowLibs, 'toggleModFlag("modShowLibs")', 'Mostrar librerías (se instalan solas como dependencias)');
}
function toggleModCat(slug){
  if(state.modCats.has(slug)) state.modCats.delete(slug); else state.modCats.add(slug);
  modFiltersChanged();
}
function toggleModFlag(key){ state[key] = !state[key]; modFiltersChanged(); }
function modFiltersChanged(){
  renderModFilters();
  searchModrinth(document.getElementById('modSearch').value.trim(), 0);
}

let searchTimer = null;
function onModSearchInput(){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=>searchModrinth(document.getElementById('modSearch').value.trim(), 0), 400);
}

async function searchModrinth(query, page=0){
  const grid = document.getElementById('modGrid');
  const loader = curLoader(), game = curGame();
  if(!loader || loader==='vanilla'){ grid.innerHTML = ''; document.getElementById('modPager').innerHTML=''; return; }
  grid.innerHTML = '<div class="searching"><span class="spin"></span> Buscando en Modrinth…</div>';
  state.modPage = page;

  const facets = [["project_type:mod"], [`categories:${loader}`], [`versions:${game}`]];
  if(state.modCats.size) facets.push([...state.modCats].map(c=>`categories:${c}`));
  if(state.modServerOnly) facets.push(["server_side:required","server_side:optional"]);
  if(!state.modShowLibs) facets.push(["categories!=library"]);

  let sort = document.getElementById('modSort').value;
  if(sort==='relevance' && !query) sort = 'downloads';
  const url = `${MODRINTH_API}/search?query=${encodeURIComponent(query)}&limit=${MODS_PER_PAGE}&offset=${page*MODS_PER_PAGE}`+
    `&index=${sort}&facets=${encodeURIComponent(JSON.stringify(facets))}`;
  try {
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    state.lastHits = data.hits;
    state.modTotal = data.total_hits;
    renderModCards();
    renderModPager();
  } catch(err){
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">No se pudo conectar con Modrinth. ¿Sin internet?<br><span style="font-family:var(--mono);font-size:11px">${esc(err.message)}</span></div>`;
    toast('alert','Sin conexión con la API de Modrinth','err');
  }
}

function renderModPager(){
  const el = document.getElementById('modPager');
  const pages = Math.ceil(state.modTotal / MODS_PER_PAGE);
  if(pages <= 1){ el.innerHTML = state.modTotal ? `<span style="font-size:12px;color:var(--muted)">${fmtNum(state.modTotal)} mods</span>` : ''; return; }
  const p = state.modPage;
  const q = document.getElementById('modSearch').value.trim().replace(/'/g,'');
  const btn = (label, page, disabled=false, active=false) =>
    `<button class="btn small${active?' primary':''}" ${disabled?'disabled':''} onclick="searchModrinth('${esc(q)}', ${page}); window.scrollTo({top:0,behavior:'smooth'})">${label}</button>`;
  const nums = [];
  const from = Math.max(0, Math.min(p-2, pages-5));
  for(let i=from; i<Math.min(from+5, pages); i++) nums.push(btn(i+1, i, false, i===p));
  el.innerHTML =
    btn('«', 0, p===0) + btn('‹', p-1, p===0) + nums.join('') + btn('›', p+1, p>=pages-1) + btn('»', pages-1, p>=pages-1) +
    `<span style="font-size:12px;color:var(--muted);margin-left:10px">${fmtNum(state.modTotal)} mods · página ${p+1} de ${fmtNum(pages)}</span>`;
}
function renderModCards(){
  const grid = document.getElementById('modGrid');
  if(!state.lastHits.length){ grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Sin resultados en Modrinth</div>'; return; }
  const installed = state.installedMods || [];
  grid.innerHTML = state.lastHits.map((m,i)=>{
    const inst = installed.find(x=>x.projectId===m.project_id || (x.slug && x.slug===m.slug));
    return `
    <div class="card mod-card" style="animation-delay:${i*0.04}s">
      <div class="mod-icon">${m.icon_url?`<img src="${esc(m.icon_url)}" alt="" loading="lazy">`:icon('package',20)}</div>
      <div class="mod-body">
        <div class="mod-title">${esc(m.title)}
          ${inst?'<span class="chip green">INSTALADO</span>':''}
        </div>
        <div class="mod-desc">${esc(m.description).slice(0,150)}</div>
        <div class="mod-stats">
          <span>${icon('download',11)} ${fmtNum(m.downloads)}</span>
          <span>${icon('users',11)} ${fmtNum(m.follows)}</span>
          <span class="chip blue">${(curLoader()||'').toUpperCase()} ${curGame()||''}</span>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${inst?'<span style="font-size:11.5px;color:var(--muted)">Gestiónalo en la pestaña «Instalados»</span>'
            :`<button class="btn small primary" onclick="installModUI(${i}, this)">${icon('download',12)} Instalar</button>`}
          <button class="btn small" onclick="downloadJar(${i}, this)" title="Descarga el .jar para el cliente de tus amigos">${icon('download',12)} .jar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
async function installModUI(i, btn){
  const m = state.lastHits[i];
  btn.disabled = true; btn.textContent = 'Instalando…';
  try {
    const r = await API.post(`/servers/${curServerId()}/mods`, { project: m.slug });
    toast('check', `Instalado: ${r.installed.join(', ')} · se carga al reiniciar`, 'ok');
    await loadInstalledMods();
    renderModCards();
  } catch(err){
    toast('alert', err.message, 'err');
    btn.disabled = false; btn.innerHTML = icon('download',12)+' Instalar';
  }
}
async function checkUpdates(){
  try {
    const { updates } = await API.get(`/servers/${curServerId()}/mods/updates`);
    state.modUpdates = Object.fromEntries(updates.map(u=>[u.filename, u.latest]));
    renderInstalledMods(); modUpdatesBadge();
    toast('refresh', updates.length?`${updates.length} mod(s) tienen versión nueva`:'Todo está actualizado', updates.length?'warn':'ok');
  } catch(err){ toast('alert', err.message, 'err'); }
}
/* ---- descarga real de .jar desde el CDN de Modrinth ---- */
async function fetchJarFile(slug){
  const params = `loaders=${encodeURIComponent(JSON.stringify([curLoader()]))}&game_versions=${encodeURIComponent(JSON.stringify([curGame()]))}`;
  const res = await fetch(`${MODRINTH_API}/project/${slug}/version?${params}`);
  if(!res.ok) throw new Error('HTTP '+res.status);
  const versions = await res.json();
  if(!versions.length) throw new Error('sin versión compatible');
  const files = versions[0].files;
  return files.find(f=>f.primary) || files[0];
}
function triggerDownload(url, filename){
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
async function downloadJar(i, btn){
  const m = state.lastHits[i];
  const original = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Buscando versión…';
  try {
    const file = await fetchJarFile(m.slug);
    triggerDownload(file.url, file.filename);
    toast('check',`Descargando ${file.filename} (${(file.size/1048576).toFixed(1)} MB)`,'ok');
    addAudit('download','Descargó '+file.filename,'info');
  } catch(err){
    toast('alert',`No hay .jar de ${m.title} para ${curLoader()} ${curGame()}`,'err');
  }
  btn.disabled = false; btn.innerHTML = original;
}
function downloadFriendsZip(){
  const enabled = (state.installedMods||[]).filter(m=>m.enabled);
  if(!enabled.length){ toast('alert','No hay mods activos que empaquetar','warn'); return; }
  triggerDownload(`/api/servers/${curServerId()}/mods/pack`, '');
  toast('check',`Descargando el .zip con ${enabled.length} mods. Tus amigos lo descomprimen en su carpeta mods y listo.`,'ok');
}
function switchModTab(tab){
  state.modTab = tab;
  document.querySelectorAll('[data-modtab]').forEach(t=>t.classList.toggle('active',t.dataset.modtab===tab));
  document.getElementById('modtab-explore').style.display = tab==='explore'?'':'none';
  document.getElementById('modtab-installed').style.display = tab==='installed'?'':'none';
  if(tab==='installed') loadInstalledMods();
  if(tab==='explore' && !state.lastHits.length) searchModrinth(document.getElementById('modSearch').value.trim(), 0);
}

/* =================== GAME RULES =================== */
const RULES = [
  { key:'pvp', type:'prop', label:'PvP', sub:'Permite combate entre jugadores', def:true },
  { key:'white-list', type:'prop', label:'Whitelist', sub:'Solo entran jugadores aprobados', def:false },
  { key:'hardcore', type:'prop', label:'Modo hardcore', sub:'Una vida. Sin respawn.', def:false },
  { key:'generate-structures', type:'prop', label:'Generar estructuras', sub:'Aldeas, templos, fortalezas', def:true },
  { key:'spawn-monsters', type:'prop', label:'Mobs hostiles', sub:'Spawneo de criaturas enemigas', def:true },
  { key:'doDaylightCycle', type:'gamerule', label:'Ciclo día / noche', sub:'Se aplica al momento · requiere server encendido', def:true },
  { key:'keepInventory', type:'gamerule', label:'Keep inventory', sub:'Se aplica al momento · requiere server encendido', def:false },
];
function renderRules(props){
  document.getElementById('gameRules').innerHTML = RULES.map(r=>{
    const on = r.type==='prop' && props && props[r.key]!==undefined ? props[r.key]==='true' : r.def;
    return `<div class="toggle-row"><div><div class="t-label">${r.label}</div><div class="t-sub">${r.sub}</div></div>
    <label class="switch"><input type="checkbox" data-rule="${r.key}" data-ruletype="${r.type}" ${on?'checked':''} onchange="ruleChanged(this)"><span class="track"></span><span class="thumb"></span></label></div>`;
  }).join('');
}
renderRules(null);

/* =================== FILES =================== */
function fileLang(f){
  const ext = f.split('.').pop().toUpperCase();
  return { YML:'YAML', YAML:'YAML', PROPERTIES:'PROPERTIES', JSON:'JSON', TOML:'TOML', TXT:'TEXTO', CONF:'CONF', CFG:'CFG' }[ext] || ext;
}
function renderFileTree(){
  const roots = [], configs = [];
  (state.fileList||[]).forEach(f=> (f.includes('/')?configs:roots).push(f));
  const item = f=>`<div class="file-item${state.currentFile===f?' active':''}" onclick="openFile('${f}')">${icon('fileCode',13)} ${f.replace(/^[^/]+\//,'')}</div>`;
  document.getElementById('fileTree').innerHTML =
    `<div class="file-folder">RAÍZ DEL SERVIDOR</div>` + (roots.map(item).join('') || '<div class="empty" style="padding:10px;font-size:11px">vacío</div>') +
    (configs.length ? `<div class="file-folder">CONFIG /</div>` + configs.map(item).join('') : '');
}
async function loadFiles(){
  const id = curServerId(); if(!id) return;
  try {
    const { files } = await API.get(`/servers/${id}/files`);
    state.fileList = files;
    renderFileTree();
    const first = files.includes('server.properties') ? 'server.properties' : files[0];
    if(first) openFile(first);
  } catch(err){ console.warn('loadFiles', err); }
}
async function openFile(f){
  state.currentFile = f;
  document.getElementById('editorFile').textContent = f;
  document.getElementById('editorLang').textContent = fileLang(f);
  renderFileTree();
  try {
    const { content } = await API.get(`/servers/${curServerId()}/file?path=${encodeURIComponent(f)}`);
    document.getElementById('editorArea').value = content;
  } catch(err){ document.getElementById('editorArea').value = ''; toast('alert', err.message, 'err'); }
}
async function saveFile(){
  if(!state.currentFile) return;
  try {
    await API.put(`/servers/${curServerId()}/file`, { path: state.currentFile, content: document.getElementById('editorArea').value });
    toast('save',`${state.currentFile} guardado`,'ok');
  } catch(err){ toast('alert', err.message, 'err'); }
}

/* =================== EVENTS (programador real) =================== */
const EV_META = {
  restart:  { ic:'refresh',  color:'var(--accent)',  bg:'var(--accent-dim)',       label:'Reinicio programado',
              hint:'Avisa en el chat a los 5 min, 1 min y 10 s, y después reinicia. Solo actúa si el servidor está encendido.' },
  announce: { ic:'message',  color:'#8b9cf9',        bg:'rgba(88,101,242,.12)',    label:'Anuncio en el chat',
              hint:'Mensaje de CraftDeck visible para todos los jugadores.' },
  command:  { ic:'terminal', color:'var(--warn)',    bg:'var(--warn-dim)',         label:'Comando de consola',
              hint:'Ejecuta cualquier comando de consola: time set day, weather clear, kill @e[type=item]…' },
  start:    { ic:'play',     color:'var(--info)',    bg:'var(--info-dim)',         label:'Encender el servidor',
              hint:'Arranca el servidor si está detenido. Útil para tenerlo listo a la hora de jugar.' },
  stop:     { ic:'power',    color:'var(--danger)',  bg:'var(--danger-dim)',       label:'Apagar el servidor',
              hint:'Avisa en el chat 1 minuto antes y lo apaga. Ideal para no comer RAM del Umbrel de madrugada.' },
};
const DAY_NAMES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function evTaskName(e){
  if(e.type==='announce') return `Anuncio: «${esc(e.payload)}»`;
  if(e.type==='command') return `Comando: <span style="font-family:var(--mono);font-size:12px">/${esc(e.payload)}</span>`;
  return EV_META[e.type]?.label || e.type;
}
function schedLabel(s){
  if(s.kind==='interval'){
    const n = s.everyMinutes || 60;
    return n<60 ? `Cada ${n} min` : n===60 ? 'Cada hora' : `Cada ${Math.round(n/60)} h`;
  }
  const days = s.kind==='weekly' ? (s.days||[]).map(d=>DAY_NAMES[d]).join(', ') : 'Diario';
  return `${days || 'Diario'} · ${s.time || '06:00'}`;
}
function fmtNext(iso){
  const d = new Date(iso), diff = (d - Date.now())/60000;
  if(diff < 1.5) return 'en un momento';
  if(diff < 60) return `en ${Math.round(diff)} min`;
  if(diff < 36*60) return `en ${Math.round(diff/60)} h`;
  return d.toLocaleString('es-ES',{weekday:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}

async function loadEvents(){
  const id = curServerId(); if(!id) return;
  try { ({ events: state.events } = await API.get(`/servers/${id}/events`)); } catch { state.events = []; }
  renderEvents(); renderDashTasks();
}
function backupTaskRow(){
  const meta = curServer()?.meta;
  if(!meta) return '';
  const on = meta.backupAuto !== false;
  return `
    <div class="row-item">
      <div class="row-icon" style="background:var(--info-dim);color:var(--info)">${icon('database',16)}</div>
      <div class="row-body">
        <div class="row-title">Backup automático ${on?'':'<span class="chip gray">PAUSADO</span>'}</div>
        <div class="row-sub">Diario · 04:00 · conserva los últimos ${meta.backupKeep ?? 7} · integrado</div>
      </div>
      <label class="switch"><input type="checkbox" ${on?'checked':''} onchange="toggleBackupFromEvents(this.checked)"><span class="track"></span><span class="thumb"></span></label>
      <span style="width:30px"></span>
    </div>`;
}
async function toggleBackupFromEvents(on){
  try {
    await API.put(`/servers/${curServerId()}/backup-settings`, { auto: on });
    const meta = curServer()?.meta;
    if(meta) meta.backupAuto = on;
    toast(on?'check':'x', on?'Backup diario activado':'Backup diario desactivado', on?'ok':'warn');
    renderEvents(); renderDashTasks();
  } catch(err){ toast('alert', err.message, 'err'); }
}
function renderEvents(){
  const rows = state.events.map((e,i)=>{
    const m = EV_META[e.type] || EV_META.command;
    return `
    <div class="row-item" style="animation-delay:${i*0.04}s">
      <div class="row-icon" style="background:${m.bg};color:${m.color}">${icon(m.ic,16)}</div>
      <div class="row-body">
        <div class="row-title">${evTaskName(e)} ${e.enabled?'':'<span class="chip gray">PAUSADO</span>'}</div>
        <div class="row-sub">${schedLabel(e.schedule)}${e.enabled?` · próxima ${fmtNext(e.next)}`:''}</div>
      </div>
      <label class="switch"><input type="checkbox" ${e.enabled?'checked':''} onchange="toggleEventTask('${e.id}',this.checked)"><span class="track"></span><span class="thumb"></span></label>
      <button class="icon-btn red" onclick="deleteEventTask('${e.id}')">${icon('trash',13)}</button>
    </div>`;
  }).join('');
  document.getElementById('eventList').innerHTML = backupTaskRow() + (rows ||
    '<div class="empty">Sin tareas todavía. Crea la primera con «Nueva tarea»: reinicios con aviso, anuncios, comandos con horario…</div>');
}
async function toggleEventTask(id, on){
  try {
    await API.post(`/servers/${curServerId()}/events/${id}/toggle`, { enabled: on });
    const e = state.events.find(x=>x.id===id); if(e) e.enabled = on;
    toast(on?'check':'x', `Tarea ${on?'activada':'pausada'}`, on?'ok':'warn');
    renderEvents(); renderDashTasks();
  } catch(err){ toast('alert', err.message, 'err'); loadEvents(); }
}
async function deleteEventTask(id){
  try {
    await API.del(`/servers/${curServerId()}/events/${id}`);
    toast('trash','Tarea eliminada','warn');
    loadEvents();
  } catch(err){ toast('alert', err.message, 'err'); }
}
function renderDashTasks(){
  const meta = curServer()?.meta;
  const items = state.events.filter(e=>e.enabled)
    .sort((a,b)=>new Date(a.next)-new Date(b.next))
    .map(e=>({ m: EV_META[e.type]||EV_META.command, name: evTaskName(e), when: fmtNext(e.next) }));
  if(meta && meta.backupAuto !== false)
    items.push({ m:{ic:'database',color:'var(--info)'}, name:'Backup automático', when:'diario · 04:00' });
  document.getElementById('dashTasks').innerHTML = items.slice(0,4).map(t=>`
    <div style="display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12.5px;">
      <span style="color:${t.m.color};display:flex">${icon(t.m.ic,14)}</span>
      <span style="flex:1">${t.name}</span>
      <span style="color:var(--muted);font-size:11.5px;font-variant-numeric:tabular-nums">${t.when}</span>
    </div>`).join('') || '<div class="empty" style="padding:16px">Sin tareas programadas</div>';
}

/* ---- editor de tareas ---- */
document.getElementById('evDays').innerHTML = DAY_NAMES.map((d,i)=>
  `<span class="day-chip${i===0?' on':''}" data-day="${i}" onclick="this.classList.toggle('on')">${d}</span>`).join('');
function toggleEventEditor(show){
  const ed = document.getElementById('eventEditor');
  const open = show !== undefined ? show : ed.style.display === 'none';
  ed.style.display = open ? '' : 'none';
  if(open){ evTypeChanged(); evSchedChanged(); }
}
function evTypeChanged(){
  const t = document.getElementById('evType').value;
  document.getElementById('evTypeHint').textContent = EV_META[t].hint;
  const f = document.getElementById('evPayloadField');
  f.style.display = (t==='announce'||t==='command') ? '' : 'none';
  document.getElementById('evPayloadLabel').textContent = t==='command' ? 'Comando (sin la /)' : 'Mensaje';
  document.getElementById('evPayload').placeholder = t==='command' ? 'time set day' : '¡Recuerda votar el server!';
}
function evSchedChanged(){
  const k = document.getElementById('evSchedKind').value;
  document.getElementById('evTimeField').style.display = k==='interval' ? 'none' : '';
  document.getElementById('evDaysField').style.display = k==='weekly' ? '' : 'none';
  document.getElementById('evEveryField').style.display = k==='interval' ? '' : 'none';
}
async function createEventTask(){
  const type = document.getElementById('evType').value;
  const payload = document.getElementById('evPayload').value.trim();
  const kind = document.getElementById('evSchedKind').value;
  if((type==='announce'||type==='command') && !payload){
    toast('alert', type==='announce'?'Escribe el mensaje del anuncio':'Escribe el comando','warn'); return;
  }
  const schedule = { kind };
  if(kind==='interval') schedule.everyMinutes = parseInt(document.getElementById('evEvery').value);
  else schedule.time = document.getElementById('evTime').value || '06:00';
  if(kind==='weekly'){
    schedule.days = [...document.querySelectorAll('#evDays .day-chip.on')].map(c=>parseInt(c.dataset.day));
    if(!schedule.days.length){ toast('alert','Elige al menos un día','warn'); return; }
  }
  try {
    await API.post(`/servers/${curServerId()}/events`, { type, payload, schedule });
    toast('check','Tarea creada — el backend se encarga aunque cierres el panel','ok');
    document.getElementById('evPayload').value = '';
    toggleEventEditor(false);
    loadEvents();
  } catch(err){ toast('alert', err.message, 'err'); }
}

/* =================== INTEGRACIONES =================== */
function renderDiscordChip(connected){
  const chip = document.getElementById('dcChip');
  chip.textContent = connected ? 'CONECTADO' : 'SIN CONECTAR';
  chip.className = 'chip ' + (connected ? 'green' : 'gray');
  document.getElementById('dcOffBtn').style.display = connected ? '' : 'none';
}
async function loadIntegrations(){
  const meta = curServer()?.meta;
  const d = meta?.discord;
  document.getElementById('dcUrl').value = d?.url || '';
  document.getElementById('dcStatus').checked = d ? d.onStatus : true;
  document.getElementById('dcPlayers').checked = d ? d.onPlayers : true;
  document.getElementById('dcBackup').checked = d ? d.onBackup : false;
  document.getElementById('dcChat').checked = d ? d.chatMirror : false;
  renderDiscordChip(!!d?.url);
  try { renderPlayit(await API.get('/playit')); } catch { /* backend sin playit */ }
}
async function saveDiscord(){
  const url = document.getElementById('dcUrl').value.trim();
  if(!url){ toast('alert','Pega primero la URL del webhook','warn'); return; }
  try {
    await API.put(`/servers/${curServerId()}/discord`, {
      url,
      onStatus: document.getElementById('dcStatus').checked,
      onPlayers: document.getElementById('dcPlayers').checked,
      onBackup: document.getElementById('dcBackup').checked,
      chatMirror: document.getElementById('dcChat').checked,
    });
    renderDiscordChip(true);
    await refreshServers();
    toast('check','Discord conectado — dale a «Enviar prueba» para comprobarlo','ok');
  } catch(err){ toast('alert', err.message, 'err'); }
}
async function testDiscord(){
  const btn = document.getElementById('dcTestBtn');
  btn.disabled = true;
  try { await API.post(`/servers/${curServerId()}/discord/test`); toast('send','Mensaje de prueba enviado — míralo en tu canal','ok'); }
  catch(err){ toast('alert', err.message, 'err'); }
  btn.disabled = false;
}
async function disconnectDiscord(){
  try {
    await API.put(`/servers/${curServerId()}/discord`, { url: '' });
    document.getElementById('dcUrl').value = '';
    renderDiscordChip(false);
    await refreshServers();
    toast('x','Discord desconectado','warn');
  } catch(err){ toast('alert', err.message, 'err'); }
}

function renderPlayit(st){
  state.playit = st;
  const chip = document.getElementById('ptChip');
  chip.textContent = st.running ? 'ACTIVO' : 'APAGADO';
  chip.className = 'chip ' + (st.running ? 'green' : 'gray');
  document.getElementById('ptBtn').textContent = st.running ? 'Detener' : 'Arrancar';
  document.getElementById('ptBody').style.display = st.running ? 'none' : '';
  const claim = document.getElementById('ptClaim');
  if(st.running && st.claimUrl){
    claim.style.display = '';
    claim.innerHTML = `
      <p style="font-size:12px;color:var(--warn);font-weight:600;margin-bottom:8px;">Falta un paso: reclama el agente con tu cuenta</p>
      <div class="copy-field"><span>${esc(st.claimUrl)}</span>
        <button class="icon-btn" onclick="copyText('${esc(st.claimUrl)}')">${icon('copy',13)}</button>
        <a class="icon-btn" href="${esc(st.claimUrl)}" target="_blank" rel="noopener">${icon('link',13)}</a>
      </div>
      <p style="font-size:11.5px;color:var(--muted);margin-top:8px;line-height:1.5;">Abre el enlace, inicia sesión en playit.gg y crea un túnel <b>Minecraft Java</b> hacia el puerto de tu server. La dirección que te den es la que compartes con tus amigos.</p>`;
  } else claim.style.display = 'none';
  const log = document.getElementById('ptLog');
  if(st.lastLines?.length){
    log.style.display = '';
    log.textContent = st.lastLines.join('\n');
    log.scrollTop = log.scrollHeight;
  } else log.style.display = 'none';
}
function copyText(t){ navigator.clipboard?.writeText(t); copied(); }
async function togglePlayit(){
  const btn = document.getElementById('ptBtn');
  btn.disabled = true;
  try {
    if(state.playit?.running){ await API.post('/playit/stop'); toast('wifi','Túnel detenido','warn'); }
    else { await API.post('/playit/start'); toast('wifi','Arrancando el agente de playit…','info'); }
    renderPlayit(await API.get('/playit'));
  } catch(err){ toast('alert', err.message, 'err'); }
  btn.disabled = false;
}
onWS(async (msg)=>{
  if(msg.type!=='playit') return;
  try { renderPlayit(await API.get('/playit')); } catch { /* sin conexión */ }
});
setInterval(async ()=>{
  if(!state.playit?.running) return;
  if(!document.getElementById('sec-integrations').classList.contains('visible')) return;
  try { renderPlayit(await API.get('/playit')); } catch { /* sin conexión */ }
}, 5000);

/* =================== BACKUPS =================== */
function fmtSize(b){ return b>=1073741824 ? (b/1073741824).toFixed(2)+' GB' : (b/1048576).toFixed(1)+' MB'; }
function fmtDate(iso){ return new Date(iso).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }
async function loadBackups(){
  const id = curServerId(); if(!id) return;
  try { state.backups = await API.get(`/servers/${id}/backups`); } catch { state.backups = []; }
  renderBackups();
  const meta = curServer()?.meta;
  document.getElementById('bkAuto').checked = meta ? meta.backupAuto !== false : true;
  const total = state.backups.reduce((a,b)=>a+b.size,0);
  document.getElementById('backupsSubtitle').textContent =
    state.backups.length ? `Snapshots del servidor · ${fmtSize(total)} usados` : 'Snapshots del servidor · todavía no hay ninguno';
}
function renderBackups(){
  document.getElementById('backupList').innerHTML = state.backups.map((b,i)=>`
    <div class="row-item" style="animation-delay:${i*0.04}s">
      <div class="row-icon" style="background:var(--info-dim);color:var(--info)">${icon('database',16)}</div>
      <div class="row-body">
        <div class="row-title" style="font-family:var(--mono);font-size:12.5px">${b.name}.zip</div>
        <div class="row-sub">${fmtDate(b.createdAt)} · ${fmtSize(b.size)} · ${b.auto?'automático':'manual'}</div>
      </div>
      <a class="btn small ghost" href="/api/servers/${curServerId()}/backups/${b.name}/download" title="Descargar">${icon('download',13)}</a>
      <button class="btn small" onclick="armAction(this, ()=>restoreBackupUI('${b.name}'))">Restaurar</button>
      <button class="icon-btn red" style="width:auto;padding:0 8px" onclick="armAction(this, ()=>deleteBackupUI('${b.name}'))">${icon('trash',13)}</button>
    </div>`).join('') || '<div class="empty">Sin backups todavía. Crea el primero con el botón de arriba.</div>';
}
/* doble click de confirmación: el primer click arma el botón, el segundo ejecuta */
function armAction(btn, fn, restoreHtml){
  if(btn.dataset.armed){ fn(); return; }
  btn.dataset.armed = '1';
  const orig = btn.innerHTML;
  btn.innerHTML = '¿Seguro?';
  btn.style.color = 'var(--danger)';
  setTimeout(()=>{ delete btn.dataset.armed; btn.innerHTML = restoreHtml || orig; btn.style.color=''; }, 3000);
}
async function makeBackup(){
  const btn = document.getElementById('btnBackup');
  btn.disabled = true; btn.textContent = 'Comprimiendo…';
  try {
    const b = await API.post(`/servers/${curServerId()}/backups`);
    toast('check',`Backup completado: ${fmtSize(b.size)}`,'ok');
    loadBackups();
  } catch(err){ toast('alert', err.message, 'err'); }
  btn.disabled = false; btn.innerHTML = icon('database',14)+' Crear backup';
}
async function restoreBackupUI(name){
  try {
    await API.post(`/servers/${curServerId()}/backups/${name}/restore`);
    toast('refresh',`Mundo restaurado desde ${name}`,'warn');
  } catch(err){ toast('alert', err.message, 'err'); }
}
async function deleteBackupUI(name){
  try { await API.del(`/servers/${curServerId()}/backups/${name}`); toast('trash',`Backup ${name} eliminado`,'warn'); loadBackups(); }
  catch(err){ toast('alert', err.message, 'err'); }
}
async function toggleBackupAuto(on){
  try { await API.put(`/servers/${curServerId()}/backup-settings`, { auto: on }); toast(on?'check':'x', on?'Backup diario activado':'Backup diario desactivado', on?'ok':'warn'); }
  catch(err){ toast('alert', err.message, 'err'); }
}

/* =================== CRASHES =================== */
async function loadCrashes(){
  const id = curServerId(); if(!id) return;
  let crashes = [];
  try { ({ crashes } = await API.get(`/servers/${id}/crashes`)); } catch { /* sin datos */ }
  state.crashes = crashes;
  renderCrashes();
  if(crashes.length) openCrash(0);
  else document.getElementById('crashDetail').innerHTML = '<div class="empty">Este servidor no tiene crash reports. Larga vida.</div>';
}
function renderCrashes(){
  document.getElementById('crashList').innerHTML =
    `<div class="mini-label" style="padding:8px 10px 2px">CRASH REPORTS</div>` +
    (state.crashes.map((c,i)=>`
    <div class="row-item" style="cursor:pointer; ${state.currentCrash===i?'border-color:var(--border-hover);background:var(--card-hover);':''}" onclick="openCrash(${i})">
      <div class="row-icon" style="background:var(--danger-dim);color:var(--danger)">${icon('alert',15)}</div>
      <div class="row-body">
        <div class="row-title" style="font-size:12.5px">${esc(c.culprit)}</div>
        <div class="row-sub">${fmtDate(c.date)}</div>
      </div>
    </div>`).join('') || '<div class="empty" style="padding:16px;font-size:12px;">Sin crashes registrados</div>');
}
async function openCrash(i){
  state.currentCrash = i;
  const c = state.crashes[i]; if(!c) return;
  renderCrashes();
  let stack = '';
  try {
    const r = await API.get(`/servers/${curServerId()}/crashes/${encodeURIComponent(c.file)}`);
    stack = r.text.split('\n').slice(0, 45).join('\n');
  } catch { stack = '(no se pudo leer el reporte)'; }
  document.getElementById('crashDetail').innerHTML = `
    <h3>${icon('alert',15)} Análisis automático</h3>
    <div class="crash-detail">
      <div style="font-size:15px;font-weight:650;">Culpable: <span style="color:var(--danger)">${esc(c.culprit)}</span></div>
      <dl class="crash-kv">
        <dt>Fecha</dt><dd>${fmtDate(c.date)}</dd>
        <dt>Archivo</dt><dd style="font-family:var(--mono);font-size:11.5px">${esc(c.file)}</dd>
        <dt>Qué pasó</dt><dd>${esc(c.reason)}</dd>
        <dt>Solución sugerida</dt><dd style="color:var(--accent)">${esc(c.fix)}</dd>
      </dl>
      ${c.culpritFilename?`<div style="display:flex;gap:8px;margin:4px 0 12px;flex-wrap:wrap;">
        <button class="btn small danger" onclick="armAction(this, ()=>disableCulprit(${i}))">${icon('x',13)} Desactivar «${esc(c.culprit)}»</button>
        <span style="font-size:11.5px;color:var(--muted);align-self:center;">Se aplica al reiniciar el servidor</span>
      </div>`:''}
      <pre class="stack">${esc(stack)}</pre>
    </div>`;
}
async function disableCulprit(i){
  const c = state.crashes[i]; if(!c?.culpritFilename) return;
  try {
    await API.post(`/servers/${curServerId()}/mods/${encodeURIComponent(c.culpritFilename)}/toggle`, { enabled: false });
    toast('check', `«${c.culprit}» desactivado — reinicia el servidor para aplicarlo`, 'ok');
  } catch(err){ toast('alert', err.message, 'err'); }
}

/* =================== ACTIVITY FEED =================== */

/* =================== CHARTS =================== */
function drawChart(canvas,data,opts){
  const dpr = window.devicePixelRatio||1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if(!w) return;
  canvas.width=w*dpr; canvas.height=h*dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,w,h);
  const {min,max,color,fill} = opts;
  const pts = data.map((v,i)=>[i/(data.length-1)*w, h-((v-min)/(max-min))*(h-14)-7]);
  const grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,fill); grad.addColorStop(1,'transparent');
  ctx.beginPath(); ctx.moveTo(pts[0][0],h);
  pts.forEach(p=>ctx.lineTo(p[0],p[1]));
  ctx.lineTo(w,h); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
  ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  ctx.strokeStyle=color; ctx.lineWidth=1.8; ctx.lineJoin='round'; ctx.stroke();
  const last = pts[pts.length-1];
  ctx.beginPath(); ctx.arc(last[0],last[1],3,0,7);
  ctx.fillStyle=color; ctx.fill();
}
function drawDualChart(canvas,a,b){
  const dpr = window.devicePixelRatio||1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if(!w) return;
  canvas.width=w*dpr; canvas.height=h*dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,w,h);
  [[a,'#22d3ee'],[b,'#a78bfa']].forEach(([data,color])=>{
    const pts = data.map((v,i)=>[i/(data.length-1)*w, h-(v/100)*(h-14)-7]);
    ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    ctx.strokeStyle=color; ctx.lineWidth=1.8; ctx.lineJoin='round'; ctx.stroke();
  });
  ctx.font='10.5px Inter, Segoe UI'; ctx.fillStyle='#22d3ee'; ctx.fillText('CPU',8,13);
  ctx.fillStyle='#a78bfa'; ctx.fillText('RAM',40,13);
}
function tickCharts(){
  // el historial lo alimentan los eventos 'metrics' del WebSocket (live.js)
  [state.playersHistory,state.cpuHistory,state.ramHistory].forEach(a=>{ if(a.length>90)a.shift(); });
  const pad = a => a.length>1 ? a : [0,0];
  const maxP = Math.max(5, ...state.playersHistory);
  drawChart(document.getElementById('playersChart'),pad(state.playersHistory),{min:0,max:maxP+1,color:'#34d399',fill:'rgba(52,211,153,.18)'});
  drawDualChart(document.getElementById('cpuChart'),pad(state.cpuHistory),pad(state.ramHistory));
}
setInterval(tickCharts,1500);

/* =================== MAP (placeholder decorativo hasta integrar BlueMap) =================== */
let mapBase = null;
function terrainH(x,y){
  return Math.sin(x*0.09)*Math.cos(y*0.075)*1.1
       + Math.sin(x*0.031+y*0.045)*0.9
       + Math.cos(x*0.017-y*0.023)*0.7
       + Math.sin((x+y)*0.11)*0.35;
}
function terrainColor(v){
  if(v<-0.9) return '#1d4ed8';
  if(v<-0.35) return '#2563eb';
  if(v<-0.15) return '#d4c27a';
  if(v<0.5) return '#4d7c3a';
  if(v<1.1) return '#2d5426';
  if(v<1.7) return '#6b7280';
  return '#e5e7eb';
}
function drawMapBase(){
  const canvas = document.getElementById('mapCanvas');
  const dpr = window.devicePixelRatio||1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if(!w) return;
  canvas.width=w*dpr; canvas.height=h*dpr;
  const off = document.createElement('canvas');
  const cell = 7;
  const cols = Math.ceil(w/cell), rows = Math.ceil(h/cell);
  off.width=cols; off.height=rows;
  const octx = off.getContext('2d');
  for(let cy=0;cy<rows;cy++) for(let cx=0;cx<cols;cx++){
    octx.fillStyle = terrainColor(terrainH(cx,cy));
    octx.fillRect(cx,cy,1,1);
  }
  mapBase = { off, w, h, dpr };
  drawMapFrame();
}
function drawMapFrame(){
  if(!mapBase) return;
  const canvas = document.getElementById('mapCanvas');
  const { off, w, h, dpr } = mapBase;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0,0,w,h);
  ctx.drawImage(off,0,0,w,h);
  // subtle grid
  ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=1;
  for(let x=0;x<w;x+=56){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for(let y=0;y<h;y+=56){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  // spawn marker
  const sx=w*0.5, sy=h*0.5;
  ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=1.6;
  ctx.strokeRect(sx-6,sy-6,12,12);
  ctx.font='10px Inter, Segoe UI'; ctx.fillStyle='rgba(255,255,255,.75)';
  ctx.fillText('spawn', sx+10, sy+3);
  // marca de agua honesta: esto todavía no es tu mundo real
  ctx.font='700 26px Inter, Segoe UI';
  const label = 'PRÓXIMAMENTE · terreno de ejemplo';
  const lw = ctx.measureText(label).width;
  ctx.fillStyle='rgba(9,9,11,.65)';
  ctx.fillRect(w/2-lw/2-18, h/2-58, lw+36, 42);
  ctx.fillStyle='rgba(255,255,255,.85)';
  ctx.fillText(label, w/2-lw/2, h/2-30);
}
document.getElementById('mapCanvas').addEventListener('mousemove', e=>{
  const r = e.target.getBoundingClientRect();
  const bx = Math.round((e.clientX-r.left-r.width/2)*4), bz = Math.round((e.clientY-r.top-r.height/2)*4);
  document.getElementById('mapCoords').textContent = `${bx}, ${bz}`;
});
window.addEventListener('resize', ()=>{ if(document.getElementById('sec-map').classList.contains('visible')) drawMapBase(); tickCharts(); });

/* =================== UPTIME =================== */
setInterval(()=>{
  if(state.online) state.uptimeSec++;
  const s = state.uptimeSec;
  const fmt = [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(n=>String(n).padStart(2,'0')).join(':');
  document.getElementById('statUptime').textContent = state.online?fmt:'—';
},1000);

/* =================== AUDIT CSV =================== */
function exportAuditCsv(){
  if(!state.audit.length){ toast('alert','No hay actividad que exportar','warn'); return; }
  const cell = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const csv = ['fecha;tipo;detalle', ...state.audit.map(a=>[a.when,a.type,a.text].map(cell).join(';'))].join('\n');
  const url = URL.createObjectURL(new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' }));
  triggerDownload(url, 'craftdeck-auditoria.csv');
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
  toast('download','craftdeck-auditoria.csv exportado','ok');
}

/* =================== INIT =================== */
hydrateIcons();
renderPlayers();
modUpdatesBadge();
tickCharts();
setTimeout(()=>toast('umbrella','Bienvenido a CraftDeck','ok'),700);
