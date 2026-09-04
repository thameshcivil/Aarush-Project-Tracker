/* ============================================================
   xlsx-io.js — export project -> .xlsx (SheetJS) and import back
   ============================================================ */

function exportProjectToWorkbook(project) {
  const wb = XLSX.utils.book_new();

  // --- Title sheet ---
  const titleAOA = [
    ['Enterprises'],
    ['Project:', project.name],
    ['Builder:', project.builder],
    ['Location:', project.location],
    ['Scope of work:', project.scopeOfWork],
    ['Work from', '', '', '', '', ':', project.workFrom],
    ['Work done by', '', '', '', '', ':', project.workDoneBy],
    ['Contact No', '', '', '', '', ':', project.contact],
    ['Mail to', '', '', '', '', ':', project.mailTo],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(titleAOA), 'Title');

  // --- Coefficients sheet ---
  const coeffHeader = ['Notation', 'Label', 'Cement (Bags)/Unit', 'P.Sand (Cft)/Unit', 'M.Sand (Cft)/Unit', 'Bricks/Unit', '20mm Aggregate (Cft)/Unit', 'Unit', 'Note'];
  const coeffRows = project.coefficients.map(c => [c.notation, c.label, c.cement, c.pSand, c.mSand, c.bricks, c.agg, c.unit, c.note]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([coeffHeader, ...coeffRows]), 'Coefficients');

  // --- Measurements (BOQ) sheet, section by section like "Internal" ---
  const measHeader = ['Sl.No', 'Section', 'Description', 'Notation', 'Nos', 'Member Count', 'Length (Ft)', 'Breadth (Ft)', 'Depth (Ft)', 'Quantity', 'Cement (Bags)', 'P.Sand (Cft)', 'M.Sand (Cft)', 'Bricks', '20mm Aggregate (Cft)'];
  const measRows = [measHeader];
  let sl = 1;
  project.sections.forEach(sec => {
    (sec.items || []).forEach(item => {
      const m = computeItemMaterials(project, item);
      measRows.push([sl++, sec.name, item.description, item.notation, item.nos, item.member, item.length, item.breadth, item.depth, m.qty, m.cement, m.pSand, m.mSand, m.bricks, m.agg]);
    });
    const t = computeSectionTotals(project, sec);
    measRows.push(['', sec.name + ' — TOTAL', '', '', '', '', '', '', '', t.qty, t.cement, t.pSand, t.mSand, t.bricks, t.agg]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(measRows), 'Measurements');

  // --- Abstract-1 sheet ---
  const a1 = computeAbstract1(project);
  const a1Header = ['S.No', 'Description', 'Notation', 'Unit', 'Quantity', 'Cement (Bags)', 'P.Sand (Cft)', 'M.Sand (Cft)', 'Bricks', '20mm Aggregate (Cft)'];
  const a1Rows = a1.map((r, i) => [i + 1, r.label, r.notation, r.unit, r.qty, r.cement, r.pSand, r.mSand, r.bricks, r.agg]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([a1Header, ...a1Rows]), 'Abstract-1');

  // --- Abstract-2 sheet ---
  const a2 = computeAbstract2(project);
  const a2Header = ['Notation', 'Quantity', 'Cement (Bags)', 'P.Sand (Cft)', 'M.Sand (Cft)', 'Bricks', '20mm Aggregate (Cft)'];
  const a2Rows = a2.rows.map(r => [r.notation, r.qty, r.cement, r.pSand, r.mSand, r.bricks, r.agg]);
  a2Rows.push(['Total', a2.totals.qty, a2.totals.cement, a2.totals.pSand, a2.totals.mSand, a2.totals.bricks, a2.totals.agg]);
  a2Rows.push([`With Wastage (${a2.wastagePct}%)`, '', a2.withWastage.cement, a2.withWastage.pSand, a2.withWastage.mSand, a2.withWastage.bricks, a2.withWastage.agg]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([a2Header, ...a2Rows]), 'Abstract-2');

  // --- Main Abstract sheet ---
  const ma = computeMainAbstract(project);
  const maHeader = ['Description', 'Unit', 'Quantity', 'Rate', 'Amount', 'As Per Spend', 'To Be Spend'];
  const maRows = ma.rows.map(r => [r.material, r.unit, r.qty, r.rate, r.amount, r.spend, r.toBeSpend]);
  maRows.push(['TOTAL', '', '', '', ma.totalAmount, ma.totalSpend, ma.toBeSpend]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([maHeader, ...maRows]), 'Main Abstract');

  // --- Material Spend sheet (linked: required qty comes from the BOQ) ---
  const linked = computeMaterialSpendLinked(project);
  const msHeader = ['Material', 'Required Qty', 'Purchased Qty', 'Remaining Qty', 'Total Spend', 'Remaining to Spend'];
  const msRows = [
    ...linked.bulkRows.map(r => [r.material, r.requiredQty, r.purchasedQty, r.remainingQty, r.totalSpend, r.remainingAmount]),
    ...linked.customRows.map(r => [r.material, '', r.purchasedQty, '', r.totalSpend, '']),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([msHeader, ...msRows]), 'Material Spend');

  // --- Daily Spend sheet ---
  const dsRun = computeDailySpendRunning(project);
  const dsHeader = ['Date', 'Notation / Description', 'Quantity', 'Amount Received', 'Amount Spent', 'Balance', 'Remark 1', 'Remark 2'];
  const dsRows = dsRun.rows.map(r => [r.date, r.notation, r.quantity, r.received, r.spent, r.balance, r.remark1, r.remark2]);
  dsRows.push(['', 'TOTAL', '', dsRun.totalReceived, dsRun.totalSpent, dsRun.balance, '', '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([dsHeader, ...dsRows]), 'Daily Spend');

  // --- Schedule sheet (dates are calculated from start date + order + duration) ---
  const plan = computeSchedulePlan(project);
  const schHeader = ['Task', 'Category', 'Duration (days)', 'Labour Required', 'Planned Start', 'Planned End', 'Actual Start', 'Actual End', 'Status', 'Progress %', 'Notes'];
  const schRows = plan.map(s => [s.task, s.category, s.durationDays, s.labour, s.plannedStart, s.plannedEnd, s.actualStart, s.actualEnd, s.status, s.progressPct, s.notes]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([schHeader, ...schRows]), 'Schedule');

  return wb;
}

function exportProjectToBlob(project) {
  const wb = exportProjectToWorkbook(project);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
}

/* ---------- Import ---------- */
// Best-effort import: reads a workbook exported by this app (or the original
// template's sheet names) and rebuilds a project object.
function importWorkbookToProject(wb, projectName) {
  const project = newProject(projectName || 'Imported Project');
  const sheet = (name) => wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) : null;

  const title = sheet('Title');
  if (title) {
    title.forEach(row => {
      const label = (row[0] || '').toString().toLowerCase();
      if (label.startsWith('project')) project.name = row[1] || project.name;
      else if (label.startsWith('builder')) project.builder = row[1] || '';
      else if (label.startsWith('location')) project.location = row[1] || '';
      else if (label.startsWith('scope')) project.scopeOfWork = row[1] || '';
      else if (label.startsWith('work from')) project.workFrom = row[6] || '';
      else if (label.startsWith('work done')) project.workDoneBy = row[6] || '';
      else if (label.startsWith('contact')) project.contact = row[6] || '';
      else if (label.startsWith('mail')) project.mailTo = row[6] || '';
    });
  }

  const coeff = sheet('Coefficients');
  if (coeff && coeff.length > 1) {
    project.coefficients = coeff.slice(1).filter(r => r[0]).map(r => ({
      notation: r[0], label: r[1] || r[0], cement: num(r[2]), pSand: num(r[3]), mSand: num(r[4]),
      bricks: num(r[5]), agg: num(r[6]), unit: r[7] || '', note: r[8] || '',
    }));
  }

  const meas = sheet('Measurements');
  if (meas && meas.length > 1) {
    const bySection = {};
    meas.slice(1).forEach(r => {
      const sectionName = (r[1] || '').toString();
      if (!sectionName || sectionName.includes('TOTAL')) return;
      if (!bySection[sectionName]) bySection[sectionName] = { id: uid('sec'), label: sectionName, name: sectionName, notation: r[3] || '', items: [] };
      bySection[sectionName].items.push({
        id: uid('item'), description: r[2] || '', notation: r[3] || '', nos: num(r[4], 1),
        member: num(r[5], 1), length: num(r[6], 1), breadth: num(r[7], 1), depth: num(r[8], 1),
      });
    });
    project.sections = Object.values(bySection);
  }

  const ma = sheet('Main Abstract');
  if (ma && ma.length > 1) {
    const bulk = ['cement', 'p.sand', 'm.sand', 'bricks', '20mm aggregate'];
    project.otherAbstractItems = ma.slice(1).filter(r => r[0] && r[0] !== 'TOTAL' && !bulk.includes((r[0] || '').toString().toLowerCase())).map(r => ({
      id: uid('oth'), description: r[0], unit: r[1] || 'LS', quantity: num(r[2], 1), rate: num(r[3]),
      isLumpSum: !r[2], spend: num(r[5]),
    }));
    // update material rates from bulk rows if present
    ma.slice(1).forEach(r => {
      const key = (r[0] || '').toString();
      const rateRow = project.materialRates.find(x => x.material.toLowerCase() === key.toLowerCase());
      if (rateRow && r[3]) rateRow.rate = num(r[3]);
    });
  }

  const ms = sheet('Material Spend');
  if (ms && ms.length > 1) {
    // New layout: Material, Required Qty, Purchased Qty, Remaining Qty, Total Spend, Remaining to Spend
    // (Required/Remaining are recalculated from the BOQ, so only material/purchased/spend are imported)
    project.materialSpend = ms.slice(1).filter(r => r[0]).map(r => ({
      id: uid('spend'), material: r[0], purchasedQty: num(r[2]), totalSpend: num(r[4]),
    }));
  }

  const ds = sheet('Daily Spend');
  if (ds && ds.length > 1) {
    project.dailySpend = ds.slice(1).filter(r => r[1] && r[1] !== 'TOTAL').map(r => ({
      id: uid('day'), date: r[0] || '', notation: r[1] || '', quantity: num(r[2]),
      received: num(r[3]), spent: num(r[4]), remark1: r[6] || '', remark2: r[7] || '',
    }));
  }

  const sch = sheet('Schedule');
  if (sch && sch.length > 1) {
    // New layout: Task, Category, Duration, Labour, PlannedStart, PlannedEnd, ActualStart, ActualEnd, Status, Progress, Notes
    // Planned dates are recalculated from the start date + order, so they aren't imported directly.
    project.schedule = sch.slice(1).filter(r => r[0]).map(r => ({
      id: uid('task'), task: r[0], category: r[1] || '', durationDays: num(r[2], 1), labour: num(r[3]),
      actualStart: r[6] || '', actualEnd: r[7] || '', status: r[8] || 'Not Started', progressPct: num(r[9]), notes: r[10] || '', linkedSectionId: '',
    }));
  }

  return project;
}

function readFileAsWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        resolve(wb);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/* ---------- Share ---------- */
async function shareProjectExcel(project) {
  const blob = exportProjectToBlob(project);
  const fileName = (project.name || 'project').replace(/[^a-z0-9\-_ ]/gi, '_') + '.xlsx';
  const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: project.name,
        text: `${project.name} — project data export`,
      });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      console.error('share failed', err);
    }
  }
  // Fallback: just download it
  downloadBlob(blob, fileName);
  return false;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
