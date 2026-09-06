/* =================== 0.7: dormido, TPS, gráficas 24 h, acciones rápidas, baneados, datapacks, Chunky, icono, MOTD, almacenamiento, clonar =================== */

/* ---------- estado «dormido» ---------- */
function isSleeping(){ return !!curServer()?.meta?.runtime?.sleeping || !!state.sleeping; }
function renderSleepBanner(){
  let el = document.getElementById('sleepBanner');
  if(!el){
    el = document.createElement('div'); el.id = 'sleepBanner'; el.style.display = 'none';
    document.getElementById('provisionBanner').insertAdjacentElement('afterend', el);
  }
  const meta = curServer()?.meta;
  if(!state.sleeping || !meta){ el.style.display = 'none'; el.innerHTML = ''; return; }
  const wake = meta.wakeOnConnect !== false;
  el.style.display = '';
  el.innerHTML = `<div class="banner info" style="border-color:rgba(167,139,250,.35);background:var(--violet-dim)"><span class="banner-icon" style="color:var(--violet)">${icon('power',18)}</span>
    <div class="banner-body"><div class="banner-title">Dormido: se apagó por llevar ${meta.idleStopMinutes || '?'} min sin nadie</div>
    <div style="font-size:12.5px;color:var(--muted2);margin-top:4px;line-height:1.6">${wake
      ? 'CraftDeck está escuchando en su puerto. En la lista de servidores de tus amigos sale «dormido» y, cuando alguien intente entrar, se arrancará solo (en un minuto pueden jugar). También puedes arrancarlo tú con «Iniciar».'
      : 'No se despierta solo (lo tienes desactivado en Rendimiento). Arráncalo con «Iniciar» cuando vayáis a jugar.'}</div></div></div>`;
}

/* ---------- TPS y gráficas con historial ---------- */
state.chartRange = 'live';
state.metricsSamples = [];
function setChartRange(r){
  state.chartRange = r;
  document.querySelectorAll('[data-range]').forEach(t=>t.classList.toggle('active', t.dataset.range===r));
  if(r!=='live') loadMetricsHistory().then(tickCharts); else tickCharts();
}
async function loadMetricsHistory(){
  const id = curServerId(); if(!id) return;
  try { ({ samples: state.metricsSamples } = await API.get(`/servers/${id}/metrics/history`)); } catch { state.metricsSamples = []; }
}
/** Series para las gráficas según el rango: en vivo (últimos ~4 min a 3 s) o historial (1 h / 24 h a 30 s). */
function chartSeries(){
  if(state.chartRange==='live') return { players: state.playersHistory, cpu: state.cpuHistory, ram: state.ramHistory };
  const span = state.chartRange==='1h' ? 3600_000 : 24*3600_000;
  const cutoff = Date.now() - span;
  const meta = curServer()?.meta;
  const s = state.metricsSamples.filter(x=>x.t > cutoff);
  return {
    players: s.map(x=>x.players),
    cpu: s.map(x=>Math.min(100, x.cpu)),
    ram: s.map(x=>meta ? Math.min(100, (x.mem / meta.memoryMb) * 100) : 0),
  };
}
function renderTps(tps){
  const sub = document.getElementById('statCpuSub');
  if(tps==null){ sub.textContent = 'Uso del proceso Java'; sub.style.color=''; return; }
  const t = Number(tps).toFixed(1);
  sub.textContent = `TPS ${t} / 20 · ${tps >= 19.5 ? 'va fluido' : tps >= 15 ? 'algo de lag' : 'lag serio'}`;
  sub.style.color = tps >= 19.5 ? 'var(--accent)' : tps >= 15 ? 'var(--warn)' : 'var(--danger)';
}
// cada 30 s en vivo también guardamos la muestra para que 1 h / 24 h se vayan rellenando sin recargar
onWS((msg)=>{
  if(msg.type!=='metrics' || msg.id!==curServerId()) return;
  renderTps(msg.tps);
  const last = state.metricsSamples[state.metricsSamples.length-1];
  if(!last || Date.now() - last.t >= 30000) state.metricsSamples.push({ t: Date.now(), cpu: msg.cpu, mem: msg.memMb, players: msg.players||0, tps: msg.tps ?? null });
});

