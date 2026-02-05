const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const app = express();
const PORT = 3006;

app.use(express.json());

const pool = new Pool({
  host: process.env.ORDER_DB_HOST || 'localhost',
  port: parseInt(process.env.ORDER_DB_PORT || '5432', 10),
  database: process.env.ORDER_DB_NAME || 'orders',
  user: process.env.ORDER_DB_USER || 'postgres',
  password: process.env.ORDER_DB_PASSWORD || 'postgres',
});

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3005';

async function checkProductExists(productId) {
  const res = await fetch(`${PRODUCT_SERVICE_URL}/products/${productId}`);
  return res.ok;
}

app.post('/orders', async (req, res) => {
  const { productId, quantity } = req.body || {};
  if (quantity == null || typeof quantity !== 'number' || quantity <= 0) {
    return res.status(400).json({ error: 'quantity doit être un nombre strictement positif' });
  }
  if (!productId || typeof productId !== 'string') {
    return res.status(400).json({ error: 'productId requis' });
  }
  const exists = await checkProductExists(productId);
  if (!exists) {
    return res.status(400).json({ error: 'Produit inexistant' });
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await pool.query(
      'INSERT INTO orders (id, product_id, quantity, created_at) VALUES ($1, $2, $3, $4)',
      [id, productId, quantity, createdAt]
    );
    res.status(201).json({ id, productId, quantity, createdAt });
  } catch (err) {
    console.error(err);
    const msg = process.env.NODE_ENV === 'production' ? 'Erreur base de données' : err.message;
    res.status(500).json({ error: msg });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, product_id AS "productId", quantity, created_at AS "createdAt" FROM orders ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    const msg = process.env.NODE_ENV === 'production' ? 'Erreur base de données' : err.message;
    res.status(500).json({ error: msg });
  }
});

app.get('/orders/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, product_id AS "productId", quantity, created_at AS "createdAt" FROM orders WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Commande non trouvée' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    const msg = process.env.NODE_ENV === 'production' ? 'Erreur base de données' : err.message;
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`order-service écoute sur le port ${PORT}`);
});
