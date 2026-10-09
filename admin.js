const SUPABASE_URL = 'https://qyrulqxbjoylohxgwywo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cnVscXhiam95bG9oeGd3eXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NzE4NDgsImV4cCI6MjEwNzA0Nzg0OH0.UFGFHyMN0yEen9hPvC0Xl9UqZCRrmcP5RIqpAA_my38';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ══════ DEVICE LOCK ══════ */
const DEVICE_KEY_STORAGE = 'ssdf_device_lock_v2';
const OWNER_DEVICE_KEY = 'SSDF-OWNER-2026-1629-AMMANANNA@143-PRIVATE';

/* Generate stable device fingerprint */
async function getDeviceFingerprint() {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'na',
    navigator.platform || 'na',
    navigator.deviceMemory || 'na',
    navigator.maxTouchPoints || 0
  ];
  const raw = parts.join('|');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

/* Verify this device is the owner's */
async function verifyDevice() {
  const urlParams = new URLSearchParams(location.search);
  const regKey = urlParams.get('register');

  // Register this device if URL has correct secret
  if (regKey === OWNER_DEVICE_KEY) {
    const fp = await getDeviceFingerprint();
    localStorage.setItem(DEVICE_KEY_STORAGE, fp);
    history.replaceState({}, '', 'admin.html');
    return { ok: true, fingerprint: fp };
  }

  const saved = localStorage.getItem(DEVICE_KEY_STORAGE);
  const current = await getDeviceFingerprint();

  if (!saved) return { ok: false, reason: 'no_device' };
  if (saved !== current) return { ok: false, reason: 'wrong_device' };
  return { ok: true, fingerprint: current };
}

function showAccessDenied(reason) {
  document.getElementById('loadingScreen').classList.add('hide');
  const el = document.getElementById('accessDenied');
  el.classList.add('show');
  if (reason === 'no_device') {
    el.innerHTML = `
      <div>
        <h1>🔒</h1>
        <h2>Not Registered</h2>
        <p>This device is not registered as the owner's phone.</p>
        <p style="font-size:12px;opacity:0.5;margin-top:30px">🐄 Sri Srinivasa Dairy Farm</p>
      </div>`;
  }
}

/* ══════ BUZZER SETUP ══════ */
const CUSTOM_BUZZER = 'buzzer.mp3';
const FALLBACK_BUZZER = 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=error-126627.mp3';

let lastOrderCount = 0;
let watcherInterval = null;

function playBuzzerOnce(volume = 1.0) {
  try {
    const audio = new Audio(CUSTOM_BUZZER);
    audio.volume = volume;
    audio.play().catch(() => {
      try {
        const fb = new Audio(FALLBACK_BUZZER);
        fb.volume = volume;
        fb.play().catch(() => {});
      } catch (e) {}
    });
  } catch (e) {}
}

function triggerBuzzer() {
  playBuzzerOnce(1.0);
  setTimeout(() => playBuzzerOnce(1.0), 900);
  setTimeout(() => playBuzzerOnce(1.0), 1800);
  if (navigator.vibrate) { try { navigator.vibrate([500, 200, 500, 200, 500]); } catch (e) {} }
  showNewOrderBanner();
}

function showNewOrderBanner() {
  const existing = document.getElementById('newOrderBanner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'newOrderBanner';
  banner.style.cssText = `
    position:fixed; top:0; left:0; right:0;
    background:linear-gradient(135deg, #f5576c, #f093fb);
    color:#fff; padding:20px;
    text-align:center; font-weight:bold;
    font-size:16px; z-index:99999;
    box-shadow:0 4px 20px rgba(0,0,0,0.5);
    cursor:pointer;
  `;
  banner.innerHTML = '🔔 NEW ORDER RECEIVED! Tap to view';
  banner.onclick = () => { loadOrders(); banner.remove(); };
  document.body.appendChild(banner);
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 30000);
}

