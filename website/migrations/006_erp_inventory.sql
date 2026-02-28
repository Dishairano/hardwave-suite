-- ERP Inventory Module Tables
-- Migration: 006_erp_inventory.sql
-- Created: 2026-02-14

-- =============================================
-- Product Categories
-- =============================================

CREATE TABLE IF NOT EXISTS inv_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id INT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES inv_categories(id) ON DELETE SET NULL,
  INDEX idx_categories_parent (parent_id)
);

INSERT INTO inv_categories (name, description) VALUES
('Software', 'Software products and licenses'),
('Hardware', 'Physical hardware products'),
('Merchandise', 'Branded merchandise'),
('Services', 'Service offerings'),
('Digital Assets', 'Digital downloadable assets');

-- =============================================
-- Products
-- =============================================

CREATE TABLE IF NOT EXISTS inv_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id INT,
  product_type ENUM('physical', 'digital', 'service') DEFAULT 'physical',
  unit_of_measure VARCHAR(20) DEFAULT 'unit',
  cost_price DECIMAL(15, 2) DEFAULT 0.00,
  selling_price DECIMAL(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  tax_rate DECIMAL(5, 2) DEFAULT 0.00,
  barcode VARCHAR(50),
  weight DECIMAL(10, 3),
  weight_unit ENUM('kg', 'lb', 'g', 'oz') DEFAULT 'kg',
  dimensions_length DECIMAL(10, 2),
  dimensions_width DECIMAL(10, 2),
  dimensions_height DECIMAL(10, 2),
  dimensions_unit ENUM('cm', 'in', 'm') DEFAULT 'cm',
  min_stock_level INT DEFAULT 0,
  max_stock_level INT DEFAULT 0,
  reorder_point INT DEFAULT 0,
  reorder_quantity INT DEFAULT 0,
  lead_time_days INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_sellable BOOLEAN DEFAULT TRUE,
  is_purchasable BOOLEAN DEFAULT TRUE,
  track_inventory BOOLEAN DEFAULT TRUE,
  allow_backorder BOOLEAN DEFAULT FALSE,
  image_url VARCHAR(500),
  tags JSON,
  custom_fields JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES inv_categories(id) ON DELETE SET NULL,
  INDEX idx_products_category (category_id),
  INDEX idx_products_sku (sku),
  INDEX idx_products_type (product_type)
);

-- =============================================
-- Warehouse Locations
-- =============================================

CREATE TABLE IF NOT EXISTS inv_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  location_type ENUM('warehouse', 'store', 'virtual', 'transit') DEFAULT 'warehouse',
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'United States',
  manager_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_locations_type (location_type)
);

INSERT INTO inv_locations (code, name, location_type, is_default) VALUES
('MAIN', 'Main Warehouse', 'warehouse', TRUE),
('DIGITAL', 'Digital Inventory', 'virtual', FALSE);

-- =============================================
-- Stock Levels (per Product per Location)
-- =============================================

CREATE TABLE IF NOT EXISTS inv_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NOT NULL,
  quantity_on_hand INT DEFAULT 0,
  quantity_reserved INT DEFAULT 0,
  quantity_available INT GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  quantity_incoming INT DEFAULT 0,
  last_counted_at TIMESTAMP NULL,
  last_movement_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES inv_products(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES inv_locations(id) ON DELETE CASCADE,
  UNIQUE KEY unique_product_location (product_id, location_id),
  INDEX idx_stock_product (product_id),
  INDEX idx_stock_location (location_id)
);

-- =============================================
-- Stock Movements (Audit Trail)
-- =============================================

CREATE TABLE IF NOT EXISTS inv_stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  location_id INT NOT NULL,
  movement_type ENUM('receipt', 'issue', 'transfer_in', 'transfer_out', 'adjustment', 'return', 'damage', 'count') NOT NULL,
  quantity INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INT,
  unit_cost DECIMAL(15, 2),
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES inv_products(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES inv_locations(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_movements_product (product_id),
  INDEX idx_movements_location (location_id),
  INDEX idx_movements_type (movement_type),
  INDEX idx_movements_date (created_at),
  INDEX idx_movements_reference (reference_type, reference_id)
);

-- =============================================
-- Suppliers
-- =============================================

CREATE TABLE IF NOT EXISTS inv_suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(255),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'United States',
  payment_terms INT DEFAULT 30,
  currency VARCHAR(3) DEFAULT 'USD',
  tax_id VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  rating INT DEFAULT 0,
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_suppliers_active (is_active)
);

