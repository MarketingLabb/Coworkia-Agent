const API_BASE = window.location.origin;
const DASHBOARD_API = `${API_BASE}/api/adriana/dashboard`;
let allLeads   = [];
let activeTab  = 'all';
let currentFilters = { insuranceType: '', search: '' };

// ── STATUS MAP ─────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  pending:            ['badge-pending',  '⏳ Pendiente'],
  quoted:             ['badge-quoted',   '📧 Cotizado'],
  accepted:           ['badge-accepted', '✅ Aceptado'],
  rejected:           ['badge-rejected', '❌ Rechazado'],
  cancelled:          ['badge-cancelled','🚫 Cancelado'],
  waiting_matricula:  ['badge-waiting',  '🚗 Matrícula'],
  waiting_cedula:     ['badge-waiting',  '🪪 Cédula'],
  waiting_competitor: ['badge-waiting',  '🔍 Comparando'],
  waiting_kyc:        ['badge-waiting',  '📋 KYC'],
};

// ── TAB FILTER MAP ────────────────────────────────────────────────────────────
const TAB_STATUSES = {
  all:      null,
  new:      ['pending', 'waiting_matricula', 'waiting_cedula'],
  process:  ['waiting_competitor', 'waiting_kyc'],
  quoted:   ['quoted'],
  accepted: ['accepted'],
  lost:     ['rejected', 'cancelled'],
};

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'error') {
  const t = document.createElement('div');
  const bg = type === 'success' ? '#10b981' : type === 'info' ? '#6366f1' : '#ef4444';
  t.style.cssText = `position:fixed;top:20px;right:20px;background:${bg};color:#fff;padding:12px 20px;border-radius:10px;z-index:9999;font-size:13px;max-width:360px;box-shadow:0 4px 20px rgba(0,0,0,.5);line-height:1.5;`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function formatDate(ds) {
  if (!ds) return '—';
  try {
    const d = new Date(ds); if (isNaN(d)) return '—';
    const diff = Math.floor((Date.now() - d) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff < 7)  return `Hace ${diff}d`;
    return d.toLocaleDateString('es-EC', { day:'2-digit', month:'short' });
  } catch { return '—'; }
}

function formatMoney(val) {
  if (val === null || val === undefined || val === '') return '—';
  const n = parseFloat(val); if (isNaN(n)) return '—';
  return `$${n.toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusBadge(status) {
  const [cls, label] = STATUS_MAP[status] || ['badge-pending', status || '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── PIPELINE TAB COUNTS ───────────────────────────────────────────────────────
function updateTabCounts() {
  const c = { all: allLeads.length, new: 0, process: 0, quoted: 0, accepted: 0, lost: 0 };
  for (const l of allLeads) {
    if (['pending','waiting_matricula','waiting_cedula'].includes(l.status))       c.new++;
    else if (['waiting_competitor','waiting_kyc'].includes(l.status))              c.process++;
    else if (l.status === 'quoted')                                                 c.quoted++;
    else if (l.status === 'accepted')                                               c.accepted++;
    else if (['rejected','cancelled'].includes(l.status))                          c.lost++;
  }
  for (const [tab, count] of Object.entries(c)) {
    const el = document.getElementById(`tab-count-${tab}`);
    if (el) el.textContent = count;
  }
}

// ── AUTOMATION PANEL ─────────────────────────────────────────────────────────
function renderAutoPanel() {
  const now = Date.now();
  const quotedLeads = allLeads.filter(l => l.status === 'quoted' && l.quote_sent_at);
  const s1 = quotedLeads.filter(l => { const h=(now-new Date(l.quote_sent_at).getTime())/3600000; return h>=20&&h<=28; });
  const s2 = quotedLeads.filter(l => { const h=(now-new Date(l.quote_sent_at).getTime())/3600000; return h>=68&&h<=76; });
  const s3 = quotedLeads.filter(l => { const h=(now-new Date(l.quote_sent_at).getTime())/3600000; return h>=164&&h<=172; });

  [['s1',s1],['s2',s2],['s3',s3]].forEach(([key,arr]) => {
    const el = document.getElementById(`auto-count-${key}`);
    if (!el) return;
    el.textContent = arr.length;
    el.classList.toggle('has-leads', arr.length > 0);
  });

  // Urgency: pending leads without followup > 48h
  const urgentLeads = allLeads.filter(l => {
    if (!['pending','waiting_matricula','waiting_cedula'].includes(l.status)) return false;
    return (now - new Date(l.created_at).getTime()) / 3600000 > 48;
  });
  const urgencyBar  = document.getElementById('urgency-bar');
  const urgencyCount= document.getElementById('urgency-count');
  if (urgencyBar) urgencyBar.style.display = urgentLeads.length > 0 ? 'flex' : 'none';
  if (urgencyCount) urgencyCount.textContent = urgentLeads.length;
}

// ── SET TAB ───────────────────────────────────────────────────────────────────
function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderLeads();
}

// ── FILTER LEADS ──────────────────────────────────────────────────────────────
function getFilteredLeads() {
  let leads = allLeads;
  const statuses = TAB_STATUSES[activeTab];
  if (statuses) leads = leads.filter(l => statuses.includes(l.status));
  if (currentFilters.insuranceType) {
    const q = currentFilters.insuranceType.toLowerCase();
    leads = leads.filter(l => (l.insurance_type || '').toLowerCase().includes(q));
  }
  if (currentFilters.search) {
    const q = currentFilters.search.toLowerCase();
    leads = leads.filter(l =>
      (l.client_name || '').toLowerCase().includes(q) ||
      (l.quote_code  || '').toLowerCase().includes(q) ||
      (l.vehicle_brand || '').toLowerCase().includes(q) ||
      (l.vehicle_model || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q)
    );
  }
  return leads;
}

// ── RENDER LEADS ──────────────────────────────────────────────────────────────
function renderLeads() {
  const container = document.getElementById('leads-container');
  const leads = getFilteredLeads();
  document.getElementById('table-count').textContent = `${leads.length} registro${leads.length !== 1 ? 's' : ''}`;

  if (leads.length === 0) {
    const isAll = activeTab === 'all';
    container.innerHTML = `<div class="empty">Sin cotizaciones en este segmento.<br><small style="opacity:.6">${isAll ? 'Las cotizaciones aparecerán aquí cuando Adriana procese solicitudes por WhatsApp' : 'No hay leads en esta etapa del pipeline'}</small></div>`;
    return;
  }

  container.innerHTML = `
    <table>
      <thead><tr>
        <th title="Código único de cotización ADR-">Código</th>
        <th title="Datos del cliente asegurado">Cliente</th>
        <th title="Marca, modelo y año del vehículo">Vehículo</th>
        <th title="Tipo de póliza de seguro">Tipo</th>
        <th title="Prima anual estimada en USD">Prima anual</th>
        <th title="Estado actual en el pipeline de ventas">Estado</th>
        <th title="Fecha de ingreso al sistema">Fecha</th>
        <th title="Acciones disponibles: comparación, WA, cambio de estado">Acciones</th>
      </tr></thead>
      <tbody>
        ${leads.map(l => {
          const vehicle  = [l.vehicle_brand, l.vehicle_model].filter(Boolean).join(' ') || '—';
          const isPending = ['pending','waiting_matricula','waiting_cedula'].includes(l.status);
          const isUrgent  = isPending && (Date.now()-new Date(l.created_at).getTime())/3600000 > 48;
          return `
          <tr>
            <td><span class="code">${l.quote_code || '—'}</span></td>
            <td>
              <div class="client-name">${isUrgent?'<span class="urgency-dot" title="⚡ Sin seguimiento más de 48h"></span>':''}${l.client_name || '—'}</div>
              ${l.email ? `<div class="client-sub">✉️ ${l.email}</div>` : ''}
              ${l.phone ? `<div class="client-sub">📱 ${l.phone}</div>` : ''}
              ${l.kyc_cedula ? `<div class="client-sub">🪪 ${l.kyc_cedula}</div>` : ''}
            </td>
            <td>
              <div class="vehicle-main">${vehicle}</div>
              ${l.vehicle_year ? `<div class="vehicle-year">Año ${l.vehicle_year}</div>` : ''}
              ${l.kyc_matricula ? `<div class="vehicle-year">🚗 ${l.kyc_matricula}</div>` : ''}
            </td>
            <td>${l.insurance_type || '—'}</td>
            <td>
              <span class="amount">${formatMoney(l.quoted_premium)}</span>
              ${l.competitor_insurer || l.competitor_quote_amount ? `<div class="client-sub" title="Cotización competidor">🏢 ${l.competitor_insurer || '?'} ${l.competitor_quote_amount ? formatMoney(l.competitor_quote_amount) : ''}</div>` : ''}
            </td>
            <td>${statusBadge(l.status)}</td>
            <td><span class="date-cell">${formatDate(l.created_at)}</span></td>
            <td>
              <div class="actions-cell">
                <select class="status-select" onchange="updateStatus('${l.quote_code}', this.value)" title="Cambiar estado del lead">
                  <option value="pending"   ${l.status==='pending'   ?'selected':''}>⏳ Pendiente</option>
                  <option value="quoted"    ${l.status==='quoted'    ?'selected':''}>📧 Cotizado</option>
                  <option value="accepted"  ${l.status==='accepted'  ?'selected':''}>✅ Aceptado</option>
                  <option value="rejected"  ${l.status==='rejected'  ?'selected':''}>❌ Rechazado</option>
                  <option value="cancelled" ${l.status==='cancelled' ?'selected':''}>🚫 Cancelado</option>
                </select>
                <button class="btn-sm btn-quotes" data-action="quotes" data-lead-id="${l.id}" data-code="${l.quote_code}" title="Ver multi-cotización de aseguradoras">📊</button>
                ${l.email ? `<button class="btn-sm btn-email" data-code="${l.quote_code}" data-action="email" title="Enviar comparación de seguros por correo electrónico">📧 Comparación</button>` : ''}
                ${l.phone ? `<button class="btn-sm btn-wa" data-code="${l.quote_code}" data-action="wa" title="Enviar recordatorio de cotización por WhatsApp">📲 WA</button>` : ''}
              </div>
            </td>
          </tr>
          <tr class="quotes-row" id="quotes-row-${l.id}">
            <td colspan="8">
              <div class="quotes-panel" id="quotes-panel-${l.id}">
                <div class="loading" style="padding:12px;">⏳ Cargando cotizaciones...</div>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
async function updateStatus(code, newStatus) {
  try {
    const res = await fetch(`${DASHBOARD_API}/leads/${code}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    const result = await res.json();
    if (!result.ok) { showToast(`Error: ${result.error || 'No se pudo actualizar'}`); return; }
    const lead = allLeads.find(l => l.quote_code === code);
    if (lead) lead.status = newStatus;
    updateTabCounts();
    renderLeads();
  } catch (err) { console.error('[ADRIANA-DASH] updateStatus error:', err); }
}

// ── SEND WA ────────────────────────────────────────────────────────────────────
async function sendWA(code, btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = '⏳';
  try {
    const res = await fetch(`${DASHBOARD_API}/leads/${code}/send-wa`, { method: 'POST' });
    const d = await res.json();
    if (d.ok) {
      btn.textContent = '✅'; showToast('WhatsApp enviado ✓', 'success');
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3000);
    } else {
      const msg = d.error === 'TEST_LEAD'       ? '📵 Lead de prueba — sin teléfono de cliente real'
                : d.error === 'NO_CLIENT_PHONE'  ? '📱 Sin teléfono del cliente'
                : `❌ ${d.error}`;
      showToast(msg); btn.textContent = orig; btn.disabled = false;
    }
  } catch (err) { showToast(`❌ ${err.message}`); btn.textContent = orig; btn.disabled = false; }
}

// ── SEND COMPARISON EMAIL ─────────────────────────────────────────────────────
async function sendComparison(code, btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = '⏳ Enviando...';
  try {
    const res = await fetch(`${DASHBOARD_API}/leads/${code}/send-comparison`, { method: 'POST' });
    const d = await res.json();
    if (d.ok) {
      btn.textContent = '✅ Enviado';
      showToast(`📧 Comparación enviada a ${d.email || 'cliente'}`, 'success');
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 4000);
      const lead = allLeads.find(l => l.quote_code === code);
      if (lead && lead.status === 'pending') { lead.status = 'quoted'; updateTabCounts(); renderLeads(); }
    } else {
      showToast(`❌ ${d.error || 'No se pudo enviar comparación'}`);
      btn.textContent = orig; btn.disabled = false;
    }
  } catch (err) { showToast(`❌ ${err.message}`); btn.textContent = orig; btn.disabled = false; }
}

// ── STATS ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res    = await fetch(`${DASHBOARD_API}/leads-stats`);
    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error('No se pudieron cargar las métricas de Adriana');
    const d = result.data;
    document.getElementById('stat-total').textContent = d.total || 0;
    document.getElementById('stat-month').textContent = d.thisMonth || 0;
    const acceptedCount = parseInt((d.byStatus || []).find(s => s.status === 'accepted')?.count || 0);
    document.getElementById('stat-accepted').textContent = acceptedCount;
    const rate = parseInt(d.total) > 0 ? Math.round((acceptedCount / parseInt(d.total)) * 100) : 0;
    document.getElementById('stat-conversion').textContent = `${rate}% conversión`;
    document.getElementById('stat-total-premium').textContent = formatMoney(d.totalPremium || 0);
  } catch (err) {
    console.error('[ADRIANA-DASH] stats error:', err);
    document.getElementById('stat-total').textContent = 'Error';
    showToast(err.message);
  }
}

