/* ============================================================
   app.js — router + UI rendering
   ============================================================ */

const APP = document.getElementById('app');
const NAV = document.getElementById('bottomnav');

let state = { screen: 'projects', project: null };

// Assigns val to obj[field], parsing to a number when field is a known
// numeric column so stored data (and the Excel export) uses real numbers
// instead of strings. Falls back to 0 on invalid numeric input rather than
// silently storing NaN.
function setField(obj, field, val, numericFields) {
  if (numericFields && numericFields.includes(field)) {
    const n = parseFloat(val);
    obj[field] = isNaN(n) ? 0 : n;
  } else {
    obj[field] = val;
  }
}

function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function inr(n) { return '₹' + fmt(n); }

function route(screen) {
  state.screen = screen;
  state.project = getActiveProject();
  const noProjectNeeded = screen === 'projects' || screen === 'account';
  if (!noProjectNeeded && !state.project) { state.screen = 'projects'; }
  render();
  window.scrollTo(0, 0);
}
window.route = route;

function refreshAndRender() {
  saveProject(state.project);
  render();
}

function render() {
  const showNav = state.screen !== 'projects' && state.screen !== 'account';
  NAV.classList.toggle('hidden', !showNav);
  if (showNav) renderNav();

  switch (state.screen) {
    case 'projects': APP.innerHTML = screenProjects(); break;
    case 'account': APP.innerHTML = screenAccount(); break;
    case 'dashboard': APP.innerHTML = screenDashboard(); break;
    case 'measurements': APP.innerHTML = screenMeasurements(); break;
    case 'coefficients': APP.innerHTML = screenCoefficients(); break;
    case 'rates': APP.innerHTML = screenRates(); break;
    case 'abstracts': APP.innerHTML = screenAbstracts(); break;
    case 'spend': APP.innerHTML = screenMaterialSpend(); break;
    case 'daily': APP.innerHTML = screenDailySpend(); break;
    case 'schedule': APP.innerHTML = screenSchedule(); break;
    case 'today': APP.innerHTML = screenToday(); break;
    case 'settings': APP.innerHTML = screenSettings(); break;
    default: APP.innerHTML = '<p>Not found</p>';
  }
}

function renderNav() {
  const items = [
    ['dashboard', '📊', 'Overview'],
    ['measurements', '📐', 'BOQ'],
    ['abstracts', '📊', 'Abstract'],
    ['daily', '💵', 'Spend'],
    ['schedule', '📅', 'Schedule'],
    ['settings', '⚙️', 'More'],
  ];
  NAV.innerHTML = items.map(([id, icon, label]) =>
    `<button class="navbtn ${state.screen === id ? 'active' : ''}" onclick="route('${id}')">
      <span class="navicon">${icon}</span><span>${label}</span>
    </button>`).join('');
}

/* ================= PROJECTS SCREEN ================= */
function screenProjects() {
  const projects = listProjects();
  return `
  <div class="topbar">
    <h1>My Projects</h1>
    <button class="iconbtn-light" onclick="route('account')" title="Account & Backup">☁️</button>
  </div>
  <div class="content">
    ${projects.length === 0 ? `<div class="empty">No projects yet. Create your first one, or import an existing Excel file.</div>` : ''}
    <div class="card-list">
      ${projects.map(p => `
        <div class="proj-card" onclick="openProject('${p.id}')">
          <div class="proj-card-main">
            <div class="proj-name">${esc(p.name)}</div>
            <div class="proj-sub">${esc(p.location || 'No location set')}</div>
          </div>
          <div class="proj-actions" onclick="event.stopPropagation()">
            <button class="iconbtn" onclick="duplicateProjectUI('${p.id}')" title="Duplicate">⧉</button>
            <button class="iconbtn danger" onclick="deleteProjectUI('${p.id}')" title="Delete">🗑</button>
          </div>
        </div>`).join('')}
    </div>
  </div>
  <div class="fab-row">
    <button class="fab secondary" onclick="triggerImport()">⬆ Import Excel</button>
    <button class="fab" onclick="createProjectUI()">+ New Project</button>
  </div>
  <input type="file" id="importFile" accept=".xlsx,.xls" style="display:none" onchange="handleImportFile(event)">
  `;
}

function createProjectUI() {
  const name = prompt('Project name:');
  if (!name) return;
  createProject(name);
  route('dashboard');
}
function openProject(id) { setActiveProject(id); route('dashboard'); }
function duplicateProjectUI(id) {
  const p = listProjects().find(x => x.id === id);
  const name = prompt('New project name:', (p.name || '') + ' (Copy)');
  if (!name) return;
  duplicateProject(id, name);
  render();
}
function deleteProjectUI(id) {
  if (!confirm('Delete this project? This cannot be undone.')) return;
  deleteProject(id);
  render();
}
function triggerImport() { document.getElementById('importFile').click(); }
async function handleImportFile(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  try {
    const wb = await readFileAsWorkbook(file);
    const name = file.name.replace(/\.(xlsx|xls)$/i, '');
    const project = importWorkbookToProject(wb, name);
    saveProject(project);
    setActiveProject(project.id);
    alert('Imported "' + project.name + '". Review Measurements & Coefficients to confirm everything mapped correctly.');
    route('dashboard');
  } catch (err) {
    console.error(err);
    alert('Could not read that file. Make sure it is a valid .xlsx export from this app (or the original template).');
  }
  evt.target.value = '';
}
window.createProjectUI = createProjectUI;
window.openProject = openProject;
window.duplicateProjectUI = duplicateProjectUI;
window.deleteProjectUI = deleteProjectUI;
window.triggerImport = triggerImport;
window.handleImportFile = handleImportFile;