-- =============================================
-- Supplier Products (Price Lists)
-- =============================================

CREATE TABLE IF NOT EXISTS inv_supplier_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  product_id INT NOT NULL,
  supplier_sku VARCHAR(50),
  unit_cost DECIMAL(15, 2) NOT NULL,
  min_order_quantity INT DEFAULT 1,
  lead_time_days INT DEFAULT 0,
  is_preferred BOOLEAN DEFAULT FALSE,
  last_order_date DATE,
  notes TEXT,
  FOREIGN KEY (supplier_id) REFERENCES inv_suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES inv_products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_supplier_product (supplier_id, product_id),
  INDEX idx_supplier_products_supplier (supplier_id),
  INDEX idx_supplier_products_product (product_id)
);

-- =============================================
-- Purchase Orders
-- =============================================

CREATE TABLE IF NOT EXISTS inv_purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(20) NOT NULL UNIQUE,
  supplier_id INT NOT NULL,
  location_id INT NOT NULL,
  status ENUM('draft', 'submitted', 'confirmed', 'partial', 'received', 'cancelled') DEFAULT 'draft',
  order_date DATE NOT NULL,
  expected_date DATE,
  received_date DATE,
  subtotal DECIMAL(15, 2) DEFAULT 0.00,
  tax_amount DECIMAL(15, 2) DEFAULT 0.00,
  shipping_cost DECIMAL(15, 2) DEFAULT 0.00,
  discount_amount DECIMAL(15, 2) DEFAULT 0.00,
  total_amount DECIMAL(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_terms INT DEFAULT 30,
  payment_status ENUM('pending', 'partial', 'paid') DEFAULT 'pending',
  shipping_method VARCHAR(100),
  tracking_number VARCHAR(100),
  notes TEXT,
  internal_notes TEXT,
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES inv_suppliers(id),
  FOREIGN KEY (location_id) REFERENCES inv_locations(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_po_supplier (supplier_id),
  INDEX idx_po_status (status),
  INDEX idx_po_date (order_date)
);

-- =============================================
-- Purchase Order Items
-- =============================================

CREATE TABLE IF NOT EXISTS inv_purchase_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity_ordered INT NOT NULL,
  quantity_received INT DEFAULT 0,
  unit_cost DECIMAL(15, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0.00,
  discount_percent DECIMAL(5, 2) DEFAULT 0.00,
  line_total DECIMAL(15, 2) NOT NULL,
  notes TEXT,
  FOREIGN KEY (purchase_order_id) REFERENCES inv_purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES inv_products(id),
  INDEX idx_po_items_order (purchase_order_id),
  INDEX idx_po_items_product (product_id)
);

-- =============================================
-- Inventory Counts (Stock Takes)
-- =============================================

CREATE TABLE IF NOT EXISTS inv_stock_counts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  count_number VARCHAR(20) NOT NULL UNIQUE,
  location_id INT NOT NULL,
  count_type ENUM('full', 'partial', 'cycle') DEFAULT 'full',
  status ENUM('draft', 'in_progress', 'completed', 'cancelled') DEFAULT 'draft',
  count_date DATE NOT NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  total_items INT DEFAULT 0,
  items_counted INT DEFAULT 0,
  variance_count INT DEFAULT 0,
  variance_value DECIMAL(15, 2) DEFAULT 0.00,
  notes TEXT,
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES inv_locations(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_counts_location (location_id),
  INDEX idx_counts_status (status)
);

CREATE TABLE IF NOT EXISTS inv_stock_count_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stock_count_id INT NOT NULL,
  product_id INT NOT NULL,
  expected_quantity INT NOT NULL,
  counted_quantity INT NULL,
  variance INT GENERATED ALWAYS AS (COALESCE(counted_quantity, 0) - expected_quantity) STORED,
  unit_cost DECIMAL(15, 2) DEFAULT 0.00,
  variance_value DECIMAL(15, 2) GENERATED ALWAYS AS (variance * unit_cost) STORED,
  notes TEXT,
  counted_by INT NULL,
  counted_at TIMESTAMP NULL,
  FOREIGN KEY (stock_count_id) REFERENCES inv_stock_counts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES inv_products(id),
  FOREIGN KEY (counted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_count_product (stock_count_id, product_id),
  INDEX idx_count_items_count (stock_count_id)
);
