/* ════════════════════════════════════════════════════════
   pengumuman.js — Halaman cek status seleksi via NRP
   - Fetch pendaftar_aslab by nrp (RLS anon SELECT 4 kolom)
   - Tampilkan 1 dari 5 status + jadwal interview (kalau lolos_berkas)
   ════════════════════════════════════════════════════════ */

/* ── Supabase config (harus sama dengan script.js & admin.js) ── */
const SUPABASE_URL = 'https://lxzplllmxyxmxznkezdv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_G_AF3JdIU0Fk7_zGhTf0Fw_Lx4ghd-_';

/* ── Init Supabase client ── */
let dbClient = null;
try {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Library supabase-js belum termuat (cek tag <script> CDN di pengumuman.html).');
  }
  dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error('Gagal inisialisasi Supabase:', err);
  dbClient = null;
}

/* ── Cek status pengumuman via NRP ── */

const STATUS_PESAN = {
  pending:        'Masih dalam proses seleksi, sabar ya 😌',
  lolos_berkas:   'Lolos seleksi berkas! Cek jadwal interview kamu di bawah 🔥',
  gagal:          'Belum lolos di tahap ini, semangat next time bre 🙏',
  lolos_final:    'Selamat, kamu resmi jadi Aslab Fislab 1! 🔥🔥',
  ditolak_final:  'Belum lolos di tahap final, makasih udah ikutan bre 🙏',
};

const STATUS_BADGE_CLASS = {
  pending:        'is-pending',
  lolos_berkas:   'is-lolos-berkas',
  gagal:          'is-gagal',
  lolos_final:    'is-lolos-final',
  ditolak_final:  'is-ditolak-final',
};

const STATUS_LABEL_PUBLIK = {
  pending:        'Pending',
  lolos_berkas:   'Lolos Berkas',
  gagal:          'Gagal',
  lolos_final:    'Lolos Final',
  ditolak_final:  'Ditolak Final',
};

const CATATAN_INTERVIEW = `
  <div class="status-catatan">
    <h3>Note:</h3>
    <ul>
      <li>Hadir <strong>15 menit sebelum</strong> jadwal wawancara dimulai.</li>
      <li>Berpakaian standart kuliah</li>
      <li>Pertanyaan dapat menghubungi panitia <a href="https://wa.me/628988682847">Yoga</a> atau <a href="https://wa.me/6281362192288">Salwa</a>.</li>
    </ul>
  </div>
`;

function handleCekStatus(event, resultId) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.querySelector('.cek-status-input');
  const nrp = (input ? input.value : '').trim();
  checkStatus(nrp, resultId);
}

async function checkStatus(nrp, resultId) {
  const result = document.getElementById(resultId);
  if (!result) return;

  if (!dbClient) {
    result.innerHTML = '<div class="status-card"><p class="status-msg">Koneksi ke server belum siap. Refresh halaman ya.</p></div>';
    return;
  }

  const nrpTrim = (nrp || '').trim();
  if (!nrpTrim) {
    result.innerHTML = '<div class="status-card"><p class="status-msg">NRP-nya diisi dulu ya 😅</p></div>';
    return;
  }

  const form = result.parentElement.querySelector('.cek-status-form');
  const btn = form ? form.querySelector('.btn-cek-status') : null;
  const input = form ? form.querySelector('.cek-status-input') : null;
  const oldHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.style.opacity = '.7'; btn.innerHTML = 'Cek…'; }
  if (input) { input.disabled = true; }

  result.innerHTML = '<div class="status-card"><p class="status-msg status-loading">Lagi cek status…</p></div>';

  try {
    const { data, error } = await dbClient
      .from('pendaftar_aslab')
      .select('nama_lengkap, nrp, status, jadwal_interview')
      .eq('nrp', nrpTrim)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      result.innerHTML = '<div class="status-card"><p class="status-msg">NRP nggak ketemu. Pastikan NRP yang kamu masukkan sudah bener.</p></div>';
      return;
    }

    renderStatusResult(data, resultId);
  } catch (err) {
    console.error('Cek status gagal:', err);
    let msg = 'Gagal ngecek status. Coba lagi sebentar ya.';
    if (err && err.message) msg += ' (' + err.message + ')';
    result.innerHTML = '<div class="status-card"><p class="status-msg">' + escapeHtml(msg) + '</p></div>';
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = oldHtml; }
    if (input) { input.disabled = false; }
  }
}

function renderStatusResult(data, resultId) {
  const result = document.getElementById(resultId);
  if (!result) return;

  const status = data.status || 'pending';
  const pesan = STATUS_PESAN[status] || STATUS_PESAN.pending;
  const badgeClass = STATUS_BADGE_CLASS[status] || STATUS_BADGE_CLASS.pending;
  const badgeLabel = STATUS_LABEL_PUBLIK[status] || 'Pending';
  const nama = data.nama_lengkap ? escapeHtml(data.nama_lengkap) : '';

  let jadwalHtml = '';
  let catatanHtml = '';
  if (status === 'lolos_berkas') {
    if (data.jadwal_interview) {
      jadwalHtml = '<div class="status-jadwal">' +
        '<span class="status-jadwal-label">📅 Jadwal Interview</span>' +
        '<strong>' + escapeHtml(formatJadwalInterview(data.jadwal_interview)) + '</strong>' +
      '</div>';
    } else {
      jadwalHtml = '<div class="status-jadwal">' +
        '<span class="status-jadwal-label">📅 Jadwal Interview</span>' +
        '<strong>Jadwal interview menyusul, pantau terus ya</strong>' +
      '</div>';
    }
    catatanHtml = CATATAN_INTERVIEW;
  }

  result.innerHTML =
    '<div class="status-card">' +
      (nama ? '<p class="status-nama">Hai, <strong>' + nama + '</strong></p>' : '') +
      '<span class="status-badge-publik ' + badgeClass + '">' + badgeLabel + '</span>' +
      '<p class="status-msg">' + escapeHtml(pesan) + '</p>' +
      jadwalHtml +
    '</div>' +
    catatanHtml;
}

function formatJadwalInterview(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
  } catch (_) {
    return String(ts);
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
