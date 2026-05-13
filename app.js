const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const FULL_WEEK_HOURS = 37.5;

// Timeline: 06:00 – 23:00
const TL_START = 6 * 60;   // 360 min
const TL_END   = 23 * 60;  // 1380 min
const TL_RANGE = TL_END - TL_START; // 1020 min
const SNAP = 15; // minute snap grid

let weeks = [emptyWeek()];
let activeWeek = 0;
let drag = null;

function emptyWeek() {
  return Array.from({ length: 7 }, () => []);
}

// ---- Time helpers ----

function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function snapMin(min) {
  return Math.round(min / SNAP) * SNAP;
}

function minToPct(min) {
  return ((min - TL_START) / TL_RANGE) * 100;
}

function pctToMin(pct) {
  return TL_START + (pct / 100) * TL_RANGE;
}

const AUTO_LUNCH_THRESHOLD = 5.5 * 60; // 330 min gross
const AUTO_LUNCH_MINUTES   = 30;

function grossMinutes(shift) {
  const start = timeToMinutes(shift.start);
  const end   = timeToMinutes(shift.end);
  return end > start ? end - start : 0;
}

function autoLunch(shift) {
  return grossMinutes(shift) > AUTO_LUNCH_THRESHOLD ? AUTO_LUNCH_MINUTES : 0;
}

function calcNetHours(shift) {
  const gross = grossMinutes(shift);
  if (gross <= 0) return 0;
  return Math.max(0, gross - autoLunch(shift)) / 60;
}

function weekTotalHours(weekIdx) {
  return weeks[weekIdx].reduce((sum, dayShifts) =>
    sum + dayShifts.reduce((s, sh) => s + calcNetHours(sh), 0), 0);
}

function averageHours() {
  if (weeks.length === 0) return 0;
  return weeks.reduce((s, _, i) => s + weekTotalHours(i), 0) / weeks.length;
}

// ---- Type turnus ----

function onTurnusTypeChange() {
  const val = document.getElementById('meta-type-turnus').value;
  document.getElementById('box-personlig').style.display = val === 'personlig' ? 'block' : 'none';
  document.getElementById('box-sjaforer').style.display  = val === 'flerere'   ? 'block' : 'none';
}

// ---- Render week tabs ----

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

// ---- Render days with timeline ----

function renderDays() {
  const grid = document.getElementById('days-grid');
  grid.innerHTML = '';

  DAYS.forEach((dayName, di) => {
    const row = document.createElement('div');
    row.className = 'day-row';

    let markersHTML = '';
    for (let h = 6; h <= 23; h++) {
      const pct = minToPct(h * 60).toFixed(2);
      markersHTML += `<div class="tl-hour" style="left:${pct}%"><span>${h}</span></div>`;
    }

    row.innerHTML = `
      <div class="day-header">
        <span class="day-name">${dayName}</span>
        <span class="day-summary" id="day-summary-${di}">Fri</span>
      </div>
      <div class="day-body">
        <div class="tl-wrap">
          <div class="tl-hours-row">${markersHTML}</div>
          <div class="tl-track" id="tl-track-${di}"
            onmousedown="timelineMouseDown(event,${di})"
            ontouchstart="timelineTouchStart(event,${di})">
          </div>
        </div>
        <p class="tl-hint">Klikk og dra på tidslinjen for å opprette vakt</p>
        <div class="shift-details-list" id="shift-details-${di}"></div>
      </div>
    `;

    grid.appendChild(row);
    renderTimeline(di);
  });
}

function renderTimeline(di) {
  const track   = document.getElementById(`tl-track-${di}`);
  const details = document.getElementById(`shift-details-${di}`);
  if (!track || !details) return;

  track.querySelectorAll('.tl-block:not(.preview)').forEach(el => el.remove());
  details.innerHTML = '';

  weeks[activeWeek][di].forEach((shift, si) => {
    const startMin = timeToMinutes(shift.start);
    const endMin   = timeToMinutes(shift.end);
    const left  = minToPct(startMin);
    const width = minToPct(endMin) - minToPct(startMin);
    const net   = calcNetHours(shift);

    const block = document.createElement('div');
    block.className = 'tl-block';
    block.style.left  = Math.max(0, left) + '%';
    block.style.width = Math.max(0.5, width) + '%';
    block.title = `${shift.start} – ${shift.end}`;
    block.innerHTML = `<span class="tl-block-label">${shift.start}–${shift.end}</span>`;
    track.appendChild(block);

    const lunch = autoLunch(shift);
    const lunchTag = lunch > 0
      ? `<span class="sd-lunch-auto">🍽 ${lunch} min lunsj inkl.</span>`
      : '';

    const detail = document.createElement('div');
    detail.className = 'shift-detail-row';
    detail.innerHTML = `
      <span class="sd-time">${shift.start} – ${shift.end}</span>
      ${lunchTag}
      <span class="sd-net">${net.toFixed(2)} t</span>
      <button class="sd-delete" onclick="removeShift(${di},${si})" title="Slett vakt">✕</button>
    `;
    details.appendChild(detail);
  });

  updateDaySummary(di);
}

