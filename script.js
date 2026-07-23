/* ── Supabase config (satu tempat saja) ── */
const SUPABASE_URL = 'https://lxzplllmxyxmxznkezdv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_G_AF3JdIU0Fk7_zGhTf0Fw_Lx4ghd-_';
const BUCKET = 'pendaftar_dokumen';

let dbClient = null;
try {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('Library supabase-js belum termuat (cek tag <script> CDN di index.html).');
  }
  dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error('Gagal inisialisasi Supabase:', err);
  dbClient = null;
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToForm() { showPage('page-form'); setStep(1); }

let currentStep = 1;

function setStep(n) {
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  for (let i = 1; i <= 2; i++) {
    const pill = document.getElementById('pill-' + i);
    if (!pill) continue;
    pill.classList.remove('active', 'done');
    if (i < n)        pill.classList.add('done');
    else if (i === n) pill.classList.add('active');
  }
  currentStep = n;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep(n) {
  if (n > currentStep && !validateStep(currentStep)) return;
  setStep(n);
}

function validateStep(step) {
  const stepEl = document.getElementById('step-' + step);

  const fields = stepEl.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="file"]), select, textarea');
  let valid = true;

  fields.forEach(field => {
    const fieldWrapper = field.closest('.field');
    if (!fieldWrapper) return;
    const hasReq = fieldWrapper.querySelector('.req');
    if (!hasReq) return;

    if (!field.value.trim()) {
      field.style.borderColor = '#e53e3e';
      field.style.boxShadow = '0 0 0 3px rgba(229,62,62,.15)';
      valid = false;

      field.addEventListener('input', () => {
        field.style.borderColor = '';
        field.style.boxShadow = '';
      }, { once: true });
      field.addEventListener('change', () => {
        field.style.borderColor = '';
        field.style.boxShadow = '';
      }, { once: true });
    }
  });

  const radioGroups = {};
  stepEl.querySelectorAll('input[type="radio"]').forEach(r => {
    if (!radioGroups[r.name]) radioGroups[r.name] = [];
    radioGroups[r.name].push(r);
  });
  Object.entries(radioGroups).forEach(([name, radios]) => {
    const checked = radios.some(r => r.checked);
    if (!checked) {
      valid = false;
      radios.forEach(r => {
        const item = r.closest('.choice-item-solid');
        if (item) {
          item.style.borderColor = '#e53e3e';
          r.addEventListener('change', () => {
            radios.forEach(ri => {
              const it = ri.closest('.choice-item-solid');
              if (it) it.style.borderColor = '';
            });
          }, { once: true });
        }
      });
    }
  });

  stepEl.querySelectorAll('input[type="file"]').forEach(f => {
    const fieldWrapper = f.closest('.field');
    if (!fieldWrapper) return;
    const hasReq = fieldWrapper.querySelector('.req');
    if (!hasReq) return;
    if (!f.files || f.files.length === 0) {
      valid = false;
      const area = f.closest('.upload-area');
      if (area) {
        area.style.borderColor = '#e53e3e';
        f.addEventListener('change', () => {
          area.style.borderColor = '';
        }, { once: true });
      }
    }
  });

  if (!valid) {
    const firstError = stepEl.querySelector('[style*="border-color: rgb(229"]');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return valid;
}

document.querySelectorAll(".upload-area").forEach(area => {
    const input = area.querySelector('input[type="file"]');
    const fileName = area.querySelector(".file-name");
    input.addEventListener("change", function(){
        if(this.files.length){
            area.classList.add("has-file");
            fileName.textContent = this.files[0].name;
        }else{
            area.classList.remove("has-file");
            fileName.textContent = "";
        }
    });
});

