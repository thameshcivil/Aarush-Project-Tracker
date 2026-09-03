/* ============================================================
   db.js — storage layer + computation engine
   All data lives in localStorage under one root key.
   Structure:
   {
     activeProjectId: "id",
     projects: { [id]: ProjectObject }
   }
   ============================================================ */

const DB_KEY = 'boq_tracker_root_v1';

const DEFAULT_COEFFICIENTS = [
  // notation, label, cement(bags/unit), pSand(cft/unit), mSand(cft/unit), bricks(nos/unit), agg20mm(cft/unit), unit, note
  { notation: 'Ex',   label: 'Excavation',              cement: 0,      pSand: 0,     mSand: 0,     bricks: 0,     agg: 0,     unit: 'Cft', note: 'Excavation – no cement/sand/aggregate' },
  { notation: 'BF',   label: 'Back Filling',            cement: 0,      pSand: 0,     mSand: 0,     bricks: 0,     agg: 0,     unit: 'Cft', note: 'Back filling – no cement/sand/aggregate' },
  { notation: 'PCC',  label: 'Plain Cement Concrete',   cement: 0.123,  pSand: 0,     mSand: 0.462, bricks: 0,     agg: 0.924, unit: 'Cft', note: 'M10 nominal 1:3:6; starter coefficient' },
  { notation: 'RCC',  label: 'Reinforced Cement Concrete', cement: 0.246, pSand: 0,  mSand: 0.462, bricks: 0,     agg: 0.924, unit: 'Cft', note: 'M20 nominal 1:1.5:3; starter coefficient' },
  { notation: 'BW',   label: 'Brick Work (9")',         cement: 0.03,   pSand: 0,     mSand: 0.225, bricks: 13.5, agg: 0,     unit: 'Cft', note: '9" brickwork; mortar 1:6; starter coefficient' },
  { notation: 'PBW',  label: 'Partition Brick Work (4.5")', cement: 0.012, pSand: 0, mSand: 0.09,  bricks: 5.5,  agg: 0,     unit: 'Sqft', note: '4.5" partition brickwork; mortar 1:6' },
  { notation: 'Tile', label: 'Tile Laying',             cement: 0.003,  pSand: 0,     mSand: 0.02,  bricks: 0,     agg: 0,     unit: 'Sqft', note: 'Floor/Wall tile laying' },
  { notation: 'Dado', label: 'Wall Dado',                cement: 0.003, pSand: 0,     mSand: 0.02,  bricks: 0,     agg: 0,     unit: 'Sqft', note: 'Wall dado' },
  { notation: 'SKT',  label: 'Skirting',                cement: 0.003,  pSand: 0,     mSand: 0.02,  bricks: 0,     agg: 0,     unit: 'Sqft', note: 'Tile skirting' },
  { notation: 'GL',   label: 'Granite Laying',          cement: 0.004,  pSand: 0,     mSand: 0.027, bricks: 0,     agg: 0,     unit: 'Sqft', note: 'Granite laying' },
  { notation: 'IPL',  label: 'Internal Plastering',     cement: 0.0045, pSand: 0.034, mSand: 0,     bricks: 0,     agg: 0,     unit: 'Sqft', note: '12mm internal plaster; mortar 1:6' },
  { notation: 'EPL',  label: 'External Plastering',     cement: 0.0078, pSand: 0.039, mSand: 0,     bricks: 0,     agg: 0,     unit: 'Sqft', note: '15mm external plaster; mortar 1:4' },
];

const DEFAULT_MATERIAL_RATES = [
  { material: 'Cement', unit: 'Bags', rate: 325 },
  { material: 'P.Sand', unit: 'Unit', rate: 6000 },
  { material: 'M.Sand', unit: 'Unit', rate: 6000 },
  { material: 'Bricks', unit: 'Nos', rate: 10 },
  { material: '20mm Aggregate', unit: 'Unit', rate: 6000 },
  { material: '40mm Aggregate', unit: 'Unit', rate: 7000 },
  { material: 'Steel', unit: 'MT', rate: 66000 },
];

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadRoot() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error('load error', e); }
  return { activeProjectId: null, projects: {} };
}

function saveRoot(root) {
  localStorage.setItem(DB_KEY, JSON.stringify(root));
}

