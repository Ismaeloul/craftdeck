/* =================== 0.6: servidores, mapa, versión, subidas, historial, filtro de consola =================== */
function loaderName(l){ return LOADER_NAMES[l] || l; }
/** Paper corre plugins; Fabric/Forge/NeoForge mods; vanilla nada. */
function contentWord(loader){ return loader==='paper' ? 'Plugins' : 'Mods'; }

/* ---------- Todos los servidores ---------- */
async function renderServersOverview(){
  await refreshServers();
  const grid = document.getElementById('serversGrid');
  const list = state.servers;
  document.getElementById('serversSubtitle').textContent = list.length
    ? `${list.length} servidor${list.length===1?'':'es'} · ${list.filter(s=>s.status==='online').length} en línea`
    : 'Todavía no hay ninguno';
  if(!list.length){ grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Crea tu primer servidor con el botón de arriba.</div>'; return; }
  grid.innerHTML = list.map((s,i)=>{
    const m = s.meta, r = m.runtime || {};
    const ready = m.provision?.status==='ready';
    const online = s.status==='online', busy = s.status==='starting' || s.status==='stopping';
    const sleeping = !online && !busy && r.sleeping;
    return `<div class="card srv-card${s.id===state.currentServerId?' current':''}" style="animation-delay:${i*0.04}s" onclick="pickServerById('${s.id}'); go('dashboard')">
      <div class="srv-head">
        ${m.serverIcon ? `<img src="/api/servers/${s.id}/icon" alt="" style="width:32px;height:32px;border-radius:8px;image-rendering:pixelated">` : `<span class="ss-dot" style="width:9px;height:9px;background:${sleeping?'var(--violet)':serverDotColor(s)}"></span>`}
        <div style="flex:1;min-width:0"><div class="srv-name">${esc(s.name)}</div><div class="srv-sub">${loaderName(m.loader)} ${esc(m.mcVersion)} · puerto ${m.port}${m.modpack?` · modpack ${esc(m.modpack.name)}`:''}</div></div>
        <span class="chip ${online?'green':s.status==='error'?'red':busy?'amber':sleeping?'sleeping':'gray'}">${sleeping?'DORMIDO':serverStatusLabel(s).toUpperCase()}</span>
      </div>
      <div class="srv-stats">
        <span>${icon('users',12)} <b>${(r.players||[]).length}</b> jugando</span>
        <span>${icon('cpu',12)} <b>${(m.memoryMb/1024).toFixed(0)} GB</b> RAM</span>
        ${online?`<span>${icon('clock',12)} <b>${fmtUptime(r.uptimeSec||0)}</b></span>`:''}
        ${m.publicAddress?`<span>${icon('link',12)} <b style="font-family:var(--mono);font-weight:500">${esc(m.publicAddress)}</b></span>`:''}
      </div>
      <div class="srv-actions" onclick="event.stopPropagation()">
        ${online||busy
          ? `<button class="btn small danger" ${busy?'disabled':''} onclick="serverAction('${s.id}','stop',this)">${icon('stop',12)} Detener</button>`
          : `<button class="btn small primary" ${ready?'':'disabled'} onclick="serverAction('${s.id}','start',this)">${icon('play',12)} Iniciar</button>`}
        <button class="btn small" onclick="pickServerById('${s.id}'); go('console')">${icon('terminal',12)} Consola</button>
        <button class="btn small ghost" ${!online && !busy && ready ? '' : 'disabled'} onclick="askClone('${s.id}', '${esc(s.name).replace(/'/g,'&#39;')}')" title="Copiar mundo, mods y configuración a otro puerto">${icon('copy',12)} Clonar</button>
        <button class="btn small ghost" onclick="pickServerById('${s.id}'); go('dashboard')">Abrir</button>
      </div>
    </div>`;
  }).join('');
  if(typeof renderStorage==='function') renderStorage();
}
function fmtUptime(s){ const h=Math.floor(s/3600), m=Math.floor(s/60)%60; return h?`${h} h ${m} min`:`${m} min`; }
function pickServerById(id){
  const i = state.servers.findIndex(s=>s.id===id);
  if(i>=0 && state.currentServerId!==id) pickServer(i);
}
async function serverAction(id, action, btn){
  btn.disabled = true;
  try {
    await API.post(`/servers/${id}/${action}`);
    toast(action==='start'?'play':'stop', action==='start'?'Arrancando…':'Deteniendo…', action==='start'?'info':'warn');
  } catch(err){ toast('alert', err.message, 'err'); }
  setTimeout(renderServersOverview, 800);
}
onWS((msg)=>{
  if(msg.type==='status' && document.getElementById('sec-servers').classList.contains('visible')) setTimeout(renderServersOverview, 300);
});

/* ---------- Mapa en vivo (BlueMap) ---------- */
let mapPoll = null;
async function loadMap(){
  const id = curServerId();
  const box = document.getElementById('mapState');
  const wrap = document.getElementById('mapFrameWrap');
  const frame = document.getElementById('mapFrame');
  const open = document.getElementById('mapOpen');
  clearInterval(mapPoll); mapPoll = null;
  if(!id){ box.innerHTML = '<div class="empty">Crea un servidor primero.</div>'; wrap.style.display='none'; return; }
  let st;
  try { st = await API.get(`/servers/${id}/map/status`); }
  catch(err){ box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  const meta = curServer()?.meta;
  open.style.display = 'none';
  if(!st.supported){
    wrap.style.display='none';
    box.innerHTML = `<div class="banner info" style="margin:0"><span class="banner-icon">${icon('map',18)}</span><div class="banner-body">
      <div class="banner-title">El mapa necesita un servidor con mods o plugins</div>
      <div style="font-size:12.5px;color:var(--muted2);margin-top:4px;line-height:1.6">Este servidor es vanilla puro. En <b>Mundo → Versión de Minecraft</b> puedes pasarlo a <b>Paper</b> (mismo mundo, admite plugins) y entonces instalar BlueMap aquí.</div></div></div>`;
    return;
  }
  if(!st.installed){
    wrap.style.display='none';
    box.innerHTML = `<div class="banner info" style="margin:0"><span class="banner-icon">${icon('map',18)}</span><div class="banner-body">
      <div class="banner-title">BlueMap no está instalado en este servidor</div>
      <div style="font-size:12.5px;color:var(--muted2);margin-top:4px;line-height:1.6">Es ${meta?.loader==='paper'?'un plugin':'un mod'} de Modrinth. CraftDeck lo instala, lo deja configurado (acepta la descarga de recursos de Mojang y sirve el mapa solo dentro del Umbrel) y lo enseña aquí. La primera vez tarda unos minutos en dibujar el mundo, y consume CPU mientras lo hace.</div>
      <div class="banner-actions"><button class="btn small primary" onclick="installMap(this)">${icon('download',13)} Instalar BlueMap</button></div></div></div>`;
    return;
  }
  if(!st.online){
    wrap.style.display='none';
    box.innerHTML = `<div class="banner info" style="margin:0"><span class="banner-icon">${icon('power',18)}</span><div class="banner-body">
      <div class="banner-title">BlueMap está instalado; arranca el servidor para ver el mapa</div>
      <div style="font-size:12.5px;color:var(--muted2);margin-top:4px">El mapa lo sirve el propio servidor de Minecraft mientras está encendido.</div></div></div>`;
    return;
  }
  if(!st.reachable){
    wrap.style.display='none';
    box.innerHTML = `<div class="banner info" style="margin:0"><span class="banner-icon"><span class="spin"></span></span><div class="banner-body">
      <div class="banner-title">El servidor está en línea; esperando a que BlueMap responda…</div>
      <div style="font-size:12.5px;color:var(--muted2);margin-top:4px;line-height:1.6">Tras arrancar tarda un poco (descarga recursos y renderiza). Si pasan varios minutos, mira la consola: BlueMap explica ahí qué le falta.</div></div></div>`;
    mapPoll = setInterval(()=>{ if(document.getElementById('sec-map').classList.contains('visible')) loadMap(); else { clearInterval(mapPoll); mapPoll=null; } }, 5000);
    return;
  }
  box.innerHTML = `<div style="display:flex;gap:12px;align-items:center;font-size:12.5px;color:var(--muted2);flex-wrap:wrap">
    <span class="chip green">EN VIVO</span> Mueve el mapa con el ratón, rueda para hacer zoom. Los jugadores aparecen con su cara. Las zonas nuevas se dibujan solas mientras el servidor está encendido.</div>`;
  const src = `/api/servers/${id}/map/view/`;
  if(frame.getAttribute('src') !== src) frame.src = src;
  open.href = src; open.style.display = '';
  wrap.style.display = '';
}
async function installMap(btn){
  btn.disabled = true; btn.textContent = 'Instalando…';
  try {
    const r = await API.post(`/servers/${curServerId()}/map/install`);
    toast('check', `Instalado: ${r.installed.join(', ')}${r.needsRestart?' · reinicia el servidor para que arranque':' · arranca el servidor'}`, 'ok');
    loadMap();
  } catch(err){ toast('alert', err.message, 'err'); btn.disabled=false; btn.innerHTML = icon('download',13)+' Instalar BlueMap'; }
}

/* ---------- Cambiar la versión de Minecraft ---------- */
async function loadVersionCard(){
  const meta = curServer()?.meta; if(!meta) return;
  document.getElementById('verCurrent').textContent = `ahora: ${loaderName(meta.loader)} ${meta.mcVersion}`;
  const sel = document.getElementById('verLoader');
  const field = document.getElementById('verLoaderField');
  const swappable = meta.loader==='vanilla' || meta.loader==='paper';
  field.style.display = swappable ? '' : 'none';
  sel.innerHTML = swappable
    ? `<option value="vanilla">Vanilla (sin plugins)</option><option value="paper">Paper (admite plugins y mapa)</option>`
    : `<option value="${meta.loader}">${loaderName(meta.loader)}</option>`;
  sel.value = meta.loader;
  loadVersionOptions();
}
async function loadVersionOptions(){
  const meta = curServer()?.meta; if(!meta) return;
  const loader = document.getElementById('verLoader').value || meta.loader;
  const sel = document.getElementById('verSelect');
  sel.innerHTML = '<option>Cargando…</option>';
  try {
    const { versions } = await API.get('/catalog/'+loader);
    const cur = versions.indexOf(meta.mcVersion);
    // solo hacia arriba: las que están por delante de la actual en el catálogo (ordenado de nueva a vieja)
    const newer = cur>=0 ? versions.slice(0, cur) : versions;
    const same = loader===meta.loader;
    const opts = (same ? newer : versions);
    sel.innerHTML = opts.length
      ? opts.map(v=>`<option value="${v}">${v}${v===meta.mcVersion?' (actual)':''}</option>`).join('')
      : `<option value="">No hay versión más nueva de ${loaderName(loader)}</option>`;
    if(!same && opts.includes(meta.mcVersion)) sel.value = meta.mcVersion;
  } catch(err){ sel.innerHTML = '<option value="">Error cargando versiones</option>'; }
}
async function changeVersion(){
  const meta = curServer()?.meta; if(!meta) return;
  const version = document.getElementById('verSelect').value;
  const loader = document.getElementById('verLoader').value || meta.loader;
  if(!version){ toast('alert','Elige una versión','warn'); return; }
  try {
    const r = await API.post(`/servers/${meta.id}/version`, { version, loader });
    toast('refresh', `Cambiando a ${loaderName(loader)} ${version}. Backup previo: ${r.backup}.zip. Sigue el progreso en el Dashboard.`, 'info');
    await refreshServers();
    renderProvisionBanner();
    go('dashboard');
  } catch(err){ toast('alert', err.message, 'err'); }
}
onWS((msg)=>{
  if(msg.type!=='migration' || msg.id!==curServerId()) return;
  const parts = [];
  if(msg.updated?.length) parts.push(`${msg.updated.length} actualizados`);
  if(msg.disabled?.length) parts.push(`${msg.disabled.length} desactivados (${msg.disabled.join(', ')})`);
  if(msg.manual?.length) parts.push(`${msg.manual.length} manuales a revisar`);
  toast(msg.disabled?.length?'alert':'check', `Mods revisados: ${parts.join(' · ') || 'todo compatible'}`, msg.disabled?.length?'warn':'ok');
});

/* ---------- Subidas (mods, mundo, backup) ---------- */
function uploadFile(url, file, onProgress){
  return new Promise((resolve, reject)=>{
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = e=>{ if(e.lengthComputable && onProgress) onProgress(e.loaded/e.total); };
    xhr.onload = ()=>{
      let data = {}; try { data = JSON.parse(xhr.responseText); } catch { /* vacío */ }
      if(xhr.status>=200 && xhr.status<300) resolve(data); else reject(new Error(data.error || `HTTP ${xhr.status}`));
    };
    xhr.onerror = ()=>reject(new Error('Fallo de red durante la subida'));
    xhr.send(file);
  });
}
async function uploadMods(files){
  const list = [...(files||[])].filter(f=>f.name.endsWith('.jar'));
  if(!list.length){ toast('alert','Solo se admiten archivos .jar','warn'); return; }
  let ok = 0;
  for(const f of list){
    try { await uploadFile(`/api/servers/${curServerId()}/upload/mod?name=${encodeURIComponent(f.name)}`, f); ok++; }
    catch(err){ toast('alert', `${f.name}: ${err.message}`, 'err'); }
  }
  if(ok) toast('check', `${ok} archivo${ok===1?'':'s'} subido${ok===1?'':'s'} · se carga${ok===1?'':'n'} al reiniciar`, 'ok');
  loadInstalledMods();
}
async function uploadWorld(file){
  if(!file) return;
  if(!file.name.endsWith('.zip')){ toast('alert','El mundo tiene que ir en un .zip','warn'); return; }
  if(state.online){ toast('alert','Detén el servidor antes de importar un mundo','warn'); return; }
  const prog = document.getElementById('worldUploadProgress');
  try {
    prog.textContent = 'Haciendo backup del mundo actual…';
    await API.post(`/servers/${curServerId()}/backups`);
    await uploadFile(`/api/servers/${curServerId()}/upload/world?name=${encodeURIComponent(file.name)}`, file,
      p=>{ prog.textContent = `Subiendo ${file.name}… ${Math.round(p*100)} %`; });
    prog.textContent = '';
    toast('check', 'Mundo importado. Arranca el servidor para entrar en él.', 'ok');
  } catch(err){ prog.textContent=''; toast('alert', err.message, 'err'); }
}
async function uploadBackup(file){
  if(!file) return;
  if(!file.name.endsWith('.zip')){ toast('alert','El backup tiene que ser un .zip','warn'); return; }
  const prog = document.getElementById('backupUploadProgress');
  try {
    await uploadFile(`/api/servers/${curServerId()}/upload/backup?name=${encodeURIComponent(file.name)}`, file,
      p=>{ prog.textContent = `Subiendo ${file.name}… ${Math.round(p*100)} %`; });
    prog.textContent = '';
    toast('check', 'Backup añadido a la lista', 'ok');
    loadBackups();
  } catch(err){ prog.textContent=''; toast('alert', err.message, 'err'); }
}
function downloadFriendsMrpack(){ downloadFriendsPack('mrpack'); }

/* pack de amigos: primero se enseña qué entra y qué se queda fuera (mods solo de servidor), luego se descarga */
async function downloadFriendsPack(kind){
  const enabled = (state.installedMods||[]).filter(m=>m.enabled);
  if(!enabled.length){ toast('alert','No hay mods activos que empaquetar','warn'); return; }
  let p;
  try { p = await API.get(`/servers/${curServerId()}/mods/pack/preview`); }
  catch(err){ toast('alert', err.message, 'err'); return; }
  if(!p.needed.length && !p.optional.length){ toast('alert', `Ninguno de los ${enabled.length} mods hace falta en el cliente: tus amigos entran sin instalar nada`, 'info'); return; }
  const url = kind==='mrpack' ? `/api/servers/${curServerId()}/mods/pack.mrpack` : `/api/servers/${curServerId()}/mods/pack`;
  showPackPreview(p, kind, url);
}
function showPackPreview(p, kind, url){
  let ov = document.getElementById('packOverlay');
  if(!ov){
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="packOverlay"><div class="modal" id="packModal"></div></div>`);
    ov = document.getElementById('packOverlay');
    ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
  }
  const list = (arr, cls) => arr.length ? `<div class="day-chips" style="margin-top:6px">${arr.map(n=>`<span class="day-chip ${cls}" style="cursor:default">${esc(n)}</span>`).join('')}</div>` : '';
  document.getElementById('packModal').innerHTML = `
    <h3 style="font-size:16px;font-weight:650;margin-bottom:4px;">Pack para tus amigos (${kind==='mrpack'?'.mrpack':'.zip'})</h3>
    <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px;">Según lo que Modrinth dice de cada mod: lo que hace falta para entrar, lo opcional y lo que es solo de servidor.</p>
    <div class="mini-label" style="color:var(--accent)">Necesarios para entrar (${p.needed.length})</div>
    ${p.needed.length ? list(p.needed,'on') : '<p class="ram-hint">Ninguno: con el loader instalado ya pueden entrar.</p>'}
    ${p.deps.length?`<p class="ram-hint" style="margin-top:6px">Incluye ${p.deps.length} que entran por ser dependencia de otro mod (${esc(p.deps.join(', '))}).</p>`:''}
    ${p.unknown.length?`<p class="ram-hint warn" style="margin-top:6px">${p.unknown.length} subido${p.unknown.length===1?'':'s'} a mano: no sé si hacen falta en cliente, así que van por si acaso (${esc(p.unknown.join(', '))}).</p>`:''}
    <div class="mini-label" style="margin-top:14px;color:var(--info)">Opcionales, no hacen falta para entrar (${p.optional.length})</div>
    ${p.optional.length ? list(p.optional,'') : '<p class="ram-hint">Ninguno.</p>'}
    ${p.optional.length && kind==='mrpack' ? '<p class="ram-hint" style="margin-top:6px">En el .mrpack van marcados como opcionales: el launcher deja elegirlos.</p>' : ''}
    <div class="mini-label" style="margin-top:14px;color:var(--violet)">Solo de servidor, se quedan fuera (${p.serverOnly.length})</div>
    ${p.serverOnly.length ? list(p.serverOnly,'') : '<p class="ram-hint">Ninguno.</p>'}
    <div style="display:flex;gap:9px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap;">
      ${p.optional.length && kind==='zip' ? `<button class="btn ghost" onclick="triggerDownload('${url}?all=1',''); document.getElementById('packOverlay').classList.remove('open')">Incluir también los opcionales</button>` : ''}
      <button class="btn" onclick="document.getElementById('packOverlay').classList.remove('open')">Cancelar</button>
      <button class="btn primary" ${!p.needed.length && kind==='zip' ? 'disabled' : ''} onclick="triggerDownload('${url}',''); document.getElementById('packOverlay').classList.remove('open'); toast('check','Descargando el pack${kind==='mrpack'?' · impórtalo en Prism, Modrinth App o ATLauncher':' · descomprímelo en la carpeta mods del cliente; dentro va un LEEME'}','ok')">${icon('download',14)} Descargar ${kind==='mrpack' ? '.mrpack' : `${p.needed.length} mods`}</button>
    </div>`;
  ov.classList.add('open');
}

/* ---------- Backups: horario ---------- */
document.getElementById('bkDays').innerHTML = DAY_NAMES.map((d,i)=>
  `<span class="day-chip on" data-day="${i}" onclick="this.classList.toggle('on'); saveBackupSchedule()">${d}</span>`).join('');
function renderBackupSchedule(){
  const meta = curServer()?.meta; if(!meta) return;
  document.getElementById('bkTime').value = meta.backupTime || '04:00';
  const days = meta.backupDays?.length ? meta.backupDays : [0,1,2,3,4,5,6];
  document.querySelectorAll('#bkDays .day-chip').forEach(c=>c.classList.toggle('on', days.includes(parseInt(c.dataset.day))));
  document.getElementById('bkSchedHint').textContent = days.length===7
    ? `Cada día a las ${meta.backupTime || '04:00'}.`
    : `Los ${days.map(d=>DAY_NAMES[d]).join(', ')} a las ${meta.backupTime || '04:00'}.`;
}
let bkSchedTimer = null;
function saveBackupSchedule(){
  clearTimeout(bkSchedTimer);
  bkSchedTimer = setTimeout(async ()=>{
    const time = document.getElementById('bkTime').value || '04:00';
    const days = [...document.querySelectorAll('#bkDays .day-chip.on')].map(c=>parseInt(c.dataset.day));
    if(!days.length){ toast('alert','Elige al menos un día','warn'); renderBackupSchedule(); return; }
    try {
      await API.put(`/servers/${curServerId()}/backup-settings`, { time, days });
      const meta = curServer()?.meta; if(meta){ meta.backupTime = time; meta.backupDays = days.length===7 ? undefined : days; }
      renderBackupSchedule(); renderEvents(); renderDashTasks();
      toast('check', 'Horario del backup guardado', 'ok');
    } catch(err){ toast('alert', err.message, 'err'); }
  }, 400);
}

/* ---------- Jugadores: caras, historial y tiempo que avanza ---------- */
function headUrl(name, size){ return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`; }
function fmtAgo(iso){
  const diff = (Date.now() - new Date(iso)) / 60000;
  if(diff < 1) return 'ahora mismo';
  if(diff < 60) return `hace ${Math.round(diff)} min`;
  if(diff < 48*60) return `hace ${Math.round(diff/60)} h`;
  return `hace ${Math.round(diff/1440)} días`;
}
async function loadPlayerHistory(){
  const id = curServerId(); if(!id) return;
  let h = { recent:[], players:[] };
  try { h = await API.get(`/servers/${id}/players/history`); } catch { /* sin historial */ }
  const online = new Set(state.players.map(p=>p.name));
  document.getElementById('playerRecent').innerHTML = h.recent.map(e=>`
    <div class="hist-row">
      <img class="mini-avatar" src="${headUrl(e.name,22)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="who">${esc(e.name)}</span>
      <span style="color:${e.kind==='join'?'var(--accent)':'var(--muted2)'}">${e.kind==='join'?'entró':'salió'}</span>
      <span class="when">${fmtAgo(e.at)}</span>
    </div>`).join('') || '<div class="empty" style="padding:14px">Nadie ha entrado todavía</div>';
  document.getElementById('playerKnown').innerHTML = h.players.slice(0,30).map(p=>`
    <div class="hist-row">
      <img class="mini-avatar" src="${headUrl(p.name,22)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="who">${esc(p.name)} ${online.has(p.name)?'<span class="chip green">EN LÍNEA</span>':''}</span>
      <span class="when">${online.has(p.name)?'':fmtAgo(p.lastSeen)+' · '}${p.sessions} visita${p.sessions===1?'':'s'} · ${p.totalMinutes>=60?`${Math.round(p.totalMinutes/60)} h`:`${p.totalMinutes} min`}</span>
    </div>`).join('') || '<div class="empty" style="padding:14px">Sin jugadores conocidos</div>';
}
// el «12 min en línea» de cada jugador avanza solo mientras la sección está a la vista
setInterval(()=>{
  if(!document.getElementById('sec-players').classList.contains('visible') || !state.players.length) return;
  document.querySelectorAll('#playerList .player-row').forEach((row,i)=>{
    const p = state.players[i]; const meta = row.querySelector('.player-meta');
    if(p && meta) meta.textContent = `${fmtDur(Date.now()-p.joinedAt)} en línea`;
  });
}, 30000);

/* ---------- Consola: filtro por nivel y búsqueda ---------- */
state.consoleLevel = 'all';
function setConsoleFilter(lvl){
  state.consoleLevel = lvl;
  document.querySelectorAll('#consoleFilter .tab').forEach(t=>t.classList.toggle('active', t.dataset.lvl===lvl));
  applyConsoleFilter();
}
function lineMatchesFilter(line){
  const lvl = state.consoleLevel;
  const q = document.getElementById('consoleSearch').value.trim().toLowerCase();
  const type = line.dataset.type || 'info';
  if(lvl==='warn' && type!=='warn' && type!=='err') return false;
  if(lvl==='err' && type!=='err') return false;
  if(q && !line.textContent.toLowerCase().includes(q)) return false;
  return true;
}
function applyConsoleFilter(){
  const lines = consoleBody.querySelectorAll('.console-line');
  let shown = 0;
  lines.forEach(l=>{ const ok = lineMatchesFilter(l); l.classList.toggle('hidden', !ok); if(ok) shown++; });
  if(state.autoscroll) consoleBody.scrollTop = consoleBody.scrollHeight;
  const q = document.getElementById('consoleSearch').value.trim();
  document.getElementById('consoleSearch').title = q || state.consoleLevel!=='all' ? `${shown} de ${lines.length} líneas` : '';
}

/* ---------- playit: túneles detectados → dirección pública ---------- */
function renderTunnels(st){
  const el = document.getElementById('ptTunnels');
  const tunnels = st.tunnels || [];
  if(!st.running || !tunnels.length){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display = '';
  const cur = curServer()?.meta?.publicAddress;
  el.innerHTML = `<div class="mini-label">Túneles detectados</div>` + tunnels.map(t=>`
    <div class="copy-field" style="margin-top:6px"><span>${esc(t)}</span>
      ${cur===t?'<span class="chip green">EN USO</span>':`<button class="btn small" onclick="usePublicAddress('${esc(t)}')" title="Ponerla como dirección para tus amigos en el Dashboard">Usar</button>`}
    </div>`).join('');
}
async function usePublicAddress(addr){
  try {
    await API.put(`/servers/${curServerId()}/address`, { publicAddress: addr });
    const meta = curServer()?.meta; if(meta) meta.publicAddress = addr;
    renderAddress(); renderTunnels(state.playit||{});
    toast('check', `Tus amigos entran por ${addr}`, 'ok');
  } catch(err){ toast('alert', err.message, 'err'); }
}