// ── LEADS ─────────────────────────────────────────────────────────────────────
async function loadLeads() {
  const container = document.getElementById('leads-container');
  container.innerHTML = '<div class="loading">⏳ Cargando leads de Adriana...</div>';
  try {
    const res    = await fetch(`${DASHBOARD_API}/leads?limit=500`);
    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error('No se pudieron cargar los leads de Adriana');
    allLeads = result.data || [];
    updateTabCounts();
    renderLeads();
    renderAutoPanel();
  } catch (err) {
    console.error('[ADRIANA-DASH] leads error:', err);
    container.innerHTML = `<div class="error">❌ Error: ${err.message}</div>`;
  }
}

// ── REFRESH ALL ───────────────────────────────────────────────────────────────
async function refreshAll() {
  const fab = document.getElementById('fab-refresh');
  fab?.classList.add('spinning');
  await Promise.all([loadStats(), loadLeads()]);
  fab?.classList.remove('spinning');
}

// ── SEED DEMO ─────────────────────────────────────────────────────────────────
async function seedDemo() {
  const btn = document.getElementById('btn-seed-demo');
  if (!btn) return;
  const orig = btn.textContent; btn.textContent = '⏳ Cargando...'; btn.disabled = true;
  try {
    const r = await fetch(`${DASHBOARD_API}/seed-demo`);
    const d = await r.json();
    if (d.ok) {
      btn.textContent = `✅ ${d.inserted} listos`;
      showToast(`${d.inserted} cotizaciones demo insertadas`, 'success');
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 3000);
      loadStats(); loadLeads();
    } else {
      btn.textContent = '❌ Error'; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
    }
  } catch { btn.textContent = '❌ Error'; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000); }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadLeads();

  document.getElementById('filter-type').addEventListener('change', e => {
    currentFilters.insuranceType = e.target.value; renderLeads();
  });
  let st;
  document.getElementById('search').addEventListener('input', e => {
    clearTimeout(st);
    st = setTimeout(() => { currentFilters.search = e.target.value; renderLeads(); }, 300);
  });

  document.getElementById('leads-container').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { code, action, leadId } = btn.dataset;
    if (action === 'wa')     sendWA(code, btn);
    if (action === 'email')  sendComparison(code, btn);
    if (action === 'quotes') toggleQuotes(leadId, btn);
  });

  // Auto-refresh every 5 minutes
  setInterval(() => refreshAll(), 5 * 60 * 1000);
});

