/* ── Config ── */
const SUPABASE_URL = "https://ortxannsshuuxqcfkxlj.supabase.co/rest/v1/daily_logs";
const SUPABASE_KEY = "sb_publishable_zGauV0bkumP5Q0UI6pyxhQ_BIi6eQfR";
const HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": "Bearer " + SUPABASE_KEY
};

/* ── State ── */
let registros = [];
let filtrados = [];
let filtro = 'todo';
let editandoId = null;

/* ── Score ── */
function score(r) {
  return ((r.energia + r.enfoque + r.animo) / 3) * 10;
}

/* ── Supabase ── */
async function cargar() {
  try {
    const res = await fetch(SUPABASE_URL + "?select=*&order=id.asc", { headers: HEADERS });
    if (!res.ok) return;
    registros = (await res.json()).map(d => ({
      id: d.id, fecha: d.fecha, actividad: d.actividad,
      jornada: d.jornada || "Mañana",
      energia: +d.energia, enfoque: +d.enfoque, animo: +d.animo
    }));
    aplicarFiltro();
  } catch(e) { console.error(e); }
}

async function guardar(actividad, jornada, energia, enfoque, animo) {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  const fecha = d.toISOString().split('T')[0];
  const res = await fetch(SUPABASE_URL, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ fecha, actividad, jornada, energia, enfoque, animo })
  });
  if (res.ok) await cargar();
}

async function actualizar(id, actividad, jornada, energia, enfoque, animo) {
  const orig = registros.find(r => String(r.id) === String(id));
  const fecha = orig ? orig.fecha : new Date().toISOString().split('T')[0];
  const res = await fetch(`${SUPABASE_URL}?id=eq.${id}`, {
    method: "PATCH", headers: HEADERS,
    body: JSON.stringify({ fecha, actividad, jornada, energia, enfoque, animo })
  });
  if (res.ok) await cargar();
}

async function borrarRegistro(id) {
  if (!confirm("¿Borrar este registro?")) return;
  await fetch(`${SUPABASE_URL}?id=eq.${id}`, { method: "DELETE", headers: HEADERS });
  await cargar();
}

/* ── Filtro ── */
function cambiarFiltro(dias, btn) {
  filtro = dias;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  aplicarFiltro();
}

function aplicarFiltro() {
  if (filtro === 'todo') {
    filtrados = [...registros];
  } else {
    const corte = new Date();
    corte.setDate(corte.getDate() - parseInt(filtro));
    const lim = corte.toISOString().split('T')[0];
    filtrados = registros.filter(r => r.fecha >= lim);
  }
  render();
}

/* ── Render principal ── */
function render() {
  renderStats();
  renderRecomendacion();
  renderHeatmap();
  renderWeekBars();
  renderInsights();
  renderActTable();
  renderRoutine();
  renderEnergy();
  renderGrafico();
  renderHistorial();
  renderChips();
  renderRacha();
}

/* ── Stats ── */
function renderStats() {
  const n = filtrados.length;
  document.getElementById('statTotal').textContent = n;

  if (n === 0) {
    document.getElementById('statScore').textContent = '—';
    document.getElementById('statChange').textContent = '';
    document.getElementById('dashTitle').textContent = 'Tu rendimiento';
    document.getElementById('dashSub').textContent = 'Empezá registrando tu primera actividad.';
    return;
  }

  const ultimo = filtrados[n - 1];
  const s = score(ultimo);
  document.getElementById('statScore').textContent = s.toFixed(0) + '%';
  document.getElementById('dashTitle').textContent = ultimo.actividad;
  document.getElementById('dashSub').textContent = `Última actividad · ${ultimo.jornada} · ${ultimo.fecha}`;

  if (n >= 2) {
    const dif = s - score(filtrados[n - 2]);
    const el = document.getElementById('statChange');
    if (dif > 0)      { el.textContent = '+' + dif.toFixed(0) + '% vs anterior'; el.className = 'stat-change up'; }
    else if (dif < 0) { el.textContent = dif.toFixed(0) + '% vs anterior';        el.className = 'stat-change down'; }
    else              { el.textContent = 'igual que anterior';                     el.className = 'stat-change'; }
  }
}

