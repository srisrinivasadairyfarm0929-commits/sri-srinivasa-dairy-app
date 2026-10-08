const SUPABASE_URL = 'https://qyrulqxbjoylohxgwywo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cnVscXhiam95bG9oeGd3eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTQ3MTg0OCwiZXhwIjoyMTA3MDQ3ODQ4fQ.o6pVGl67ncA5URZV1MOOsjP5rZtJ6Ni1KZ0S3fA2x8Q';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const sounds = {
  add: new Audio('https://actions.google.com/sounds/v1/cart/button_click.ogg'),
  success: new Audio('https://actions.google.com/sounds/v1/cart/achievement_bell.ogg'),
  error: new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg')
};
const play = n => { sounds[n].currentTime = 0; sounds[n].play().catch(()=>{}); };

let cart = [], upiId = '', step = 1;
let discount = 0, appliedCoupon = null;

/* ══════ DRAWER ══════ */
function toggleDrawer() {
  document.getElementById('drawer').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}

function openInstagram() {
  const appUrl = 'instagram://user?username=srinivasa_dairyfarm';
  const webUrl = 'https://www.instagram.com/srinivasa_dairyfarm';
  window.location.href = appUrl;
  setTimeout(() => { window.location.href = webUrl; }, 800);
}

function openWhatsApp() {
  const phone = '919121188763';
  const msg = encodeURIComponent('Hi, I want to order milk from Sri Srinivasa Dairy Farm 🐄');
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}

/* ══════ LOAD DATA ══════ */
(async () => {
  const { data: s } = await db.from('settings').select('*');
  s.forEach(x => { if (x.key === 'upi_id') upiId = x.value; });
  document.getElementById('upiId').textContent = upiId;

  const { data: products } = await db.from('products').select('*').eq('active', true);

  const quantities = [
    { label: '0.5L', mult: 0.5 },
    { label: '1L',   mult: 1 },
    { label: '2L',   mult: 2 },
    { label: '5L',   mult: 5 },
    { label: '10L',  mult: 10 }
  ];

  document.getElementById('items').innerHTML = products.map((p, idx) => `
    <div class="item" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" style="animation-delay:${idx*0.1}s">
      <div class="item-top">
        <div>
          <div class="item-name">🐄 ${p.name}</div>
          <div class="item-stock">Base: ₹${p.price}/L</div>
        </div>
        <div class="item-price">₹${p.price}/L</div>
      </div>
      <div class="qty-row" data-product="${p.id}">
        ${quantities.map(q => `
          <button type="button" class="qty-pill" data-qty="${q.mult}" data-label="${q.label}" onclick="selectQty(this, ${p.id}, ${p.price}, '${p.name}')">
            ${q.label}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');
})();

/* ══════ QUANTITY SELECT ══════ */
function selectQty(btn, productId, basePrice, name) {
  const row = btn.parentElement;
  row.querySelectorAll('.qty-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const qty = Number(btn.dataset.qty);
  const label = btn.dataset.label;

  // Remove any existing entry for this product
  cart = cart.filter(c => c.productId !== productId);

  // Add new entry
  cart.push({
    productId,
    id: productId,
    name: `${name} (${label})`,
    price: Math.round(basePrice * qty),
    qty,
    label
  });

  play('add');
  renderCart();
}

/* ══════ CART ══════ */
function renderCart() {
  document.getElementById('cart').innerHTML = cart.map((c, i) =>
    `<div class="cart-item">
      <span>${c.name}</span>
      <span>₹${c.price}
        <button onclick="removeItem(${i})" style="background:none;border:none;color:#f5576c;cursor:pointer;font-size:16px">✕</button>
      </span>
    </div>`).join('');
  updateTotal();
}

function removeItem(i) {
  cart.splice(i, 1);
  play('add');
  renderCart();
  // Clear active state for removed product's qty pills
  document.querySelectorAll('.qty-row').forEach(row => {
    const productInCart = cart.some(c => c.productId === Number(row.dataset.product));
    if (!productInCart) {
      row.querySelectorAll('.qty-pill').forEach(b => b.classList.remove('active'));
    }
  });
}

function updateTotal() {
  const sub = cart.reduce((s, c) => s + c.price, 0);
  const total = Math.max(0, sub - discount);
  document.getElementById('total').textContent = total;
  document.getElementById('discountLine').textContent = discount ? ` (-₹${discount})` : '';
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

/* ══════ SUBMIT ORDER ══════ */
document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!cart.length) { play('error'); alert('Select quantity for at least one product'); return; }

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

  play('success');
  confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  document.getElementById('orderId').textContent = order.order_id;
  document.getElementById('successPopup').classList.remove('hidden');

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

function closePopup() {
  document.getElementById('successPopup').classList.add('hidden');
}

/* ══════ RIPPLE EFFECT ══════ */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.submit-btn, .add-btn, .upi-btn, .qty-pill');
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