// ── MULTI-QUOTE PANEL ─────────────────────────────────────────────────────────
const quotesCache = {};

async function toggleQuotes(leadId, btn) {
  const row = document.getElementById(`quotes-row-${leadId}`);
  if (!row) return;
  const isOpen = row.classList.contains('open');
  // Close all
  document.querySelectorAll('.quotes-row.open').forEach(r => r.classList.remove('open'));
  document.querySelectorAll('.btn-quotes.active').forEach(b => b.classList.remove('active'));
  if (isOpen) return; // Was open → just close

  row.classList.add('open');
  btn.classList.add('active');

  if (quotesCache[leadId]) {
    renderQuotesPanel(leadId, quotesCache[leadId]);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/adriana/leads/${leadId}/quotes`);
    const d = await res.json();
    if (!d.ok) throw new Error(d.error);
    quotesCache[leadId] = d.data;
    renderQuotesPanel(leadId, d.data);
  } catch (err) {
    document.getElementById(`quotes-panel-${leadId}`).innerHTML =
      `<div class="no-quotes">❌ Error: ${err.message}</div>`;
  }
}

function renderQuotesPanel(leadId, quotes) {
  const panel = document.getElementById(`quotes-panel-${leadId}`);
  if (!quotes.length) {
    panel.innerHTML = `<div class="no-quotes">Sin cotizaciones multi-aseguradora para este lead.<br><small>Las cotizaciones se generan cuando el cliente completa el flujo por WhatsApp.</small></div>`;
    return;
  }

  // Agrupar quotes por fecha (historial)
  const grouped = {};
  quotes.forEach(q => {
    const date = q.created_at ? new Date(q.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(q);
  });
  const dates = Object.keys(grouped);

  const buildTable = (qs) => {
    const rows = qs.map(q => {
      const coverages = (() => { try { const c = typeof q.coverages === 'string' ? JSON.parse(q.coverages) : q.coverages; return Array.isArray(c) ? c.slice(0, 3).join(', ') + (c.length > 3 ? ` (+${c.length - 3})` : '') : '—'; } catch { return '—'; } })();
      return `<tr class="${q.is_recommended ? 'recommended' : ''}">
        <td class="provider-name">${q.is_recommended ? '⭐ ' : ''}${q.provider_name}${q.is_recommended ? '<span class="rec-badge">Recomendada</span>' : ''}</td>
        <td>${q.plan_name || '—'}</td>
        <td class="premium">${formatMoney(q.annual_premium)}</td>
        <td>${formatMoney(q.monthly_premium)}/mes</td>
        <td>${q.deductible_pct}%</td>
        <td class="coverages-list">${coverages}</td>
      </tr>`;
    }).join('');
    return `<table class="quotes-table">
      <thead><tr>
        <th>Aseguradora</th><th>Plan</th><th>Prima Anual</th><th>Mensual</th><th>Deducible</th><th>Coberturas</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  };

  let html = `<div class="quotes-header">
    <h4>📊 Comparativa de ${quotes.length} cotizaciones${dates.length > 1 ? ` · ${dates.length} fechas` : ''}</h4>
    <button class="btn-export" onclick="exportQuotesHTML('${leadId}')" title="Descargar comparativa como HTML">📥 Exportar</button>
  </div>`;

  if (dates.length === 1) {
    html += buildTable(quotes);
  } else {
    dates.forEach((date, i) => {
      html += `<div class="quotes-history-label">📅 ${date} <span>${grouped[date].length} cotiz.</span></div>`;
      html += buildTable(grouped[date]);
    });
  }

  panel.innerHTML = html;
}

// ── C4: Export quotes as downloadable HTML ────────────────────────────────────
async function exportQuotesHTML(leadId) {
  try {
    window.open(`${API_BASE}/api/adriana/leads/${leadId}/quotes/export`, '_blank');
  } catch (err) {
    showToast('Error al exportar: ' + err.message);
  }
}
