const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = 8085;

app.use(cors());

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

const frontendServiceUrl = process.env.FRONTEND_SERVICE_URL;
if (frontendServiceUrl) {
  app.use(
    '/',
    createProxyMiddleware({
      target: frontendServiceUrl,
      changeOrigin: true,
      pathRewrite: { '^/$': '/index.html' },
      onProxyReq(proxyReq, req) {
        if (req.url === '/' || req.url === '') console.log('[gateway] Proxy vers web:', req.method, req.url, '->', frontendServiceUrl);
      },
      onError(err, req, res) {
        console.error('Proxy vers frontend:', err.message);
        res.status(503).type('text').send('Frontend indisponible (service web non joignable). Vérifier que le pod web tourne: kubectl get pods');
      },
    })
  );
} else {
  app.get('/', (_, res) => {
    res.type('text').status(200).send('Frontend non configuré. Définir FRONTEND_SERVICE_URL (ex. http://web:80) ou lancer le service web.');
  });
}

app.listen(PORT, () => {
  console.log(`gateway écoute sur le port ${PORT}`);
});
