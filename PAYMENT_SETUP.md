# Payment System Setup Guide

## Overview
LogoLapser uses Supabase for backend + Stripe/PayPal for payments.

## 1. Database Setup (Supabase)

Go to your Supabase Dashboard → SQL Editor and run the migration:

```sql
-- Copy contents from: supabase/migrations/001_create_credits_tables.sql
```

This creates:
- `user_credits` table (stores user credit balances)
- `credit_transactions` table (payment history)
- `add_credits()` function (called after successful payment)
- `deduct_credits()` function (called when processing images)

## 2. Deploy Edge Functions

### Install Supabase CLI
```bash
npm install -g supabase
```

### Login and link project
```bash
supabase login
supabase link --project-ref ohxhkpcwvvodrmkaixwb
```

### Set secrets for Edge Functions
```bash
# Stripe (get from Stripe Dashboard)
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx

# Stripe Webhook Secret (get this from Stripe Dashboard after creating webhook)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# PayPal (get from PayPal Developer Dashboard)
supabase secrets set PAYPAL_CLIENT_ID=your_paypal_client_id
supabase secrets set PAYPAL_CLIENT_SECRET=your_paypal_client_secret
supabase secrets set PAYPAL_MODE=sandbox  # Change to 'live' for production
```

### Deploy functions
```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy create-paypal-order
supabase functions deploy capture-paypal-order
```

## 3. Stripe Webhook Setup

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter URL: `https://ohxhkpcwvvodrmkaixwb.supabase.co/functions/v1/stripe-webhook`
4. Select event: `checkout.session.completed`
5. Copy the "Signing secret" and set it as `STRIPE_WEBHOOK_SECRET`

## 4. PayPal Setup (Optional)

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create a new app or use existing
3. Copy Client ID and Secret
4. Set them as Supabase secrets (see above)

## 5. Environment Variables

Make sure `.env.local` has:
```
VITE_SUPABASE_URL=https://ohxhkpcwvvodrmkaixwb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SZAeNDhnNxXcLJC...
```

## 6. Testing

### Test Stripe Payment
Use test card: `4242 4242 4242 4242`
- Any future expiry date
- Any 3-digit CVC
- Any billing address

### Test PayPal
Use PayPal sandbox accounts from the Developer Dashboard.

## Going Live

1. Replace Stripe test keys with live keys
2. Replace PayPal sandbox credentials with live credentials
3. Update `PAYPAL_MODE` to `live`
4. Test with real small payment first!

## Credit Packages

| Package | Credits | Price | Per Credit |
|---------|---------|-------|------------|
| Starter | 30 | €2.99 | €0.10 |
| Standard | 100 | €7.99 | €0.08 |
| Pro | 300 | €19.99 | €0.067 |
| Premium | 1000 | €49.99 | €0.05 |

## 7. Invoice System (Rechnungen)

### Database Setup
Run the second migration for invoices:
```sql
-- Copy contents from: supabase/migrations/002_create_invoice_tables.sql
```

This creates:
- `invoices` table (stores all invoices)
- `invoice_sequences` table (manages invoice number sequences per prefix)
- `company_settings` table (your company info for invoice header)
- `get_next_invoice_number()` function (atomic invoice number generation)
- `create_invoice()` function (creates invoice with all data)

### Update Company Settings
After running the migration, update your company info:
```sql
UPDATE company_settings SET
  company_name = 'Your Company GmbH',
  company_address = 'Musterstraße 123
12345 Musterstadt
Deutschland',
  company_email = 'billing@yourcompany.com',
  tax_id = '123/456/78901',
  vat_id = 'DE123456789',
  bank_name = 'Your Bank',
  bank_iban = 'DE89 3704 0044 0532 0130 00',
  bank_bic = 'COBADEFFXXX',
  invoice_footer = 'Vielen Dank für Ihren Einkauf!'
WHERE id = (SELECT id FROM company_settings LIMIT 1);
```

### Deploy Invoice Functions
```bash
supabase functions deploy create-invoice
supabase functions deploy generate-invoice-pdf
```

### Features
- **Automatic Invoice Creation**: Invoices are created automatically after successful Stripe/PayPal payment
- **Separate Number Ranges**: Uses prefix "LL" for LogoLapser (e.g., LL-2024-0001)
- **PDF Download**: Users can download invoices as PDF from "Meine Rechnungen" in the user menu
- **DATEV Export**: Admins can export all invoices as DATEV-compatible CSV for accounting

### Invoice Number Format
`LL-YYYY-NNNN`
- `LL` = Prefix (configurable per business area)
- `YYYY` = Year
- `NNNN` = Sequential number (resets each year)

### Legal Compliance (Germany)
- Separate number ranges per business area are allowed
- Each range must be sequential and gap-free
- 10-year retention requirement (stored in Supabase)
- All required invoice fields included (§14 UStG)
