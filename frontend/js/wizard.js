/* =================== WIZARD: CREAR SERVIDOR (versión suelta o modpack de Modrinth) =================== */
const LOADER_LABELS = { vanilla: 'Vanilla', paper: 'Paper (plugins)', fabric: 'Fabric (mods)', forge: 'Forge (mods)', neoforge: 'NeoForge (mods)' };
const LOADER_NAMES = { vanilla: 'Vanilla', paper: 'Paper', fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge' };
const LOADER_HINTS = {
  vanilla: 'El servidor oficial tal cual. Sin mods ni plugins.',
  paper: 'Vanilla optimizado que admite plugins (EssentialsX, WorldEdit, BlueMap…). Los jugadores entran con el cliente normal, sin instalar nada.',
  fabric: 'Mods ligeros y modernos. Tus amigos necesitan Fabric y los mismos mods en su cliente (el pack .mrpack se lo pone fácil).',
  forge: 'El loader clásico de los grandes packs. Tus amigos necesitan Forge y los mismos mods.',
  neoforge: 'Sucesor de Forge para 1.20.2 en adelante. Tus amigos necesitan NeoForge y los mismos mods.',
};

document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay" id="wizardOverlay">
  <div class="modal" style="width:min(560px, calc(100vw - 40px));">
    <h3 style="font-size:16px;font-weight:650;margin-bottom:4px;">Crear servidor</h3>
    <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px;">CraftDeck descarga Java y el servidor por ti.</p>
    <div class="tabs" style="margin-bottom:14px;">
      <div class="tab active" data-wztab="version" onclick="switchWizardTab('version')">Elegir versión</div>
      <div class="tab" data-wztab="modpack" onclick="switchWizardTab('modpack')">Desde un modpack</div>
    </div>
    <div class="field"><label>Nombre</label><input type="text" id="wzName" placeholder="Mi servidor" maxlength="40"></div>

    <div id="wztab-version">
      <div class="form-grid" style="margin-top:13px;">
        <div class="field"><label>Tipo</label>
          <select id="wzLoader">${Object.entries(LOADER_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Versión de Minecraft</label>
          <select id="wzVersion"><option>Cargando…</option></select>
        </div>
      </div>
      <p class="ram-hint" id="wzLoaderHint" style="margin-top:8px;"></p>
    </div>

    <div id="wztab-modpack" style="display:none;">
      <div class="search-wrap" style="margin-top:13px;">
        <i data-icon="search" data-size="15"></i>
        <input type="text" id="wzPackSearch" placeholder="Buscar modpacks en Modrinth… prueba: cobblemon, create, better minecraft" oninput="onPackSearchInput()">
      </div>
      <div id="wzPackResults" style="max-height:220px;overflow-y:auto;margin-top:10px;"></div>
      <div id="wzPackPicked" style="display:none;margin-top:12px;">
        <div class="field"><label>Versión del modpack</label><select id="wzPackVersion"></select></div>
        <p class="ram-hint" id="wzPackHint"></p>
      </div>
    </div>

    <div class="field" style="margin-top:13px;"><label>RAM asignada · <span class="slider-val" id="wzRamVal">2048</span> MB</label>
      <div class="slider-row"><input type="range" id="wzRam" min="1024" max="12288" step="512" value="2048"></div>
      <p class="ram-hint" id="wzRamHint"></p>
    </div>
    <label style="display:flex;align-items:center;gap:9px;margin-top:15px;font-size:12.5px;color:var(--muted2);cursor:pointer;">
      <input type="checkbox" id="wzEula" style="accent-color:var(--accent);width:15px;height:15px;">
      Acepto la <a href="https://aka.ms/MinecraftEULA" target="_blank" style="color:var(--accent)">EULA de Minecraft</a>
    </label>
    <div id="wzProgress" style="display:none;margin-top:14px;max-height:160px;overflow-y:auto;background:#070708;border:1px solid var(--border);border-radius:9px;padding:10px 13px;font-family:var(--mono);font-size:11.5px;line-height:1.7;color:var(--muted2);"></div>
    <div style="display:flex;gap:9px;justify-content:flex-end;margin-top:18px;">
      <button class="btn" id="wzCancel">Cancelar</button>
      <button class="btn primary" id="wzCreate">Crear servidor</button>
    </div>
  </div>
</div>`);

const wzOverlay = document.getElementById('wizardOverlay');
const wzVersion = document.getElementById('wzVersion');
const wzProgress = document.getElementById('wzProgress');
let wzCreatingId = null;
let wzTab = 'version';
let wzPack = null; // { slug, title } elegido en la pestaña de modpacks

document.getElementById('wzRam').oninput = function () { document.getElementById('wzRamVal').textContent = this.value; updateRamHint('wz'); };
document.getElementById('wzCancel').onclick = closeCreateWizard;
wzOverlay.addEventListener('click', (e) => { if (e.target === wzOverlay && !wzCreatingId) closeCreateWizard(); });

function switchWizardTab(tab) {
  wzTab = tab;
  document.querySelectorAll('[data-wztab]').forEach((t) => t.classList.toggle('active', t.dataset.wztab === tab));
  document.getElementById('wztab-version').style.display = tab === 'version' ? '' : 'none';
  document.getElementById('wztab-modpack').style.display = tab === 'modpack' ? '' : 'none';
  // un modpack necesita más RAM que un server pelado
  if (tab === 'modpack' && Number(document.getElementById('wzRam').value) < 4096) {
    document.getElementById('wzRam').value = 4096; document.getElementById('wzRamVal').textContent = 4096; updateRamHint('wz');
  }
}

async function loadWizardVersions() {
  const loader = document.getElementById('wzLoader').value;
  document.getElementById('wzLoaderHint').textContent = LOADER_HINTS[loader] || '';
  wzVersion.innerHTML = '<option>Cargando…</option>';
  try {
    const { versions } = await API.get('/catalog/' + loader);
    wzVersion.innerHTML = versions.map((v) => `<option value="${v}">${v}</option>`).join('');
  } catch (err) {
    wzVersion.innerHTML = '<option value="">Error cargando versiones</option>';
    toast('alert', 'No se pudo cargar el catálogo: ' + err.message, 'err');
  }
}
document.getElementById('wzLoader').onchange = loadWizardVersions;

/* ---- modpacks ---- */
let packSearchTimer = null;
function onPackSearchInput() {
  clearTimeout(packSearchTimer);
  packSearchTimer = setTimeout(() => searchModpacks(document.getElementById('wzPackSearch').value.trim()), 400);
}
async function searchModpacks(query) {
  const box = document.getElementById('wzPackResults');
  box.innerHTML = '<div class="searching" style="padding:18px"><span class="spin"></span> Buscando…</div>';
  const facets = [['project_type:modpack'], ['server_side:required', 'server_side:optional']];
  const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=12&index=${query ? 'relevance' : 'downloads'}&facets=${encodeURIComponent(JSON.stringify(facets))}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { hits } = await res.json();
    box.innerHTML = hits.map((h) => `
      <div class="ss-item" style="gap:10px;align-items:flex-start;padding:8px" onclick="pickModpack('${esc(h.slug)}', '${esc(h.title).replace(/'/g, '&#39;')}')">
        <div class="mod-icon" style="width:36px;height:36px;border-radius:8px">${h.icon_url ? `<img src="${esc(h.icon_url)}" alt="" loading="lazy">` : icon('package', 16)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:620">${esc(h.title)} ${wzPack?.slug === h.slug ? '<span class="chip green">ELEGIDO</span>' : ''}</div>
          <div style="font-size:11.5px;color:var(--muted);line-height:1.5">${esc(h.description).slice(0, 110)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">${icon('download', 10)} ${fmtNum(h.downloads)} · ${(h.categories || []).filter((c) => ['fabric', 'forge', 'neoforge', 'quilt'].includes(c)).join(', ') || 'loader ?'} · ${(h.versions || []).slice(-1)[0] || ''}</div>
        </div>
      </div>`).join('') || '<div class="empty" style="padding:14px">Sin resultados</div>';
  } catch (err) {
    box.innerHTML = `<div class="empty" style="padding:14px">No se pudo buscar en Modrinth: ${esc(err.message)}</div>`;
  }
}
async function pickModpack(slug, title) {
  wzPack = { slug, title };
  searchModpacks(document.getElementById('wzPackSearch').value.trim());
  const picked = document.getElementById('wzPackPicked');
  const sel = document.getElementById('wzPackVersion');
  picked.style.display = '';
  sel.innerHTML = '<option>Cargando versiones…</option>';
  document.getElementById('wzPackHint').textContent = '';
  if (!document.getElementById('wzName').value.trim()) document.getElementById('wzName').value = title.slice(0, 40);
  try {
    const { versions } = await API.get(`/modpacks/${slug}/versions`);
    if (!versions.length) { sel.innerHTML = '<option value="">Este pack no tiene versiones para Fabric, Forge o NeoForge</option>'; return; }
    sel.innerHTML = versions.map((v) => `<option value="${v.id}">${esc(v.versionNumber)} · ${LOADER_NAMES[v.loader] || v.loader} ${esc(v.game)}</option>`).join('');
    document.getElementById('wzPackHint').textContent = 'CraftDeck descarga los mods del pack que hacen falta en el servidor (los que son solo de cliente se omiten) y monta el loader que pide.';
  } catch (err) {
    sel.innerHTML = '<option value="">Error cargando versiones</option>';
    toast('alert', err.message, 'err');
  }
}

function openCreateWizard() {
  wzCreatingId = null;
  wzProgress.style.display = 'none';
  wzProgress.innerHTML = '';
  document.getElementById('wzCreate').disabled = false;
  wzOverlay.classList.add('open');
  hydrateIcons(wzOverlay);
  loadWizardVersions();
  loadSystemInfo().then(() => updateRamHint('wz'));
  if (wzTab === 'modpack' && !document.getElementById('wzPackResults').innerHTML) searchModpacks('');
}

function closeCreateWizard() { wzOverlay.classList.remove('open'); }

document.querySelectorAll('[data-wztab]').forEach((t) => t.addEventListener('click', () => { if (wzTab === 'modpack' && !document.getElementById('wzPackResults').innerHTML) searchModpacks(''); }));

document.getElementById('wzCreate').onclick = async () => {
  const name = document.getElementById('wzName').value.trim();
  const memoryMb = Number(document.getElementById('wzRam').value);
  const acceptEula = document.getElementById('wzEula').checked;
  if (!name) { toast('alert', 'Ponle un nombre al servidor', 'warn'); return; }
  const body = { name, memoryMb, acceptEula };
  if (wzTab === 'modpack') {
    const versionId = document.getElementById('wzPackVersion').value;
    if (!wzPack || !versionId) { toast('alert', 'Elige un modpack y una versión', 'warn'); return; }
    body.modpackVersionId = versionId;
  } else {
    body.loader = document.getElementById('wzLoader').value;
    body.version = wzVersion.value;
    if (!body.version) { toast('alert', 'Elige una versión', 'warn'); return; }
  }
  if (!acceptEula) { toast('alert', 'Tienes que aceptar la EULA para crear el servidor', 'warn'); return; }
  if (updateRamHint('wz')) { toast('alert', 'Esa RAM no cabe en tu Umbrel ahora mismo; baja el valor', 'warn'); return; }

  document.getElementById('wzCreate').disabled = true;
  wzProgress.style.display = 'block';
  wzProgress.innerHTML = `<div>${wzTab === 'modpack' ? 'Leyendo el modpack…' : 'Creando servidor…'}</div>`;
  try {
    const meta = await API.post('/servers', body);
    wzCreatingId = meta.id;
    refreshServers();
  } catch (err) {
    wzProgress.innerHTML += `<div style="color:var(--danger)">${esc(err.message)}</div>`;
    document.getElementById('wzCreate').disabled = false;
  }
};

/* =================== SERVIDORES REALES EN EL SWITCHER =================== */
async function refreshServers() {
  try {
    const servers = await API.get('/servers');
    state.servers = servers.map((s) => ({
      id: s.id,
      name: s.name,
      sub: `${LOADER_NAMES[s.loader] || s.loader} ${s.mcVersion} · :${s.port}`,
      status: s.runtime && s.runtime.status !== 'offline'
        ? s.runtime.status
        : (s.provision.status === 'ready' ? 'offline' : s.provision.status),
      meta: s,
    }));
    renderServerMenu();
    if (!state.servers.some((s) => s.id === state.currentServerId)) state.currentServerId = state.servers[0]?.id ?? null;
    const cur = curServer();
    if (cur) {
      document.getElementById('ssName').textContent = cur.name;
      document.getElementById('ssSub').textContent = cur.sub;
      document.getElementById('ssDot').style.background = serverDotColor(cur);
    } else {
      document.getElementById('ssName').textContent = 'Sin servidores';
      document.getElementById('ssSub').textContent = 'Crea uno para empezar';
      document.getElementById('ssDot').style.background = 'var(--muted)';
    }
    if (!window.__liveInit) {
      window.__liveInit = true;
      if (typeof onServerSwitched === 'function') onServerSwitched();
    } else {
      renderAddress();
      renderProvisionBanner();
    }
  } catch (err) {
    console.warn('No se pudo cargar la lista de servidores', err);
  }
}
refreshServers();

// la lista cambió en el backend (borrado, reintento de creación, cambio de versión…): resincronizar
onWS((msg) => { if (msg.type === 'servers') refreshServers(); });

onWS((msg) => {
  if (msg.type !== 'provision' || msg.id !== wzCreatingId) return;
  const div = document.createElement('div');
  if (msg.status === 'error') { div.style.color = 'var(--danger)'; div.textContent = '✗ ' + msg.msg; }
  else div.textContent = msg.msg;
  wzProgress.appendChild(div);
  wzProgress.scrollTop = wzProgress.scrollHeight;
  if (msg.status === 'error') {
    document.getElementById('wzCreate').disabled = false;
    wzCreatingId = null;
    toast('alert', 'Falló la creación del servidor', 'err');
  } else if (/listo\.$/.test(msg.msg)) {
    toast('check', 'Servidor creado y listo para arrancar', 'ok');
    wzCreatingId = null;
    setTimeout(() => { closeCreateWizard(); if (typeof refreshServers === 'function') refreshServers(); }, 900);
  }
});
