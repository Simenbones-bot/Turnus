const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const FULL_WEEK_HOURS = 37.5;

let weeks = [emptyWeek()];
let activeWeek = 0;

function emptyWeek() {
  return Array.from({ length: 7 }, () => []);
}

function defaultShift() {
  return { start: '07:00', end: '15:00', lunchMinutes: 30 };
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function calcNetHours(shift) {
  const start = timeToMinutes(shift.start);
  const end = timeToMinutes(shift.end);
  if (end <= start) return 0;
  const gross = end - start;
  return Math.max(0, gross - (shift.lunchMinutes || 0)) / 60;
}

function weekTotalHours(weekIdx) {
  return weeks[weekIdx].reduce((sum, dayShifts) =>
    sum + dayShifts.reduce((s, sh) => s + calcNetHours(sh), 0), 0);
}

function averageHours() {
  if (weeks.length === 0) return 0;
  return weeks.reduce((s, _, i) => s + weekTotalHours(i), 0) / weeks.length;
}

function renderWeekTabs() {
  const wrap = document.getElementById('week-tabs');
  wrap.innerHTML = '';
  weeks.forEach((_, i) => {
    const tab = document.createElement('button');
    tab.className = 'week-tab' + (i === activeWeek ? ' active' : '');
    tab.textContent = `Uke ${i + 1}`;
    tab.onclick = () => { activeWeek = i; renderAll(); };
    wrap.appendChild(tab);
    if (weeks.length > 1) {
      const del = document.createElement('button');
      del.className = 'week-tab delete-week';
      del.title = `Slett uke ${i + 1}`;
      del.textContent = '✕';
      del.onclick = (e) => { e.stopPropagation(); deleteWeek(i); };
      wrap.appendChild(del);
    }
  });
  const addBtn = document.createElement('button');
  addBtn.id = 'add-week-btn';
  addBtn.textContent = '+ Legg til uke';
  addBtn.onclick = addWeek;
  wrap.appendChild(addBtn);
}

function renderDays() {
  const grid = document.getElementById('days-grid');
  grid.innerHTML = '';
  const week = weeks[activeWeek];

  DAYS.forEach((dayName, di) => {
    const dayShifts = week[di];
    const totalH = dayShifts.reduce((s, sh) => s + calcNetHours(sh), 0);
    const summaryText = dayShifts.length === 0
      ? 'Fri'
      : dayShifts.map(sh => `${sh.start}–${sh.end}${sh.lunchMinutes ? ' (L)' : ''}`).join(', ') + `  →  ${totalH.toFixed(2)} t`;

    const row = document.createElement('div');
    row.className = 'day-row';
    row.innerHTML = `
      <div class="day-header" onclick="toggleDay(${di})">
        <span class="day-name">${dayName}</span>
        <span class="day-summary" id="day-summary-${di}">${summaryText}</span>
        <span class="day-toggle">▼ Rediger</span>
      </div>
      <div class="day-body" id="day-body-${di}">
        <div class="shifts-list" id="shifts-list-${di}"></div>
        <button class="btn-add-shift" onclick="addShift(${di})">+ Legg til vakt</button>
      </div>
    `;
    grid.appendChild(row);
    renderShifts(di);
  });
}

function renderShifts(di) {
  const list = document.getElementById(`shifts-list-${di}`);
  if (!list) return;
  list.innerHTML = '';
  weeks[activeWeek][di].forEach((shift, si) => {
    const net = calcNetHours(shift);
    const row = document.createElement('div');
    row.className = 'shift-row';
    row.innerHTML = `
      <label>Fra</label>
      <input type="time" value="${shift.start}" onchange="updateShift(${di},${si},'start',this.value)">
      <label>Til</label>
      <input type="time" value="${shift.end}" onchange="updateShift(${di},${si},'end',this.value)">
      <div class="lunch-group">
        <label>Lunch (min)</label>
        <input type="number" min="0" max="120" step="5" value="${shift.lunchMinutes}"
          onchange="updateShift(${di},${si},'lunchMinutes',parseInt(this.value)||0)">
      </div>
      <span class="shift-hours" id="shift-hours-${di}-${si}">${net.toFixed(2)} t</span>
      <button class="btn-remove-shift" title="Fjern vakt" onclick="removeShift(${di},${si})">✕</button>
    `;
    list.appendChild(row);
  });
}

function updateDaySummary(di) {
  const dayShifts = weeks[activeWeek][di];
  const totalH = dayShifts.reduce((s, sh) => s + calcNetHours(sh), 0);
  const el = document.getElementById(`day-summary-${di}`);
  if (!el) return;
  el.textContent = dayShifts.length === 0
    ? 'Fri'
    : dayShifts.map(sh => `${sh.start}–${sh.end}${sh.lunchMinutes ? ' (L)' : ''}`).join(', ') + `  →  ${totalH.toFixed(2)} t`;
}

function renderSummary() {
  const avg = averageHours();
  const pct = (avg / FULL_WEEK_HOURS) * 100;

  document.getElementById('stat-weeks').textContent = weeks.length;
  document.getElementById('stat-avg-hours').textContent = avg.toFixed(2) + ' t';
  document.getElementById('stat-pct').textContent = pct.toFixed(1) + '%';

  const bar = document.getElementById('stilling-bar-fill');
  bar.style.width = Math.min(pct, 100) + '%';
  document.getElementById('stilling-bar-pct').textContent = pct.toFixed(1) + '%';

  const list = document.getElementById('week-hours-list');
  list.innerHTML = '';
  weeks.forEach((_, i) => {
    const h = weekTotalHours(i);
    const p = ((h / FULL_WEEK_HOURS) * 100).toFixed(1);
    const item = document.createElement('div');
    item.className = 'week-hours-item';
    item.innerHTML = `<span>Uke ${i + 1}</span><span>${h.toFixed(2)} t &nbsp;(${p}%)</span>`;
    list.appendChild(item);
  });
}

function renderAll() {
  renderWeekTabs();
  renderDays();
  renderSummary();
}

function toggleDay(di) {
  document.getElementById(`day-body-${di}`).classList.toggle('open');
}

function addWeek() {
  weeks.push(emptyWeek());
  activeWeek = weeks.length - 1;
  renderAll();
}

function deleteWeek(i) {
  weeks.splice(i, 1);
  if (activeWeek >= weeks.length) activeWeek = weeks.length - 1;
  renderAll();
}

function addShift(di) {
  weeks[activeWeek][di].push(defaultShift());
  renderShifts(di);
  updateDaySummary(di);
  renderSummary();
  document.getElementById(`day-body-${di}`).classList.add('open');
}

function removeShift(di, si) {
  weeks[activeWeek][di].splice(si, 1);
  renderShifts(di);
  updateDaySummary(di);
  renderSummary();
}

function updateShift(di, si, field, value) {
  weeks[activeWeek][di][si][field] = value;
  const net = calcNetHours(weeks[activeWeek][di][si]);
  const el = document.getElementById(`shift-hours-${di}-${si}`);
  if (el) el.textContent = net.toFixed(2) + ' t';
  updateDaySummary(di);
  renderSummary();
}

function buildPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const avg = averageHours();
  const pct = ((avg / FULL_WEEK_HOURS) * 100).toFixed(1);
  const today = new Date().toLocaleDateString('nb-NO');
  const avdeling = document.getElementById('meta-avdeling').value;
  const leder = document.getElementById('meta-leder').value;
  const ansatt = document.getElementById('meta-ansatt').value;

  const marginL = 20;
  const pageW = 210;
  let y = 20;

  const line = (text, size = 11, bold = false, color = [0, 0, 0]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(text, marginL, y);
    y += size * 0.45 + 2;
  };

  const hline = () => {
    doc.setDrawColor(180, 180, 180);
    doc.line(marginL, y, pageW - marginL, y);
    y += 5;
  };

  const nl = (n = 4) => { y += n; };

  doc.setFillColor(26, 74, 138);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('DRØFTINGSNOTAT – TURNUS', pageW / 2, 13, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Til behandling med fagforbundet', pageW / 2, 21, { align: 'center' });
  y = 36;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Dato: ${today}`, pageW - marginL, y, { align: 'right' });
  nl(2);

  line('Informasjon', 12, true, [26, 74, 138]);
  hline();
  if (avdeling) { line(`Avdeling: ${avdeling}`, 11); nl(1); }
  if (leder)    { line(`Avdelingsleder: ${leder}`, 11); nl(1); }
  if (ansatt)   { line(`Ansatt: ${ansatt}`, 11); nl(1); }
  nl(3);

  line('Beregning av stillingsprosent', 12, true, [26, 74, 138]);
  hline();
  line(`Antall uker i turnus: ${weeks.length}`, 11);
  nl(1);
  line(`Gjennomsnittlig arbeidstid per uke: ${avg.toFixed(2)} timer`, 11);
  nl(1);
  line(`100% stilling = ${FULL_WEEK_HOURS} timer/uke`, 11);
  nl(1);
  line(`Stillingsprosent: ${pct}%`, 13, true, [37, 99, 235]);
  nl(5);

  line('Vaktdetaljer per uke', 12, true, [26, 74, 138]);
  hline();

  weeks.forEach((week, wi) => {
    if (y > 240) { doc.addPage(); y = 20; }

    line(`Uke ${wi + 1}`, 11, true);
    nl(1);

    let weekTotal = 0;
    DAYS.forEach((dayName, di) => {
      const dayShifts = week[di];
      if (dayShifts.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(`${dayName}: Fri`, marginL + 4, y);
        y += 6;
      } else {
        dayShifts.forEach((sh) => {
          const net = calcNetHours(sh);
          weekTotal += net;
          const lunch = sh.lunchMinutes > 0 ? ` (lunch: ${sh.lunchMinutes} min)` : '';
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 30, 30);
          doc.text(`${dayName}: ${sh.start} – ${sh.end}${lunch}`, marginL + 4, y);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(37, 99, 235);
          doc.text(`${net.toFixed(2)} t`, pageW - marginL, y, { align: 'right' });
          y += 6;
        });
      }
    });

    nl(1);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Sum uke ${wi + 1}: ${weekTotal.toFixed(2)} timer`, marginL + 4, y);
    y += 6;
    nl(4);
  });

  if (y > 220) { doc.addPage(); y = 20; }
  nl(4);
  line('Underskrifter', 12, true, [26, 74, 138]);
  hline();

  const sigLine = (role) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(role + ':', marginL, y);
    y += 5;
    doc.setDrawColor(0, 0, 0);
    doc.line(marginL, y, marginL + 80, y);
    doc.text('Dato:', marginL + 85, y - 1);
    doc.line(marginL + 95, y, marginL + 125, y);
    y += 10;
  };

  sigLine('Avdelingsleder');
  sigLine('Tillitsvalgt / Fagforbundet');
  sigLine('Ansatt');

  return doc;
}

