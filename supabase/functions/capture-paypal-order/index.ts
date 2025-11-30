import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID') || '';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET') || '';
const PAYPAL_API_URL = Deno.env.get('PAYPAL_MODE') === 'live' 
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getPayPalAccessToken(): Promise<string> {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  
  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing order ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this order was already processed (prevent duplicate credits)
    const { data: existingTransaction } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('payment_id', orderId)
      .maybeSingle();

    if (existingTransaction) {
      console.log('Order already processed:', orderId);
      return new Response(
        JSON.stringify({ success: true, message: 'Order already processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = await getPayPalAccessToken();

    // Capture the order
    const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await response.json();

    if (!response.ok || captureData.status !== 'COMPLETED') {
      console.error('PayPal capture failed:', captureData);
      return new Response(
        JSON.stringify({ error: 'Payment capture failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract custom data from the order
    const customId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id 
      || captureData.purchase_units?.[0]?.custom_id;
    
    let orderData = { userId: '', packageId: 'unknown', credits: 0 };
    try {
      orderData = JSON.parse(customId);
    } catch (e) {
      console.warn('Could not parse custom_id:', customId);
    }

    const credits = orderData.credits;
    const finalUserId = orderData.userId;

    if (credits > 0 && finalUserId) {
      // Add credits to user account
      const { data, error } = await supabase.rpc('add_credits', {
        p_user_id: finalUserId,
        p_amount: credits,
        p_type: 'purchase',
        p_description: `Purchased ${credits} credits via PayPal`,
        p_payment_provider: 'paypal',
        p_payment_id: orderId,
        p_package_id: orderData.packageId,
      });

      if (error) {
        console.error('Error adding credits:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to add credits' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Added ${credits} credits to user ${finalUserId}. New balance: ${data}`);

      return new Response(
        JSON.stringify({ success: true, credits, newBalance: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'No credits to add' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('PayPal capture error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
