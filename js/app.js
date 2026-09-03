/* ============================================================
   app.js — router + UI rendering
   ============================================================ */

const APP = document.getElementById('app');
const NAV = document.getElementById('bottomnav');

let state = { screen: 'projects', project: null };

function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function inr(n) { return '₹' + fmt(n); }

function route(screen) {
  state.screen = screen;
  state.project = getActiveProject();
  if (screen !== 'projects' && !state.project) { state.screen = 'projects'; }
  render();
  window.scrollTo(0, 0);
}
window.route = route;

function refreshAndRender() {
  saveProject(state.project);
  render();
}

function render() {
  const showNav = state.screen !== 'projects';
  NAV.classList.toggle('hidden', !showNav);
  if (showNav) renderNav();

  switch (state.screen) {
    case 'projects': APP.innerHTML = screenProjects(); break;
    case 'dashboard': APP.innerHTML = screenDashboard(); break;
    case 'measurements': APP.innerHTML = screenMeasurements(); break;
    case 'coefficients': APP.innerHTML = screenCoefficients(); break;
    case 'rates': APP.innerHTML = screenRates(); break;
    case 'abstracts': APP.innerHTML = screenAbstracts(); break;
    case 'spend': APP.innerHTML = screenMaterialSpend(); break;
    case 'daily': APP.innerHTML = screenDailySpend(); break;
    case 'schedule': APP.innerHTML = screenSchedule(); break;
    case 'settings': APP.innerHTML = screenSettings(); break;
    default: APP.innerHTML = '<p>Not found</p>';
  }
}