/* ---------- consola: acciones rápidas ---------- */
const QUICK = [
  ['☀️ Día','time set day'], ['🌙 Noche','time set night'], ['🌤 Sol','weather clear'], ['🌧 Lluvia','weather rain'],
  ['💾 Guardar','save-all'], ['👥 Lista','list'], ['🕊 Pacífico','difficulty peaceful'], ['⚔️ Normal','difficulty normal'],
  ['🏠 Todos al spawn','execute as @a run tp @s ~ ~ ~'],
];
document.getElementById('quickActions').innerHTML = QUICK.map(([l,c])=>`<button class="btn small ghost" title="/${esc(c)}" onclick="quickCmd('${esc(c)}')">${l}</button>`).join('');
async function quickCmd(cmd){
  if(cmd.startsWith('execute as @a run tp')) cmd = 'execute in minecraft:overworld run tp @a 0 ~ 0'; // al spawn de verdad lo resolvemos abajo
  if(!state.online){ toast('alert','El servidor tiene que estar encendido','warn'); return; }
  try {
    if(cmd.includes('tp @a')){
      // spawn real: leer coordenadas del mundo no es trivial desde fuera; usamos el comando de spawnpoint del propio juego
      await API.post(`/servers/${curServerId()}/command`, { command: 'execute as @a at @s run spreadplayers 0 0 0 1 false @s' });
      toast('check','Todos teletransportados alrededor del spawn (0,0)','ok');
      return;
    }
    await API.post(`/servers/${curServerId()}/command`, { command: cmd });
    toast('terminal', `/${cmd}`, 'ok');
  } catch(err){ toast('alert', err.message, 'err'); }
}

/* ---------- jugadores: baneados, OP y ban sin estar conectados ---------- */
function renderBanned(){
  const b = state.playerLists?.banned || [];
  document.getElementById('bannedCount').textContent = b.length || '';
  document.getElementById('bannedCount').style.display = b.length ? '' : 'none';
  document.getElementById('bannedList').innerHTML = b.map(x=>`
    <div class="hist-row">
      <img class="mini-avatar" src="${headUrl(x.name,22)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="who">${esc(x.name)}</span>
      <span class="when">${esc(x.reason||'')}</span>
      <button class="btn small" onclick="playerAction('${esc(x.name)}','pardon')">${icon('check',12)} Desbanear</button>
    </div>`).join('') || '<div class="empty" style="padding:12px">Nadie está baneado</div>';
}
async function banByName(){
  const inp = document.getElementById('banName'); const name = inp.value.trim();
  if(!name) return;
  await playerAction(name, 'ban'); inp.value = '';
}
// «Jugadores conocidos» con botones: OP/quitar OP y ban/desbanear aunque el jugador no esté
const _loadPlayerHistory = loadPlayerHistory;
loadPlayerHistory = async function(){
  await _loadPlayerHistory();
  const ops = new Set((state.playerLists?.ops||[]).map(n=>n.toLowerCase()));
  const banned = new Set((state.playerLists?.banned||[]).map(x=>x.name.toLowerCase()));
  document.querySelectorAll('#playerKnown .hist-row').forEach(row=>{
    const name = row.querySelector('.who')?.childNodes[0]?.textContent.trim();
    if(!name) return;
    const op = ops.has(name.toLowerCase()), ban = banned.has(name.toLowerCase());
    row.insertAdjacentHTML('beforeend', `<span style="display:flex;gap:4px">
      <button class="icon-btn" title="${op?'Quitar OP':'Dar OP'}" style="width:26px;height:26px;${op?'color:var(--warn);border-color:rgba(251,191,36,.4)':''}" onclick="playerAction('${esc(name)}','${op?'deop':'op'}')">${icon('crown',12)}</button>
      <button class="icon-btn red" title="${ban?'Desbanear':'Banear'}" style="width:26px;height:26px;${ban?'color:var(--danger);border-color:rgba(248,113,113,.4)':''}" onclick="playerAction('${esc(name)}','${ban?'pardon':'ban'}')">${icon('ban',12)}</button>
    </span>`);
  });
  renderBanned();
};