/* ── Recomendación ── */
function renderRecomendacion() {
  const el = document.getElementById('recomendacionCoach');
  if (filtrados.length < 3) {
    el.innerHTML = '<p class="empty">Registrá al menos 3 actividades para ver recomendaciones.</p>';
    return;
  }

  const grupos = {};
  filtrados.forEach(r => {
    const k = r.actividad + '|' + r.jornada;
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(score(r));
  });

  let mejorK = '', mejorP = -1, peorK = '', peorP = 999;
  for (const k in grupos) {
    const p = grupos[k].reduce((a, b) => a + b, 0) / grupos[k].length;
    if (p > mejorP) { mejorP = p; mejorK = k; }
    if (p < peorP)  { peorP = p; peorK = k; }
  }

  const [mA, mJ] = mejorK.split('|');
  const [pA, pJ] = peorK.split('|');
  const frases = [
    `<b>${mA}</b> por la <b>${mJ}</b>. Ése es tu momento de oro.`,
    `Los datos muestran que <b>${mA}</b> a la <b>${mJ}</b> es tu combinación ganadora.`,
    `<b>${mA}</b> a la <b>${mJ}</b>, te hace fluir. Priorizalo.`
  ];

  let html = `<p class="rec-text">${frases[new Date().getDay() % frases.length]}</p>`;
  if (peorP < 65 && (pA !== mA || pJ !== mJ)) {
    html += `<p class="rec-sub">Ojo: <b>${pA}</b> por la <b>${pJ}</b> te cuesta más de lo normal. Considerá moverlo de horario.</p>`;
  }
  el.innerHTML = html;
}

/* ── Heatmap ── */
function renderHeatmap() {
  const el = document.getElementById('heatmapContenedor');
  if (!el) return;

  const res = { Mañana: { s:0, n:0 }, Tarde: { s:0, n:0 }, Noche: { s:0, n:0 } };
  filtrados.forEach(r => {
    if (res[r.jornada]) { res[r.jornada].s += score(r); res[r.jornada].n++; }
  });

  el.innerHTML = ['Mañana', 'Tarde', 'Noche'].map(m => {
    const d = res[m];
    const prom = d.n ? Math.round(d.s / d.n) : 0;
    const barClass = prom >= 75 ? 'bar-green' : prom >= 50 ? 'bar-amber' : prom > 0 ? 'bar-red' : '';
    return `<div class="today-block">
      <div class="today-moment">${m}</div>
      <div class="today-score${d.n ? '' : ' today-empty'}">${d.n ? prom + '%' : '–'}</div>
      <div class="today-bar"><div class="today-bar-fill ${barClass}" style="width:${prom}%"></div></div>
    </div>`;
  }).join('');
}

/* ── Barras semanales ── */
function renderWeekBars() {
  const el = document.getElementById('historial7Dias');
  if (!el) return;

  if (!filtrados.length) { el.innerHTML = '<p class="empty">Sin datos.</p>'; return; }

  const porDia = {};
  filtrados.forEach(r => {
    if (!porDia[r.fecha]) porDia[r.fecha] = { s:0, n:0 };
    porDia[r.fecha].s += score(r);
    porDia[r.fecha].n++;
  });

  el.innerHTML = Object.keys(porDia).sort().slice(-7).map(f => {
    const prom = porDia[f].s / porDia[f].n;
    const [, mes, dia] = f.split('-');
    return `<div class="w-col">
      <div class="w-bar-wrap"><div class="w-bar" style="height:${prom}%"></div></div>
      <span class="w-label">${dia}/${mes}</span>
    </div>`;
  }).join('');
}

