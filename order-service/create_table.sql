-- Table des commandes pour order-service
CREATE TABLE IF NOT EXISTS orders (
  id         VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