/* ================= DASHBOARD ================= */
function screenDashboard() {
  const p = state.project;
  const a2 = computeAbstract2(p);
  const ma = computeMainAbstract(p);
  const ds = computeDailySpendRunning(p);
  const sch = computeScheduleProgress(p);
  const today = computeTodayReport(p);
  const upcoming = computeUpcomingWork(p, 7);
  return `
  <div class="topbar"><button class="back" onclick="route('projects')">‹</button><h1>${esc(p.name)}</h1></div>
  <div class="content">
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Est. Project Cost</div><div class="stat-value">${inr(ma.totalAmount)}</div></div>
      <div class="stat"><div class="stat-label">Spent so far</div><div class="stat-value">${inr(ma.totalSpend)}</div></div>
      <div class="stat"><div class="stat-label">Cash Balance</div><div class="stat-value">${inr(ds.balance)}</div></div>
      <div class="stat"><div class="stat-label">Schedule Progress</div><div class="stat-value">${sch.pct}%</div></div>
    </div>

    <div class="section-title">📋 Today (${today.today})</div>
    <div class="mini-table" onclick="route('today')" style="cursor:pointer">
      <div class="mini-row"><span>Tasks active today</span><b>${today.activeToday.length}</b></div>
      <div class="mini-row"><span>Labour needed today</span><b>${fmt(today.totalLabour)}</b></div>
      <div class="mini-row"><span>Spent today</span><b>${inr(today.spentToday)}</b></div>
    </div>

    ${upcoming.length ? `
    <div class="section-title">📅 Upcoming Work (next 7 days)</div>
    <div class="mini-table" onclick="route('schedule')" style="cursor:pointer">
      ${upcoming.slice(0,4).map(t => `<div class="mini-row"><span>${esc(t.task)}</span><b>${t.plannedStart}</b></div>`).join('')}
    </div>` : ''}

    <div class="section-title">Materials Required (with wastage)</div>
    <div class="mini-table">
      ${['cement','pSand','mSand','bricks','agg'].map((k,i)=>{
        const labels=['Cement (Bags)','P.Sand (Cft)','M.Sand (Cft)','Bricks (Nos)','20mm Aggregate (Cft)'];
        return `<div class="mini-row"><span>${labels[i]}</span><b>${fmt(a2.withWastage[k])}</b></div>`;
      }).join('')}
    </div>

    <div class="section-title">Quick Actions</div>
    <div class="quick-actions">
      <button class="qa" onclick="route('measurements')">📐 Add Work Item</button>
      <button class="qa" onclick="route('spend')">📦 Material Tracker</button>
      <button class="qa" onclick="route('daily')">💵 Log Spend</button>
      <button class="qa" onclick="route('schedule')">📅 Schedule of Work</button>
      <button class="qa" onclick="route('today')">📋 Today's Report</button>
      <button class="qa" onclick="shareUI()">📲 Share via WhatsApp/Mail</button>
    </div>
  </div>`;
}
async function exportUI() {
  const blob = exportProjectToBlob(state.project);
  downloadBlob(blob, (state.project.name || 'project').replace(/[^a-z0-9\-_ ]/gi,'_') + '.xlsx');
}
async function shareUI() { await shareProjectExcel(state.project); }
window.exportUI = exportUI;
window.shareUI = shareUI;

/* ================= MEASUREMENTS (BOQ) ================= */
function screenMeasurements() {
  const p = state.project;
  return `
  <div class="topbar"><button class="back" onclick="route('dashboard')">‹</button><h1>Measurements (BOQ)</h1></div>
  <div class="content">
    ${p.sections.length === 0 ? '<div class="empty">No sections yet. Add a work section (e.g. Excavation, Footing, Brick Work) to start entering measurements.</div>' : `
    <div class="collapse-all-row">
      <button class="linkbtn" onclick="setAllSectionsCollapsed(true)">Collapse All</button>
      <button class="linkbtn" onclick="setAllSectionsCollapsed(false)">Expand All</button>
    </div>`}
    ${p.sections.map(sec => renderSection(p, sec)).join('')}
  </div>
  <div class="fab-row">
    <button class="fab" onclick="addSectionUI()">+ Add Section</button>
  </div>`;
}

function renderSection(p, sec) {
  const t = computeSectionTotals(p, sec);
  const collapsed = !!sec.collapsed;
  const itemCount = (sec.items||[]).length;
  return `
  <div class="card">
    <div class="card-header">
      <button class="chevron-btn" onclick="toggleSectionCollapse('${sec.id}')">${collapsed ? '▸' : '▾'}</button>
      <input class="inline-input title" value="${esc(sec.name)}" onchange="updateSectionField('${sec.id}','name',this.value)">
      <button class="iconbtn danger" onclick="deleteSectionUI('${sec.id}')">🗑</button>
    </div>
    ${collapsed
      ? `<div class="collapsed-summary" onclick="toggleSectionCollapse('${sec.id}')">${itemCount} item${itemCount===1?'':'s'} · Qty ${fmt(t.qty)} · Cement ${fmt(t.cement)} bags</div>`
      : `
    ${itemCount === 0 ? '<div class="empty small">No items yet.</div>' : ''}
    <div class="item-card-list">
      ${(sec.items||[]).map(item => renderItemCard(p, sec, item)).join('')}
    </div>
    <div class="section-total">Section Total — Qty: <b>${fmt(t.qty)}</b> &nbsp;·&nbsp; Cement: <b>${fmt(t.cement)}</b> bags &nbsp;·&nbsp; M.Sand: <b>${fmt(t.mSand)}</b> cft &nbsp;·&nbsp; Bricks: <b>${fmt(t.bricks)}</b> &nbsp;·&nbsp; Agg: <b>${fmt(t.agg)}</b> cft</div>
    <button class="linkbtn" onclick="addItemUI('${sec.id}')">+ Add Item</button>
    `}
  </div>`;
}