/* ── Validasi file sebelum upload ── */
function validateFile(file, jenis) {
  const limits = {
    cv:           { max: 10 * 1024 * 1024, types: ['application/pdf'] },
    transkrip:    { max: 5  * 1024 * 1024, types: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'] },
    bukti_follow: { max: 5  * 1024 * 1024, types: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'] },
  };
  const lim = limits[jenis];
  if (!lim) return { ok: false, msg: 'Jenis file tidak dikenal.' };

  if (!lim.types.includes(file.type)) {
    if (jenis === 'cv') return { ok: false, msg: 'CV harus PDF.' };
    return { ok: false, msg: 'File harus PDF atau gambar (JPG/PNG).' };
  }
  if (file.size > lim.max) {
    const mb = lim.max / (1024 * 1024);
    return { ok: false, msg: 'Ukuran melebihi ' + mb + ' MB.' };
  }
  return { ok: true };
}

function extFromMime(mime) {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

/* ── Upload satu file ke Storage ── */
async function uploadDokumen(nrp, file, folder, jenis) {
  const v = validateFile(file, jenis);
  if (!v.ok) throw new Error(v.msg);
  const ts = Date.now();
  const ext = extFromMime(file.type);
  const path = nrp + '/' + folder + '_' + ts + '.' + ext;
  const { error } = await dbClient.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/* ── Kumpulkan data primitif dari form ── */
function kumpulkanFormData() {
  const get = id => document.getElementById(id).value.trim();
  const radio = name => {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  };

  return {
    nama_lengkap:           get('nama_lengkap'),
    nrp:                    get('nrp'),
    email:                  get('email'),
    no_wa:                  get('no_wa'),
    motivasi:               get('motivasi'),
    skala_prioritas:        parseInt(radio('skala_prioritas'), 10),
    bisa_tinkercad_proteus: radio('bisa_tinkercad_proteus') === 'ya',
    ipk:                    parseFloat(get('ipk')),
    judul_a1:               get('judul-a1'),
    judul_a2:               get('judul-a2'),
    judul_b1:               get('judul-b1'),
    judul_b2:               get('judul-b2'),
    penjelasan_sebelum_ets: get('penjelasan_sebelum_ets'),
    penjelasan_sesudah_ets: get('penjelasan_sesudah_ets'),
    kesediaan_hadir:        radio('kesediaan_hadir'),
  };
}

/* ── Submit: validasi → upload → insert → sukses ── */
async function submitForm() {
  if (!dbClient) {
    alert('Koneksi ke server belum siap. Refresh halaman, kalau masih gagal hubungi panitia.');
    return;
  }
  const agreed = document.getElementById('agree').checked;
  if (!agreed) {
    alert('Dicentang dulu bre, baru bisa submit😌');
    return;
  }

  if (!validateStep(1) || !validateStep(2)) return;

  const cvFile     = document.getElementById('file_cv').files[0];
  const transFile  = document.getElementById('file_transkrip').files[0];
  const buktiFile  = document.getElementById('file_bukti_follow').files[0];

  for (const [file, jenis] of [
    [cvFile, 'cv'],
    [transFile, 'transkrip'],
    [buktiFile, 'bukti_follow'],
  ]) {
    const v = validateFile(file, jenis);
    if (!v.ok) { alert(v.msg); return; }
  }

  const data = kumpulkanFormData();

  const btn = document.querySelector('.btn-submit');
  const oldHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.style.opacity = '.7'; btn.innerHTML = 'Mengirim…'; }

  let uploadedPaths = [];
  try {
    uploadedPaths.push(await uploadDokumen(data.nrp, cvFile,    'cv',           'cv'));
    uploadedPaths.push(await uploadDokumen(data.nrp, transFile, 'transkrip',    'transkrip'));
    uploadedPaths.push(await uploadDokumen(data.nrp, buktiFile, 'bukti_follow', 'bukti_follow'));

    const row = {
      ...data,
      file_cv_path:           uploadedPaths[0],
      file_transkrip_path:    uploadedPaths[1],
      file_bukti_follow_path: uploadedPaths[2],
    };

    const { error: insertErr } = await dbClient.from('pendaftar_aslab').insert(row);
    if (insertErr) throw insertErr;

    clearFormData();
    showPage('page-success');
    setStep(1);
  } catch (err) {
    console.error('Submit gagal:', err);

    // cleanup file yang sudah terupload kalau insert gagal
    if (uploadedPaths.length > 0) {
      try { await dbClient.storage.from(BUCKET).remove(uploadedPaths); } catch (_) {}
    }

    let msg = 'Gagal mengirim data. Coba lagi ya.';
    if (err && err.message) msg += '\n(' + err.message + ')';
    alert(msg);
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = oldHtml; }
  }
}

const judulSebelumETS = [
  'Matode Transformasi Wye-Delta',
  'Analisis Rangkaian Node dan Mesh',
  'Teorema Thevenin dan Norton',
  'Karakteristik Dioda',
];

const judulSesudahETS = [
  'Transistor Dwikutub',
  'Gejala Transien pada Rangkaian Non-linier Orde-1',
  'Op-Amp sebagai Penguat Sinyal',
  'Pengolahan Sinyal Analog menggunakan Op-Amp',
  'Rangkaian Filter Pasif',
];

function buildOptions(selectId, judulList) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="" disabled selected>Pilih...</option>';
  judulList.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j;
    opt.textContent = j;
    sel.appendChild(opt);
  });
}

