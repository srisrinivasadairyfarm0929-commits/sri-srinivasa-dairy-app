const SUPABASE_URL = 'https://qyrulqxbjoylohxgwywo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cnVscXhiam95bG9oeGd3eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTQ3MTg0OCwiZXhwIjoyMTA3MDQ3ODQ4fQ.o6pVGl67ncA5URZV1MOOsjP5rZtJ6Ni1KZ0S3fA2x8Q';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let cart = [], upiId = '', step = 1;
let discount = 0, appliedCoupon = null;
let natureAudio = null, gameLoop = null;

const sounds = {
  add: new Audio('https://actions.google.com/sounds/v1/cart/button_click.ogg'),
  success: new Audio('https://actions.google.com/sounds/v1/cart/achievement_bell.ogg'),
  error: new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg')
};
const play = n => { sounds[n].currentTime = 0; sounds[n].play().catch(()=>{}); };

function playNatureSound() {
  natureAudio = new Audio('https://actions.google.com/sounds/v1/ambiences/forest_bird_chirps.ogg');
  natureAudio.loop = true;
  natureAudio.volume = 0.35;
  natureAudio.play().catch(() => {
    document.addEventListener('touchstart', () => {
      if (natureAudio && natureAudio.paused) natureAudio.play().catch(()=>{});
    }, { once: true });
    document.addEventListener('click', () => {
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

window.addEventListener('load', () => {
  playNatureSound();
  const splash = document.getElementById('splash');
  const offline = document.getElementById('offlineScreen');
  const main = document.getElementById('mainApp');
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 700);
    if (navigator.onLine) main.classList.remove('hidden');
    else { offline.classList.remove('hidden'); startGame(); }
  }, 3500);
});

window.addEventListener('online', () => {
  document.getElementById('offlineScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  stopGame();
});
window.addEventListener('offline', () => {
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('offlineScreen').classList.remove('hidden');
  startGame();
});

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

(async () => {
  const { data: s } = await db.from('settings').select('*');
  s.forEach(x => { if (x.key === 'upi_id') upiId = x.value; });
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
  if (itemsEl) {
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
})();

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
  alert('✅ Last order restored! Review and continue.');
}

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
    content.innerHTML = `<div class="bill-empty">No orders this month.<br>Start ordering to see your bill here! 🥛</div>`;
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

const GRID = 16, CELL = 20;
let snake, direction, food, score, best, canvas, ctx, gameSpeed;

function startGame() {
  canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  best = Number(localStorage.getItem('snakeBest') || 0);
  document.getElementById('best').textContent = best;
  resetGame();
  if (gameLoop) clearInterval(gameLoop);
  gameLoop = setInterval(gameTick, gameSpeed);
  document.addEventListener('keydown', handleKey);

  let tsx = 0, tsy = 0;
  canvas.addEventListener('touchstart', e => { tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; });
  canvas.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tsx;
    const dy = e.changedTouches[0].clientY - tsy;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 30) setDir('right'); else if (dx < -30) setDir('left');
    } else {
      if (dy > 30) setDir('down'); else if (dy < -30) setDir('up');
    }
  }, { passive: true });

  document.querySelectorAll('.dpad').forEach(btn => btn.addEventListener('click', () => setDir(btn.dataset.dir)));
}

function resetGame() {
  snake = [{x:8,y:8},{x:7,y:8},{x:6,y:8}];
  direction = { x: 1, y: 0 };
  score = 0; gameSpeed = 150;
  placeFood();
  document.getElementById('score').textContent = 0;
}
function placeFood() {
  let ok = false;
  while (!ok) {
    food = { x: Math.floor(Math.random()*GRID), y: Math.floor(Math.random()*GRID) };
    ok = !snake.some(s => s.x === food.x && s.y === food.y);
  }
}
function setDir(d) {
  if (!snake) return;
  if (d==='up'    && direction.y===0) direction = { x:0, y:-1 };
  if (d==='down'  && direction.y===0) direction = { x:0, y: 1 };
  if (d==='left'  && direction.x===0) direction = { x:-1,y: 0 };
  if (d==='right' && direction.x===0) direction = { x: 1,y: 0 };
}
function handleKey(e) {
  if (e.key==='ArrowUp')    setDir('up');
  if (e.key==='ArrowDown')  setDir('down');
  if (e.key==='ArrowLeft')  setDir('left');
  if (e.key==='ArrowRight') setDir('right');
}
function gameTick() {
  if (!snake) return;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { gameOver(); return; }
  if (snake.some(s => s.x === head.x && s.y === head.y)) { gameOver(); return; }
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score++;
    document.getElementById('score').textContent = score;
    placeFood();
    if (score % 5 === 0 && gameSpeed > 70) {
      gameSpeed -= 10;
      clearInterval(gameLoop);
      gameLoop = setInterval(gameTick, gameSpeed);
    }
  } else snake.pop();
  drawGame();
}
function drawGame() {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(102,187,106,0.1)';
  for (let i = 0; i < GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i*CELL,0); ctx.lineTo(i*CELL,canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i*CELL); ctx.lineTo(canvas.width,i*CELL); ctx.stroke();
  }
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath();
  ctx.arc(food.x*CELL+CELL/2, food.y*CELL+CELL/2, CELL/2-2, 0, Math.PI*2);
  ctx.fill();
  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? '#66bb6a' : '#2e7d32';
    ctx.fillRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2);
  });
}
function gameOver() {
  clearInterval(gameLoop); gameLoop = null;
  if (score > best) {
    best = score;
    localStorage.setItem('snakeBest', best);
    document.getElementById('best').textContent = best;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over!', canvas.width/2, canvas.height/2 - 10);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Score: ' + score, canvas.width/2, canvas.height/2 + 20);
  ctx.fillText('Tap to play again', canvas.width/2, canvas.height/2 + 50);
  canvas.addEventListener('click', restartGame, { once: true });
  canvas.addEventListener('touchstart', restartGame, { once: true });
}
function restartGame() {
  resetGame();
  if (gameLoop) clearInterval(gameLoop);
  gameLoop = setInterval(gameTick, gameSpeed);
}
function stopGame() {
  if (gameLoop) { clearInterval(gameLoop); gameLoop = null; }
      }