function startOrderWatcher() {
  if (watcherInterval) clearInterval(watcherInterval);
  (async () => {
    try {
      const { count } = await db.from('orders').select('*', { count: 'exact', head: true });
      lastOrderCount = count || 0;
    } catch (e) {}
  })();
  watcherInterval = setInterval(async () => {
    try {
      const { count } = await db.from('orders').select('*', { count: 'exact', head: true });
      if (typeof count !== 'number') return;
      if (count > lastOrderCount) { triggerBuzzer(); lastOrderCount = count; }
    } catch (e) {}
  }, 8000);
}

function addSoundTestButton() {
  if (document.getElementById('testBuzzerBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'testBuzzerBtn';
  btn.textContent = '🔊 Test Buzzer';
  btn.style.cssText = `
    position:fixed; bottom:16px; right:16px;
    padding:12px 18px;
    background:linear-gradient(135deg, #2e7d32, #66bb6a);
    color:#fff; border:none; border-radius:30px;
    font-weight:bold; font-size:13px;
    box-shadow:0 6px 20px rgba(0,0,0,0.4);
    z-index:99998; cursor:pointer;
  `;
  btn.onclick = () => triggerBuzzer();
  document.body.appendChild(btn);
}

function addResetButton() {
  if (document.getElementById('resetDeviceBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'resetDeviceBtn';
  btn.textContent = '🔄 Reset Device';
  btn.style.cssText = `
    position:fixed; bottom:16px; left:16px;
    padding:10px 14px;
    background:rgba(245,87,108,0.8);
    color:#fff; border:none; border-radius:30px;
    font-weight:bold; font-size:12px;
    box-shadow:0 6px 20px rgba(0,0,0,0.4);
    z-index:99998; cursor:pointer;
  `;
  btn.onclick = () => {
    if (confirm('Reset device lock? You will need to re-register with the secret key.')) {
      localStorage.removeItem(DEVICE_KEY_STORAGE);
      location.href = 'admin.html';
    }
  };
  document.body.appendChild(btn);
}

/* ══════ BOOT ══════ */
async function bootAdmin() {
  const result = await verifyDevice();
  if (!result.ok) { showAccessDenied(result.reason); return; }

  document.getElementById('loadingScreen').classList.add('hide');
  document.getElementById('mainContent').style.display = 'block';

  const label = document.getElementById('deviceLabel');
  if (label) label.textContent = '✓ ' + result.fingerprint.slice(0, 8) + '...';

  loadOrders();

  // Silent audio unlock
  try {
    const a = new Audio(CUSTOM_BUZZER);
    a.volume = 0;
    a.play().then(() => { a.pause(); }).catch(() => {});
  } catch (e) {}

  startOrderWatcher();
  addSoundTestButton();
  addResetButton();
}

window.addEventListener('load', bootAdmin);

/* ══════ ORDERS ══════ */
async function loadOrders() {
  const { data } = await db.from('orders').select('*').order('created_at', { ascending: false });
  const statuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

  document.getElementById('ordersTable').innerHTML = `
    <tr><th>Order</th><th>Name</th><th>Total</th><th>UTR</th><th>Slot</th><th>Payment</th><th>Status</th><th>Actions</th></tr>
    ${(data || []).map(o => `
      <tr>
        <td>${o.order_id}</td>
        <td>${o.name}<br><small>${o.phone}</small></td>
        <td>₹${o.total}</td>
        <td>${o.utr || '-'}</td>
        <td>${o.slot || '-'}</td>
        <td>
          <select onchange="updatePayment('${o.order_id}', this.value)">
            ${['Unpaid','Awaiting Verification','Paid','Failed'].map(s =>
              `<option ${o.payment_status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <select onchange="updateStatus('${o.order_id}', this.value)">
            ${statuses.map(s =>
              `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <button onclick="sendWhatsApp('${o.order_id}')" style="background:none;border:none;font-size:18px;cursor:pointer">📲</button>
          <button onclick="sendEmail('${o.order_id}')" style="background:none;border:none;font-size:18px;cursor:pointer">✉️</button>
        </td>
      </tr>`).join('')}`;
}

async function updateStatus(id, status) { await db.from('orders').update({ status }).eq('order_id', id); }
async function updatePayment(id, payment_status) { await db.from('orders').update({ payment_status }).eq('order_id', id); }

async function sendWhatsApp(orderId) {
  const { data } = await db.from('orders').select('*').eq('order_id', orderId).single();
  if (!data) return;
  const msg = `🐄 Sri Srinivasa Dairy Farm

Order: ${data.order_id}
Name: ${data.name}
Slot: ${data.slot || '-'}
Status: ${data.status}
Payment: ${data.payment_status}
Total: ₹${data.total}

Thank you!`;
  const phone = String(data.phone).replace(/\D/g, '');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function sendEmail(orderId) {
  const { data } = await db.from('orders').select('*').eq('order_id', orderId).single();
  if (!data || !data.email) return;
  const subject = `Order ${data.order_id} — ${data.status}`;
  const body = `Hi ${data.name},

Your order ${data.order_id} is now: ${data.status}
Slot: ${data.slot || '-'}
Payment: ${data.payment_status}
Total: ₹${data.total}

Sri Srinivasa Dairy Farm`;
  window.location.href = `mailto:${data.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ══════ DELIVERY ══════ */
async function loadDelivery() {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db.from('orders').select('*')
    .gte('created_at', today + 'T00:00:00')
    .order('created_at', { ascending: false });

  const morning = (data || []).filter(o => (o.slot || '').includes('Morning'));
  const evening = (data || []).filter(o => (o.slot || '').includes('Evening'));
  const other = (data || []).filter(o => !(o.slot || '').includes('Morning') && !(o.slot || '').includes('Evening'));

  const renderGroup = (title, list) => {
    if (!list.length) return '';
    return `
      <div class="slot-header">${title} — ${list.length} orders</div>
      ${list.map(o => `
        <div class="delivery-card">
          <div class="row"><b>${o.name}</b> <span>₹${o.total}</span></div>
          <div class="row"><span>📞 ${o.phone}</span></div>
          <div class="row"><span>📍 ${o.address}</span></div>
          <div class="items">🛒 ${(o.items || []).map(i => i.name).join(', ')}</div>
          <div class="row" style="margin-top:6px">
            <span style="font-size:11px;opacity:0.7">${o.order_id}</span>
            <a href="https://wa.me/${String(o.phone).replace(/\D/g, '')}" target="_blank" style="color:#66bb6a;font-size:12px">Message →</a>
          </div>
        </div>`).join('')}`;
  };

  document.getElementById('deliveryList').innerHTML =
    (morning.length || evening.length || other.length)
      ? renderGroup('🌅 Morning', morning) + renderGroup('🌆 Evening', evening) + renderGroup('🕐 Other', other)
      : '<p style="text-align:center;opacity:0.6;padding:40px">No orders today yet.</p>';
}

/* ══════ PRODUCTS ══════ */
async function loadProducts() {
  const { data } = await db.from('products').select('*').order('id');
  document.getElementById('productsTable').innerHTML = `
    <tr><th>Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Active</th><th>Upload</th><th></th></tr>
    ${(data || []).map(p => `
      <tr>
        <td>${p.image_url ? `<img src="${p.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:6px">` : '—'}</td>
        <td><input value="${p.name}" onchange="updateProduct(${p.id},'name',this.value)"></td>
        <td><input type="number" value="${p.price}" onchange="updateProduct(${p.id},'price',Number(this.value))"></td>
        <td><input type="number" value="${p.stock}" onchange="updateProduct(${p.id},'stock',Number(this.value))"></td>
        <td><input type="checkbox" ${p.active ? 'checked' : ''} onchange="updateProduct(${p.id},'active',this.checked)"></td>
        <td><input type="file" accept="image/*" onchange="uploadImage(${p.id}, this.files[0])"></td>
        <td><button onclick="deleteProduct(${p.id})" style="background:none;border:none;cursor:pointer">🗑️</button></td>
      </tr>`).join('')}`;
}

async function addProduct() {
  const name = document.getElementById('pName').value;
  const price = Number(document.getElementById('pPrice').value);
  const stock = Number(document.getElementById('pStock').value) || 100;
  if (!name || !price) return alert('Fill name & price');
  await db.from('products').insert([{ name, price, stock, active: true }]);
  loadProducts();
}

async function updateProduct(id, field, value) { await db.from('products').update({ [field]: value }).eq('id', id); }

async function deleteProduct(id) {
  if (confirm('Delete?')) { await db.from('products').delete().eq('id', id); loadProducts(); }
}

/* ══════ COUPONS ══════ */
async function loadCoupons() {
  const { data } = await db.from('coupons').select('*').order('id', { ascending: false });
  document.getElementById('couponsTable').innerHTML = `
    <tr><th>Code</th><th>Type</th><th>Value</th><th>Min</th><th>Used</th><th>Active</th><th></th></tr>
    ${(data || []).map(c => `
      <tr>
        <td>${c.code}</td>
        <td>${c.type}</td>
        <td>${c.value}</td>
        <td>₹${c.min_order}</td>
        <td>${c.used_count}/${c.usage_limit}</td>
        <td><input type="checkbox" ${c.active ? 'checked' : ''} onchange="toggleCoupon(${c.id}, this.checked)"></td>
        <td><button onclick="deleteCoupon(${c.id})" style="background:none;border:none;cursor:pointer">🗑️</button></td>
      </tr>`).join('')}`;
}

async function addCoupon() {
  const code = document.getElementById('cCode').value.trim().toUpperCase();
  const type = document.getElementById('cType').value;
  const value = Number(document.getElementById('cValue').value);
  const min_order = Number(document.getElementById('cMin').value) || 0;
  const usage_limit = Number(document.getElementById('cLimit').value) || 100;
  if (!code || !value) return alert('Fill code & value');
  const { error } = await db.from('coupons').insert([{ code, type, value, min_order, usage_limit }]);
  if (error) return alert(error.message);
  loadCoupons();
}

async function toggleCoupon(id, active) { await db.from('coupons').update({ active }).eq('id', id); }
async function deleteCoupon(id) {
  if (confirm('Delete coupon?')) { await db.from('coupons').delete().eq('id', id); loadCoupons(); }
}

/* ══════ ANALYTICS ══════ */
async function loadAnalytics() {
  const { data } = await db.from('orders').select('*');
  const orders = data || [];
  const totalOrders = orders.length;
  const revenue = orders.filter(o => o.payment_status === 'Paid').reduce((s, o) => s + Number(o.total || 0), 0);
  const pending = orders.filter(o => o.status === 'Pending').length;

  document.getElementById('stats').innerHTML = `
    <div class="stat"><h3>${totalOrders}</h3><p>Orders</p></div>
    <div class="stat"><h3>₹${revenue}</h3><p>Revenue</p></div>
    <div class="stat"><h3>${pending}</h3><p>Pending</p></div>`;

  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const count = orders.filter(o => (o.created_at || '').slice(0, 10) === key).length;
    return { label: d.toLocaleDateString('en', { weekday: 'short' }), count };
  });
  const max = Math.max(...days.map(d => d.count), 1);
  document.getElementById('chart').innerHTML = days.map(d => `
    <div class="bar-wrap">
      <div class="bar" style="height:${(d.count / max) * 100}%"></div>
      <span>${d.label}</span>
    </div>`).join('');
}

/* ══════ IMAGE UPLOAD ══════ */
async function uploadImage(id, file) {
  if (!file) return;
  const path = `products/${id}_${Date.now()}_${file.name}`;
  const { error } = await db.storage.from('product-images').upload(path, file);
  if (error) return alert(error.message);
  const { data: { publicUrl } } = db.storage.from('product-images').getPublicUrl(path);
  await db.from('products').update({ image_url: publicUrl }).eq('id', id);
  loadProducts();
}
