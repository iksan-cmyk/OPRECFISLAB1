/* ════════════════════════════════════════════════════════
   admin.js — Logic untuk Admin Panel
   - Auth via Supabase Auth (signInWithPassword)
   - Fetch pendaftar_aslab
   - Generate signed URL untuk 3 dokumen
   - Update status pendaftar
   - Filter search
   ════════════════════════════════════════════════════════ */

/* ── Supabase config (harus sama dengan script.js) ── */
const SUPABASE_URL = 'https://lxzplllmxyxmxznkezdv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_G_AF3JdIU0Fk7_zGhTf0Fw_Lx4ghd-_';
const BUCKET = 'pendaftar_dokumen';

/* ── Status enum (5 state, sesuai AGENTS.md) ── */
const STATUS_OPTS = [
  { value: 'pending',        label: 'Pending' },
  { value: 'lolos_berkas',   label: 'Lolos Berkas' },
  { value: 'gagal',          label: 'Gagal' },
  { value: 'lolos_final',    label: 'Lolos Final' },
  { value: 'ditolak_final',  label: 'Ditolak Final' },
];

const STATUS_LABELS = {
  pending: 'Pending',
  lolos_berkas: 'Lolos Berkas',
  gagal: 'Gagal',
  lolos_final: 'Lolos Final',
  ditolak_final: 'Ditolak Final',
};

/* ── Init Supabase client ── */
let dbClient = null;
try {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Library supabase-js belum termuat.');
  }
  dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error('Gagal inisialisasi Supabase:', err);
}

/* ── Cache pendaftar ( untuk filter tanpa re-fetch ) ── */
let pendaftarCache = [];

/* ════════ AUTH ════════ */

async function checkSession() {
  if (!dbClient) return null;
  try {
    const { data: { session }, error } = await dbClient.auth.getSession();
    if (error) throw error;
    return session;
  } catch (err) {
    console.error('Cek session gagal:', err);
    return null;
  }
}

async function login(email, password) {
  if (!dbClient) {
    tampilkanLoginError('Koneksi ke server belum siap.');
    return false;
  }
  try {
    const { data, error } = await dbClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return !!data.session;
  } catch (err) {
    tampilkanLoginError(err.message || 'Email atau password salah.');
    return false;
  }
}

async function logout() {
  if (!dbClient) return;
  try {
    await dbClient.auth.signOut();
  } catch (err) {
    console.error('Logout gagal:', err);
  }
  showPage('page-login');
  document.getElementById('form-login').reset();
}

function tampilkanLoginError(msg) {
  const el = document.getElementById('login-error');
  if (el) el.textContent = msg;
}

/* ════════ NAVIGASI ════════ */

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════ DASHBOARD: FETCH PENDAFTAR ════════ */

async function fetchPendaftar() {
  if (!dbClient) return;

  const tbody = document.getElementById('tbody-pendaftar');
  const emptyState = document.getElementById('empty-state');

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--subtext)">Memuat data...</td></tr>';
  emptyState.style.display = 'none';

  try {
    const { data, error } = await dbClient
      .from('pendaftar_aslab')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    pendaftarCache = data || [];
    renderTabel(pendaftarCache);
    renderStats(pendaftarCache);
  } catch (err) {
    console.error('Fetch pendaftar gagal:', err);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--red)">Gagal memuat data: ' + (err.message || 'unknown error') + '</td></tr>';
  }
}

