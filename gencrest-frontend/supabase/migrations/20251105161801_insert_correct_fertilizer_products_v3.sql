/*
  # Insert Correct Fertilizer Products from Excel Sheet

  ## Summary
  This migration inserts the correct fertilizer products and SKUs based on the official product master Excel sheet.
  It includes DAP, MOP, Urea, SSP, and NPK variants with proper case/bag conversion values.

  ## Products Added
  1. DAP (Di-Ammonium Phosphate) - 25 Kg, 50 Kg
  2. MOP (Muriate of Potash) - 25 Kg, 50 Kg
  3. Urea - 45 Kg, 50 Kg
  4. SSP (Single Super Phosphate) - 50 Kg
  5. NPK 12-32-16 - 50 Kg
  6. NPK 10-26-26 - 50 Kg
  7. NPK 20-20-0-13 - 50 Kg

  ## Case/Bag Conversions
  - DAP 25 Kg: 1 Case = 50 Kg, 1 Bag = 25 Kg
  - DAP 50 Kg: 1 Case = 50 Kg, 1 Bag = 50 Kg
  - MOP 25 Kg: 1 Case = 50 Kg, 1 Bag = 25 Kg
  - MOP 50 Kg: 1 Case = 50 Kg, 1 Bag = 50 Kg
  - Urea 45 Kg: 1 Case = 90 Kg, 1 Bag = 45 Kg
  - Urea 50 Kg: 1 Case = 50 Kg, 1 Bag = 50 Kg
  - SSP 50 Kg: 1 Case = 50 Kg, 1 Bag = 50 Kg
  - All NPK 50 Kg: 1 Case = 50 Kg, 1 Bag = 50 Kg

  ## Security
  - No RLS changes needed
*/

DO $$
DECLARE
  v_category_id UUID;
  v_product_id UUID;
