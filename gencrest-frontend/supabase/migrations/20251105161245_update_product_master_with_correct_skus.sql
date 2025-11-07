/*
  # Update Product Master with Correct SKUs and Case/Bag Sizes

  ## Summary
  This migration updates the product catalog with the correct product names, SKU codes, and case/bag conversions
  based on the official product master spreadsheet.

  ## Changes Made

  ### Product SKU Updates
  Updates all product SKUs with correct:
  - Product names (DAP, MOP, Urea, SSP, NPK variants)
  - SKU codes and names
  - Case sizes (number of Kg in 1 case)
  - Bag sizes (number of Kg in 1 bag)
  - Packaging type set to 'bag' for all fertilizer products

  ### Case/Bag Conversion Logic
  Based on official product specifications:
  - **DAP 25 Kg**: 1 Case = 50 Kg (2 bags), 1 Bag = 25 Kg
  - **DAP 50 Kg**: 1 Case = 50 Kg (1 bag), 1 Bag = 50 Kg
  - **MOP 25 Kg**: 1 Case = 50 Kg (2 bags), 1 Bag = 25 Kg
  - **MOP 50 Kg**: 1 Case = 50 Kg (1 bag), 1 Bag = 50 Kg
  - **Urea 45 Kg**: 1 Case = 90 Kg (2 bags), 1 Bag = 45 Kg
  - **Urea 50 Kg**: 1 Case = 50 Kg (1 bag), 1 Bag = 50 Kg
  - **SSP 50 Kg**: 1 Case = 50 Kg (1 bag), 1 Bag = 50 Kg
  - **NPK 50 Kg variants**: 1 Case = 50 Kg (1 bag), 1 Bag = 50 Kg

  ## Security
  - No RLS policy changes needed
*/

-- Update DAP 25 Kg SKU
UPDATE product_skus
SET
  sku_name = 'DAP 25 Kg',
  sku_code = 'DAP-25KG',
  case_size = 50,
  bag_size = 25,
  packaging_type = 'bag'
WHERE sku_code = 'DAP-25KG' OR sku_name LIKE '%DAP%25%';

-- Update DAP 50 Kg SKU
UPDATE product_skus
SET
  sku_name = 'DAP 50 Kg',
  sku_code = 'DAP-50KG',
  case_size = 50,
  bag_size = 50,
  packaging_type = 'bag'
WHERE sku_code = 'DAP-50KG' OR sku_name LIKE '%DAP%50%';

-- Update MOP 25 Kg SKU (if exists, otherwise insert handled separately)
UPDATE product_skus
SET
  sku_name = 'MOP 25 Kg',
  sku_code = 'MOP-25KG',
  case_size = 50,
  bag_size = 25,
  packaging_type = 'bag'
WHERE sku_code = 'MOP-25KG' OR sku_name LIKE '%MOP%25%';

-- Update MOP 50 Kg SKU
UPDATE product_skus
SET
  sku_name = 'MOP 50 Kg',
  sku_code = 'MOP-50KG',
  case_size = 50,
  bag_size = 50,
  packaging_type = 'bag'
WHERE sku_code = 'MOP-50KG' OR sku_name LIKE '%MOP%50%';

-- Update Urea 45 Kg SKU
UPDATE product_skus
SET
  sku_name = 'Urea 45 Kg',
  sku_code = 'UREA-45KG',
  case_size = 90,
  bag_size = 45,
  packaging_type = 'bag'
WHERE sku_code = 'UREA-45KG' OR sku_name LIKE '%Urea%45%';

-- Update Urea 50 Kg SKU
UPDATE product_skus
SET
  sku_name = 'Urea 50 Kg',
  sku_code = 'UREA-50KG',
  case_size = 50,
  bag_size = 50,
  packaging_type = 'bag'
WHERE sku_code = 'UREA-50KG' OR sku_name LIKE '%Urea%50%';

-- Update SSP 50 Kg SKU
UPDATE product_skus
SET
  sku_name = 'SSP 50 Kg',
  sku_code = 'SSP-50KG',
  case_size = 50,
  bag_size = 50,
  packaging_type = 'bag'
WHERE sku_code = 'SSP-50KG' OR sku_name LIKE '%SSP%50%';

-- Update NPK 12-32-16 50 Kg SKU
UPDATE product_skus
SET
  sku_name = 'NPK 12-32-16 50 Kg',
  sku_code = 'NPK-12-32-16-50KG',
  case_size = 50,
  bag_size = 50,
  packaging_type = 'bag'
WHERE sku_code LIKE '%NPK%12%32%16%' OR sku_name LIKE '%NPK%12%32%16%';

-- Update NPK 10-26-26 50 Kg SKU
UPDATE product_skus
SET
  sku_name = 'NPK 10-26-26 50 Kg',
  sku_code = 'NPK-10-26-26-50KG',
  case_size = 50,
  bag_size = 50,
  packaging_type = 'bag'
WHERE sku_code LIKE '%NPK%10%26%26%' OR sku_name LIKE '%NPK%10%26%26%';

-- Update NPK 20-20-0-13 50 Kg SKU
UPDATE product_skus
SET
  sku_name = 'NPK 20-20-0-13 50 Kg',
  sku_code = 'NPK-20-20-0-13-50KG',
  case_size = 50,
  bag_size = 50,
  packaging_type = 'bag'
WHERE sku_code LIKE '%NPK%20%20%' OR sku_name LIKE '%NPK%20%20%';

-- Update product names to match official nomenclature
UPDATE products
SET product_name = 'DAP (Di-Ammonium Phosphate)'
WHERE product_code = 'DAP';

UPDATE products
SET product_name = 'MOP (Muriate of Potash)'
WHERE product_code = 'MOP';

UPDATE products
SET product_name = 'Urea'
WHERE product_code = 'UREA' OR product_code = 'Urea';

UPDATE products
SET product_name = 'SSP (Single Super Phosphate)'
WHERE product_code = 'SSP';

UPDATE products
SET product_name = 'NPK 12-32-16'
WHERE product_code LIKE '%12%32%16%' OR product_code = 'NPK-12-32-16';

UPDATE products
SET product_name = 'NPK 10-26-26'
WHERE product_code LIKE '%10%26%26%' OR product_code = 'NPK-10-26-26';

UPDATE products
SET product_name = 'NPK 20-20-0-13'
WHERE product_code LIKE '%20%20%' OR product_code = 'NPK-20-20-0-13';

-- Add comment for documentation
COMMENT ON COLUMN product_skus.case_size IS 'Number of Kg in one CASE. Example: If 1 case = 50 Kg, then entering 2 cases = 100 Kg';
COMMENT ON COLUMN product_skus.bag_size IS 'Number of Kg in one BAG. Example: If 1 bag = 25 Kg, then entering 2 bags = 50 Kg';
