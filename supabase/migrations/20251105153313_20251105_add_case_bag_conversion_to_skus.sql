/*
  # Add Case/Bag Conversion Fields to Product SKUs

  ## Summary
  This migration adds fields to track case and bag sizes for product SKUs, enabling proper unit conversion
  when users enter stock quantities in CASES or BAGS.

  ## Changes Made

  ### Modified Tables
  - `product_skus` table:
    - Added `case_size` (numeric, nullable) - Number of base units (liters/kg) in one CASE
    - Added `bag_size` (numeric, nullable) - Number of base units (kg) in one BAG
    - Added `packaging_type` (text, nullable) - Type of packaging: 'bottle', 'bag', 'bucket', etc.

  ## Business Logic
  - For liquid SKUs (ml, ltr): use `case_size` to define how many liters are in 1 CASE
    - Example: If 1 CASE = 10 liters of 1 Ltr bottles, then case_size = 10
  - For powder/granular SKUs (kg, gm): use `bag_size` to define how many kg are in 1 BAG
    - Example: If 1 BAG = 25 kg, then bag_size = 25

  ## Example Usage
  - When user enters "2 CASES" of a 1 Ltr product with case_size=10:
    - System converts to: 2 * 10 = 20 liters
  - When user enters "3 BAGS" of a 5 Kg product with bag_size=25:
    - System converts to: 3 * 25 = 75 kg

  ## Security
  - No RLS policy changes needed (inherits existing policies)
*/

-- Add case_size, bag_size, and packaging_type columns to product_skus
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_skus' AND column_name = 'case_size'
  ) THEN
    ALTER TABLE product_skus ADD COLUMN case_size numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_skus' AND column_name = 'bag_size'
  ) THEN
    ALTER TABLE product_skus ADD COLUMN bag_size numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_skus' AND column_name = 'packaging_type'
  ) THEN
    ALTER TABLE product_skus ADD COLUMN packaging_type text DEFAULT NULL;
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN product_skus.case_size IS 'Number of base units (liters for liquids) in one CASE. Used when entering stock in CASES.';
COMMENT ON COLUMN product_skus.bag_size IS 'Number of base units (kg for solids) in one BAG. Used when entering stock in BAGS.';
COMMENT ON COLUMN product_skus.packaging_type IS 'Type of packaging: bottle, bag, bucket, etc.';

-- Example: Update some sample products with case/bag sizes
-- These are examples - actual values should be configured based on business requirements

-- Update liquid products (1 Ltr bottles) - typically 10 bottles per case
UPDATE product_skus
SET case_size = 10, packaging_type = 'bottle'
WHERE sku_name LIKE '%1 Ltr%' OR sku_name LIKE '%1000 ml%';

-- Update liquid products (500 ml bottles) - typically 20 bottles per case
UPDATE product_skus
SET case_size = 10, packaging_type = 'bottle'
WHERE sku_name LIKE '%500 ml%' OR sku_name LIKE '%500ML%';

-- Update liquid products (250 ml bottles) - typically 40 bottles per case
UPDATE product_skus
SET case_size = 10, packaging_type = 'bottle'
WHERE sku_name LIKE '%250 ml%' OR sku_name LIKE '%250ML%';

-- Update solid products with bag sizes
UPDATE product_skus
SET bag_size = 30, packaging_type = 'bag'
WHERE sku_name LIKE '%30 Kg%' OR sku_name LIKE '%30KG%';

UPDATE product_skus
SET bag_size = 25, packaging_type = 'bag'
WHERE sku_name LIKE '%25 Kg%' OR sku_name LIKE '%25KG%';

UPDATE product_skus
SET bag_size = 10, packaging_type = 'bag'
WHERE (sku_name LIKE '%10 Kg%' OR sku_name LIKE '%10KG%')
AND packaging_type IS NULL;

UPDATE product_skus
SET bag_size = 5, packaging_type = 'bag'
WHERE sku_name LIKE '%5 Kg%' OR sku_name LIKE '%5KG%';