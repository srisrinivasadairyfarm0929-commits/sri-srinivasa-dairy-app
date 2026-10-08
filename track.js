const SUPABASE_URL = 'https://qyrulqxbjoylohxgwywo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cnVscXhiam95bG9oeGd3eXdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTQ3MTg0OCwiZXhwIjoyMTA3MDQ3ODQ4fQ.o6pVGl67ncA5URZV1MOOsjP5rZtJ6Ni1KZ0S3fA2x8Q0Nzg0OH0.UFGFHyMN0yEen9hPvC0Xl9UqZCRrmcP5RIqpAA_my38';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function trackOrder() {
  const id = document.getElementById('trackId').value.trim();
  const resultEl = document.getElementById('result');
  if (!id) return;

  const { data, error } = await db.from('orders').select('*').eq('order_id', id).single();

  if (error || !data) {
    resultEl.innerHTML = `<p style="color:#f5576c">❌ Order not found</p>`;
    return;
  }

  const steps = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];
  const current = steps.indexOf(data.status);

  resultEl.innerHTML = `
    <h3>Order ${data.order_id}</h3>
    <p>Status: <b>${data.status}</b></p>
    <p>Payment: <b>${data.payment_status}</b></p>
    <p>Total: ₹${data.total}</p>
    <div class="timeline">
      ${steps.map((s, i) => `
        <div class="step ${i <= current ? 'active' : ''}">
          <div class="dot"></div>
          <span>${s}</span>
        </div>`).join('')}
    </div>
  `;
}