/* ---------- datapacks ---------- */
state.datapacks = [];
let dpTimer = null;
function onDpSearchInput(){ clearTimeout(dpTimer); dpTimer = setTimeout(()=>searchDatapacks(document.getElementById('dpSearch').value.trim()), 400); }
async function loadDatapacks(){
  const id = curServerId(); if(!id) return;
  try { ({ installed: state.datapacks } = await API.get(`/servers/${id}/datapacks`)); } catch { state.datapacks = []; }
  const b = document.getElementById('tabDatapackCount'); b.textContent = state.datapacks.length || '';
  document.getElementById('dpInstalled').innerHTML = `<div class="mini-label" style="padding:4px 8px 8px">INSTALADOS (${state.datapacks.length}) · en world/datapacks</div>` + state.datapacks.map(p=>`
    <div class="player-row">
      <div class="avatar" style="color:var(--violet)">${p.iconUrl?`<img src="${esc(p.iconUrl)}" alt="" loading="lazy" onerror="this.remove()">`:icon('box',16)}</div>
      <div class="player-info"><div class="player-name">${esc(p.name)} ${!p.enabled?'<span class="chip gray">DESACTIVADO</span>':''} ${p.tracked?'':'<span class="chip gray">MANUAL</span>'}</div>
        <div class="player-meta" style="font-family:var(--mono)">${esc(p.versionNumber||p.filename)}</div></div>
      <label class="switch"><input type="checkbox" ${p.enabled?'checked':''} onchange="toggleDatapack('${esc(p.filename)}', this.checked)"><span class="track"></span><span class="thumb"></span></label>
      <button class="icon-btn red" style="width:auto;padding:0 8px" onclick="armAction(this, ()=>removeDatapack('${esc(p.filename)}'))">${icon('trash',13)}</button>
    </div>`).join('') || '<div class="empty" style="padding:14px">Sin datapacks. Busca arriba o sube un .zip.</div>';
}
async function searchDatapacks(query){
  const grid = document.getElementById('dpGrid');
  const game = curGame(); if(!game){ grid.innerHTML=''; return; }
  grid.innerHTML = '<div class="searching"><span class="spin"></span> Buscando datapacks…</div>';
  const facets = [['project_type:datapack'], [`versions:${game}`]];
  const url = `${MODRINTH_API}/search?query=${encodeURIComponent(query)}&limit=12&index=${query?'relevance':'downloads'}&facets=${encodeURIComponent(JSON.stringify(facets))}`;
  try {
    const res = await fetch(url); if(!res.ok) throw new Error('HTTP '+res.status);
    const { hits } = await res.json();
    const inst = new Set(state.datapacks.map(p=>p.projectId));
    grid.innerHTML = hits.map(h=>`
      <div class="card mod-card">
        <div class="mod-icon">${h.icon_url?`<img src="${esc(h.icon_url)}" alt="" loading="lazy">`:icon('box',20)}</div>
        <div class="mod-body">
          <div class="mod-title">${esc(h.title)} ${inst.has(h.project_id)?'<span class="chip green">INSTALADO</span>':''}</div>
          <div class="mod-desc">${esc(h.description).slice(0,150)}</div>
          <div class="mod-stats"><span>${icon('download',11)} ${fmtNum(h.downloads)}</span><span class="chip violet">DATAPACK ${esc(game)}</span></div>
          <div style="margin-top:12px">${inst.has(h.project_id)?'':`<button class="btn small primary" onclick="installDatapack('${esc(h.slug)}', this)">${icon('download',12)} Instalar</button>`}</div>
        </div>
      </div>`).join('') || '<div class="empty" style="grid-column:1/-1">Sin resultados</div>';
  } catch(err){ grid.innerHTML = `<div class="empty" style="grid-column:1/-1">No se pudo buscar en Modrinth: ${esc(err.message)}</div>`; }
}
async function installDatapack(slug, btn){
  btn.disabled = true; btn.textContent = 'Instalando…';
  try {
    const r = await API.post(`/servers/${curServerId()}/datapacks`, { project: slug });
    toast('check', `Datapack ${r.installed} instalado${r.applied?' y aplicado con /reload':' · se carga al arrancar'}`, 'ok');
    await loadDatapacks(); searchDatapacks(document.getElementById('dpSearch').value.trim());
  } catch(err){ toast('alert', err.message, 'err'); btn.disabled=false; btn.innerHTML = icon('download',12)+' Instalar'; }
}
async function toggleDatapack(f, on){
  try { await API.post(`/servers/${curServerId()}/datapacks/${encodeURIComponent(f)}/toggle`, { enabled: on }); toast(on?'check':'x', `${f} ${on?'activado':'desactivado'}`, on?'ok':'warn'); loadDatapacks(); }
  catch(err){ toast('alert', err.message, 'err'); loadDatapacks(); }
}
async function removeDatapack(f){
  try { await API.del(`/servers/${curServerId()}/datapacks/${encodeURIComponent(f)}`); toast('trash', `${f} eliminado`, 'warn'); loadDatapacks(); }
  catch(err){ toast('alert', err.message, 'err'); }
}
async function uploadDatapacks(files){
  const list = [...(files||[])].filter(f=>f.name.endsWith('.zip'));
  if(!list.length){ toast('alert','Los datapacks van en .zip','warn'); return; }
  for(const f of list){
    try { await uploadFile(`/api/servers/${curServerId()}/upload/datapack?name=${encodeURIComponent(f.name)}`, f); }
    catch(err){ toast('alert', `${f.name}: ${err.message}`, 'err'); }
  }
  toast('check','Datapack(s) subido(s)','ok'); loadDatapacks();
}
// la pestaña de datapacks se engancha al selector de pestañas de Mods
const _switchModTab = switchModTab;
switchModTab = function(tab){
  if(tab==='datapacks'){
    state.modTab = tab;
    document.querySelectorAll('[data-modtab]').forEach(t=>t.classList.toggle('active', t.dataset.modtab===tab));
    ['explore','installed','datapacks'].forEach(t=>{ document.getElementById('modtab-'+t).style.display = t===tab ? '' : 'none'; });
    loadDatapacks(); searchDatapacks(document.getElementById('dpSearch').value.trim());
    return;
  }
  document.getElementById('modtab-datapacks').style.display = 'none';
  _switchModTab(tab);
};