// Each measurement item is its own card with full-width, clearly labeled
// fields — not a cramped table row. This is deliberately mobile-first: on a
// ~360-390px phone, a 9-column table leaves ~25px per field, too narrow to
// tap or read reliably. Stacked fields give every input room to be used.
function renderItemCard(p, sec, item) {
  const m = computeItemMaterials(p, item);
  const collapsed = !!item.collapsed;
  if (collapsed) {
    return `
    <div class="item-card collapsed" onclick="toggleItemCollapse('${sec.id}','${item.id}')">
      <div class="item-card-head" style="margin-bottom:0">
        <button class="chevron-btn small">▸</button>
        <span class="item-desc">${esc(item.description) || '<em>Untitled item</em>'}</span>
        <span class="qty-badge">${fmt(m.qty)}</span>
        <button class="iconbtn danger" onclick="event.stopPropagation(); deleteItemUI('${sec.id}','${item.id}')">✕</button>
      </div>
    </div>`;
  }
  const notationOptions = p.coefficients.map(c => `<option value="${c.notation}" ${item.notation===c.notation?'selected':''}>${c.notation} — ${esc(c.label)}</option>`).join('');
  return `
  <div class="item-card">
    <div class="item-card-head">
      <button class="chevron-btn small" onclick="toggleItemCollapse('${sec.id}','${item.id}')">▾</button>
      <input class="cell-input item-desc" value="${esc(item.description)}" placeholder="Item description"
        onchange="updateItemField('${sec.id}','${item.id}','description',this.value)">
      <button class="iconbtn danger" onclick="deleteItemUI('${sec.id}','${item.id}')">✕</button>
    </div>
    <label class="field-label">Notation
      <select class="cell-input" onchange="updateItemField('${sec.id}','${item.id}','notation',this.value)">${notationOptions}</select>
    </label>
    <div class="item-fields-grid">
      <label class="field-label">Nos<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${item.nos}" onchange="updateItemField('${sec.id}','${item.id}','nos',this.value)"></label>
      <label class="field-label">Member Count<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${item.member}" onchange="updateItemField('${sec.id}','${item.id}','member',this.value)"></label>
      <label class="field-label">Length (ft)<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${item.length}" onchange="updateItemField('${sec.id}','${item.id}','length',this.value)"></label>
      <label class="field-label">Breadth (ft)<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${item.breadth}" onchange="updateItemField('${sec.id}','${item.id}','breadth',this.value)"></label>
      <label class="field-label">Depth (ft)<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${item.depth}" onchange="updateItemField('${sec.id}','${item.id}','depth',this.value)"></label>
    </div>
    <div class="qty-badge">Qty: <b>${fmt(m.qty)}</b> ${esc((findCoefficient(p,item.notation)||{}).unit||'')}</div>
    <div class="item-materials">Cement ${fmt(m.cement)} bags · P.Sand ${fmt(m.pSand)} cft · M.Sand ${fmt(m.mSand)} cft · Bricks ${fmt(m.bricks)} · Agg ${fmt(m.agg)} cft</div>
  </div>`;
}
function toggleSectionCollapse(secId) {
  const sec = state.project.sections.find(s => s.id === secId);
  sec.collapsed = !sec.collapsed;
  saveProject(state.project);
  render();
}
function toggleItemCollapse(secId, itemId) {
  const sec = state.project.sections.find(s => s.id === secId);
  const item = sec.items.find(i => i.id === itemId);
  item.collapsed = !item.collapsed;
  saveProject(state.project);
  render();
}
function setAllSectionsCollapsed(val) {
  state.project.sections.forEach(s => { s.collapsed = val; (s.items||[]).forEach(i => i.collapsed = val); });
  refreshAndRender();
}
window.toggleSectionCollapse = toggleSectionCollapse;
window.toggleItemCollapse = toggleItemCollapse;
window.setAllSectionsCollapsed = setAllSectionsCollapsed;

function addSectionUI() {
  const name = prompt('Section name (e.g. "Footing", "Brick Work"):');
  if (!name) return;
  state.project.sections.push({ id: uid('sec'), label: name, name, items: [] });
  refreshAndRender();
}
function deleteSectionUI(id) {
  if (!confirm('Delete this section and all its items?')) return;
  state.project.sections = state.project.sections.filter(s => s.id !== id);
  refreshAndRender();
}
function updateSectionField(id, field, val) {
  const sec = state.project.sections.find(s => s.id === id);
  setField(sec, field, val, []);
  saveProject(state.project);
}
function addItemUI(secId) {
  const sec = state.project.sections.find(s => s.id === secId);
  const defaultNotation = (state.project.coefficients[0] || {}).notation || '';
  sec.items.push({ id: uid('item'), description: 'New item', notation: defaultNotation, nos: 1, member: 1, length: 1, breadth: 1, depth: 1 });
  refreshAndRender();
}
function deleteItemUI(secId, itemId) {
  const sec = state.project.sections.find(s => s.id === secId);
  sec.items = sec.items.filter(i => i.id !== itemId);
  refreshAndRender();
}
function updateItemField(secId, itemId, field, val) {
  const sec = state.project.sections.find(s => s.id === secId);
  const item = sec.items.find(i => i.id === itemId);
  setField(item, field, val, ['nos','member','length','breadth','depth']);
  refreshAndRender();
}
window.addSectionUI = addSectionUI;
window.deleteSectionUI = deleteSectionUI;
window.updateSectionField = updateSectionField;
window.addItemUI = addItemUI;
window.deleteItemUI = deleteItemUI;
window.updateItemField = updateItemField;

