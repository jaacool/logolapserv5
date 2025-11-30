-- User Credits Table
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Transactions Table (for history)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'bonus', 'refund')),
  amount INTEGER NOT NULL,
  description TEXT,
  payment_provider TEXT, -- 'stripe' or 'paypal'
  payment_id TEXT, -- Stripe session ID or PayPal order ID
  package_id TEXT, -- Reference to credit package
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON user_credits;
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to add credits (used after successful payment)
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id TEXT,
  p_amount INTEGER,
  p_type TEXT DEFAULT 'purchase',
  p_description TEXT DEFAULT NULL,
  p_payment_provider TEXT DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL,
  p_package_id TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Insert or update user credits
  INSERT INTO user_credits (user_id, credits)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET credits = user_credits.credits + p_amount;
  
  -- Get new balance
  SELECT credits INTO v_new_balance
  FROM user_credits
  WHERE user_id = p_user_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (user_id, type, amount, description, payment_provider, payment_id, package_id)
  VALUES (p_user_id, p_type, p_amount, p_description, p_payment_provider, p_payment_id, p_package_id);
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits (used when processing images)
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id TEXT,
  p_amount INTEGER,
  p_reason TEXT DEFAULT 'Image processing'
)
RETURNS INTEGER AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT credits INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id;
  
  -- Check if user has enough credits
  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Required: %, Available: %', p_amount, COALESCE(v_current_balance, 0);
  END IF;
  
  -- Deduct credits
  UPDATE user_credits
  SET credits = credits - p_amount
  WHERE user_id = p_user_id
  RETURNING credits INTO v_new_balance;
  
  -- Record transaction (negative amount for usage)
  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'usage', -p_amount, p_reason);
  
  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see their own data
CREATE POLICY "Users can view own credits"
  ON user_credits FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can view own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true));

-- Service role can do everything (for Edge Functions)
CREATE POLICY "Service role full access to credits"
  ON user_credits FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to transactions"
  ON credit_transactions FOR ALL
  USING (auth.role() = 'service_role');