/* ---------- Chunky: pregenerar ---------- */
state.chunky = { running:false, pct:0, text:'' };
function renderChunky(){
  const box = document.getElementById('chunkyBox');
  const loader = curLoader();
  if(!loader || loader==='vanilla'){ box.innerHTML = '<p class="ram-hint">Chunky es un mod/plugin: pasa el servidor a Paper (Mundo → Versión) o usa uno Fabric/Forge/NeoForge.</p>'; return; }
  const installed = (state.installedMods||[]).some(m=>(m.slug||m.name||'').toLowerCase().includes('chunky'));
  if(!installed){
    box.innerHTML = `<button class="btn small primary" onclick="installChunky(this)">${icon('download',13)} Instalar Chunky</button>`;
    return;
  }
  const c = state.chunky;
  box.innerHTML = `
    <div class="form-grid">
      <div class="field"><label>Radio alrededor del spawn</label>
        <select id="chunkyRadius"><option value="500">500 bloques (rápido)</option><option value="1000" selected>1000 bloques</option><option value="2000">2000 bloques (largo)</option><option value="3000">3000 bloques (muy largo)</option></select></div>
      <div class="field"><label>Estado</label><div style="padding:10px 0;font-size:13px">${c.running?`<span class="chip green">EN MARCHA</span> ${c.pct}%`:(c.text?esc(c.text):'Parado')}</div></div>
    </div>
    ${c.running?`<div class="progress-track" style="margin-top:6px"><div class="progress-fill" style="width:${c.pct}%"></div></div>`:''}
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      ${c.running?`<button class="btn small danger" onclick="chunkyCmd('cancel')">${icon('stop',13)} Cancelar</button>`:`<button class="btn small primary" ${state.online?'':'disabled'} onclick="chunkyStart()">${icon('play',13)} Pregenerar</button>`}
      ${state.online?'':'<span class="ram-hint">Arranca el servidor para pregenerar.</span>'}
    </div>`;
}
async function installChunky(btn){
  btn.disabled = true; btn.textContent = 'Instalando…';
  try { await API.post(`/servers/${curServerId()}/mods`, { project: 'chunky' }); toast('check','Chunky instalado · reinicia el servidor si estaba encendido','ok'); await loadInstalledMods(); renderChunky(); }
  catch(err){ toast('alert', err.message, 'err'); btn.disabled=false; }
}
async function chunkyStart(){
  const r = document.getElementById('chunkyRadius').value;
  try {
    for(const cmd of ['chunky world world', `chunky radius ${r}`, 'chunky start']) await API.post(`/servers/${curServerId()}/command`, { command: cmd });
    state.chunky = { running:true, pct:0, text:'' }; renderChunky();
    toast('play', `Pregenerando ${r} bloques alrededor del spawn`, 'info');
  } catch(err){ toast('alert', err.message, 'err'); }
}
async function chunkyCmd(c){
  try { await API.post(`/servers/${curServerId()}/command`, { command: `chunky ${c}` }); state.chunky.running=false; state.chunky.text='Cancelado'; renderChunky(); }
  catch(err){ toast('alert', err.message, 'err'); }
}
onWS((msg)=>{
  if(msg.type!=='console' || msg.id!==curServerId()) return;
  const m = msg.line.match(/\[Chunky\] Task running for (\S+)\. Processed: (\d+) chunks \(([\d.]+)%\)/);
  if(m){ state.chunky = { running:true, pct:Math.round(parseFloat(m[3])), text:'' }; if(document.getElementById('sec-world').classList.contains('visible')) renderChunky(); return; }
  if(/\[Chunky\] Task finished/.test(msg.line)){ state.chunky = { running:false, pct:100, text:'Terminado ✔' }; renderChunky(); toast('check','Pregeneración terminada','ok'); }
  if(/\[Chunky\] Task stopped|cancelled/i.test(msg.line) && state.chunky.running){ state.chunky = { running:false, pct:0, text:'Cancelado' }; renderChunky(); }
});