function filterJudul() {
  const groups = [
    { ids: ['judul-a1', 'judul-a2'] },   //sebelum ETS
    { ids: ['judul-b1', 'judul-b2'] },   //sesudah ETS
  ];

  const allIds = groups.flatMap(g => g.ids);
  const selects = allIds.map(id => document.getElementById(id));
  const chosen = selects.map(s => s.value).filter(v => v !== '');

  selects.forEach(sel => {
    const ownVal = sel.value;
    [...sel.options].forEach(opt => {
      if (opt.value === '') return;
      opt.hidden = chosen.includes(opt.value) && opt.value !== ownVal;
    });
    if (ownVal && chosen.filter(v => v === ownVal).length > 1) {
      sel.value = '';
    }
  });

  const rechosen = selects.map(s => s.value).filter(v => v !== '');
  selects.forEach(sel => {
    const ownVal = sel.value;
    [...sel.options].forEach(opt => {
      if (opt.value === '') return;
      opt.hidden = rechosen.includes(opt.value) && opt.value !== ownVal;
    });
  });
}

//auto save
function saveFormData() {
  const data = {};

  document.querySelectorAll('#page-form input:not([type="radio"]):not([type="checkbox"]):not([type="file"]), #page-form textarea, #page-form select').forEach(el => {
    if (el.id || el.name) {
      data[el.id || el.name + '_' + el.closest('.field')?.querySelector('label')?.textContent.trim()] = el.value;
    }
  });

  document.querySelectorAll('#page-form input[type="radio"]:checked').forEach(r => {
    data['radio_' + r.name] = r.value;
  });

  localStorage.setItem('aslab_form', JSON.stringify(data));
}

function restoreFormData() {
  const raw = localStorage.getItem('aslab_form');
  if (!raw) return;
  const data = JSON.parse(raw);

  document.querySelectorAll('#page-form input:not([type="radio"]):not([type="checkbox"]):not([type="file"]), #page-form textarea, #page-form select').forEach(el => {
    const key = el.id || el.name + '_' + el.closest('.field')?.querySelector('label')?.textContent.trim();
    if (data[key] !== undefined) el.value = data[key];
  });

  document.querySelectorAll('#page-form input[type="radio"]').forEach(r => {
    const key = 'radio_' + r.name;
    if (data[key] === r.value) {
      r.checked = true;
      const item = r.closest('.choice-item-solid');
      if (item) item.classList.add('is-checked');
    }
  });

  if (typeof filterJudul === 'function') filterJudul();
}

function clearFormData() {
  localStorage.removeItem('aslab_form');

  // reset semua field di form
  document.querySelectorAll('#page-form input:not([type="file"]), #page-form textarea, #page-form select').forEach(el => {
    if (el.type === 'radio' || el.type === 'checkbox') {
      el.checked = false;
    } else {
      el.value = '';
    }
  });

  document.querySelectorAll('#page-form .choice-item-solid').forEach(item => {
    item.classList.remove('is-checked');
    item.style.borderColor = '';
  });

  document.querySelectorAll('#page-form input, #page-form textarea, #page-form select').forEach(el => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
  });
}

function goBack() {
  clearFormData();
  showPage('page-lobby');
}

function goHome() {
  clearFormData();
  showPage('page-lobby');
  setStep(1);
}

function initAutoSave() {
  document.querySelectorAll('#page-form input, #page-form textarea, #page-form select').forEach(el => {
    el.addEventListener('input', saveFormData);
    el.addEventListener('change', saveFormData);
  });
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  buildOptions('judul-a1', judulSebelumETS);
  buildOptions('judul-a2', judulSebelumETS);
  buildOptions('judul-b1', judulSesudahETS);
  buildOptions('judul-b2', judulSesudahETS);

  restoreFormData();
  initAutoSave();
});
