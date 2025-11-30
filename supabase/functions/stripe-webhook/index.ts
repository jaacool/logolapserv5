import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

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
      } catch (err) {
        console.error('Database error:', err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
