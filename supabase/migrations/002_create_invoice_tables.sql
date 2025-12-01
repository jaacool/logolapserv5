-- Invoice Sequences Table (for different number ranges)
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix TEXT NOT NULL,
  year INTEGER NOT NULL,
  current_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(prefix, year)
);

-- Initialize LogoLapser sequence for current year
INSERT INTO invoice_sequences (prefix, year, current_number)
VALUES ('LL', EXTRACT(YEAR FROM NOW())::INTEGER, 0)
ON CONFLICT (prefix, year) DO NOTHING;

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Customer details (captured at time of purchase)
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_company TEXT,
  customer_address TEXT,
  customer_vat_id TEXT,
  
  -- Invoice details
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('draft', 'paid', 'cancelled', 'refunded')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  
  -- Line items stored as JSONB
  -- Format: [{ description: string, quantity: number, unit_price: number, total: number }]
  line_items JSONB NOT NULL DEFAULT '[]',
  
  -- Amounts (in cents to avoid floating point issues)
  subtotal_cents INTEGER NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 19.00, -- German VAT
  tax_amount_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  
  -- Payment reference
  payment_provider TEXT NOT NULL CHECK (payment_provider IN ('stripe', 'paypal')),
  payment_id TEXT NOT NULL,
  transaction_id UUID REFERENCES credit_transactions(id),
  
  -- PDF storage
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_id ON invoices(payment_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoice_sequences_updated_at ON invoice_sequences;
CREATE TRIGGER update_invoice_sequences_updated_at
  BEFORE UPDATE ON invoice_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get next invoice number (atomic operation)
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_prefix TEXT DEFAULT 'LL')
RETURNS TEXT AS $$
DECLARE
  v_year INTEGER;
  v_number INTEGER;
  v_invoice_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  
  -- Insert or update sequence (atomic with row lock)
  INSERT INTO invoice_sequences (prefix, year, current_number)
  VALUES (p_prefix, v_year, 1)
  ON CONFLICT (prefix, year)
  DO UPDATE SET current_number = invoice_sequences.current_number + 1
  RETURNING current_number INTO v_number;
  
  -- Format: LL-2024-0001
  v_invoice_number := p_prefix || '-' || v_year || '-' || LPAD(v_number::TEXT, 4, '0');
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to create invoice
CREATE OR REPLACE FUNCTION create_invoice(
  p_user_id TEXT,
  p_customer_email TEXT,
  p_customer_name TEXT DEFAULT NULL,
  p_line_items JSONB DEFAULT '[]',
  p_subtotal_cents INTEGER DEFAULT 0,
  p_tax_rate DECIMAL DEFAULT 19.00,
  p_payment_provider TEXT DEFAULT 'stripe',
  p_payment_id TEXT DEFAULT NULL,
  p_transaction_id UUID DEFAULT NULL,
  p_prefix TEXT DEFAULT 'LL'
)
RETURNS TABLE(invoice_id UUID, invoice_number TEXT) AS $$
DECLARE
  v_invoice_number TEXT;
  v_tax_amount_cents INTEGER;
  v_total_cents INTEGER;
  v_invoice_id UUID;
BEGIN
  -- Get next invoice number
  v_invoice_number := get_next_invoice_number(p_prefix);
  
  -- Calculate tax and total
  v_tax_amount_cents := ROUND(p_subtotal_cents * (p_tax_rate / 100))::INTEGER;
  v_total_cents := p_subtotal_cents + v_tax_amount_cents;
  
  -- Insert invoice
  INSERT INTO invoices (
    invoice_number,
    user_id,
    customer_email,
    customer_name,
    line_items,
    subtotal_cents,
    tax_rate,
    tax_amount_cents,
    total_cents,
    payment_provider,
    payment_id,
    transaction_id
  )
  VALUES (
    v_invoice_number,
    p_user_id,
    p_customer_email,
    p_customer_name,
    p_line_items,
    p_subtotal_cents,
    p_tax_rate,
    v_tax_amount_cents,
    v_total_cents,
    p_payment_provider,
    p_payment_id,
    p_transaction_id
  )
  RETURNING id INTO v_invoice_id;
  
  RETURN QUERY SELECT v_invoice_id, v_invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Users can only view their own invoices
CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true));

-- Service role can do everything
CREATE POLICY "Service role full access to invoices"
  ON invoices FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to sequences"
  ON invoice_sequences FOR ALL
  USING (auth.role() = 'service_role');

-- Company info table (for invoice header)
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_address TEXT NOT NULL,
  company_email TEXT,
  company_phone TEXT,
  company_website TEXT,
  tax_id TEXT, -- Steuernummer
  vat_id TEXT, -- USt-IdNr.
  bank_name TEXT,
  bank_iban TEXT,
  bank_bic TEXT,
  logo_url TEXT,
  invoice_prefix TEXT DEFAULT 'LL',
  invoice_footer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default company settings
INSERT INTO company_settings (
  company_name,
  company_address,
  company_email,
  tax_id,
  vat_id,
  invoice_prefix,
  invoice_footer
)
VALUES (
  'jaa.cool Media GmbH & Co. KG',
  'Großbeerenstr. 27A\n10965 Berlin\nDeutschland',
  'billing@jaa.cool',
  '', -- Steuernummer hier eintragen
  '', -- USt-IdNr. hier eintragen
  'LL',
  'Vielen Dank für Ihren Einkauf!'
)
ON CONFLICT DO NOTHING;

-- Service role access for company settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read company settings"
  ON company_settings FOR SELECT
  USING (true);

CREATE POLICY "Service role can update company settings"
  ON company_settings FOR ALL
  USING (auth.role() = 'service_role');