/* ── Insights ── */
function renderInsights() {
  const el = document.getElementById('insights');
  if (!el) return;

  if (filtrados.length < 2) {
    el.innerHTML = '<p class="empty">Necesitás al menos 2 registros.</p>'; return;
  }

  const analisis = {};
  filtrados.forEach(r => {
    if (!analisis[r.actividad]) analisis[r.actividad] = {};
    if (!analisis[r.actividad][r.jornada]) analisis[r.actividad][r.jornada] = [];
    analisis[r.actividad][r.jornada].push(r.enfoque);
  });

  const msgs = [];
  for (const act in analisis) {
    const proms = {};
    for (const j in analisis[act]) {
      const arr = analisis[act][j];
      proms[j] = arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    const tiempos = Object.keys(proms);
    if (tiempos.length < 2) continue;
    const best  = tiempos.reduce((a, b) => proms[a] > proms[b] ? a : b);
    const worst = tiempos.reduce((a, b) => proms[a] < proms[b] ? a : b);
    if (proms[best] - proms[worst] >= 1.5 || proms[best] >= 8)
      msgs.push({ icon: '💡', text: `<b>${act}</b> por la <b>${best}</b> dispara tu productividad.` });
    else if (proms[worst] <= 4)
      msgs.push({ icon: '⚠️', text: `<b>${act}</b> por la <b>${worst}</b> te está costando demasiado.` });
  }

  el.innerHTML = msgs.length
    ? msgs.map(m => `<div class="insight-item"><div class="insight-icon">${m.icon}</div><p class="insight-text">${m.text}</p></div>`).join('')
    : '<p class="empty">Tu rendimiento es parejo. Seguí registrando para ver patrones.</p>';
}

/* ── Tabla de actividades ── */
function renderActTable() {
  const tbody = document.getElementById('actTableBody');
  if (!tbody) return;

  const byAct = {};
  filtrados.forEach(r => {
    if (!byAct[r.actividad]) byAct[r.actividad] = [];
    byAct[r.actividad].push(score(r));
  });

  if (!Object.keys(byAct).length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty" style="padding:16px 0;">Sin datos en este período.</td></tr>`;
    return;
  }

  tbody.innerHTML = Object.entries(byAct).map(([act, scores]) => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    let tend = '<span class="tend-badge tend-flat">—</span>';
    if (scores.length >= 2) {
      const dif = scores[scores.length - 1] - scores[scores.length - 2];
      if (dif >  2) tend = `<span class="tend-badge tend-up">↑ ${dif.toFixed(0)}%</span>`;
      if (dif < -2) tend = `<span class="tend-badge tend-down">↓ ${Math.abs(dif).toFixed(0)}%</span>`;
    }
    return `<tr>
      <td>${act}</td>
      <td>${scores.length}</td>
      <td><span class="mini-score">${avg.toFixed(0)}%</span></td>
      <td>${tend}</td>
    </tr>`;
  }).join('');
}

/* ── Rutina ideal ── */
function renderRoutine() {
  const el = document.getElementById('rutinaContenedor');
  const note = document.getElementById('routineNote');
  if (!el) return;

  if (filtrados.length < 5) {
    el.innerHTML = '';
    if (note) note.style.display = '';
    return;
  }
  if (note) note.style.display = 'none';

  const pj = { Mañana: {}, Tarde: {}, Noche: {} };
  filtrados.forEach(r => {
    if (!pj[r.jornada][r.actividad]) pj[r.jornada][r.actividad] = { s:0, n:0 };
    pj[r.jornada][r.actividad].s += score(r);
    pj[r.jornada][r.actividad].n++;
  });

  const usadas = [];
  el.innerHTML = ['Mañana', 'Tarde', 'Noche'].map(j => {
    let best = 'Libre', bestP = -1;
    for (const act in pj[j]) {
      if (usadas.includes(act)) continue;
      const p = pj[j][act].s / pj[j][act].n;
      if (p > bestP) { bestP = p; best = act; }
    }
    if (best !== 'Libre') usadas.push(best);
    return `<div class="routine-cell">
      <div class="routine-moment">${j}</div>
      <div class="routine-act">${best}</div>
    </div>`;
  }).join('');
}

/* ── Energía ── */
function renderEnergy() {
  const el = document.getElementById('impactoEnergiaContenedor');
  if (!el) return;

  if (filtrados.length < 2) {
    el.innerHTML = '<p class="empty">Cargá más datos para ver el impacto.</p>'; return;
  }

  const anim = {};
  filtrados.forEach(r => {
    if (!anim[r.actividad]) anim[r.actividad] = { s:0, n:0 };
    anim[r.actividad].s += r.animo;
    anim[r.actividad].n++;
  });

  let best = '', bestP = -1, worst = '', worstP = 999;
  for (const a in anim) {
    const p = anim[a].s / anim[a].n;
    if (p > bestP)  { bestP = p;  best = a; }
    if (p < worstP) { worstP = p; worst = a; }
  }

  if (best === worst) { el.innerHTML = '<p class="empty">Energía pareja entre todas las actividades.</p>'; return; }

  el.innerHTML = `
    <div class="energy-card e-plus">
      <div class="e-label">Te recarga ✓</div>
      <div class="e-name">${best}</div>
    </div>
    <div class="energy-card e-minus">
      <div class="e-label">Te agota ↓</div>
      <div class="e-name">${worst}</div>
    </div>`;
}

