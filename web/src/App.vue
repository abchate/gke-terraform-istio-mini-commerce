<script setup>
import { ref, onMounted } from 'vue'

const API = import.meta.env.VITE_API_URL || ''

const products = ref([])
const orders = ref([])
const productId = ref('')
const quantity = ref(1)
const message = ref({ text: '', error: false })
const loading = ref(true)

async function loadProducts() {
  try {
    const r = await fetch(`${API}/api/products`)
    if (!r.ok) throw new Error(r.status)
    products.value = await r.json()
    if (products.value.length && !productId.value) productId.value = products.value[0].id
  } catch (e) {
    message.value = { text: 'Erreur produits: ' + e.message, error: true }
  }
}

async function loadOrders() {
  try {
    const r = await fetch(`${API}/api/orders`)
    if (!r.ok) throw new Error(r.status)
    orders.value = await r.json()
  } catch (e) {
    message.value = { text: 'Erreur commandes: ' + e.message, error: true }
  }
}

async function submitOrder(e) {
  e.preventDefault()
  message.value = { text: '', error: false }
  try {
    const r = await fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: productId.value, quantity: quantity.value }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      message.value = { text: data.error || r.status, error: true }
      return
    }
    message.value = { text: 'Commande créée: ' + data.id, error: false }
    loadOrders()
  } catch (e) {
    message.value = { text: 'Erreur: ' + e.message, error: true }
  }
}

onMounted(async () => {
  loading.value = true
  await loadProducts()
  await loadOrders()
  loading.value = false
})
</script>

<template>
  <div class="app">
    <h1>Mini Commerce</h1>
    <p class="sub">Frontend Vue 3 – API via gateway</p>

    <section>
      <h2>Produits</h2>
      <div v-if="loading" class="loading">Chargement…</div>
      <div v-else class="products">
        <div v-for="p in products" :key="p.id" class="product">
          <strong>{{ p.name }}</strong>
          <span class="price">{{ p.price }} €</span>
          <small>{{ p.id }}</small>
        </div>
      </div>
    </section>

    <section>
      <h2>Créer une commande</h2>
      <form @submit="submitOrder">
        <label>
          Produit
          <select v-model="productId" required>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</option>
          </select>
        </label>
        <label>
          Quantité
          <input v-model.number="quantity" type="number" min="1" required />
        </label>
        <button type="submit">Créer la commande</button>
      </form>
      <p v-if="message.text" :class="['msg', message.error ? 'err' : 'ok']">{{ message.text }}</p>
    </section>

    <section>
      <h2>Commandes</h2>
      <div v-if="orders.length === 0" class="empty">Aucune commande.</div>
      <table v-else class="orders">
        <thead>
          <tr>
            <th>Id</th>
            <th>Produit</th>
            <th>Quantité</th>
            <th>Créée le</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id">
            <td><code>{{ o.id }}</code></td>
            <td>{{ o.productId }}</td>
            <td>{{ o.quantity }}</td>
            <td>{{ o.createdAt }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.app { max-width: 720px; margin: 0 auto; padding: 1.5rem; font-family: system-ui, sans-serif; background: #f5f5f5; min-height: 100vh; }
h1 { margin-top: 0; color: #333; }
.sub { color: #666; font-size: 0.9rem; }
section { background: #fff; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
h2 { font-size: 1.1rem; color: #555; border-bottom: 1px solid #eee; padding-bottom: 0.25rem; }
.products { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; }
.product { padding: 0.75rem; background: #f9f9f9; border-radius: 6px; border: 1px solid #eee; }
.product strong { display: block; }
.price { color: #2e7d32; }
.loading, .empty { color: #666; }
form { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end; }
label { display: flex; flex-direction: column; gap: 0.25rem; }
input, select, button { padding: 0.5rem 0.75rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 6px; }
button { background: #1976d2; color: #fff; border: none; cursor: pointer; }
button:hover { background: #1565c0; }
.msg { margin-top: 0.5rem; padding: 0.5rem; border-radius: 6px; }
.msg.err { background: #ffebee; color: #c62828; }
.msg.ok { background: #e8f5e9; color: #2e7d32; }
.orders { width: 100%; border-collapse: collapse; }
.orders th, .orders td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #eee; }
.orders th { color: #666; font-weight: 600; }
</style>
