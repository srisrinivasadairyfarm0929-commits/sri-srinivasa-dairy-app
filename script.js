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

(async () => {
  const { data: s } = await db.from('settings').select('*');
  s.forEach(x => { if (x.key === 'upi_id') upiId = x.value; });
  document.getElementById('upiId').textContent = upiId;

  const { data: products } = await db.from('products').select('*').eq('active', true);
  document.getElementById('items').innerHTML = products.map(p => `
    <div class="item" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-stock="${p.stock}">
      ${p.image_url ? `<img src="${p.image_url}" class="prod-img">` : ''}
      <div style="flex:1">
        <div>${p.name} — ₹${p.price}</div>
        <small style="opacity:0.6">Stock: ${p.stock}</small>
      </div>
      <button type="button" class="add-btn" ${p.stock<=0?'disabled':''}>${p.stock<=0?'Out':'+ Add'}</button>
    </div>`).join('');
  document.querySelectorAll('.add-btn').forEach(b => { if (!b.onclick) b.addEventListener('click', addToCart); });
})();

function addToCart(e){
  const item = e.target.closest('.item');
  const stock = Number(item.dataset.stock);
  const already = cart.filter(c => c.id === Number(item.dataset.id)).length;
  if (already >= stock) { play('error'); alert('Out of stock'); return; }
  cart.push({ id:Number(item.dataset.id), name:item.dataset.name, price:Number(item.dataset.price) });
  play('add'); renderCart();
}
function renderCart(){
  document.getElementById('cart').innerHTML = cart.map((c,i) =>
    `<div class="cart-item"><span>${c.name}</span>
      <span>₹${c.price} <button onclick="removeItem(${i})" style="background:none;border:none;color:#f5576c;cursor:pointer">✕</button></span>
    </div>`).join('');
  updateTotal();
}
function removeItem(i){ cart.splice(i,1); play('add'); renderCart(); }
function updateTotal(){
  const sub = cart.reduce((s,c)=>s+c.price,0);
  const total = Math.max(0, sub - discount);
  document.getElementById('total').textContent = total;
  document.getElementById('discountLine').textContent = discount ? ` (-₹${discount})` : '';
}

async function applyCoupon(){
  const code = document.getElementById('couponCode').value.trim().toUpperCase();
  const msg = document.getElementById('couponMsg');
  if (!code) return;
  const { data } = await db.from('coupons').select('*').eq('code',code).eq('active',true).single();
  if (!data) { msg.style.color='#f5576c'; msg.textContent='❌ Invalid'; play('error'); return; }
  const sub = cart.reduce((s,c)=>s+c.price,0);
  if (sub < data.min_order) { msg.style.color='#f5576c'; msg.textContent=`❌ Min ₹${data.min_order}`; return; }
  discount = data.type==='percent' ? Math.floor(sub*data.value/100) : data.value;
  appliedCoupon = data;
  msg.style.color='#ffd54f'; msg.textContent=`✅ Applied -₹${discount}`;
  play('success'); updateTotal();
}

document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!cart.length) { play('error'); alert('Add items'); return; }
  const sub = cart.reduce((s,c)=>s+c.price,0);
  const total = Math.max(0, sub - discount);

  if (step === 1) {
    step = 2;
    document.getElementById('qrcode').innerHTML = '';
    new QRCode(document.getElementById('qrcode'), {
      text: `upi://pay?pa=${upiId}&pn=Sri Srinivasa Dairy Farm&am=${total}&cu=INR`,
      width: 180, height: 180
    });
    document.getElementById('paymentSection').classList.remove('hidden');
    document.getElementById('submitBtn').textContent = 'Confirm Order ✅';
    return;
  }

  const utr = document.getElementById('utr').value.trim();
  if (!utr) { play('error'); alert('Enter UTR'); return; }

  const order = {
    order_id: 'SSDF' + Date.now().toString().slice(-8),
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    items: cart, total,
    coupon_code: appliedCoupon?.code || null,
    discount,
    payment_method: 'UPI', utr,
    status: 'Pending', payment_status: 'Awaiting Verification'
  };

  const { error } = await db.from('orders').insert([order]);
  if (error) { play('error'); alert(error.message); return; }

  for (const it of order.items) {
    const { data: p } = await db.from('products').select('stock').eq('id', it.id).single();
    if (p) await db.from('products').update({ stock: Math.max(0, p.stock-1) }).eq('id', it.id);
  }
  if (appliedCoupon) {
    await db.from('coupons').update({ used_count: appliedCoupon.used_count + 1 }).eq('id', appliedCoupon.id);
  }

  play('success');
  confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
  document.getElementById('orderId').textContent = order.order_id;
  document.getElementById('successPopup').classList.remove('hidden');

  cart = []; discount = 0; appliedCoupon = null;
  renderCart(); step = 1;
  document.getElementById('paymentSection').classList.add('hidden');
  document.getElementById('submitBtn').textContent = 'Continue 💳';
  document.getElementById('couponCode').value = '';
  document.getElementById('couponMsg').textContent = '';
  document.getElementById('orderForm').reset();
});

function closePopup(){ document.getElementById('successPopup').classList.add('hidden'); }
