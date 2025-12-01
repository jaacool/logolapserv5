-- Referral System Tables
-- Each user can generate ONE personal referral code
-- Code can be used by unlimited new users (but each user only once, on first purchase)
-- Referrer gets 50 credits per successful referral
-- New user gets 20% bonus credits on their first purchase

-- Referral Codes Table (one per user)
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,  -- Owner of this referral code
  code TEXT UNIQUE NOT NULL,     -- The actual referral code (contains part of email)
  total_uses INTEGER NOT NULL DEFAULT 0,  -- How many times this code was used
  total_credits_earned INTEGER NOT NULL DEFAULT 0,  -- Total credits earned from referrals
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral Redemptions Table (tracks who used which code)
CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id),
  referred_user_id TEXT UNIQUE NOT NULL,  -- UNIQUE: each user can only redeem once ever
  package_id TEXT NOT NULL,               -- Which package was purchased
  credits_purchased INTEGER NOT NULL,     -- Base credits from package
  bonus_credits INTEGER NOT NULL,         -- 20% bonus credits given
  referrer_credits INTEGER NOT NULL DEFAULT 50,  -- Credits given to referrer
  payment_id TEXT,                         -- Payment reference
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_code_id ON referral_redemptions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_redemptions_referred_user ON referral_redemptions(referred_user_id);

-- Trigger to auto-update updated_at on referral_codes
DROP TRIGGER IF EXISTS update_referral_codes_updated_at ON referral_codes;
CREATE TRIGGER update_referral_codes_updated_at
  BEFORE UPDATE ON referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate a referral code for a user
-- Code format: REF-{first 4 chars of email}-{random 6 chars}
CREATE OR REPLACE FUNCTION generate_referral_code(
  p_user_id TEXT,
  p_user_email TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_email_part TEXT;
  v_random_part TEXT;
  v_existing_code TEXT;
BEGIN
  -- Check if user already has a code
  SELECT code INTO v_existing_code
  FROM referral_codes
  WHERE user_id = p_user_id;
  
  IF v_existing_code IS NOT NULL THEN
    RETURN v_existing_code;  -- Return existing code
  END IF;
  
  -- Extract first 4 chars of email (before @), uppercase
  v_email_part := UPPER(SUBSTRING(SPLIT_PART(p_user_email, '@', 1) FROM 1 FOR 4));
  
  -- Generate random 6-char alphanumeric string
  v_random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 6));
  
  -- Combine to create code
  v_code := 'REF-' || v_email_part || '-' || v_random_part;
  
  -- Insert the new code
  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, v_code);
  
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate a referral code
-- Returns: code info if valid, null if invalid or user already used a code
CREATE OR REPLACE FUNCTION validate_referral_code(
  p_code TEXT,
  p_user_id TEXT
)
RETURNS TABLE (
  is_valid BOOLEAN,
  referral_code_id UUID,
  referrer_user_id TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_code_record RECORD;
  v_already_used BOOLEAN;
BEGIN
  -- Check if user has already used ANY referral code
  SELECT EXISTS(
    SELECT 1 FROM referral_redemptions WHERE referred_user_id = p_user_id
  ) INTO v_already_used;
  
  IF v_already_used THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'You have already used a referral code';
    RETURN;
  END IF;
  
  -- Find the referral code
  SELECT * INTO v_code_record
  FROM referral_codes
  WHERE code = UPPER(TRIM(p_code));
  
  IF v_code_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'Invalid referral code';
    RETURN;
  END IF;
  
  -- Check if user is trying to use their own code
  IF v_code_record.user_id = p_user_id THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 'You cannot use your own referral code';
    RETURN;
  END IF;
  
  -- Code is valid
  RETURN QUERY SELECT true, v_code_record.id, v_code_record.user_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process a referral after successful payment
-- Called by payment webhooks after credits are added
CREATE OR REPLACE FUNCTION process_referral(
  p_referral_code_id UUID,
  p_referred_user_id TEXT,
  p_package_id TEXT,
  p_credits_purchased INTEGER,
  p_payment_id TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  bonus_credits INTEGER,
  referrer_credits INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_code_record RECORD;
  v_bonus INTEGER;
  v_referrer_bonus INTEGER := 50;  -- Fixed 50 credits for referrer
BEGIN
  -- Calculate 20% bonus for the new user
  v_bonus := FLOOR(p_credits_purchased * 0.20);
  
  -- Get the referral code info
  SELECT * INTO v_code_record
  FROM referral_codes
  WHERE id = p_referral_code_id;
  
  IF v_code_record IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 'Referral code not found';
    RETURN;
  END IF;
  
  -- Check if this user already redeemed (double-check)
  IF EXISTS(SELECT 1 FROM referral_redemptions WHERE referred_user_id = p_referred_user_id) THEN
    RETURN QUERY SELECT false, 0, 0, 'User already redeemed a referral';
    RETURN;
  END IF;
  
  -- Record the redemption
  INSERT INTO referral_redemptions (
    referral_code_id,
    referred_user_id,
    package_id,
    credits_purchased,
    bonus_credits,
    referrer_credits,
    payment_id
  ) VALUES (
    p_referral_code_id,
    p_referred_user_id,
    p_package_id,
    p_credits_purchased,
    v_bonus,
    v_referrer_bonus,
    p_payment_id
  );
  
  -- Update referral code stats
  UPDATE referral_codes
  SET 
    total_uses = total_uses + 1,
    total_credits_earned = total_credits_earned + v_referrer_bonus
  WHERE id = p_referral_code_id;
  
  -- Add bonus credits to the new user
  PERFORM add_credits(
    p_referred_user_id,
    v_bonus,
    'bonus',
    'Referral bonus (20% of first purchase)',
    NULL,
    p_payment_id,
    NULL
  );
  
  -- Add credits to the referrer
  PERFORM add_credits(
    v_code_record.user_id,
    v_referrer_bonus,
    'bonus',
    'Referral reward - new user signed up',
    NULL,
    p_payment_id,
    NULL
  );
  
  RETURN QUERY SELECT true, v_bonus, v_referrer_bonus, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get referral stats for a user
CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id TEXT)
RETURNS TABLE (
  has_code BOOLEAN,
  code TEXT,
  total_referrals INTEGER,
  total_credits_earned INTEGER,
  can_use_referral BOOLEAN
) AS $$
DECLARE
  v_code_record RECORD;
  v_can_use BOOLEAN;
BEGIN
  -- Get user's referral code if exists
  SELECT * INTO v_code_record
  FROM referral_codes
  WHERE user_id = p_user_id;
  
  -- Check if user can still use a referral code (hasn't used one yet)
  SELECT NOT EXISTS(
    SELECT 1 FROM referral_redemptions WHERE referred_user_id = p_user_id
  ) INTO v_can_use;
  
  IF v_code_record IS NOT NULL THEN
    RETURN QUERY SELECT 
      true,
      v_code_record.code,
      v_code_record.total_uses,
      v_code_record.total_credits_earned,
      v_can_use;
  ELSE
    RETURN QUERY SELECT 
      false,
      NULL::TEXT,
      0,
      0,
      v_can_use;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_redemptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own referral code
CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = current_setting('app.current_user_id', true));

-- Users can view their own redemptions
CREATE POLICY "Users can view own redemptions"
  ON referral_redemptions FOR SELECT
  USING (auth.uid()::text = referred_user_id OR referred_user_id = current_setting('app.current_user_id', true));

-- Service role full access
CREATE POLICY "Service role full access to referral_codes"
  ON referral_codes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to referral_redemptions"
  ON referral_redemptions FOR ALL
  USING (auth.role() = 'service_role');
