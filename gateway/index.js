const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = 8085;

app.use(cors());
const staticDir = process.env.STATIC_DIR || path.join(__dirname, '..', 'frontend');
app.use(express.static(staticDir));

const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3005';
const orderServiceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3006';

app.use(
  '/api/products',
  createProxyMiddleware({
    target: productServiceUrl,
    changeOrigin: true,
    pathRewrite: { '^/api/products': '/products' },
  })
);

app.use(
  '/api/orders',
  createProxyMiddleware({
    target: orderServiceUrl,
    changeOrigin: true,
    pathRewrite: { '^/api/orders': '/orders' },
  })
);

app.listen(PORT, () => {
  console.log(`gateway écoute sur le port ${PORT}`);
});