/* ── Simulador ── */
function calcularPrediccion() {
  const act = document.getElementById('simActividad').value.trim().toLowerCase();
  const jor = document.getElementById('simJornada').value;
  const el  = document.getElementById('resultadoSimulador');

  if (!act) { el.innerHTML = '<p class="sim-result">Escribí una actividad.</p>'; return; }

  const avg = arr => (arr.reduce((s, r) => s + score(r), 0) / arr.length).toFixed(0);
  const exactas = filtrados.filter(r => r.actividad.toLowerCase() === act && r.jornada === jor);
  const simil   = filtrados.filter(r => r.actividad.toLowerCase() === act);

  if (exactas.length)
    el.innerHTML = `<p class="sim-result"><span class="big-num">${avg(exactas)}%</span>Promedio para este horario.</p>`;
  else if (simil.length)
    el.innerHTML = `<p class="sim-result"><span class="big-num">${avg(simil)}%</span>No tenés datos a la ${jor}. Promedio general.</p>`;
  else
    el.innerHTML = `<p class="sim-result">No tenés registros de esta actividad aún.</p>`;
}

/* ── Gráfico global ── */
function renderGrafico() {
  const canvas = document.getElementById('grafico');
  if (!canvas || !filtrados.length) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600;
  canvas.width  = W * devicePixelRatio;
  canvas.height = 140 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, W, 140);

  const px = 16, py = 20, uw = W - px * 2, uh = 100;
  const n = filtrados.length;
  const pts = filtrados.map((r, i) => ({
    x: px + i * (n > 1 ? uw / (n - 1) : uw),
    y: py + uh - (score(r) / 100) * uh
  }));

  const g = ctx.createLinearGradient(0, py, 0, py + uh);
  g.addColorStop(0, 'rgba(169,184,212,.18)');
  g.addColorStop(1, 'rgba(169,184,212,0)');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, py + uh);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, py + uh);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#A9B8D4';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.stroke();

  pts.forEach((p, i) => {
    const s = score(filtrados[i]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#1B2A3F'; ctx.fill();
    ctx.strokeStyle = '#A9B8D4'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#8BADD4';
    ctx.textAlign = 'center';
    ctx.fillText(s.toFixed(0) + '%', p.x, p.y - 9);
  });
}

/* ── Historial ── */
function renderHistorial() {
  const el = document.getElementById('historialLista');
  if (!el) return;

  const items = filtrados.slice(-6).reverse();
  if (!items.length) { el.innerHTML = '<p class="empty" style="padding:4px 0;">Sin registros.</p>'; return; }

  el.innerHTML = '';
  items.forEach(r => {
    const div = document.createElement('div');
    div.className = 'h-item';
    div.innerHTML = `
      <span class="h-score-pill">${score(r).toFixed(0)}%</span>
      <div class="h-info">
        <div class="h-name">${r.actividad}</div>
        <div class="h-meta">${r.jornada} · ${r.fecha}</div>
      </div>
      <div class="h-actions">
        <button class="h-btn edit" onclick="cargarParaEditar('${r.id}')">Editar</button>
        <button class="h-btn del"  onclick="borrarRegistro('${r.id}')">✕</button>
      </div>`;
    el.appendChild(div);
  });
}

/* ── Chips ── */
function renderChips() {
  const el = document.getElementById('quickTags');
  if (!el) return;

  const cnt = {};
  registros.forEach(r => { cnt[r.actividad] = (cnt[r.actividad] || 0) + 1; });

  el.innerHTML = '';
  Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 4).forEach(nombre => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = nombre;
    btn.onclick = () => { document.getElementById('actividad').value = nombre; };
    el.appendChild(btn);
  });
}

/* ── Racha ── */
function renderRacha() {
  const el = document.getElementById('statRacha');
  if (!el || !registros.length) { if (el) el.textContent = '0'; return; }

  const fmt = d => d.toISOString().split('T')[0];
  const fechas = [...new Set(registros.map(r => r.fecha))].sort().reverse();
  const hoy  = fmt(new Date());
  const ayer = fmt(new Date(Date.now() - 86400000));

  if (fechas[0] !== hoy && fechas[0] !== ayer) { el.textContent = '0'; return; }

  let racha = 1;
  for (let i = 1; i < fechas.length; i++) {
    const esperado = new Date(fechas[i - 1] + 'T12:00:00');
    esperado.setDate(esperado.getDate() - 1);
    if (fechas[i] === fmt(esperado)) racha++;
    else break;
  }
  el.textContent = racha;
}