function renderTabel(data) {
  const tbody = document.getElementById('tbody-pendaftar');
  const emptyState = document.getElementById('empty-state');

  if (!data || data.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  tbody.innerHTML = data.map((p, i) => {
    const status = p.status || 'pending';
    const statusClass = 'status-' + status;
    const statusLabel = STATUS_LABELS[status] || 'Pending';

    const options = STATUS_OPTS.map(o =>
      '<option value="' + o.value + '"' + (o.value === status ? ' selected' : '') + '>' + o.label + '</option>'
    ).join('');

    const aksiDokumen = status === 'lolos_berkas'
      ? `<input class="input-jadwal" type="datetime-local" value="${timestamptzToLocalInput(p.jadwal_interview)}" title="Jadwal interview">
         <button class="btn-lihat-dok btn-simpan-jadwal" onclick="updateJadwalInterview('${p.id || p.nrp}')" title="Simpan jadwal">
           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
           Simpan
         </button>`
      : '';

    return `
      <tr data-id="${p.id || p.nrp}">
        <td style="color:var(--gray400)">${i + 1}</td>
        <td class="col-nama">${escapeHtml(p.nama_lengkap || '-')}</td>
        <td class="col-nrp">${escapeHtml(p.nrp || '-')}</td>
        <td class="col-email">${escapeHtml(p.email || '-')}</td>
        <td class="col-wa">${escapeHtml(p.no_wa || '-')}</td>
        <td>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </td>
        <td>
          <div class="col-aksi">
            <button class="btn-lihat-dok btn-detail" onclick="bukaModalDetail('${p.id || p.nrp}')" title="Lihat detail pendaftar">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Detail
            </button>
            ${aksiDokumen}
            <select class="select-status" onchange="updateStatus('${p.id || p.nrp}', this.value)" data-current="${status}">
              ${options}
            </select>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderStats(data) {
  const counts = { total: 0, pending: 0, lolos_berkas: 0, gagal: 0, lolos_final: 0, ditolak_final: 0 };
  data.forEach(p => {
    counts.total++;
    const s = p.status || 'pending';
    if (counts[s] !== undefined) counts[s]++;
  });

  document.getElementById('stat-total').textContent = counts.total;
  document.getElementById('stat-pending').textContent = counts.pending;
  document.getElementById('stat-berkas').textContent = counts.lolos_berkas;
  document.getElementById('stat-final').textContent = counts.lolos_final;
  document.getElementById('stat-gagal').textContent = counts.gagal + counts.ditolak_final;
}

/* ════════ UPDATE STATUS ════════ */

async function updateStatus(id, newStatus) {
  if (!dbClient) return;

  const row = document.querySelector('tr[data-id="' + id + '"]');
  const select = row ? row.querySelector('.select-status') : null;
  const badge = row ? row.querySelector('.status-badge') : null;

  if (select) { select.disabled = true; }

  try {
    const { error } = await dbClient
      .from('pendaftar_aslab')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) throw error;

    if (badge) {
      badge.className = 'status-badge status-' + newStatus;
      badge.textContent = STATUS_LABELS[newStatus] || 'Pending';
    }

    const p = pendaftarCache.find(x => (x.id || x.nrp) == id);
    if (p) {
      p.status = newStatus;
      renderStats(pendaftarCache);
      const searchInput = document.querySelector('.admin-search');
      const q = searchInput ? searchInput.value.trim() : '';
      if (q) filterTabel(q); else renderTabel(pendaftarCache);
    }
  } catch (err) {
    console.error('Update status gagal:', err);
    alert('Gagal mengubah status: ' + (err.message || 'unknown error'));
    if (select && select.dataset.current) select.value = select.dataset.current;
  } finally {
    if (select) { select.disabled = false; }
  }
}

/* ════════ UPDATE JADWAL INTERVIEW ════════ */

async function updateJadwalInterview(id) {
  if (!dbClient) return;

  const row = document.querySelector('tr[data-id="' + id + '"]');
  const input = row ? row.querySelector('.input-jadwal') : null;
  const btn = row ? row.querySelector('.btn-simpan-jadwal') : null;

  if (!input) return;

  const val = input.value;
  const iso = val ? localInputToISO(val) : null;

  if (input) { input.disabled = true; }
  if (btn) { btn.disabled = true; }

  try {
    const { error } = await dbClient
      .from('pendaftar_aslab')
      .update({ jadwal_interview: iso })
      .eq('id', id);

    if (error) throw error;

    const p = pendaftarCache.find(x => (x.id || x.nrp) == id);
    if (p) p.jadwal_interview = iso;
  } catch (err) {
    console.error('Update jadwal interview gagal:', err);
    alert('Gagal menyimpan jadwal: ' + (err.message || 'unknown error'));
    const p = pendaftarCache.find(x => (x.id || x.nrp) == id);
    if (input && p) input.value = timestamptzToLocalInput(p.jadwal_interview);
  } finally {
    if (input) { input.disabled = false; }
    if (btn) { btn.disabled = false; }
  }
}

/* ════════ HELPER KONVERSI TANGGAL ════════ */

function timestamptzToLocalInput(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  } catch (_) {
    return '';
  }
}

function localInputToISO(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/* ════════ MODAL DETAIL PENDAFTAR ════════ */

function tutupModalDetail() {
  document.getElementById('modal-detail').classList.remove('active');
}

function formatTanggal(ts) {
  if (!ts) return '-';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return escapeHtml(String(ts));
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  } catch (_) {
    return escapeHtml(String(ts));
  }
}

function val(v) {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
  return escapeHtml(String(v));
}

async function bukaModalDetail(id) {
  const p = pendaftarCache.find(x => (x.id || x.nrp) == id);
  if (!p) return;

  const modal = document.getElementById('modal-detail');
  const title = document.getElementById('detail-title');
  const body = document.getElementById('detail-body');

  title.textContent = 'Detail — ' + (p.nama_lengkap || p.nrp || 'Pendaftar');
  body.innerHTML = '<p class="modal-loading">Memuat data...</p>';
  modal.classList.add('active');

  const ipkVal = (p.ipk !== null && p.ipk !== undefined && p.ipk !== '')
    ? escapeHtml(String(p.ipk))
    : '-';

  const skalaVal = (p.skala_prioritas !== null && p.skala_prioritas !== undefined && !isNaN(p.skala_prioritas))
    ? escapeHtml(String(p.skala_prioritas)) + ' / 10'
    : '-';

  const bisaVal = (p.bisa_tinkercad_proteus === null || p.bisa_tinkercad_proteus === undefined)
    ? '-'
    : (p.bisa_tinkercad_proteus ? 'Ya' : 'Tidak');

  const html = [
    '<div class="detail-section">',
      '<h4 class="detail-section-title">Data Diri</h4>',
      detailRow('Nama Lengkap', val(p.nama_lengkap)),
      detailRow('NRP', val(p.nrp)),
      detailRow('Email', val(p.email)),
      detailRow('No. WhatsApp', val(p.no_wa)),
      detailRow('IPK', ipkVal),
      detailRow('Waktu Daftar', formatTanggal(p.created_at)),
    '</div>',

    '<div class="detail-section">',
      '<h4 class="detail-section-title">Motivasi & Kesediaan</h4>',
      detailEssay('Motivasi', val(p.motivasi)),
      detailRow('Skala Prioritas', skalaVal),
      detailRow('Bisa Tinkercad/Proteus', bisaVal),
      detailRow('Kesediaan Hadir', val(p.kesediaan_hadir)),
    '</div>',

    '<div class="detail-section">',
      '<h4 class="detail-section-title">Pilihan Judul & Penjelasan</h4>',
      detailRow('Judul A1 (Sebelum ETS)', val(p.judul_a1)),
      detailRow('Judul A2 (Sebelum ETS)', val(p.judul_a2)),
      detailEssay('Penjelasan Sebelum ETS', val(p.penjelasan_sebelum_ets)),
      detailRow('Judul B1 (Sesudah ETS)', val(p.judul_b1)),
      detailRow('Judul B2 (Sesudah ETS)', val(p.judul_b2)),
      detailEssay('Penjelasan Sesudah ETS', val(p.penjelasan_sesudah_ets)),
    '</div>',

    '<div class="detail-section">',
      '<h4 class="detail-section-title">Dokumen</h4>',
      '<div id="detail-dokumen" class="detail-dokumen-wrap"><p class="modal-loading">Memuat dokumen...</p></div>',
    '</div>',
  ].join('');

  body.innerHTML = html;

  const dokumen = [
    { label: 'Curriculum Vitae',  path: p.file_cv_path,           folder: 'cv' },
    { label: 'Transkrip Nilai',   path: p.file_transkrip_path,    folder: 'transkrip' },
    { label: 'Bukti Follow IG',   path: p.file_bukti_follow_path, folder: 'bukti_follow' },
  ];

  const dokWrap = document.getElementById('detail-dokumen');
  if (!dokWrap) return;
  dokWrap.innerHTML = dokumen.map(d => '<div id="dok-slot-' + d.folder + '"></div>').join('');

  for (const dok of dokumen) {
    const slot = document.getElementById('dok-slot-' + dok.folder);
    if (!slot) continue;

    if (!dok.path) {
      slot.outerHTML = renderDokItemFull(dok.label, null, null);
      continue;
    }

    const filename = dok.path.split('/').pop();
    try {
      const { data, error } = await dbClient.storage
        .from(BUCKET)
        .createSignedUrl(dok.path, 300);

      if (error) throw error;
      slot.outerHTML = renderDokItemFull(dok.label, data.signedUrl, filename);
    } catch (err) {
      console.error('Signed URL gagal untuk ' + dok.folder + ':', err);
      slot.outerHTML = renderDokItemFull(dok.label, null, filename);
    }
  }
}

function detailRow(label, value) {
  return '<div class="detail-row"><span class="detail-label">' + escapeHtml(label) + '</span><span class="detail-value">' + value + '</span></div>';
}

function detailEssay(label, value) {
  return '<div class="detail-row detail-row-essay"><span class="detail-label">' + escapeHtml(label) + '</span><span class="detail-value detail-essay">' + value + '</span></div>';
}

function renderDokItemFull(label, url, filename) {
  const actions = url
    ? '<div class="dok-actions">' +
        '<a class="btn-dok btn-dok-lihat" href="' + url + '" target="_blank" rel="noopener"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Lihat</a>' +
        '<a class="btn-dok btn-dok-download" href="' + url + '" download="' + escapeHtml(filename) + '"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download</a>' +
      '</div>'
    : '<span class="dok-empty">Gagal generate link</span>';

  const sub = (url && filename)
    ? '<span class="dok-filename">' + escapeHtml(filename) + '</span>'
    : (!url ? '<span class="dok-empty">Tidak ada file</span>' : '');

  return '<div class="dok-item"><div class="dok-info"><span class="dok-label">' + escapeHtml(label) + '</span>' + sub + '</div>' + actions + '</div>';
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'modal-detail') tutupModalDetail();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    tutupModalDetail();
  }
});

/* ════════ FILTER ════════ */

function filterTabel(query) {
  const q = (query || '').toLowerCase();
  if (!q) { renderTabel(pendaftarCache); return; }

  const filtered = pendaftarCache.filter(p =>
    (p.nama_lengkap || '').toLowerCase().includes(q) ||
    (p.nrp || '').toLowerCase().includes(q) ||
    (p.email || '').toLowerCase().includes(q)
  );
  renderTabel(filtered);
}

/* ════════ UTIL ════════ */

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ════════ INIT ════════ */

document.addEventListener('DOMContentLoaded', async () => {
  if (!dbClient) {
    tampilkanLoginError('Koneksi ke server gagal. Refresh halaman.');
    return;
  }

  const form = document.getElementById('form-login');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn = form.querySelector('.btn-login');

      tampilkanLoginError('');
      if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

      const ok = await login(email, password);

      if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }

      if (ok) {
        showPage('page-dashboard');
        fetchPendaftar();
      }
    });
  }

  const session = await checkSession();
  if (session) {
    showPage('page-dashboard');
    fetchPendaftar();
  } else {
    showPage('page-login');
  }
});
