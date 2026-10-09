const SUPABASE_URL = 'https://qyrulqxbjoylohxgwywo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cnVscXhiam95bG9oeGd3eXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NzE4NDgsImV4cCI6MjEwNzA0Nzg0OH0.UFGFHyMN0yEen9hPvC0Xl9UqZCRrmcP5RIqpAA_my38';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let cart = [], upiId = '', step = 1;
let discount = 0, appliedCoupon = null;
let natureAudio = null, popupTimer = null, countdownInterval = null;

/* ══════ SOUNDS ══════ */
const sounds = {
  add: new Audio('https://actions.google.com/sounds/v1/cart/button_click.ogg'),
  success: new Audio('https://actions.google.com/sounds/v1/cart/achievement_bell.ogg'),
  error: new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg')
};
const play = n => { try { sounds[n].currentTime = 0; sounds[n].play().catch(()=>{}); } catch(e){} };

/* Global click sound for every button */
document.addEventListener('click', (e) => {
  if (e.target.closest('button, a, .qty-pill, .quick-btn, input[type=radio], input[type=checkbox]')) {
    try {
      const clickAudio = new Audio('https://actions.google.com/sounds/v1/cart/button_click.ogg');
      clickAudio.volume = 0.35;
      clickAudio.play().catch(()=>{});
    } catch (err) {}
  }
}, true);

function playNatureSound() {
  natureAudio = new Audio('https://actions.google.com/sounds/v1/ambiences/forest_bird_chirps.ogg');
  natureAudio.loop = true;
  natureAudio.volume = 0.35;
  natureAudio.play().catch(() => {
    document.addEventListener('touchstart', () => {
      if (natureAudio && natureAudio.paused) natureAudio.play().catch(()=>{});
    }, { once: true });
  });
  setTimeout(() => {
    if (!natureAudio) return;
    let vol = natureAudio.volume;
    const fade = setInterval(() => {
      vol -= 0.02;
      if (vol <= 0) { natureAudio.pause(); clearInterval(fade); }
      else natureAudio.volume = vol;
    }, 200);
  }, 20000);
}

/* ══════ BOOT ══════ */
window.addEventListener('load', () => {
  playNatureSound();
  const splash = document.getElementById('splash');
  const main = document.getElementById('mainApp');
  setTimeout(() => {
    if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 700); }
    if (main) main.classList.remove('hidden');
  }, 3000);
});

/* ══════ DRAWER ══════ */
function toggleDrawer() {
  document.getElementById('drawer').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}
function openInstagram() {
  window.location.href = 'instagram://user?username=srinivasa_dairyfarm';
  setTimeout(() => { window.location.href = 'https://www.instagram.com/srinivasa_dairyfarm'; }, 800);
}
function openWhatsApp() {
  const msg = encodeURIComponent('Hi, I want to order milk from Sri Srinivasa Dairy Farm 🐄');
  window.open(`https://wa.me/919121188763?text=${msg}`, '_blank');
}

/* ══════ LOAD DATA ══════ */
(async () => {
  try {
    const { data: s } = await db.from('settings').select('*');
    if (s) s.forEach(x => { if (x.key === 'upi_id') upiId = x.value; });
    const upiEl = document.getElementById('upiId');
    if (upiEl) upiEl.textContent = upiId;

    const { data: products } = await db.from('products').select('*').eq('active', true);
    const quantities = [
      { label: '0.5L', mult: 0.5 },
      { label: '1L', mult: 1 },
      { label: '2L', mult: 2 },
      { label: '5L', mult: 5 },
      { label: '10L', mult: 10 }
    ];
    const itemsEl = document.getElementById('items');
    if (itemsEl && products) {
      itemsEl.innerHTML = products.map((p, idx) => `
        <div class="item" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" style="animation-delay:${idx*0.1}s">
          <div class="item-top">
            <div><div class="item-name">🐄 ${p.name}</div><div class="item-stock">Base: ₹${p.price}/L</div></div>
            <div class="item-price">₹${p.price}/L</div>
          </div>
          <div class="qty-row" data-product="${p.id}">
            ${quantities.map(q => `<button type="button" class="qty-pill" data-qty="${q.mult}" data-label="${q.label}" onclick="selectQty(this, ${p.id}, ${p.price}, '${p.name}')">${q.label}</button>`).join('')}
          </div>
          <div class="custom-qty-row">
            <input type="number" step="0.25" min="0.25" placeholder="Custom qty in L (e.g. 1.5)" id="custom_${p.id}">
            <button type="button" class="custom-qty-btn" onclick="applyCustom(${p.id}, ${p.price}, '${p.name}')">Add</button>
          </div>
        </div>
      `).join('');
    }
  } catch (e) { console.warn('Data load error:', e); }
})();

