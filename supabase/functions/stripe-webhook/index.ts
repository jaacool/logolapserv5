import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

// Credit packages with prices
const CREDIT_PACKAGES: Record<string, { name: string; credits: number; priceCents: number }> = {
  'starter': { name: 'Starter Pack', credits: 50, priceCents: 499 },
  'basic': { name: 'Basic Pack', credits: 150, priceCents: 999 },
  'pro': { name: 'Pro Pack', credits: 500, priceCents: 2499 },
  'enterprise': { name: 'Enterprise Pack', credits: 2000, priceCents: 7999 },
};

// Manual signature verification to avoid Stripe SDK issues
async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const parts = signature.split(',');
    let timestamp = '';
    let sig = '';
    
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') sig = value;
    }
    
    if (!timestamp || !sig) return false;
    
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return sig === expectedSig;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  console.log('Webhook received, signature present:', !!signature);
  console.log('Endpoint secret present:', !!endpointSecret);

  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature' }), { status: 400 });
  }

  const isValid = await verifyStripeSignature(body, signature, endpointSecret);
  
  if (!isValid) {
    console.error('Webhook signature verification failed');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
  }

  const event = JSON.parse(body);
  console.log('Event type:', event.type);

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    const userId = session.metadata?.userId;
    const packageId = session.metadata?.packageId;
    const credits = parseInt(session.metadata?.credits || '0', 10);

    console.log('Processing payment:', { userId, packageId, credits });

    if (userId && credits > 0) {
      try {
        // Check if this payment was already processed (prevent duplicate credits)
        const { data: existingTransaction } = await supabase
          .from('credit_transactions')
          .select('id')
          .eq('payment_id', session.id)
          .maybeSingle();

        if (existingTransaction) {
          console.log('Payment already processed:', session.id);
          return new Response(JSON.stringify({ received: true, message: 'Already processed' }), { status: 200 });
        }

        // Add credits to user account
        const { data, error } = await supabase.rpc('add_credits', {
          p_user_id: userId,
          p_amount: credits,
          p_type: 'purchase',
          p_description: `Purchased ${credits} credits (${packageId})`,
          p_payment_provider: 'stripe',
          p_payment_id: session.id,
          p_package_id: packageId,
        });

        if (error) {
          console.error('Error adding credits:', error);
          return new Response(JSON.stringify({ error: 'Failed to add credits' }), { status: 500 });
        }

        console.log(`Added ${credits} credits to user ${userId}. New balance: ${data}`);

        // Create invoice for this purchase
        try {
          const pkg = CREDIT_PACKAGES[packageId] || { 
            name: 'Credit Package', 
            credits, 
            priceCents: session.amount_total || 0 
          };

          const lineItems = [{
            description: `${pkg.name} - ${credits} Credits`,
            quantity: 1,
            unit_price_cents: session.amount_total || pkg.priceCents,
            total_cents: session.amount_total || pkg.priceCents,
          }];

          // Calculate net amount (price includes 19% VAT)
          const totalCents = session.amount_total || pkg.priceCents;
          const subtotalCents = Math.round(totalCents / 1.19);

          const { data: invoiceResult, error: invoiceError } = await supabase.rpc('create_invoice', {
            p_user_id: userId,
            p_customer_email: session.customer_email || session.customer_details?.email || 'unknown@email.com',
            p_customer_name: session.customer_details?.name || null,
            p_line_items: JSON.stringify(lineItems),
            p_subtotal_cents: subtotalCents,
            p_tax_rate: 19.00,
            p_payment_provider: 'stripe',
            p_payment_id: session.id,
            p_transaction_id: null,
            p_prefix: 'LL',
          });

          if (invoiceError) {
            console.error('Error creating invoice:', invoiceError);
          } else {
            console.log('Invoice created:', invoiceResult?.[0]?.invoice_number);
          }
        } catch (invoiceErr) {
          console.error('Invoice creation error:', invoiceErr);
          // Don't fail the webhook if invoice creation fails
        }
      } catch (err) {
        console.error('Database error:', err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