function downloadPDF() {
  try {
    const doc = buildPDF();
    doc.save('drofting_turnus.pdf');
    showStatus('success', 'PDF lastet ned.');
  } catch (err) {
    showStatus('error', 'Feil ved generering av PDF: ' + err.message);
  }
}

function openEmail() {
  try {
    const doc = buildPDF();
    doc.save('drofting_turnus.pdf');

    const avdeling = document.getElementById('meta-avdeling').value || 'Avdeling';
    const ansatt = document.getElementById('meta-ansatt').value || '';
    const subject = encodeURIComponent(`Drøftingsnotat turnus – ${avdeling}${ansatt ? ' – ' + ansatt : ''}`);
    const body = encodeURIComponent(
      `Hei,\n\nVedlagt finner du drøftingsnotat for turnus.\n\n` +
      `Avdeling: ${avdeling}\n` +
      (ansatt ? `Ansatt: ${ansatt}\n` : '') +
      `\nVennlig hilsen`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;

    const hint = document.getElementById('email-hint');
    hint.style.display = 'block';
    showStatus('success', 'PDF lastet ned. Legg den ved i e-posten som åpnet seg.');
  } catch (err) {
    showStatus('error', 'Feil: ' + err.message);
  }
}

function showStatus(type, msg) {
  const el = document.getElementById('export-status');
  el.className = 'status-msg ' + type;
  el.textContent = msg;
  setTimeout(() => { el.className = 'status-msg'; }, 8000);
}

document.addEventListener('DOMContentLoaded', renderAll);