/* ══════ QUANTITY ══════ */
function selectQty(btn, productId, basePrice, name) {
  const row = btn.parentElement;
  row.querySelectorAll('.qty-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const qty = Number(btn.dataset.qty);
  const label = btn.dataset.label;
  cart = cart.filter(c => c.productId !== productId);
  cart.push({ productId, id: productId, name: `${name} (${label})`, price: Math.round(basePrice * qty), qty, label });
  play('add');
  renderCart();
}

function applyCustom(productId, basePrice, name) {
  const input = document.getElementById('custom_' + productId);
  const qty = Number(input.value);
  if (!qty || qty < 0.25) { play('error'); alert('Minimum 0.25 L'); return; }
  if (qty > 50) { play('error'); alert('Maximum 50 L'); return; }
  cart = cart.filter(c => c.productId !== productId);
  cart.push({ productId, id: productId, name: `${name} (${qty}L)`, price: Math.round(basePrice * qty), qty, label: qty + 'L' });
  const row = document.querySelector(`.qty-row[data-product="${productId}"]`);
  if (row) row.querySelectorAll('.qty-pill').forEach(b => b.classList.remove('active'));
  play('success');
  input.value = '';
  renderCart();
}

function renderCart() {
  const cartEl = document.getElementById('cart');
  if (!cartEl) return;
  cartEl.innerHTML = cart.map((c, i) =>
    `<div class="cart-item">
      <span>${c.name}</span>
      <span>₹${c.price}
        <button onclick="removeItem(${i})" style="background:none;border:none;color:#f5576c;cursor:pointer;font-size:16px">✕</button>
      </span>
    </div>`).join('');
  updateTotal();
}

function removeItem(i) {
  const removed = cart[i];
  cart.splice(i, 1);
  play('add');
  renderCart();
  if (removed) {
    const row = document.querySelector(`.qty-row[data-product="${removed.productId}"]`);
    if (row) row.querySelectorAll('.qty-pill').forEach(b => b.classList.remove('active'));
  }
}

function updateTotal() {
  const sub = cart.reduce((s, c) => s + c.price, 0);
  const total = Math.max(0, sub - discount);
  const tEl = document.getElementById('total');
  const dEl = document.getElementById('discountLine');
  if (tEl) tEl.textContent = total;
  if (dEl) dEl.textContent = discount ? ` (-₹${discount})` : '';
}

/* ══════ COUPON ══════ */
async function applyCoupon() {
  const code = document.getElementById('couponCode').value.trim().toUpperCase();
  const msg = document.getElementById('couponMsg');
  if (!code) return;
  const { data } = await db.from('coupons').select('*').eq('code', code).eq('active', true).single();
  if (!data) { msg.style.color='#f5576c'; msg.textContent='❌ Invalid'; play('error'); return; }
  const sub = cart.reduce((s, c) => s + c.price, 0);
  if (sub < data.min_order) { msg.style.color='#f5576c'; msg.textContent=`❌ Min ₹${data.min_order}`; return; }
  discount = data.type === 'percent' ? Math.floor(sub * data.value / 100) : data.value;
  appliedCoupon = data;
  msg.style.color='#ffd54f'; msg.textContent=`✅ Applied -₹${discount}`;
  play('success');
  updateTotal();
}

/* ══════ REPEAT ══════ */
function repeatLastOrder() {
  const last = localStorage.getItem('lastOrder');
  if (!last) { play('error'); alert('No previous order found. Place an order first.'); return; }
  const prev = JSON.parse(last);
  cart = prev.items || [];
  renderCart();
  cart.forEach(item => {
    const row = document.querySelector(`.qty-row[data-product="${item.productId}"]`);
    if (row) row.querySelectorAll('.qty-pill').forEach(b => {
      if (Number(b.dataset.qty) === item.qty) b.classList.add('active');
    });
  });
  play('success');
  alert('✅ Last order restored!');
}

/* ══════ MONTHLY BILL ══════ */
async function showMonthlyBill() {
  const phone = prompt('Enter your phone number (10 digits):');
  if (!phone) return;
  const cleaned = phone.replace(/\D/g, '').slice(-10);
  if (cleaned.length !== 10) { play('error'); alert('Enter valid 10-digit number'); return; }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data, error } = await db.from('orders').select('*')
    .ilike('phone', '%' + cleaned + '%')
    .gte('created_at', monthStart.toISOString())
    .order('created_at', { ascending: false });

  const content = document.getElementById('billContent');
  document.getElementById('billModal').classList.remove('hidden');

  if (error) { content.innerHTML = `<p style="color:#f5576c">Error: ${error.message}</p>`; return; }
  if (!data || !data.length) {
    content.innerHTML = `<div class="bill-empty">No orders this month.<br>Start ordering to see your bill! 🥛</div>`;
    return;
  }

  const total = data.reduce((s, o) => s + Number(o.total), 0);
  const paid = data.filter(o => o.payment_status === 'Paid').reduce((s, o) => s + Number(o.total), 0);
  const pending = total - paid;

  content.innerHTML = `
    <p style="opacity:0.7;font-size:12px;margin-bottom:10px">${new Date(monthStart).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
    ${data.map(o => `
      <div class="bill-row">
        <span>${new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · ${o.slot || '-'}</span>
        <span>₹${o.total} <span style="font-size:10px;opacity:0.6">${o.payment_status === 'Paid' ? '✅' : '⏳'}</span></span>
      </div>
    `).join('')}
    <div class="bill-row" style="margin-top:8px"><span>Total orders</span><span>${data.length}</span></div>
    <div class="bill-total"><span>Total Amount</span><span>₹${total}</span></div>
    <div class="bill-row"><span>Paid</span><span style="color:#66bb6a">₹${paid}</span></div>
    <div class="bill-row"><span>Pending</span><span style="color:#ffd54f">₹${pending}</span></div>
  `;
}

function closeBill() {
  document.getElementById('billModal').classList.add('hidden');
}

/* ══════ SUCCESS POPUP + 2 MIN COUNTDOWN ══════ */
function openSuccessPopup() {
  document.getElementById('successPopup').classList.remove('hidden');
  let remaining = 120;
  const cdEl = document.getElementById('countdown');
  if (cdEl) cdEl.textContent = remaining;

  countdownInterval = setInterval(() => {
    remaining--;
    const el = document.getElementById('countdown');
    if (el) el.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      closePopup();
    }
  }, 1000);
}

