const SUPABASE_URL = 'https://qyrulqxbjoylohxgwywo.supabase.co/rest/v1/';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cnVscXhiam95bG9oeGd3eXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NzE4NDgsImV4cCI6MjEwNzA0Nzg0OH0.UFGFHyMN0yEen9hPvC0Xl9UqZCRrmcP5RIqpAA_my38';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function login() {
  const pwd = document.getElementById('pwd').value;
  const { data } = await db.from('settings').select('value').eq('key','admin_password').single();
  if (data && data.value === pwd) {
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('panel').classList.remove('hidden');
    loadOrders();
  } else alert('Wrong password');
}

async function loadOrders() {
  const { data } = await db.from('orders').select('*').order('created_at', { ascending: false });
  const statuses = ['Pending','Confirmed','Shipped','Delivered','Cancelled'];

  document.getElementById('ordersTable').innerHTML = `
    <tr><th>Order</th><th>Name</th><th>Total</th><th>UTR</th><th>Payment</th><th>Status</th><th>Actions</th></tr>
    ${data.map(o => `
      <tr>
        <td>${o.order_id}</td>
        <td>${o.name}<br><small>${o.phone}</small></td>
        <td>₹${o.total}</td>
        <td>${o.utr || '-'}</td>
        <td>
          <select onchange="updatePayment('${o.order_id}', this.value)">
            ${['Unpaid','Awaiting Verification','Paid','Failed'].map(s =>
              `<option ${o.payment_status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <select onchange="updateStatus('${o.order_id}', this.value)">
            ${statuses.map(s =>
              `<option ${o.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <button onclick="sendWhatsApp('${o.order_id}')" title="WhatsApp">📲</button>
          <button onclick="sendEmail('${o.order_id}')" title="Email">✉️</button>
        </td>
      </tr>`).join('')}`;
}

async function updateStatus(id, status) {
  await db.from('orders').update({ status }).eq('order_id', id);
}

async function updatePayment(id, payment_status) {
  await db.from('orders').update({ payment_status }).eq('order_id', id);
}

async function sendWhatsApp(orderId) {
  const { data } = await db.from('orders').select('*').eq('order_id', orderId).single();
  if (!data) return;
  const msg = `🐄 Sri Srinivasa Dairy Farm

Order: ${data.order_id}
Name: ${data.name}
Status: ${data.status}
Payment: ${data.payment_status}
Total: ₹${data.total}

Thank you!`;
  const phone = String(data.phone).replace(/\D/g,'');
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function sendEmail(orderId) {
  const { data } = await db.from('orders').select('*').eq('order_id', orderId).single();
  if (!data || !data.email) return;
  const subject = `Order ${data.order_id} — ${data.status}`;
  const body = `Hi ${data.name},

Your order ${data.order_id} is now: ${data.status}
Payment: ${data.payment_status}
Total: ₹${data.total}

Sri Srinivasa Dairy Farm`;
  window.location.href = `mailto:${data.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function loadProducts() {
  const { data } = await db.from('products').select('*').order('id');
  document.getElementById('productsTable').innerHTML = `
    <tr><th>Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Active</th><th>Upload</th><th></th></tr>
    ${data.map(p => `
      <tr>
        <td>${p.image_url ? `<img src="${p.image_url}" style="width:50px;height:50px;object-fit:cover;border-radius:8px">` : '—'}</td>
        <td><input value="${p.name}" onchange="updateProduct(${p.id},'name',this.value)"></td>
        <td><input type="number" value="${p.price}" onchange="updateProduct(${p.id},'price',Number(this.value))"></td>
        <td><input type="number" value="${p.stock}" onchange="updateProduct(${p.id},'stock',Number(this.value))"></td>
        <td><input type="checkbox" ${p.active?'checked':''} onchange="updateProduct(${p.id},'active',this.checked)"></td>
        <td><input type="file" accept="image/*" onchange="uploadImage(${p.id}, this.files[0])"></td>
        <td><button onclick="deleteProduct(${p.id})">🗑️</button></td>
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

async function updateProduct(id, field, value) {
  await db.from('products').update({ [field]: value }).eq('id', id);
}

async function deleteProduct(id) {
  if (confirm('Delete?')) {
    await db.from('products').delete().eq('id', id);
    loadProducts();
  }
}

async function uploadImage(id, file) {
  if (!file) return;
  const path = `products/${id}_${Date.now()}_${file.name}`;
  const { error } = await db.storage.from('product-images').upload(path, file);
  if (error) return alert(error.message);
  const { data: { publicUrl } } = db.storage.from('product-images').getPublicUrl(path);
  await db.from('products').update({ image_url: publicUrl }).eq('id', id);
  loadProducts();
}

async function loadCoupons() {
  const { data } = await db.from('coupons').select('*').order('id', { ascending: false });
  document.getElementById('couponsTable').innerHTML = `
    <tr><th>Code</th><th>Type</th><th>Value</th><th>Min</th><th>Used</th><th>Active</th><th></th></tr>
    ${data.map(c => `
      <tr>
        <td>${c.code}</td>
        <td>${c.type}</td>
        <td>${c.value}</td>
        <td>₹${c.min_order}</td>
        <td>${c.used_count}/${c.usage_limit}</td>
        <td><input type="checkbox" ${c.active?'checked':''} onchange="toggleCoupon(${c.id}, this.checked)"></td>
        <td><button onclick="deleteCoupon(${c.id})">🗑️</button></td>
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

async function toggleCoupon(id, active) {
  await db.from('coupons').update({ active }).eq('id', id);
}

async function deleteCoupon(id) {
  if (confirm('Delete coupon?')) {
    await db.from('coupons').delete().eq('id', id);
    loadCoupons();
  }
}

async function loadAnalytics() {
  const { data } = await db.from('orders').select('*');
  const totalOrders = data.length;
  const revenue = data.filter(o => o.payment_status === 'Paid').reduce((s,o) => s + Number(o.total), 0);
  const pending = data.filter(o => o.status === 'Pending').length;

  document.getElementById('stats').innerHTML = `
    <div class="stat"><h3>${totalOrders}</h3><p>Orders</p></div>
    <div class="stat"><h3>₹${revenue}</h3><p>Revenue</p></div>
    <div class="stat"><h3>${pending}</h3><p>Pending</p></div>`;

  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0,10);
    const count = data.filter(o => o.created_at?.slice(0,10) === key).length;
    return { label: d.toLocaleDateString('en', { weekday: 'short' }), count };
  });

  const max = Math.max(...days.map(d => d.count), 1);
  document.getElementById('chart').innerHTML = days.map(d => `
    <div class="bar-wrap">
      <div class="bar" style="height:${(d.count/max)*100}%"></div>
      <span>${d.label}</span>
    </div>`).join('');
                       }