/* ================= COEFFICIENTS (material coefficients per work type) ================= */
function screenCoefficients() {
  const p = state.project;
  return `
  <div class="topbar"><button class="back" onclick="route('settings')">‹</button><h1>Coefficients</h1></div>
  <div class="content">
    <p class="hint">These are the material quantities used per 1 unit of each work type. Edit them to match your site's actual mix ratios — every BOQ item using that notation recalculates automatically.</p>
    <p class="scroll-hint">↔ Swipe sideways to see every column</p>
    <table class="item-table wide">
      <thead><tr><th>Notation</th><th>Label</th><th>Unit</th><th>Cement/unit</th><th>P.Sand/unit</th><th>M.Sand/unit</th><th>Bricks/unit</th><th>Agg/unit</th><th></th></tr></thead>
      <tbody>
        ${p.coefficients.map((c,i) => `<tr>
          <td><input class="cell-input" value="${esc(c.notation)}" onchange="updateCoeff(${i},'notation',this.value)"></td>
          <td><input class="cell-input" value="${esc(c.label)}" onchange="updateCoeff(${i},'label',this.value)"></td>
          <td><input class="cell-input" value="${esc(c.unit)}" onchange="updateCoeff(${i},'unit',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${c.cement}" onchange="updateCoeff(${i},'cement',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${c.pSand}" onchange="updateCoeff(${i},'pSand',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${c.mSand}" onchange="updateCoeff(${i},'mSand',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${c.bricks}" onchange="updateCoeff(${i},'bricks',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${c.agg}" onchange="updateCoeff(${i},'agg',this.value)"></td>
          <td><button class="iconbtn danger" onclick="deleteCoeff(${i})">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="fab-row"><button class="fab" onclick="addCoeff()">+ Add Coefficient</button></div>`;
}
function updateCoeff(i, field, val) {
  setField(state.project.coefficients[i], field, val, ['cement','pSand','mSand','bricks','agg']);
  saveProject(state.project);
  render();
}
function addCoeff() {
  state.project.coefficients.push({ notation: 'NEW', label: 'New Work Type', cement:0, pSand:0, mSand:0, bricks:0, agg:0, unit:'Cft', note:'' });
  refreshAndRender();
}
function deleteCoeff(i) {
  if (!confirm('Delete this coefficient? Items using it will show zero materials.')) return;
  state.project.coefficients.splice(i,1);
  refreshAndRender();
}
window.updateCoeff = updateCoeff;
window.addCoeff = addCoeff;
window.deleteCoeff = deleteCoeff;

/* ================= MATERIAL RATES (schedule of rates) ================= */
function screenRates() {
  const p = state.project;
  return `
  <div class="topbar"><button class="back" onclick="route('settings')">‹</button><h1>Schedule of Rates</h1></div>
  <div class="content">
    <p class="hint">Cost per unit for each material. These rates drive the Main Abstract cost estimate — update them any time prices change.</p>
    <table class="item-table">
      <thead><tr><th>Material</th><th>Unit</th><th>Rate (₹)</th><th></th></tr></thead>
      <tbody>
        ${p.materialRates.map((r,i) => `<tr>
          <td><input class="cell-input" value="${esc(r.material)}" onchange="updateRate(${i},'material',this.value)"></td>
          <td><input class="cell-input" value="${esc(r.unit)}" onchange="updateRate(${i},'unit',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${r.rate}" onchange="updateRate(${i},'rate',this.value)"></td>
          <td><button class="iconbtn danger" onclick="deleteRate(${i})">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div class="section-title">Wastage Allowance</div>
    <div class="form-row">
      <label>Wastage %</label>
      <input class="cell-input num" type="number" step="any" value="${p.wastagePct}" onchange="updateWastage(this.value)">
    </div>

    <div class="section-title">Other Cost Items (Doors, Electrical, Labour, etc.)</div>
    <p class="scroll-hint">↔ Swipe sideways to see every column</p>
    <table class="item-table wide">
      <thead><tr><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Spend</th><th></th></tr></thead>
      <tbody>
        ${(p.otherAbstractItems||[]).map((o,i) => `<tr>
          <td><input class="cell-input" value="${esc(o.description)}" onchange="updateOther(${i},'description',this.value)"></td>
          <td><input class="cell-input" value="${esc(o.unit)}" onchange="updateOther(${i},'unit',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${o.quantity}" onchange="updateOther(${i},'quantity',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${o.rate}" onchange="updateOther(${i},'rate',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${o.spend}" onchange="updateOther(${i},'spend',this.value)"></td>
          <td><button class="iconbtn danger" onclick="deleteOther(${i})">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <button class="linkbtn" onclick="addOther()">+ Add Cost Item</button>
  </div>`;
}
function updateRate(i, field, val) {
  setField(state.project.materialRates[i], field, val, ['rate']);
  saveProject(state.project);
}
function addRate() { state.project.materialRates.push({material:'New Material', unit:'Unit', rate:0}); refreshAndRender(); }
function deleteRate(i) { state.project.materialRates.splice(i,1); refreshAndRender(); }
function updateWastage(val) { setField(state.project, 'wastagePct', val, ['wastagePct']); saveProject(state.project); }
function addOther() { state.project.otherAbstractItems.push({id: uid('oth'), description:'New item', unit:'LS', quantity:1, rate:0, spend:0, isLumpSum:false}); refreshAndRender(); }
function updateOther(i, field, val) { setField(state.project.otherAbstractItems[i], field, val, ['quantity','rate','spend']); saveProject(state.project); }
function deleteOther(i) { state.project.otherAbstractItems.splice(i,1); refreshAndRender(); }
window.updateRate = updateRate; window.addRate = addRate; window.deleteRate = deleteRate;
window.updateWastage = updateWastage; window.addOther = addOther; window.updateOther = updateOther; window.deleteOther = deleteOther;

/* ================= ABSTRACTS ================= */
function screenAbstracts() {
  const p = state.project;
  const a1 = computeAbstract1(p);
  const a2 = computeAbstract2(p);
  const ma = computeMainAbstract(p);
  return `
  <div class="topbar"><button class="back" onclick="route('dashboard')">‹</button><h1>Abstracts</h1></div>
  <div class="content">
    <div class="section-title">Abstract-1 · By Work Section</div>
    <p class="scroll-hint">↔ Swipe sideways to see every column</p>
    <table class="item-table wide">
      <thead><tr><th>Section</th><th>Notation</th><th>Qty</th><th>Cement</th><th>M.Sand</th><th>Bricks</th><th>Agg</th></tr></thead>
      <tbody>${a1.map(r => `<tr><td>${esc(r.label)}</td><td>${esc(r.notation)}</td><td>${fmt(r.qty)}</td><td>${fmt(r.cement)}</td><td>${fmt(r.mSand)}</td><td>${fmt(r.bricks)}</td><td>${fmt(r.agg)}</td></tr>`).join('')}</tbody>
    </table>

    <div class="section-title">Abstract-2 · By Notation (with wastage)</div>
    <p class="scroll-hint">↔ Swipe sideways to see every column</p>
    <table class="item-table wide">
      <thead><tr><th>Notation</th><th>Qty</th><th>Cement</th><th>M.Sand</th><th>Bricks</th><th>Agg</th></tr></thead>
      <tbody>
        ${a2.rows.map(r => `<tr><td>${esc(r.notation)}</td><td>${fmt(r.qty)}</td><td>${fmt(r.cement)}</td><td>${fmt(r.mSand)}</td><td>${fmt(r.bricks)}</td><td>${fmt(r.agg)}</td></tr>`).join('')}
        <tr class="totalrow"><td>Total</td><td>${fmt(a2.totals.qty)}</td><td>${fmt(a2.totals.cement)}</td><td>${fmt(a2.totals.mSand)}</td><td>${fmt(a2.totals.bricks)}</td><td>${fmt(a2.totals.agg)}</td></tr>
        <tr class="totalrow"><td>+ Wastage (${a2.wastagePct}%)</td><td></td><td>${fmt(a2.withWastage.cement)}</td><td>${fmt(a2.withWastage.mSand)}</td><td>${fmt(a2.withWastage.bricks)}</td><td>${fmt(a2.withWastage.agg)}</td></tr>
      </tbody>
    </table>

    <div class="section-title">Main Abstract · Cost Estimate</div>
    <p class="scroll-hint">↔ Swipe sideways to see every column</p>
    <table class="item-table wide">
      <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Spent</th><th>To Spend</th></tr></thead>
      <tbody>
        ${ma.rows.map(r => `<tr><td>${esc(r.material)}</td><td>${fmt(r.qty)}</td><td>${fmt(r.rate)}</td><td>${inr(r.amount)}</td><td>${inr(r.spend)}</td><td>${inr(r.toBeSpend)}</td></tr>`).join('')}
        <tr class="totalrow"><td>TOTAL</td><td></td><td></td><td>${inr(ma.totalAmount)}</td><td>${inr(ma.totalSpend)}</td><td>${inr(ma.toBeSpend)}</td></tr>
      </tbody>
    </table>
  </div>`;
}

/* ================= MATERIAL SPEND ================= */
function screenMaterialSpend() {
  const p = state.project;
  const linked = computeMaterialSpendLinked(p);
  return `
  <div class="topbar"><button class="back" onclick="route('dashboard')">‹</button><h1>Material Spend</h1></div>
  <div class="content">
    <p class="hint">Required quantities come straight from your BOQ — log what you buy against each and see what's left automatically.</p>
    <div class="section-title">Required Materials (from BOQ)</div>
    ${linked.bulkRows.map(r => `
      <div class="item-card">
        <div class="item-card-head"><span class="item-desc">${esc(r.material)}</span>
          <span class="qty-badge">Need: ${fmt(r.requiredQty)} ${esc(r.unit)}</span></div>
        <div class="item-fields-grid three">
          <label class="field-label">Purchased (${esc(r.unit)})<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${r.purchasedQty}" onchange="updateBulkSpend('${esc(r.material)}','purchasedQty',this.value)"></label>
          <label class="field-label">Spent (₹)<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${r.totalSpend}" onchange="updateBulkSpend('${esc(r.material)}','totalSpend',this.value)"></label>
          <label class="field-label">Remaining to Buy<div class="cell-input readonly">${fmt(r.remainingQty)} ${esc(r.unit)}</div></label>
        </div>
        <div class="item-materials">Est. cost ${inr(r.requiredAmount)} · Remaining to spend ${inr(r.remainingAmount)}</div>
      </div>`).join('')}

    <div class="section-title">Other Materials (Steel, Paint, Fittings…)</div>
    ${linked.customRows.length === 0 ? '<div class="empty small">Nothing added yet — use this for materials outside the bulk 5 above.</div>' : ''}
    ${linked.customRows.map((m) => {
      const i = state.project.materialSpend.indexOf(m);
      return `
      <div class="item-card">
        <div class="item-card-head">
          <input class="cell-input item-desc" value="${esc(m.material)}" placeholder="Material name" onchange="updateSpend(${i},'material',this.value)">
          <button class="iconbtn danger" onclick="deleteSpend(${i})">✕</button>
        </div>
        <div class="item-fields-grid">
          <label class="field-label">Purchased Qty<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${m.purchasedQty}" onchange="updateSpend(${i},'purchasedQty',this.value)"></label>
          <label class="field-label">Total Spend (₹)<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${m.totalSpend}" onchange="updateSpend(${i},'totalSpend',this.value)"></label>
        </div>
      </div>`;
    }).join('')}
    <button class="linkbtn" onclick="addSpend()">+ Add Other Material</button>
  </div>`;
}
function addSpend() { state.project.materialSpend.push({id: uid('spend'), material:'New Material', purchasedQty:0, totalSpend:0}); refreshAndRender(); }
function updateSpend(i, field, val) { setField(state.project.materialSpend[i], field, val, ['purchasedQty','totalSpend']); saveProject(state.project); render(); }
function deleteSpend(i) { state.project.materialSpend.splice(i,1); refreshAndRender(); }
function updateBulkSpend(materialName, field, val) {
  const row = upsertMaterialSpendRow(state.project, materialName);
  setField(row, field, val, ['purchasedQty','totalSpend']);
  saveProject(state.project);
  render();
}
window.addSpend = addSpend; window.updateSpend = updateSpend; window.deleteSpend = deleteSpend; window.updateBulkSpend = updateBulkSpend;

/* ================= DAILY SPEND (ledger) ================= */
function screenDailySpend() {
  const p = state.project;
  const run = computeDailySpendRunning(p);
  return `
  <div class="topbar"><button class="back" onclick="route('dashboard')">‹</button><h1>Daily Spend Ledger</h1></div>
  <div class="content">
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Total Received</div><div class="stat-value">${inr(run.totalReceived)}</div></div>
      <div class="stat"><div class="stat-label">Total Spent</div><div class="stat-value">${inr(run.totalSpent)}</div></div>
      <div class="stat"><div class="stat-label">Balance in Hand</div><div class="stat-value">${inr(run.balance)}</div></div>
    </div>
    ${(p.dailySpend||[]).length === 0 ? '<div class="empty small">No entries yet.</div>' : ''}
    ${(p.dailySpend||[]).slice().reverse().map((d) => {
      const i = p.dailySpend.indexOf(d);
      const runRow = run.rows.find(r => r.id === d.id);
      return `
      <div class="item-card">
        <div class="item-card-head">
          <input class="cell-input" type="date" value="${d.date}" onchange="updateDaily(${i},'date',this.value)" style="max-width:150px">
          <button class="iconbtn danger" onclick="deleteDaily(${i})">✕</button>
        </div>
        <label class="field-label">Description<input class="cell-input" value="${esc(d.notation)}" placeholder="What was this for?" onchange="updateDaily(${i},'notation',this.value)"></label>
        <div class="item-fields-grid three">
          <label class="field-label">Qty<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${d.quantity}" onchange="updateDaily(${i},'quantity',this.value)"></label>
          <label class="field-label">Received (₹)<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${d.received}" onchange="updateDaily(${i},'received',this.value)"></label>
          <label class="field-label">Spent (₹)<input class="cell-input num" type="number" step="any" inputmode="decimal" value="${d.spent}" onchange="updateDaily(${i},'spent',this.value)"></label>
        </div>
        <label class="field-label">Remark<input class="cell-input" value="${esc(d.remark1)}" onchange="updateDaily(${i},'remark1',this.value)"></label>
        <div class="qty-badge">Balance after this entry: <b>${inr(runRow ? runRow.balance : 0)}</b></div>
      </div>`;
    }).join('')}
    <button class="linkbtn" onclick="addDaily()">+ Add Entry</button>
  </div>`;
}
function addDaily() {
  const today = new Date().toISOString().slice(0,10);
  state.project.dailySpend.push({id: uid('day'), date: today, notation:'', quantity:0, received:0, spent:0, remark1:'', remark2:''});
  refreshAndRender();
}
function updateDaily(i, field, val) { setField(state.project.dailySpend[i], field, val, ['quantity','received','spent']); saveProject(state.project); render(); }
function deleteDaily(i) { state.project.dailySpend.splice(i,1); refreshAndRender(); }
window.addDaily = addDaily; window.updateDaily = updateDaily; window.deleteDaily = deleteDaily;

/* ================= SCHEDULE OF WORK (workflow-driven) ================= */
// You list the work in the order you'll do it, give each item a duration
// and the labour it needs — the app chains the dates together itself
// (task 2 starts the day after task 1 ends, and so on). Nothing here asks
// you to type a date by hand; only "Actual" fields are for what really
// happened, everything else is calculated.
function screenSchedule() {
  const p = state.project;
  const sch = computeScheduleProgress(p);
  const plan = computeSchedulePlan(p);
  const upcoming = computeUpcomingWork(p, 7);
  return `
  <div class="topbar"><button class="back" onclick="route('dashboard')">‹</button><h1>Schedule of Work</h1></div>
  <div class="content">
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Tasks</div><div class="stat-value">${sch.total}</div></div>
      <div class="stat"><div class="stat-label">Completed</div><div class="stat-value">${sch.done}</div></div>
      <div class="stat"><div class="stat-label">Overall Progress</div><div class="stat-value">${sch.pct}%</div></div>
    </div>

    <div class="form-row">
      <label>Work starts</label>
      <input class="cell-input" type="date" value="${p.scheduleStartDate}" onchange="updateScheduleStart(this.value)">
    </div>
    <p class="hint">Every task's dates are calculated from this start date plus each task's duration, in the order listed below. Reorder with ↑/↓ to change the plan.</p>

    ${upcoming.length ? `
    <div class="section-title">📅 Upcoming Work (next 7 days)</div>
    <div class="mini-table">
      ${upcoming.map(t => `<div class="mini-row"><span>${esc(t.task)} <span class="muted-inline">(${t.plannedStart} → ${t.plannedEnd})</span></span><b>${t.labour ? fmt(t.labour)+' labour' : '—'}</b></div>`).join('')}
    </div>` : ''}

    <div class="section-title">Work Items (in order)</div>
    ${plan.length === 0 ? '<div class="empty">No work items yet. Add each task in the order you will do it — dates are calculated automatically.</div>' : ''}
    ${plan.map((t,i) => renderTask(p, t, i, plan.length)).join('')}
  </div>
  <div class="fab-row">
    <button class="fab secondary" onclick="generateScheduleFromBOQ()">⇅ From BOQ Sections</button>
    <button class="fab" onclick="addTask()">+ Add Task</button>
  </div>`;
}
function renderTask(project, t, i, total) {
  const pct = Number(t.progressPct)||0;
  const statusOptions = ['Not Started','In Progress','Delayed','Completed'].map(s=>`<option ${t.status===s?'selected':''}>${s}</option>`).join('');
  const sectionOptions = ['<option value="">— link to a BOQ section (optional) —</option>']
    .concat(project.sections.map(s => `<option value="${s.id}" ${t.linkedSectionId===s.id?'selected':''}>${esc(s.name)}</option>`)).join('');
  return `<div class="card">
    <div class="card-header">
      <div class="reorder-btns">
        <button class="iconbtn" ${i===0?'disabled':''} onclick="moveTask(${i},-1)">↑</button>
        <button class="iconbtn" ${i===total-1?'disabled':''} onclick="moveTask(${i},1)">↓</button>
      </div>
      <input class="inline-input title" value="${esc(t.task)}" onchange="updateTask(${i},'task',this.value)">
      <button class="iconbtn danger" onclick="deleteTask(${i})">🗑</button>
    </div>
    <div class="qty-badge">${t.plannedStart} → ${t.plannedEnd} (${t.durationDays} day${t.durationDays>1?'s':''})</div>
    <div class="item-fields-grid" style="margin-top:10px">
      <label class="field-label">Category<input class="cell-input" value="${esc(t.category)}" onchange="updateTask(${i},'category',this.value)"></label>
      <label class="field-label">Status<select class="cell-input" onchange="updateTask(${i},'status',this.value)">${statusOptions}</select></label>
      <label class="field-label">Duration (days)<input class="cell-input num" type="number" min="1" step="1" inputmode="numeric" value="${t.durationDays}" onchange="updateTask(${i},'durationDays',this.value)"></label>
      <label class="field-label">Labour Required<input class="cell-input num" type="number" min="0" step="1" inputmode="numeric" value="${t.labour||0}" onchange="updateTask(${i},'labour',this.value)"></label>
    </div>
    <label class="field-label">Linked BOQ Section<select class="cell-input" onchange="updateTask(${i},'linkedSectionId',this.value)">${sectionOptions}</select></label>
    <div class="item-fields-grid" style="margin-top:8px">
      <label class="field-label">Actual Start<input class="cell-input" type="date" value="${t.actualStart||''}" onchange="updateTask(${i},'actualStart',this.value)"></label>
      <label class="field-label">Actual End<input class="cell-input" type="date" value="${t.actualEnd||''}" onchange="updateTask(${i},'actualEnd',this.value)"></label>
    </div>
    <label class="progress-label">Progress: ${pct}%</label>
    <input type="range" min="0" max="100" value="${pct}" class="progress-slider" onchange="updateTask(${i},'progressPct',this.value)">
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    <textarea class="cell-input notes" placeholder="Notes" onchange="updateTask(${i},'notes',this.value)">${esc(t.notes||'')}</textarea>
  </div>`;
}
function addTask() {
  state.project.schedule.push({id: uid('task'), task:'New Task', category:'', durationDays:1, labour:0, actualStart:'', actualEnd:'', status:'Not Started', progressPct:0, notes:'', linkedSectionId:''});
  refreshAndRender();
}
function updateTask(i, field, val) { setField(state.project.schedule[i], field, val, ['progressPct','durationDays','labour']); saveProject(state.project); render(); }
function deleteTask(i) { state.project.schedule.splice(i,1); refreshAndRender(); }
function moveTask(i, dir) {
  const arr = state.project.schedule;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  refreshAndRender();
}
function updateScheduleStart(val) { state.project.scheduleStartDate = val; saveProject(state.project); render(); }
function generateScheduleFromBOQ() {
  const linkedIds = new Set(state.project.schedule.map(t => t.linkedSectionId).filter(Boolean));
  const toAdd = state.project.sections.filter(s => !linkedIds.has(s.id));
  if (toAdd.length === 0) { alert('Every BOQ section already has a linked task.'); return; }
  toAdd.forEach(s => {
    state.project.schedule.push({
      id: uid('task'), task: s.name, category: '', durationDays: 2, labour: 2,
      actualStart: '', actualEnd: '', status: 'Not Started', progressPct: 0, notes: '', linkedSectionId: s.id,
    });
  });
  refreshAndRender();
}
window.addTask = addTask; window.updateTask = updateTask; window.deleteTask = deleteTask;
window.moveTask = moveTask; window.updateScheduleStart = updateScheduleStart; window.generateScheduleFromBOQ = generateScheduleFromBOQ;

/* ================= TODAY'S PROGRESS REPORT ================= */
function screenToday() {
  const p = state.project;
  const r = computeTodayReport(p);
  return `
  <div class="topbar"><button class="back" onclick="route('dashboard')">‹</button><h1>Today's Report</h1></div>
  <div class="content">
    <p class="hint">${r.today}</p>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Active Tasks Today</div><div class="stat-value">${r.activeToday.length}</div></div>
      <div class="stat"><div class="stat-label">Labour Needed Today</div><div class="stat-value">${fmt(r.totalLabour)}</div></div>
      <div class="stat"><div class="stat-label">Spent Today</div><div class="stat-value">${inr(r.spentToday)}</div></div>
      <div class="stat"><div class="stat-label">Received Today</div><div class="stat-value">${inr(r.receivedToday)}</div></div>
    </div>

    <div class="section-title">Work Happening Today</div>
    ${r.activeToday.length === 0 ? '<div class="empty small">No tasks scheduled for today.</div>' : r.activeToday.map(t => `
      <div class="item-card">
        <div class="item-card-head"><span class="item-desc">${esc(t.task)}</span><span class="qty-badge">${t.progressPct||0}%</span></div>
        <div class="item-materials">${esc(t.category||'—')} · Labour needed: ${fmt(t.labour||0)} · ${t.plannedStart} → ${t.plannedEnd} · Status: ${esc(t.status)}</div>
      </div>`).join('')}

    <div class="section-title">Today's Cash Entries</div>
    ${r.todaysSpend.length === 0 ? '<div class="empty small">No spend entries logged today.</div>' : r.todaysSpend.map(d => `
      <div class="mini-row"><span>${esc(d.notation||'—')}</span><b>${d.received ? '+' + inr(d.received) : '-' + inr(d.spent)}</b></div>`).join('')}
  </div>`;
}

/* ================= SETTINGS / MORE ================= */
function screenSettings() {
  const p = state.project;
  return `
  <div class="topbar"><button class="back" onclick="route('dashboard')">‹</button><h1>More</h1></div>
  <div class="content">
    <div class="section-title">Project Info</div>
    <div class="form-row"><label>Name</label><input class="cell-input" value="${esc(p.name)}" onchange="updateProjField('name',this.value)"></div>
    <div class="form-row"><label>Builder</label><input class="cell-input" value="${esc(p.builder)}" onchange="updateProjField('builder',this.value)"></div>
    <div class="form-row"><label>Location</label><input class="cell-input" value="${esc(p.location)}" onchange="updateProjField('location',this.value)"></div>
    <div class="form-row"><label>Scope of Work</label><input class="cell-input" value="${esc(p.scopeOfWork)}" onchange="updateProjField('scopeOfWork',this.value)"></div>
    <div class="form-row"><label>Contact No</label><input class="cell-input" value="${esc(p.contact)}" onchange="updateProjField('contact',this.value)"></div>
    <div class="form-row"><label>Mail to</label><input class="cell-input" value="${esc(p.mailTo)}" onchange="updateProjField('mailTo',this.value)"></div>

    <div class="section-title">Setup</div>
    <div class="menu-list">
      <button class="menu-item" onclick="route('coefficients')">🧮 Coefficients (material mix ratios) <span>›</span></button>
      <button class="menu-item" onclick="route('rates')">💰 Schedule of Rates (cost/unit) <span>›</span></button>
      <button class="menu-item" onclick="route('spend')">📦 Material Spend Tracker <span>›</span></button>
      <button class="menu-item" onclick="route('account')">☁️ Cloud Backup & Sync <span>›</span></button>
    </div>

    <div class="section-title">Data</div>
    <div class="menu-list">
      <button class="menu-item" onclick="exportUI()">📤 Export to Excel <span>›</span></button>
      <button class="menu-item" onclick="shareUI()">📲 Share (WhatsApp / Mail) <span>›</span></button>
      <button class="menu-item" onclick="triggerImport()">⬆ Import Excel into this project <span>›</span></button>
    </div>
    <input type="file" id="importFile" accept=".xlsx,.xls" style="display:none" onchange="handleImportIntoProject(event)">
  </div>`;
}
function updateProjField(field, val) { state.project[field] = val; saveProject(state.project); }
async function handleImportIntoProject(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  if (!confirm('This will overwrite the current project data with the contents of the Excel file. Continue?')) { evt.target.value=''; return; }
  try {
    const wb = await readFileAsWorkbook(file);
    const imported = importWorkbookToProject(wb, state.project.name);
    imported.id = state.project.id;
    imported.createdAt = state.project.createdAt;
    state.project = imported;
    saveProject(state.project);
    alert('Import complete.');
    route('dashboard');
  } catch (err) {
    console.error(err);
    alert('Could not read that file.');
  }
  evt.target.value = '';
}
window.updateProjField = updateProjField;
window.handleImportIntoProject = handleImportIntoProject;

/* ================= ACCOUNT: CLOUD BACKUP & MULTI-DEVICE SYNC ================= */
function screenAccount() {
  const configured = typeof cloudConfigured === 'function' && cloudConfigured();
  const user = configured && typeof getCurrentCloudUser === 'function' ? getCurrentCloudUser() : null;
  const sync = configured && typeof getSyncStatus === 'function' ? getSyncStatus() : { status: 'offline' };
  const autoSync = typeof getAutoSyncPref === 'function' ? getAutoSyncPref() : true;

  return `
  <div class="topbar"><button class="back" onclick="route('projects')">‹</button><h1>Cloud Backup & Sync</h1></div>
  <div class="content">
    ${!configured ? `
      <div class="empty">
        Cloud sync isn't set up yet. It's optional — the app works fully
        offline without it. To turn it on, follow the steps in
        <b>js/firebase-config.js</b> (also explained in README.md) to
        connect your own free Firebase project, then reload the app.
      </div>
    ` : user ? `
      <div class="mini-table">
        <div class="mini-row"><span>Signed in as</span><b>${esc(user.email)}</b></div>
        <div class="mini-row"><span>Sync status</span><b>${syncStatusLabel(sync)}</b></div>
      </div>
      <div class="form-row" style="margin-top:16px">
        <label>Auto-sync</label>
        <input type="checkbox" ${autoSync ? 'checked' : ''} onchange="toggleAutoSync(this.checked)" style="width:22px;height:22px">
      </div>
      <p class="hint">When on, every change you make here syncs to your account automatically (while online), so it shows up on your other signed-in devices too.</p>
      <div class="menu-list" style="margin-top:14px">
        <button class="menu-item" onclick="handleBackupNow()">☁️ Backup All Projects Now <span>›</span></button>
        <button class="menu-item" onclick="handleCloudSignOut()">🚪 Sign Out <span>›</span></button>
      </div>
    ` : `
      <p class="hint">Sign in to back up your projects to the cloud and pick up the same projects on another phone. Your local data stays exactly where it is either way.</p>
      <div class="form-row"><label>Email</label><input class="cell-input" type="email" id="acctEmail" placeholder="you@example.com"></div>
      <div class="form-row"><label>Password</label><input class="cell-input" type="password" id="acctPassword" placeholder="At least 6 characters"></div>
      <div id="acctError" class="boot-error" style="display:none;margin:12px 0"></div>
      <div class="quick-actions" style="margin-top:6px">
        <button class="qa" onclick="handleCloudSignIn()">Sign In</button>
        <button class="qa" onclick="handleCloudSignUp()">Create Account</button>
      </div>
    `}
    <div class="section-title">Local Backup (always available, no sign-in needed)</div>
    <div class="menu-list">
      <button class="menu-item" onclick="handleDownloadBackup()">💾 Download Local Backup (.json) <span>›</span></button>
    </div>
    <p class="hint">This saves every project on this device to one file — keep a copy somewhere safe (email it to yourself, save to Drive) as insurance against clearing your browser's storage.</p>
  </div>`;
}
function syncStatusLabel(sync) {
  if (sync.status === 'synced') return '✓ Up to date';
  if (sync.status === 'syncing') return 'Syncing…';
  if (sync.status === 'error') return '⚠ Error — ' + esc(sync.error || 'check connection');
  return sync.status;
}
function showAcctError(msg) {
  const el = document.getElementById('acctError');
  if (el) { el.style.display = 'block'; el.innerHTML = '<b>Couldn\'t sign in</b>' + esc(msg); }
}
async function handleCloudSignIn() {
  const email = document.getElementById('acctEmail').value.trim();
  const password = document.getElementById('acctPassword').value;
  try { await cloudSignIn(email, password); route('account'); }
  catch (e) { showAcctError(e.message); }
}
async function handleCloudSignUp() {
  const email = document.getElementById('acctEmail').value.trim();
  const password = document.getElementById('acctPassword').value;
  try { await cloudSignUp(email, password); route('account'); }
  catch (e) { showAcctError(e.message); }
}
async function handleCloudSignOut() { await cloudSignOut(); route('account'); }
async function handleBackupNow() {
  await pushAllProjectsNow();
  alert('Backup pushed to the cloud.');
  render();
}
function handleDownloadBackup() {
  const root = getRoot();
  const blob = new Blob([JSON.stringify(root, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'boq-tracker-backup-' + todayStr() + '.json');
}
function toggleAutoSync(on) { setAutoSyncPref(on); render(); }
window.handleCloudSignIn = handleCloudSignIn;
window.handleCloudSignUp = handleCloudSignUp;
window.handleCloudSignOut = handleCloudSignOut;
window.handleBackupNow = handleBackupNow;
window.handleDownloadBackup = handleDownloadBackup;
window.toggleAutoSync = toggleAutoSync;

function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------- boot ---------- */
window.addEventListener('error', (e) => {
  if (!APP) return;
  APP.innerHTML = `<div class="boot-error"><b>Something went wrong loading the app</b>
    ${esc(e.message || 'Unknown error')}<br><br>
    Try: fully reload the page, or clear this site's storage in your browser
    settings and reload. If it keeps happening after that, the deployed files
    may be incomplete — re-check that index.html, css/, js/, and manifest.json
    are all at the same folder level in your GitHub repo.</div>`;
});

document.addEventListener('DOMContentLoaded', () => {
  // Always land on the project list first. Opening a project is an explicit
  // tap, never something the app should assume on your behalf.
  route('projects');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
  if (typeof initCloud === 'function') initCloud();
});

// Fired by cloud-sync.js whenever sign-in state changes (including the
// initial pull-and-merge completing) — re-render so the Settings screen and
// project list reflect newly-synced data without the user having to
// navigate away and back.
window.onCloudAuthChanged = function () {
  render();
};