function closePopup() {
  document.getElementById('successPopup').classList.add('hidden');
  if (popupTimer) clearTimeout(popupTimer);
  if (countdownInterval) clearInterval(countdownInterval);
  popupTimer = null;
  countdownInterval = null;
}

/* ══════ ORDER SUBMIT ══════ */
document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!cart.length) { play('error'); alert('Select at least one product'); return; }

  const sub = cart.reduce((s, c) => s + c.price, 0);
  const total = Math.max(0, sub - discount);

  if (step === 1) {
    step = 2;
    const upiLink = `upi://pay?pa=${upiId}&pn=Sri Srinivasa Dairy Farm&am=${total}&cu=INR&tn=Order`;
    document.getElementById('payAmount').textContent = total;
    document.getElementById('upiPayBtn').href = upiLink;
    document.getElementById('qrcode').innerHTML = '';
    new QRCode(document.getElementById('qrcode'), { text: upiLink, width: 180, height: 180 });
    document.getElementById('paymentSection').classList.remove('hidden');
    document.getElementById('submitBtn').textContent = 'Confirm Order ✅';
    document.getElementById('paymentSection').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const utr = document.getElementById('utr').value.trim();
  if (!utr) { play('error'); alert('Enter UTR'); return; }
  if (utr.length < 8) { play('error'); alert('UTR must be at least 8 characters'); return; }
  if (!/^[0-9A-Za-z]+$/.test(utr)) { play('error'); alert('UTR should only contain letters and numbers'); return; }

  const slot = document.querySelector('input[name="slot"]:checked').value;

  const order = {
    order_id: 'SSDF' + Date.now().toString().slice(-8),
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    items: cart,
    total,
    coupon_code: appliedCoupon?.code || null,
    discount,
    slot,
    payment_method: 'UPI',
    utr,
    status: 'Pending',
    payment_status: 'Awaiting Verification'
  };

  const { error } = await db.from('orders').insert([order]);
  if (error) { play('error'); alert(error.message); return; }

  if (appliedCoupon) {
    await db.from('coupons').update({ used_count: appliedCoupon.used_count + 1 }).eq('id', appliedCoupon.id);
  }

  localStorage.setItem('lastOrder', JSON.stringify({ items: order.items }));

  play('success');
  confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  document.getElementById('orderId').textContent = order.order_id;
  openSuccessPopup();

  cart = []; discount = 0; appliedCoupon = null;
  renderCart();
  step = 1;
  document.querySelectorAll('.qty-pill').forEach(b => b.classList.remove('active'));
  document.getElementById('paymentSection').classList.add('hidden');
  document.getElementById('submitBtn').textContent = 'Continue 💳';
  document.getElementById('couponCode').value = '';
  document.getElementById('couponMsg').textContent = '';
  document.getElementById('orderForm').reset();
});

/* ══════ RIPPLE ══════ */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.submit-btn, .add-btn, .upi-btn, .qty-pill, .custom-qty-btn, .quick-btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});