/* ── Selector de momento ── */
function selMomento(btn) {
  document.querySelectorAll('.moment-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  document.getElementById('jornada').value = btn.dataset.val;
}

function setAutoMomento() {
  const h = new Date().getHours();
  const val = h < 13 ? 'Mañana' : h < 20 ? 'Tarde' : 'Noche';
  document.querySelectorAll('.moment-btn').forEach(b => b.classList.toggle('sel', b.dataset.val === val));
  document.getElementById('jornada').value = val;
}

/* ── Stepper ── */
function cambiarValor(id, delta) {
  const inp = document.getElementById(id);
  const nv = Math.max(1, Math.min(10, +inp.value + delta));
  inp.value = nv;
  document.getElementById('val-' + id).textContent = nv * 10 + '%';
}

/* ── Editar ── */
function cargarParaEditar(id) {
  const r = registros.find(x => String(x.id) === String(id));
  if (!r) return;
  editandoId = id;
  document.getElementById('actividad').value = r.actividad;
  document.getElementById('jornada').value = r.jornada;
  document.querySelectorAll('.moment-btn').forEach(b => b.classList.toggle('sel', b.dataset.val === r.jornada));
  ['energia', 'enfoque', 'animo'].forEach(m => {
    document.getElementById(m).value = r[m];
    document.getElementById('val-' + m).textContent = r[m] * 10 + '%';
  });
  const btn = document.getElementById('btnSave');
  btn.textContent = 'Actualizar';
  btn.classList.add('editing');
  if (window.innerWidth <= 800) mobSwitch('form');
  document.getElementById('actividad').focus();
}

/* ── Toast ── */
function mostrarToast() {
  const t = document.getElementById('toast');
  t.classList.add('toast-show');
  setTimeout(() => t.classList.remove('toast-show'), 2600);
}

/* ── Historial toggle ── */
function toggleHistory() {
  document.getElementById('histAcc').classList.toggle('open');
}

/* ── Mobile nav ── */
function mobSwitch(tab) {
  document.querySelectorAll('.mob-tab').forEach(b => b.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  const form = document.getElementById('panelForm');
  const dash = document.getElementById('panelDash');
  if (tab === 'form') {
    form.classList.add('mob-show'); dash.classList.remove('mob-show');
  } else {
    dash.classList.add('mob-show'); form.classList.remove('mob-show');
    if (tab === 'stats')
      setTimeout(() => {
        const ins = document.getElementById('insights');
        if (ins) ins.scrollIntoView({ behavior: 'smooth' });
      }, 100);
  }
}

function initMobile() {
  const mob = window.innerWidth <= 800;
  document.getElementById('panelForm').classList.toggle('mob-show', false);
  document.getElementById('panelDash').classList.toggle('mob-show', mob);
  if (mob) {
    const tabDash = document.getElementById('tab-dash');
    if (tabDash) tabDash.classList.add('active');
  }
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  setAutoMomento();
  initMobile();
  window.addEventListener('resize', initMobile);
  window.addEventListener('resize', renderGrafico);

  document.getElementById('formRegistro').addEventListener('submit', async e => {
    e.preventDefault();
    const actividad = document.getElementById('actividad').value.trim();
    const jornada   = document.getElementById('jornada').value;
    const energia   = +document.getElementById('energia').value;
    const enfoque   = +document.getElementById('enfoque').value;
    const animo     = +document.getElementById('animo').value;
    const btn       = document.getElementById('btnSave');

    if (editandoId !== null) {
      await actualizar(editandoId, actividad, jornada, energia, enfoque, animo);
      editandoId = null;
      btn.textContent = 'Guardar';
      btn.classList.remove('editing');
    } else {
      await guardar(actividad, jornada, energia, enfoque, animo);
    }

    e.target.reset();
    ['energia', 'enfoque', 'animo'].forEach(m => {
      document.getElementById(m).value = 5;
      document.getElementById('val-' + m).textContent = '50%';
    });
    setAutoMomento();
    mostrarToast();
  });

  cargar();
});