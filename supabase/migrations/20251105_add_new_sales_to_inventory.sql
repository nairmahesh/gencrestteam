/*
  # Add New Sales Fields to Distributor Inventory

  ## Summary
  This migration adds fields to track sales made after the last visit/verification.
  These fields help monitor distributor performance between visits.

  ## Changes Made

  ### Modified Tables
  - `distributor_inventory` table:
    - Added `new_sales` (numeric) - Volume of sales since last verification
    - Added `new_sales_value` (numeric) - Value of sales since last verification
    - Added `last_verified_at` (timestamptz) - Timestamp of last verification

  ## Business Logic
  - `new_sales` tracks sales volume that occurred after `last_verified_at`
  - When a verification is completed, the system should:
    1. Reset `new_sales` and `new_sales_value` to 0
    2. Update `last_verified_at` to current timestamp
  - Between visits, as sales are recorded, `new_sales` accumulates

  ## Security
  - No RLS policy changes needed (inherits existing policies)
*/

-- Add new_sales, new_sales_value, and last_verified_at columns to distributor_inventory
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributor_inventory' AND column_name = 'new_sales'
  ) THEN
    ALTER TABLE distributor_inventory ADD COLUMN new_sales numeric(12, 2) DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributor_inventory' AND column_name = 'new_sales_value'
  ) THEN
    ALTER TABLE distributor_inventory ADD COLUMN new_sales_value numeric(14, 2) DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributor_inventory' AND column_name = 'last_verified_at'
  ) THEN
    ALTER TABLE distributor_inventory ADD COLUMN last_verified_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN distributor_inventory.new_sales IS 'Volume of sales made since last verification';
COMMENT ON COLUMN distributor_inventory.new_sales_value IS 'Value of sales made since last verification (in Rs)';
COMMENT ON COLUMN distributor_inventory.last_verified_at IS 'Timestamp when stock was last verified';