function updateDaySummary(di) {
  const dayShifts = weeks[activeWeek][di];
  const totalH = dayShifts.reduce((s, sh) => s + calcNetHours(sh), 0);
  const el = document.getElementById(`day-summary-${di}`);
  if (!el) return;
  el.textContent = dayShifts.length === 0
    ? 'Fri'
    : `${dayShifts.length} vakt${dayShifts.length > 1 ? 'er' : ''} – ${totalH.toFixed(2)} t`;
}

function renderSummary() {
  const avg = averageHours();
  const pct = (avg / FULL_WEEK_HOURS) * 100;

  document.getElementById('stat-weeks').textContent    = weeks.length;
  document.getElementById('stat-avg-hours').textContent = avg.toFixed(2) + ' t';
  document.getElementById('stat-pct').textContent       = pct.toFixed(1) + '%';

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

// ---- Week/shift actions ----

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

function removeShift(di, si) {
  weeks[activeWeek][di].splice(si, 1);
  renderTimeline(di);
  renderSummary();
}

function updateShift(di, si, field, value) {
  weeks[activeWeek][di][si][field] = value;
  renderTimeline(di);
  renderSummary();
}

// ---- Timeline drag (mouse) ----

function getTrackPct(clientX, trackEl) {
  const rect = trackEl.getBoundingClientRect();
  return Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100));
}

function timelineMouseDown(e, di) {
  const track = e.currentTarget;
  const pct   = getTrackPct(e.clientX, track);
  const startMin = Math.max(TL_START, Math.min(TL_END, snapMin(pctToMin(pct))));

  const preview = document.createElement('div');
  preview.className = 'tl-block preview';
  track.appendChild(preview);

  drag = { di, track, preview, startMin, endMin: startMin };
  updateDragPreview();
  e.preventDefault();
}

function handleGlobalMouseMove(e) {
  if (!drag) return;
  const pct    = getTrackPct(e.clientX, drag.track);
  drag.endMin  = Math.max(TL_START, Math.min(TL_END, snapMin(pctToMin(pct))));
  updateDragPreview();
}

function handleGlobalMouseUp() {
  if (!drag) return;
  const startMin = Math.min(drag.startMin, drag.endMin);
  const endMin   = Math.max(drag.startMin, drag.endMin);

  drag.preview.remove();

  if (endMin - startMin >= SNAP) {
    weeks[activeWeek][drag.di].push({
      start: minToTime(startMin),
      end:   minToTime(endMin)
    });
    renderTimeline(drag.di);
    renderSummary();
  }
  drag = null;
}

function updateDragPreview() {
  if (!drag) return;
  const s = Math.min(drag.startMin, drag.endMin);
  const e = Math.max(drag.startMin, drag.endMin);
  const left  = minToPct(s);
  const width = minToPct(e) - minToPct(s);
  drag.preview.style.left  = left + '%';
  drag.preview.style.width = Math.max(0, width) + '%';
  drag.preview.textContent = e - s >= SNAP ? `${minToTime(s)} – ${minToTime(e)}` : '';
}

// ---- Timeline drag (touch) ----

function timelineTouchStart(e, di) {
  const touch = e.touches[0];
  timelineMouseDown({ currentTarget: e.currentTarget, clientX: touch.clientX, preventDefault: () => e.preventDefault() }, di);
}

function handleGlobalTouchMove(e) {
  if (!drag) return;
  e.preventDefault();
  handleGlobalMouseMove({ clientX: e.touches[0].clientX });
}

function handleGlobalTouchEnd() {
  handleGlobalMouseUp();
}

// ---- PDF generation ----

function buildPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const avg       = averageHours();
  const pct       = ((avg / FULL_WEEK_HOURS) * 100).toFixed(1);
  const today     = new Date().toLocaleDateString('nb-NO');
  const avdeling  = document.getElementById('meta-avdeling').value;
  const leder     = document.getElementById('meta-leder').value;
  const typeVal   = document.getElementById('meta-type-turnus').value;
  const typeLabel = typeVal === 'personlig' ? 'Personlig turnus'
                  : typeVal === 'flerere'   ? 'Turnus for flere sjåfører' : '';
  const navn           = document.getElementById('meta-navn').value;
  const antallSjaforer = document.getElementById('meta-antall-sjaforer').value;
  const arsak          = document.getElementById('meta-arsak').value;
  const kommentar      = document.getElementById('meta-kommentar').value;

  const marginL = 20;
  const pageW   = 210;
  let y = 20;

  const line = (text, size = 11, bold = false, color = [0, 0, 0]) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(...color);
    doc.text(text, marginL, y);
    y += size * 0.45 + 2;
  };

  const multiLine = (text, size = 10) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(text, pageW - marginL * 2);
    lines.forEach(l => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(l, marginL, y);
      y += size * 0.45 + 1.5;
    });
    y += 2;
  };

  const hline = () => {
    doc.setDrawColor(180, 180, 180);
    doc.line(marginL, y, pageW - marginL, y);
    y += 5;
  };

  const nl = (n = 4) => { y += n; };

  const checkPage = (needed = 30) => {
    if (y + needed > 275) { doc.addPage(); y = 20; }
  };

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
  if (avdeling)       { line(`Avdeling: ${avdeling}`, 11); nl(1); }
  if (leder)          { line(`Avdelingsleder: ${leder}`, 11); nl(1); }
  if (typeLabel)      { line(`Type turnus: ${typeLabel}`, 11); nl(1); }
  if (navn)           { line(`Navn: ${navn}`, 11); nl(1); }
  if (antallSjaforer) { line(`Antall sjåfører: ${antallSjaforer}`, 11); nl(1); }
  nl(3);

  checkPage(40);
  line('Beregning av stillingsprosent', 12, true, [26, 74, 138]);
  hline();
  line(`Antall uker i turnus: ${weeks.length}`, 11); nl(1);
  line(`Gjennomsnittlig arbeidstid per uke: ${avg.toFixed(2)} timer`, 11); nl(1);
  line(`100% stilling = ${FULL_WEEK_HOURS} timer/uke`, 11); nl(1);
  line(`Stillingsprosent: ${pct}%`, 13, true, [37, 99, 235]);
  nl(5);

  checkPage(30);
  line('Vaktdetaljer per uke', 12, true, [26, 74, 138]);
  hline();

  weeks.forEach((week, wi) => {
    checkPage(60);
    line(`Uke ${wi + 1}`, 11, true);
    nl(1);

    let weekTotal = 0;
    DAYS.forEach((dayName, di) => {
      const dayShifts = week[di];
      if (y > 265) { doc.addPage(); y = 20; }

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
          const lunch = autoLunch(sh) > 0 ? ` (lunsj: ${autoLunch(sh)} min)` : '';
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

  if (arsak || kommentar) {
    checkPage(40);
    line('Tilleggsinformasjon', 12, true, [26, 74, 138]);
    hline();
    if (arsak) {
      line('Årsak til turnusendring:', 11, true);
      nl(1);
      multiLine(arsak);
      nl(2);
    }
    if (kommentar) {
      line('Annen kommentar:', 11, true);
      nl(1);
      multiLine(kommentar);
      nl(2);
    }
  }

  checkPage(50);
  nl(4);
  line('Underskrifter', 12, true, [26, 74, 138]);
  hline();

  const sigLine = (role) => {
    if (y > 265) { doc.addPage(); y = 20; }
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
    buildPDF().save('drofting_turnus.pdf');
    showStatus('success', 'PDF lastet ned.');
  } catch (err) {
    showStatus('error', 'Feil ved generering av PDF: ' + err.message);
  }
}

function openEmail() {
  try {
    buildPDF().save('drofting_turnus.pdf');
    const avdeling = document.getElementById('meta-avdeling').value || 'Avdeling';
    const navn     = document.getElementById('meta-navn').value || '';
    const subject  = encodeURIComponent(`Drøftingsnotat turnus – ${avdeling}${navn ? ' – ' + navn : ''}`);
    const body     = encodeURIComponent(
      `Hei,\n\nVedlagt finner du drøftingsnotat for turnus.\n\nAvdeling: ${avdeling}\n` +
      (navn ? `Navn: ${navn}\n` : '') +
      `\nVennlig hilsen`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    document.getElementById('email-hint').style.display = 'block';
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

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('mousemove', handleGlobalMouseMove);
  document.addEventListener('mouseup',   handleGlobalMouseUp);
  document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
  document.addEventListener('touchend',  handleGlobalTouchEnd);
  renderAll();
});