/* ---------- icono del servidor ---------- */
function renderIcon(){
  const meta = curServer()?.meta; if(!meta) return;
  const prev = document.getElementById('iconPreview');
  prev.innerHTML = meta.serverIcon ? `<img src="/api/servers/${meta.id}/icon?t=${Date.now()}" alt="" style="width:64px;height:64px;image-rendering:pixelated">` : icon('package',22);
  document.getElementById('iconRemove').style.display = meta.serverIcon ? '' : 'none';
  document.getElementById('iconHint').textContent = meta.serverIcon ? 'Se aplica al reiniciar el servidor.' : 'Sin icono: los amigos verán el cubo gris por defecto.';
}
async function uploadIcon(file){
  if(!file) return;
  try {
    const r = await uploadFile(`/api/servers/${curServerId()}/upload/icon?name=server-icon.png`, file);
    const meta = curServer()?.meta; if(meta) meta.serverIcon = true;
    renderIcon(); toast('check', `Icono guardado${r.needsRestart?' · se ve al reiniciar':''}`, 'ok');
  } catch(err){ toast('alert', err.message, 'err'); }
}
async function removeIcon(){
  try { await API.del(`/servers/${curServerId()}/icon`); const meta = curServer()?.meta; if(meta) meta.serverIcon = false; renderIcon(); toast('x','Icono quitado','warn'); }
  catch(err){ toast('alert', err.message, 'err'); }
}

/* ---------- MOTD con colores ---------- */
const MC_COLORS = { '0':'#000000','1':'#0000AA','2':'#00AA00','3':'#00AAAA','4':'#AA0000','5':'#AA00AA','6':'#FFAA00','7':'#AAAAAA','8':'#555555','9':'#5555FF','a':'#55FF55','b':'#55FFFF','c':'#FF5555','d':'#FF55FF','e':'#FFFF55','f':'#FFFFFF' };
document.getElementById('motdTools').innerHTML =
  Object.entries(MC_COLORS).map(([k,c])=>`<button type="button" style="background:${c};color:${['0','1','4','5','8'].includes(k)?'#fff':'#000'}" title="§${k}" onclick="motdInsert('§${k}')">${k}</button>`).join('') +
  `<button type="button" class="fmt" onclick="motdInsert('§l')" title="Negrita"><b>N</b></button><button type="button" class="fmt" onclick="motdInsert('§o')" title="Cursiva"><i>C</i></button><button type="button" class="fmt" onclick="motdInsert('§r')" title="Quitar formato">reset</button><button type="button" class="fmt" onclick="motdInsert('\\n')" title="Segunda línea">↵ línea</button>`;
function motdInsert(code){
  const inp = document.getElementById('wMotd');
  const s = inp.selectionStart ?? inp.value.length, e = inp.selectionEnd ?? s;
  inp.value = inp.value.slice(0,s) + code + inp.value.slice(e);
  inp.focus(); inp.setSelectionRange(s+code.length, s+code.length); renderMotdPreview();
}
function renderMotdPreview(){
  const raw = document.getElementById('wMotd').value.replace(/\\n/g,'\n');
  let html = '', color = '#aaa', bold = false, italic = false;
  const flush = (t)=>{ if(t) html += `<span style="color:${color};${bold?'font-weight:700;':''}${italic?'font-style:italic;':''}">${esc(t)}</span>`; };
  let buf = '';
  for(let i=0;i<raw.length;i++){
    if(raw[i]==='§' && i+1<raw.length){
      flush(buf); buf='';
      const k = raw[i+1].toLowerCase(); i++;
      if(MC_COLORS[k]){ color = MC_COLORS[k]; bold=false; italic=false; }
      else if(k==='l') bold=true; else if(k==='o') italic=true; else if(k==='r'){ color='#aaa'; bold=false; italic=false; }
    } else buf += raw[i];
  }
  flush(buf);
  document.getElementById('motdPreview').innerHTML = html || '<span style="color:#555">Vista previa del MOTD</span>';
}
// Minecraft guarda los saltos de línea del MOTD como "\n" literal en server.properties: se dejan tal cual
const _loadWorld = loadWorld;
loadWorld = async function(){ await _loadWorld(); const inp = document.getElementById('wMotd'); inp.value = inp.value.replace(/\n/g,'\\n'); renderMotdPreview(); renderIcon(); renderChunky(); };