function renderNav() {
  const items = [
    ['dashboard', '🏠', 'Home'],
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
  <div class="topbar"><h1>My Projects</h1></div>
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
  return `
  <div class="topbar"><button class="back" onclick="route('projects')">‹</button><h1>${esc(p.name)}</h1></div>
  <div class="content">
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Est. Project Cost</div><div class="stat-value">${inr(ma.totalAmount)}</div></div>
      <div class="stat"><div class="stat-label">Spent so far</div><div class="stat-value">${inr(ma.totalSpend)}</div></div>
      <div class="stat"><div class="stat-label">Cash Balance</div><div class="stat-value">${inr(ds.balance)}</div></div>
      <div class="stat"><div class="stat-label">Schedule Progress</div><div class="stat-value">${sch.pct}%</div></div>
    </div>

    <div class="section-title">Materials Required (with wastage)</div>
    <div class="mini-table">
      ${['cement','pSand','mSand','bricks','agg'].map((k,i)=>{
        const labels=['Cement (Bags)','P.Sand (Cft)','M.Sand (Cft)','Bricks (Nos)','20mm Aggregate (Cft)'];
        return `<div class="mini-row"><span>${labels[i]}</span><b>${fmt(a2.withWastage[k])}</b></div>`;
      }).join('')}
    </div>

    <div class="section-title">Quick Actions</div>
    <div class="quick-actions">
      <button class="qa" onclick="route('measurements')">📐 Add Measurement</button>
      <button class="qa" onclick="route('daily')">💵 Log Spend</button>
      <button class="qa" onclick="route('schedule')">📅 Update Schedule</button>
      <button class="qa" onclick="exportUI()">📤 Export Excel</button>
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
    ${p.sections.length === 0 ? '<div class="empty">No sections yet. Add a work section (e.g. Excavation, Footing, Brick Work) to start entering measurements.</div>' : ''}
    ${p.sections.map(sec => renderSection(p, sec)).join('')}
  </div>
  <div class="fab-row">
    <button class="fab" onclick="addSectionUI()">+ Add Section</button>
  </div>`;
}

function renderSection(p, sec) {
  const t = computeSectionTotals(p, sec);
  return `
  <div class="card">
    <div class="card-header">
      <input class="inline-input title" value="${esc(sec.name)}" onchange="updateSectionField('${sec.id}','name',this.value)">
      <button class="iconbtn danger" onclick="deleteSectionUI('${sec.id}')">🗑</button>
    </div>
    <table class="item-table">
      <thead><tr><th>Description</th><th>Notation</th><th>Nos</th><th>Mem</th><th>L</th><th>B</th><th>D</th><th>Qty</th><th></th></tr></thead>
      <tbody>
        ${(sec.items||[]).map(item => renderItemRow(p, sec, item)).join('')}
      </tbody>
    </table>
    <div class="section-total">Total Qty: <b>${fmt(t.qty)}</b> &nbsp;|&nbsp; Cement: <b>${fmt(t.cement)}</b> bags &nbsp;|&nbsp; M.Sand: <b>${fmt(t.mSand)}</b> cft &nbsp;|&nbsp; Bricks: <b>${fmt(t.bricks)}</b> &nbsp;|&nbsp; Agg: <b>${fmt(t.agg)}</b> cft</div>
    <button class="linkbtn" onclick="addItemUI('${sec.id}')">+ Add Item</button>
  </div>`;
}

function renderItemRow(p, sec, item) {
  const m = computeItemMaterials(p, item);
  const notationOptions = p.coefficients.map(c => `<option value="${c.notation}" ${item.notation===c.notation?'selected':''}>${c.notation}</option>`).join('');
  return `<tr>
    <td><input class="cell-input" value="${esc(item.description)}" onchange="updateItemField('${sec.id}','${item.id}','description',this.value)"></td>
    <td><select class="cell-input" onchange="updateItemField('${sec.id}','${item.id}','notation',this.value)">${notationOptions}</select></td>
    <td><input class="cell-input num" type="number" step="any" value="${item.nos}" onchange="updateItemField('${sec.id}','${item.id}','nos',this.value)"></td>
    <td><input class="cell-input num" type="number" step="any" value="${item.member}" onchange="updateItemField('${sec.id}','${item.id}','member',this.value)"></td>
    <td><input class="cell-input num" type="number" step="any" value="${item.length}" onchange="updateItemField('${sec.id}','${item.id}','length',this.value)"></td>
    <td><input class="cell-input num" type="number" step="any" value="${item.breadth}" onchange="updateItemField('${sec.id}','${item.id}','breadth',this.value)"></td>
    <td><input class="cell-input num" type="number" step="any" value="${item.depth}" onchange="updateItemField('${sec.id}','${item.id}','depth',this.value)"></td>
    <td class="qty-cell">${fmt(m.qty)}</td>
    <td><button class="iconbtn danger" onclick="deleteItemUI('${sec.id}','${item.id}')">✕</button></td>
  </tr>`;
}

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
  sec[field] = val;
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
  const numeric = ['nos','member','length','breadth','depth'];
  item[field] = numeric.includes(field) ? val : val;
  saveProject(state.project);
  render();
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
  const numeric = ['cement','pSand','mSand','bricks','agg'];
  state.project.coefficients[i][field] = numeric.includes(field) ? val : val;
  saveProject(state.project);
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
    <table class="item-table">
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
  state.project.materialRates[i][field] = field==='rate' ? val : val;
  saveProject(state.project);
}
function addRate() { state.project.materialRates.push({material:'New Material', unit:'Unit', rate:0}); refreshAndRender(); }
function deleteRate(i) { state.project.materialRates.splice(i,1); refreshAndRender(); }
function updateWastage(val) { state.project.wastagePct = val; saveProject(state.project); }
function addOther() { state.project.otherAbstractItems.push({id: uid('oth'), description:'New item', unit:'LS', quantity:1, rate:0, spend:0, isLumpSum:false}); refreshAndRender(); }
function updateOther(i, field, val) { state.project.otherAbstractItems[i][field] = val; saveProject(state.project); }
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
    <table class="item-table">
      <thead><tr><th>Section</th><th>Notation</th><th>Qty</th><th>Cement</th><th>M.Sand</th><th>Bricks</th><th>Agg</th></tr></thead>
      <tbody>${a1.map(r => `<tr><td>${esc(r.label)}</td><td>${esc(r.notation)}</td><td>${fmt(r.qty)}</td><td>${fmt(r.cement)}</td><td>${fmt(r.mSand)}</td><td>${fmt(r.bricks)}</td><td>${fmt(r.agg)}</td></tr>`).join('')}</tbody>
    </table>

    <div class="section-title">Abstract-2 · By Notation (with wastage)</div>
    <table class="item-table">
      <thead><tr><th>Notation</th><th>Qty</th><th>Cement</th><th>M.Sand</th><th>Bricks</th><th>Agg</th></tr></thead>
      <tbody>
        ${a2.rows.map(r => `<tr><td>${esc(r.notation)}</td><td>${fmt(r.qty)}</td><td>${fmt(r.cement)}</td><td>${fmt(r.mSand)}</td><td>${fmt(r.bricks)}</td><td>${fmt(r.agg)}</td></tr>`).join('')}
        <tr class="totalrow"><td>Total</td><td>${fmt(a2.totals.qty)}</td><td>${fmt(a2.totals.cement)}</td><td>${fmt(a2.totals.mSand)}</td><td>${fmt(a2.totals.bricks)}</td><td>${fmt(a2.totals.agg)}</td></tr>
        <tr class="totalrow"><td>+ Wastage (${a2.wastagePct}%)</td><td></td><td>${fmt(a2.withWastage.cement)}</td><td>${fmt(a2.withWastage.mSand)}</td><td>${fmt(a2.withWastage.bricks)}</td><td>${fmt(a2.withWastage.agg)}</td></tr>
      </tbody>
    </table>

    <div class="section-title">Main Abstract · Cost Estimate</div>
    <table class="item-table">
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
  return `
  <div class="topbar"><button class="back" onclick="route('dashboard')">‹</button><h1>Material Spend</h1></div>
  <div class="content">
    <p class="hint">Track what you've actually purchased against the required quantities.</p>
    <table class="item-table">
      <thead><tr><th>Material</th><th>Actual Qty Used</th><th>Purchased</th><th>Total Spend (₹)</th><th></th></tr></thead>
      <tbody>
        ${(p.materialSpend||[]).map((m,i) => `<tr>
          <td><input class="cell-input" value="${esc(m.material)}" onchange="updateSpend(${i},'material',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${m.actualQty}" onchange="updateSpend(${i},'actualQty',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${m.purchasedQty}" onchange="updateSpend(${i},'purchasedQty',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${m.totalSpend}" onchange="updateSpend(${i},'totalSpend',this.value)"></td>
          <td><button class="iconbtn danger" onclick="deleteSpend(${i})">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <button class="linkbtn" onclick="addSpend()">+ Add Material Row</button>
  </div>`;
}
function addSpend() { state.project.materialSpend.push({id: uid('spend'), material:'New Material', actualQty:0, purchasedQty:0, totalSpend:0}); refreshAndRender(); }
function updateSpend(i, field, val) { state.project.materialSpend[i][field] = val; saveProject(state.project); }
function deleteSpend(i) { state.project.materialSpend.splice(i,1); refreshAndRender(); }
window.addSpend = addSpend; window.updateSpend = updateSpend; window.deleteSpend = deleteSpend;

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
    <table class="item-table wide">
      <thead><tr><th>Date</th><th>Description</th><th>Qty</th><th>Received</th><th>Spent</th><th>Balance</th><th>Remark</th><th></th></tr></thead>
      <tbody>
        ${(p.dailySpend||[]).map((d,i) => `<tr>
          <td><input class="cell-input" type="date" value="${d.date}" onchange="updateDaily(${i},'date',this.value)"></td>
          <td><input class="cell-input" value="${esc(d.notation)}" onchange="updateDaily(${i},'notation',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${d.quantity}" onchange="updateDaily(${i},'quantity',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${d.received}" onchange="updateDaily(${i},'received',this.value)"></td>
          <td><input class="cell-input num" type="number" step="any" value="${d.spent}" onchange="updateDaily(${i},'spent',this.value)"></td>
          <td class="qty-cell">${fmt(run.rows[i] ? run.rows[i].balance : 0)}</td>
          <td><input class="cell-input" value="${esc(d.remark1)}" onchange="updateDaily(${i},'remark1',this.value)"></td>
          <td><button class="iconbtn danger" onclick="deleteDaily(${i})">✕</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <button class="linkbtn" onclick="addDaily()">+ Add Entry</button>
  </div>`;
}
function addDaily() {
  const today = new Date().toISOString().slice(0,10);
  state.project.dailySpend.push({id: uid('day'), date: today, notation:'', quantity:0, received:0, spent:0, remark1:'', remark2:''});
  refreshAndRender();
}
function updateDaily(i, field, val) { state.project.dailySpend[i][field] = val; saveProject(state.project); render(); }
function deleteDaily(i) { state.project.dailySpend.splice(i,1); refreshAndRender(); }
window.addDaily = addDaily; window.updateDaily = updateDaily; window.deleteDaily = deleteDaily;

/* ================= SCHEDULE TRACKING ================= */
function screenSchedule() {
  const p = state.project;
  const sch = computeScheduleProgress(p);
  return `
  <div class="topbar"><button class="back" onclick="route('dashboard')">‹</button><h1>Schedule</h1></div>
  <div class="content">
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Tasks</div><div class="stat-value">${sch.total}</div></div>
      <div class="stat"><div class="stat-label">Completed</div><div class="stat-value">${sch.done}</div></div>
      <div class="stat"><div class="stat-label">Overall Progress</div><div class="stat-value">${sch.pct}%</div></div>
    </div>
    ${(p.schedule||[]).map((t,i) => renderTask(t,i)).join('') || '<div class="empty">No tasks yet. Add work items with planned dates to track progress.</div>'}
  </div>
  <div class="fab-row"><button class="fab" onclick="addTask()">+ Add Task</button></div>`;
}
function renderTask(t,i) {
  const pct = Number(t.progressPct)||0;
  const statusOptions = ['Not Started','In Progress','Delayed','Completed'].map(s=>`<option ${t.status===s?'selected':''}>${s}</option>`).join('');
  return `<div class="card">
    <div class="card-header">
      <input class="inline-input title" value="${esc(t.task)}" onchange="updateTask(${i},'task',this.value)">
      <button class="iconbtn danger" onclick="deleteTask(${i})">🗑</button>
    </div>
    <div class="task-grid">
      <label>Category<input class="cell-input" value="${esc(t.category)}" onchange="updateTask(${i},'category',this.value)"></label>
      <label>Status<select class="cell-input" onchange="updateTask(${i},'status',this.value)">${statusOptions}</select></label>
      <label>Planned Start<input class="cell-input" type="date" value="${t.plannedStart}" onchange="updateTask(${i},'plannedStart',this.value)"></label>
      <label>Planned End<input class="cell-input" type="date" value="${t.plannedEnd}" onchange="updateTask(${i},'plannedEnd',this.value)"></label>
      <label>Actual Start<input class="cell-input" type="date" value="${t.actualStart}" onchange="updateTask(${i},'actualStart',this.value)"></label>
      <label>Actual End<input class="cell-input" type="date" value="${t.actualEnd}" onchange="updateTask(${i},'actualEnd',this.value)"></label>
    </div>
    <label class="progress-label">Progress: ${pct}%</label>
    <input type="range" min="0" max="100" value="${pct}" class="progress-slider" onchange="updateTask(${i},'progressPct',this.value)">
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    <textarea class="cell-input notes" placeholder="Notes" onchange="updateTask(${i},'notes',this.value)">${esc(t.notes||'')}</textarea>
  </div>`;
}
function addTask() {
  state.project.schedule.push({id: uid('task'), task:'New Task', category:'', plannedStart:'', plannedEnd:'', actualStart:'', actualEnd:'', status:'Not Started', progressPct:0, notes:''});
  refreshAndRender();
}
function updateTask(i, field, val) { state.project.schedule[i][field] = val; saveProject(state.project); render(); }
function deleteTask(i) { state.project.schedule.splice(i,1); refreshAndRender(); }
window.addTask = addTask; window.updateTask = updateTask; window.deleteTask = deleteTask;

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

function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const root = getRoot();
  if (root.activeProjectId && root.projects[root.activeProjectId]) {
    route('dashboard');
  } else {
    route('projects');
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
});