function newProject(name) {
  const id = uid('proj');
  return {
    id,
    name: name || 'New Project',
    builder: '',
    location: '',
    scopeOfWork: '',
    workFrom: '',
    workDoneBy: '',
    contact: '',
    mailTo: '',
    createdAt: new Date().toISOString(),
    wastagePct: 10, // % wastage applied on top of raw material totals
    coefficients: JSON.parse(JSON.stringify(DEFAULT_COEFFICIENTS)),
    materialRates: JSON.parse(JSON.stringify(DEFAULT_MATERIAL_RATES)),
    sections: [], // [{id, label, name, items:[...]}]
    otherAbstractItems: [], // Main-abstract-only lines: Door, Window, Electrical, Plumbing, Labour, etc.
    materialSpend: [], // [{id, material, actualQty, purchasedQty, totalSpend}]
    dailySpend: [], // [{id, date, notation, quantity, received, spent, remark1, remark2}]
    schedule: [], // [{id, task, category, plannedStart, plannedEnd, actualStart, actualEnd, status, progressPct, notes}]
  };
}

function getRoot() { return loadRoot(); }

function listProjects() {
  const root = loadRoot();
  return Object.values(root.projects).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function getActiveProject() {
  const root = loadRoot();
  if (!root.activeProjectId) return null;
  return root.projects[root.activeProjectId] || null;
}

function setActiveProject(id) {
  const root = loadRoot();
  root.activeProjectId = id;
  saveRoot(root);
}

function createProject(name) {
  const root = loadRoot();
  const p = newProject(name);
  root.projects[p.id] = p;
  root.activeProjectId = p.id;
  saveRoot(root);
  return p;
}

function duplicateProject(id, newName) {
  const root = loadRoot();
  const src = root.projects[id];
  if (!src) return null;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid('proj');
  copy.name = newName || (src.name + ' (Copy)');
  copy.createdAt = new Date().toISOString();
  root.projects[copy.id] = copy;
  root.activeProjectId = copy.id;
  saveRoot(root);
  return copy;
}

function deleteProject(id) {
  const root = loadRoot();
  delete root.projects[id];
  if (root.activeProjectId === id) {
    const remaining = Object.keys(root.projects);
    root.activeProjectId = remaining.length ? remaining[0] : null;
  }
  saveRoot(root);
}

function saveProject(project) {
  const root = loadRoot();
  root.projects[project.id] = project;
  saveRoot(root);
}

/* ---------- Computation engine ---------- */

// Quantity = Nos * MemberCount * Length * Breadth * Depth
// (Length/Breadth/Depth default to 1 when not applicable, e.g. count-only items)
function computeItemQuantity(item) {
  const nos = num(item.nos, 1);
  const member = num(item.member, 1);
  const length = num(item.length, 1);
  const breadth = num(item.breadth, 1);
  const depth = num(item.depth, 1);
  return nos * member * length * breadth * depth;
}

function num(v, dflt) {
  const n = parseFloat(v);
  return isNaN(n) ? (dflt === undefined ? 0 : dflt) : n;
}

function findCoefficient(project, notation) {
  return project.coefficients.find(c => c.notation === notation) || null;
}

// Returns {cement,pSand,mSand,bricks,agg} for one item
function computeItemMaterials(project, item) {
  const qty = computeItemQuantity(item);
  const coeff = findCoefficient(project, item.notation);
  if (!coeff) return { qty, cement: 0, pSand: 0, mSand: 0, bricks: 0, agg: 0 };
  return {
    qty,
    cement: qty * num(coeff.cement),
    pSand: qty * num(coeff.pSand),
    mSand: qty * num(coeff.mSand),
    bricks: qty * num(coeff.bricks),
    agg: qty * num(coeff.agg),
  };
}

// Totals for one section (sum of its items)
function computeSectionTotals(project, section) {
  const t = { qty: 0, cement: 0, pSand: 0, mSand: 0, bricks: 0, agg: 0 };
  (section.items || []).forEach(item => {
    const m = computeItemMaterials(project, item);
    t.qty += m.qty; t.cement += m.cement; t.pSand += m.pSand;
    t.mSand += m.mSand; t.bricks += m.bricks; t.agg += m.agg;
  });
  return t;
}

// Abstract-1: one row per section (work item), like the "Internal" sheet totals
function computeAbstract1(project) {
  return project.sections.map(sec => {
    const t = computeSectionTotals(project, sec);
    return {
      label: sec.name, notation: sec.notation || (sec.items[0] && sec.items[0].notation) || '',
      unit: (findCoefficient(project, sec.notation) || {}).unit || '',
      ...t,
    };
  });
}

// Abstract-2: grouped by notation across the whole project
function computeAbstract2(project) {
  const groups = {};
  project.sections.forEach(sec => {
    (sec.items || []).forEach(item => {
      const m = computeItemMaterials(project, item);
      const key = item.notation || '—';
      if (!groups[key]) groups[key] = { notation: key, qty: 0, cement: 0, pSand: 0, mSand: 0, bricks: 0, agg: 0 };
      groups[key].qty += m.qty; groups[key].cement += m.cement; groups[key].pSand += m.pSand;
      groups[key].mSand += m.mSand; groups[key].bricks += m.bricks; groups[key].agg += m.agg;
    });
  });
  const rows = Object.values(groups);
  const totals = rows.reduce((a, r) => ({
    qty: a.qty + r.qty, cement: a.cement + r.cement, pSand: a.pSand + r.pSand,
    mSand: a.mSand + r.mSand, bricks: a.bricks + r.bricks, agg: a.agg + r.agg,
  }), { qty: 0, cement: 0, pSand: 0, mSand: 0, bricks: 0, agg: 0 });
  const wf = 1 + (num(project.wastagePct, 0) / 100);
  const withWastage = {
    cement: totals.cement * wf, pSand: totals.pSand * wf,
    mSand: totals.mSand * wf, bricks: totals.bricks * wf, agg: totals.agg * wf,
  };
  return { rows, totals, withWastage, wastagePct: num(project.wastagePct, 0) };
}

function rateFor(project, materialName) {
  const r = project.materialRates.find(x => x.material.toLowerCase() === materialName.toLowerCase());
  return r ? num(r.rate) : 0;
}

// Main Abstract: material cost rollup (bulk materials from Abstract-2 + any custom "other" lines)
function computeMainAbstract(project) {
  const a2 = computeAbstract2(project);
  const rows = [];
  const pushRow = (material, unit, qty, spend) => {
    const rate = rateFor(project, material);
    const amount = qty * rate;
    rows.push({ material, unit, qty, rate, amount, spend: spend || 0, toBeSpend: amount - (spend || 0) });
  };
  pushRow('Cement', 'Bags', a2.withWastage.cement, spentFor(project, 'Cement'));
  pushRow('P.Sand', 'Cft', a2.withWastage.pSand, spentFor(project, 'P.Sand'));
  pushRow('M.Sand', 'Cft', a2.withWastage.mSand, spentFor(project, 'M.Sand'));
  pushRow('Bricks', 'Nos', a2.withWastage.bricks, spentFor(project, 'Bricks'));
  pushRow('20mm Aggregate', 'Cft', a2.withWastage.agg, spentFor(project, '20mm Aggregate'));

  (project.otherAbstractItems || []).forEach(o => {
    const rate = num(o.rate);
    const qty = num(o.quantity, 1);
    const amount = o.isLumpSum ? rate : qty * rate;
    rows.push({
      material: o.description, unit: o.unit || 'LS', qty: o.isLumpSum ? '' : qty, rate,
      amount, spend: num(o.spend), toBeSpend: amount - num(o.spend),
    });
  });

  const totalAmount = rows.reduce((s, r) => s + num(r.amount), 0);
  const totalSpend = rows.reduce((s, r) => s + num(r.spend), 0);
  return { rows, totalAmount, totalSpend, toBeSpend: totalAmount - totalSpend };
}

function spentFor(project, materialName) {
  const row = (project.materialSpend || []).find(m => m.material.toLowerCase() === materialName.toLowerCase());
  return row ? num(row.totalSpend) : 0;
}

function computeDailySpendRunning(project) {
  let received = 0, spent = 0;
  const rows = (project.dailySpend || [])
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(r => {
      received += num(r.received);
      spent += num(r.spent);
      return { ...r, balance: received - spent };
    });
  return { rows, totalReceived: received, totalSpent: spent, balance: received - spent };
}

function computeScheduleProgress(project) {
  const tasks = project.schedule || [];
  if (!tasks.length) return { pct: 0, total: 0, done: 0 };
  const avg = tasks.reduce((s, t) => s + num(t.progressPct), 0) / tasks.length;
  const done = tasks.filter(t => num(t.progressPct) >= 100).length;
  return { pct: Math.round(avg), total: tasks.length, done };
}