/* ---------- almacenamiento ---------- */
async function renderStorage(){
  const box = document.getElementById('storageBox');
  let s; try { s = await API.get('/storage'); } catch(err){ box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  const gb = mb => mb >= 1024 ? (mb/1024).toFixed(1)+' GB' : mb+' MB';
  const colors = ['#34d399','#60a5fa','#a78bfa','#fbbf24','#f87171','#22d3ee','#f472b6'];
  const parts = [...s.servers.map((x,i)=>({label:x.name, mb:x.serverMb + x.backupsMb, color:colors[i%colors.length], detail:`mundo ${gb(x.worldMb)} · backups ${gb(x.backupsMb)}`})),
    {label:'Java', mb:s.runtimesMb, color:'#9d9da6', detail:'runtimes descargados'}, {label:'Caché', mb:s.cacheMb, color:'#6f6f78', detail:'installers y descargas'}];
  const total = Math.max(1, s.totalMb);
  document.getElementById('storageHint').textContent = `${gb(s.totalMb)} usados por CraftDeck` + (s.diskFreeMb!=null ? ` · ${gb(s.diskFreeMb)} libres en el disco del Umbrel` : '');
  box.innerHTML = `<div class="storage-bar">${parts.filter(p=>p.mb>0).map(p=>`<span style="width:${(p.mb/total*100).toFixed(1)}%;background:${p.color}" title="${esc(p.label)} · ${gb(p.mb)}"></span>`).join('')}</div>
    <div class="storage-legend">${parts.map(p=>`<span><i style="background:${p.color}"></i>${esc(p.label)} <b style="color:var(--text)">${gb(p.mb)}</b> <span style="color:var(--muted)">· ${esc(p.detail)}</span></span>`).join('')}</div>
    ${s.diskFreeMb!=null && s.diskFreeMb < 5*1024 ? '<p class="ram-hint err" style="margin-top:10px">Queda poco espacio en el disco: borra backups antiguos o baja el número que se conservan.</p>' : ''}`;
}

/* ---------- clonar servidor ---------- */
function askClone(id, name){
  let ov = document.getElementById('cloneOverlay');
  if(!ov){ document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="cloneOverlay"><div class="modal" id="cloneModal"></div></div>`); ov = document.getElementById('cloneOverlay'); ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); }); }
  document.getElementById('cloneModal').innerHTML = `
    <h3 style="font-size:16px;font-weight:650;margin-bottom:4px;">Clonar «${esc(name)}»</h3>
    <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px;">Copia el mundo, mods y configuración a un servidor nuevo en otro puerto. Los backups no se copian. El original debe estar detenido.</p>
    <div class="field"><label>Nombre del clon</label><input type="text" id="cloneName" value="${esc(name)} (copia)" maxlength="40"></div>
    <div style="display:flex;gap:9px;justify-content:flex-end;margin-top:18px;">
      <button class="btn" onclick="document.getElementById('cloneOverlay').classList.remove('open')">Cancelar</button>
      <button class="btn primary" onclick="doClone('${id}')">${icon('copy',14)} Clonar</button>
    </div>`;
  ov.classList.add('open');
}
async function doClone(id){
  const name = document.getElementById('cloneName').value.trim();
  if(!name){ toast('alert','Ponle nombre','warn'); return; }
  try {
    await API.post(`/servers/${id}/clone`, { name });
    document.getElementById('cloneOverlay').classList.remove('open');
    toast('copy', `Clonando… el nuevo servidor aparecerá en la lista en cuanto termine de copiar`, 'info');
    setTimeout(renderServersOverview, 800);
  } catch(err){ toast('alert', err.message, 'err'); }
}

/* ---------- logs ---------- */
function refreshLogsLink(){ const a = document.getElementById('logsDownload'); if(a && curServerId()) a.href = `/api/servers/${curServerId()}/logs.zip`; }
