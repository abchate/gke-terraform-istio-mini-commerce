const express = require('express');
const app = express();
const PORT = 3005;

const products = [
  { id: 'p1', name: 'T-shirt', price: 19.99 },
  { id: 'p2', name: 'Jean', price: 49.99 },
  { id: 'p3', name: 'Chaussures', price: 79.99 },
  { id: 'p4', name: 'Sac', price: 39.99 },
  { id: 'p5', name: 'Casquette', price: 14.99 },
];

app.get('/products', (req, res) => {
  res.json(products);
});

app.get('/products/:id', (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
  res.json(product);
});

app.listen(PORT, () => {
  console.log(`product-service écoute sur le port ${PORT}`);
});
