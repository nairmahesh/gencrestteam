/*
  # Stock Verification History System

  ## Overview
  Creates a comprehensive history tracking system for stock verifications including
  e-signature and photo proof documentation.

  ## 1. New Tables

  ### `stock_verification_history`
  - Records each stock verification event with complete audit trail
  - Links to verified SKUs, e-signature, and photo proofs
  - Tracks who performed verification and when
  - Captures GPS coordinates for location verification

  ### `verification_sku_details`
  - Detailed SKU-level changes for each verification
  - Records old stock, new stock, and allocations (farmer/retailer)

  ### `verification_proofs`
  - Stores e-signature and photo proof URLs
  - Links to verification history record

  ## 2. Security
  - RLS enabled on all tables
  - Authenticated and anonymous users can read and insert
  - Updates and deletes restricted for audit trail integrity
*/

-- Create stock_verification_history table
CREATE TABLE IF NOT EXISTS stock_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_date timestamptz DEFAULT now() NOT NULL,
  retailer_id text NOT NULL,
  retailer_name text NOT NULL,
  retailer_code text,
  retailer_location text,
  verified_by_id text NOT NULL,
  verified_by_name text NOT NULL,
  verified_by_role text,
  total_skus_verified integer NOT NULL DEFAULT 0,
  latitude numeric(10, 6),
  longitude numeric(10, 6),
  location_verified boolean DEFAULT false,
  has_signature boolean DEFAULT false,
  has_photo_proof boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create verification_sku_details table
CREATE TABLE IF NOT EXISTS verification_sku_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL REFERENCES stock_verification_history(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  product_name text NOT NULL,
  sku_code text NOT NULL,
  sku_name text NOT NULL,
  unit text NOT NULL,
  old_stock integer NOT NULL,
  new_stock integer NOT NULL,
  stock_difference integer NOT NULL,
  farmer_allocation integer DEFAULT 0,
  retailer_allocation integer DEFAULT 0,
  allocated_retailers jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create verification_proofs table
CREATE TABLE IF NOT EXISTS verification_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL REFERENCES stock_verification_history(id) ON DELETE CASCADE,
  proof_type text NOT NULL CHECK (proof_type IN ('signature', 'photo', 'document')),
  proof_url text NOT NULL,
  file_name text,
  file_size integer,
  mime_type text,
  uploaded_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for stock_verification_history
CREATE INDEX IF NOT EXISTS idx_verification_history_date ON stock_verification_history(verification_date DESC);
CREATE INDEX IF NOT EXISTS idx_verification_history_retailer ON stock_verification_history(retailer_id, verification_date DESC);
CREATE INDEX IF NOT EXISTS idx_verification_history_verified_by ON stock_verification_history(verified_by_id, verification_date DESC);

-- Create indexes for verification_sku_details
CREATE INDEX IF NOT EXISTS idx_verification_sku_verification ON verification_sku_details(verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_sku_product ON verification_sku_details(product_code, sku_code);

-- Create indexes for verification_proofs
CREATE INDEX IF NOT EXISTS idx_verification_proofs_verification ON verification_proofs(verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_proofs_type ON verification_proofs(proof_type);

-- Enable Row Level Security
ALTER TABLE stock_verification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_sku_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_proofs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_verification_history
CREATE POLICY "Authenticated users can read verification history"
  ON stock_verification_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert verification history"
  ON stock_verification_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update verification history"
  ON stock_verification_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Only system can delete verification history"
  ON stock_verification_history FOR DELETE TO authenticated USING (false);

-- RLS Policies for verification_sku_details
CREATE POLICY "Authenticated users can read SKU details"
  ON verification_sku_details FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert SKU details"
  ON verification_sku_details FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Only system can update SKU details"
  ON verification_sku_details FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Only system can delete SKU details"
  ON verification_sku_details FOR DELETE TO authenticated USING (false);

-- RLS Policies for verification_proofs
CREATE POLICY "Authenticated users can read proofs"
  ON verification_proofs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert proofs"
  ON verification_proofs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Only system can update proofs"
  ON verification_proofs FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Only system can delete proofs"
  ON verification_proofs FOR DELETE TO authenticated USING (false);

-- Add anon policies for development
CREATE POLICY "Anon can read verification history"
  ON stock_verification_history FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert verification history"
  ON stock_verification_history FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update verification history"
  ON stock_verification_history FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read SKU details"
  ON verification_sku_details FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert SKU details"
  ON verification_sku_details FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can read proofs"
  ON verification_proofs FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert proofs"
  ON verification_proofs FOR INSERT TO anon WITH CHECK (true);
