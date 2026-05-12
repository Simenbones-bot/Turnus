const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const FULL_WEEK_HOURS = 37.5;

// State: array of weeks, each week = array of 7 day-shift-arrays
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
  const net = gross - (shift.lunchMinutes || 0);
  return Math.max(0, net) / 60;
}

function weekTotalHours(weekIdx) {
  return weeks[weekIdx].reduce((sum, dayShifts) =>
    sum + dayShifts.reduce((s, sh) => s + calcNetHours(sh), 0), 0);
}

function averageHours() {
  if (weeks.length === 0) return 0;
  return weeks.reduce((s, _, i) => s + weekTotalHours(i), 0) / weeks.length;
}

// ---- Render ----

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
        <span class="day-toggle" id="day-toggle-${di}">▼ Rediger</span>
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
  const dayShifts = weeks[activeWeek][di];
  dayShifts.forEach((shift, si) => {
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

// ---- Actions ----

function toggleDay(di) {
  const body = document.getElementById(`day-body-${di}`);
  body.classList.toggle('open');
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
  const body = document.getElementById(`day-body-${di}`);
  if (body) body.classList.add('open');
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
  const hoursEl = document.getElementById(`shift-hours-${di}-${si}`);
  if (hoursEl) hoursEl.textContent = net.toFixed(2) + ' t';
  updateDaySummary(di);
  renderSummary();
}

// ---- Build payload ----

function buildPayload() {
  const weeksData = weeks.map((week) =>
    week.map((dayShifts) =>
      dayShifts.map((sh) => ({
        start: sh.start,
        end: sh.end,
        lunchMinutes: sh.lunchMinutes,
        netHours: calcNetHours(sh),
      }))
    )
  );
  return {
    turnus: {
      weeks: weeksData,
      averageHours: averageHours(),
    },
    metadata: {
      avdeling: document.getElementById('meta-avdeling').value,
      leder: document.getElementById('meta-leder').value,
      ansatt: document.getElementById('meta-ansatt').value,
    },
  };
}

// ---- PDF download ----

async function downloadPDF() {
  const btn = document.getElementById('btn-download');
  btn.disabled = true;
  btn.textContent = 'Genererer...';
  try {
    const payload = buildPayload();
    const res = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Feil ved generering av PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drofting_turnus.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showStatus('error', 'Kunne ikke laste ned PDF: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Last ned PDF';
  }
}

// ---- Send email ----

async function sendEmail() {
  const email = document.getElementById('email-input').value.trim();
  if (!email) {
    showStatus('error', 'Skriv inn en e-postadresse.');
    return;
  }
  const btn = document.getElementById('btn-send');
  btn.disabled = true;
  btn.textContent = 'Sender...';
  try {
    const payload = { ...buildPayload(), email };
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      showStatus('success', `Drøftingsnotat sendt til ${email}`);
    } else {
      throw new Error(data.error || 'Ukjent feil');
    }
  } catch (err) {
    showStatus('error', 'Sending feilet: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send til e-post';
  }
}

function showStatus(type, msg) {
  const el = document.getElementById('email-status');
  el.className = 'status-msg ' + type;
  el.textContent = msg;
  setTimeout(() => { el.className = 'status-msg'; }, 6000);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', renderAll);
