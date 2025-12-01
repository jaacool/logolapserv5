import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateInvoiceParams {
  userId: string;
  customerEmail: string;
  customerName?: string;
  packageId: string;
  packageName: string;
  credits: number;
  amountCents: number;
  paymentProvider: 'stripe' | 'paypal';
  paymentId: string;
  transactionId?: string;
}

// Credit packages with prices (should match your frontend)
const CREDIT_PACKAGES: Record<string, { name: string; credits: number; price: number }> = {
  'starter': { name: 'Starter Pack', credits: 50, price: 4.99 },
  'basic': { name: 'Basic Pack', credits: 150, price: 9.99 },
  'pro': { name: 'Pro Pack', credits: 500, price: 24.99 },
  'enterprise': { name: 'Enterprise Pack', credits: 2000, price: 79.99 },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const params: CreateInvoiceParams = await req.json();
    
    const {
      userId,
      customerEmail,
      customerName,
      packageId,
      packageName,
      credits,
      amountCents,
      paymentProvider,
      paymentId,
      transactionId,
    } = params;

    // Validate required fields
    if (!userId || !customerEmail || !paymentId || !amountCents) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invoice already exists for this payment
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .eq('payment_id', paymentId)
      .maybeSingle();

    if (existingInvoice) {
      console.log('Invoice already exists for payment:', paymentId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          invoiceId: existingInvoice.id,
          invoiceNumber: existingInvoice.invoice_number,
          message: 'Invoice already exists' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get package info
    const pkg = CREDIT_PACKAGES[packageId] || { 
      name: packageName || 'Credit Package', 
      credits, 
      price: amountCents / 100 
    };

    // Create line items
    const lineItems = [
      {
        description: `${pkg.name} - ${credits} Credits`,
        quantity: 1,
        unit_price_cents: amountCents,
        total_cents: amountCents,
      }
    ];

    // Calculate amounts (price is already including tax for B2C in Germany)
    // For simplicity, we calculate backwards: total = net + 19% VAT
    // net = total / 1.19
    const subtotalCents = Math.round(amountCents / 1.19);
    const taxRate = 19.00;

    // Create invoice using the database function
    const { data: invoiceResult, error: invoiceError } = await supabase.rpc('create_invoice', {
      p_user_id: userId,
      p_customer_email: customerEmail,
      p_customer_name: customerName || null,
      p_line_items: JSON.stringify(lineItems),
      p_subtotal_cents: subtotalCents,
      p_tax_rate: taxRate,
      p_payment_provider: paymentProvider,
      p_payment_id: paymentId,
      p_transaction_id: transactionId || null,
      p_prefix: 'LL',
    });

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invoice', details: invoiceError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const invoice = invoiceResult[0];
    console.log('Invoice created:', invoice.invoice_number);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoiceId: invoice.invoice_id,
        invoiceNumber: invoice.invoice_number,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Create invoice error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