BEGIN
  -- Get or create Fertilizer category
  SELECT id INTO v_category_id FROM product_categories WHERE name = 'Fertilizer' LIMIT 1;
  IF v_category_id IS NULL THEN
    INSERT INTO product_categories (name, description)
    VALUES ('Fertilizer', 'Fertilizer products')
    RETURNING id INTO v_category_id;
  END IF;

  -- Insert/Update DAP Product
  INSERT INTO products (product_code, product_name, category_id, is_active)
  VALUES ('DAP', 'DAP (Di-Ammonium Phosphate)', v_category_id, true)
  ON CONFLICT (product_code) DO UPDATE
  SET product_name = 'DAP (Di-Ammonium Phosphate)', category_id = v_category_id
  RETURNING id INTO v_product_id;

  -- Insert DAP SKUs
  INSERT INTO product_skus (product_id, sku_code, sku_name, unit_type, unit_value, case_size, bag_size, packaging_type, is_active)
  VALUES 
    (v_product_id, 'DAP-25KG', 'DAP 25 Kg', 'Kg', 25, 50, 25, 'bag', true),
    (v_product_id, 'DAP-50KG', 'DAP 50 Kg', 'Kg', 50, 50, 50, 'bag', true)
  ON CONFLICT (sku_code) DO UPDATE
  SET sku_name = EXCLUDED.sku_name,
      unit_type = EXCLUDED.unit_type,
      unit_value = EXCLUDED.unit_value,
      case_size = EXCLUDED.case_size,
      bag_size = EXCLUDED.bag_size,
      packaging_type = EXCLUDED.packaging_type,
      product_id = EXCLUDED.product_id;

  -- Insert/Update MOP Product
  INSERT INTO products (product_code, product_name, category_id, is_active)
  VALUES ('MOP', 'MOP (Muriate of Potash)', v_category_id, true)
  ON CONFLICT (product_code) DO UPDATE
  SET product_name = 'MOP (Muriate of Potash)', category_id = v_category_id
  RETURNING id INTO v_product_id;

  -- Insert MOP SKUs
  INSERT INTO product_skus (product_id, sku_code, sku_name, unit_type, unit_value, case_size, bag_size, packaging_type, is_active)
  VALUES 
    (v_product_id, 'MOP-25KG', 'MOP 25 Kg', 'Kg', 25, 50, 25, 'bag', true),
    (v_product_id, 'MOP-50KG', 'MOP 50 Kg', 'Kg', 50, 50, 50, 'bag', true)
  ON CONFLICT (sku_code) DO UPDATE
  SET sku_name = EXCLUDED.sku_name,
      unit_type = EXCLUDED.unit_type,
      unit_value = EXCLUDED.unit_value,
      case_size = EXCLUDED.case_size,
      bag_size = EXCLUDED.bag_size,
      packaging_type = EXCLUDED.packaging_type,
      product_id = EXCLUDED.product_id;

  -- Insert/Update Urea Product
  INSERT INTO products (product_code, product_name, category_id, is_active)
  VALUES ('UREA', 'Urea', v_category_id, true)
  ON CONFLICT (product_code) DO UPDATE
  SET product_name = 'Urea', category_id = v_category_id
  RETURNING id INTO v_product_id;

  -- Insert Urea SKUs
  INSERT INTO product_skus (product_id, sku_code, sku_name, unit_type, unit_value, case_size, bag_size, packaging_type, is_active)
  VALUES 
    (v_product_id, 'UREA-45KG', 'Urea 45 Kg', 'Kg', 45, 90, 45, 'bag', true),
    (v_product_id, 'UREA-50KG', 'Urea 50 Kg', 'Kg', 50, 50, 50, 'bag', true)
  ON CONFLICT (sku_code) DO UPDATE
  SET sku_name = EXCLUDED.sku_name,
      unit_type = EXCLUDED.unit_type,
      unit_value = EXCLUDED.unit_value,
      case_size = EXCLUDED.case_size,
      bag_size = EXCLUDED.bag_size,
      packaging_type = EXCLUDED.packaging_type,
      product_id = EXCLUDED.product_id;

  -- Insert/Update SSP Product
  INSERT INTO products (product_code, product_name, category_id, is_active)
  VALUES ('SSP', 'SSP (Single Super Phosphate)', v_category_id, true)
  ON CONFLICT (product_code) DO UPDATE
  SET product_name = 'SSP (Single Super Phosphate)', category_id = v_category_id
  RETURNING id INTO v_product_id;

  -- Insert SSP SKU
  INSERT INTO product_skus (product_id, sku_code, sku_name, unit_type, unit_value, case_size, bag_size, packaging_type, is_active)
  VALUES (v_product_id, 'SSP-50KG', 'SSP 50 Kg', 'Kg', 50, 50, 50, 'bag', true)
  ON CONFLICT (sku_code) DO UPDATE
  SET sku_name = EXCLUDED.sku_name,
      unit_type = EXCLUDED.unit_type,
      unit_value = EXCLUDED.unit_value,
      case_size = EXCLUDED.case_size,
      bag_size = EXCLUDED.bag_size,
      packaging_type = EXCLUDED.packaging_type,
      product_id = EXCLUDED.product_id;

  -- Insert/Update NPK 12-32-16 Product
  INSERT INTO products (product_code, product_name, category_id, is_active)
  VALUES ('NPK-12-32-16', 'NPK 12-32-16', v_category_id, true)
  ON CONFLICT (product_code) DO UPDATE
  SET product_name = 'NPK 12-32-16', category_id = v_category_id
  RETURNING id INTO v_product_id;

  -- Insert NPK 12-32-16 SKU
  INSERT INTO product_skus (product_id, sku_code, sku_name, unit_type, unit_value, case_size, bag_size, packaging_type, is_active)
  VALUES (v_product_id, 'NPK-12-32-16-50KG', 'NPK 12-32-16 50 Kg', 'Kg', 50, 50, 50, 'bag', true)
  ON CONFLICT (sku_code) DO UPDATE
  SET sku_name = EXCLUDED.sku_name,
      unit_type = EXCLUDED.unit_type,
      unit_value = EXCLUDED.unit_value,
      case_size = EXCLUDED.case_size,
      bag_size = EXCLUDED.bag_size,
      packaging_type = EXCLUDED.packaging_type,
      product_id = EXCLUDED.product_id;

  -- Insert/Update NPK 10-26-26 Product
  INSERT INTO products (product_code, product_name, category_id, is_active)
  VALUES ('NPK-10-26-26', 'NPK 10-26-26', v_category_id, true)
  ON CONFLICT (product_code) DO UPDATE
  SET product_name = 'NPK 10-26-26', category_id = v_category_id
  RETURNING id INTO v_product_id;

  -- Insert NPK 10-26-26 SKU
  INSERT INTO product_skus (product_id, sku_code, sku_name, unit_type, unit_value, case_size, bag_size, packaging_type, is_active)
  VALUES (v_product_id, 'NPK-10-26-26-50KG', 'NPK 10-26-26 50 Kg', 'Kg', 50, 50, 50, 'bag', true)
  ON CONFLICT (sku_code) DO UPDATE
  SET sku_name = EXCLUDED.sku_name,
      unit_type = EXCLUDED.unit_type,
      unit_value = EXCLUDED.unit_value,
      case_size = EXCLUDED.case_size,
      bag_size = EXCLUDED.bag_size,
      packaging_type = EXCLUDED.packaging_type,
      product_id = EXCLUDED.product_id;

  -- Insert/Update NPK 20-20-0-13 Product
  INSERT INTO products (product_code, product_name, category_id, is_active)
  VALUES ('NPK-20-20-0-13', 'NPK 20-20-0-13', v_category_id, true)
  ON CONFLICT (product_code) DO UPDATE
  SET product_name = 'NPK 20-20-0-13', category_id = v_category_id
  RETURNING id INTO v_product_id;

  -- Insert NPK 20-20-0-13 SKU
  INSERT INTO product_skus (product_id, sku_code, sku_name, unit_type, unit_value, case_size, bag_size, packaging_type, is_active)
  VALUES (v_product_id, 'NPK-20-20-0-13-50KG', 'NPK 20-20-0-13 50 Kg', 'Kg', 50, 50, 50, 'bag', true)
  ON CONFLICT (sku_code) DO UPDATE
  SET sku_name = EXCLUDED.sku_name,
      unit_type = EXCLUDED.unit_type,
      unit_value = EXCLUDED.unit_value,
      case_size = EXCLUDED.case_size,
      bag_size = EXCLUDED.bag_size,
      packaging_type = EXCLUDED.packaging_type,
      product_id = EXCLUDED.product_id;

END $$;
