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

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  customer_email: string;
  customer_name: string | null;
  customer_company: string | null;
  customer_address: string | null;
  customer_vat_id: string | null;
  status: string;
  currency: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
  }>;
  subtotal_cents: number;
  tax_rate: number;
  tax_amount_cents: number;
  total_cents: number;
  payment_provider: string;
  payment_id: string;
  created_at: string;
}

interface CompanySettings {
  company_name: string;
  company_address: string;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  tax_id: string | null;
  vat_id: string | null;
  bank_name: string | null;
  bank_iban: string | null;
  bank_bic: string | null;
  invoice_footer: string | null;
}

function formatCurrency(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateString));
}

// Generate HTML invoice that can be converted to PDF
function generateInvoiceHTML(invoice: Invoice, company: CompanySettings): string {
  const lineItemsHTML = invoice.line_items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price_cents, invoice.currency)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.total_cents, invoice.currency)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rechnung ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #1f2937; }
    .invoice { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .company-info { text-align: right; }
    .company-name { font-size: 24px; font-weight: bold; color: #0891b2; margin-bottom: 8px; }
    .invoice-title { font-size: 32px; font-weight: bold; color: #1f2937; margin-bottom: 8px; }
    .invoice-number { font-size: 16px; color: #6b7280; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .address-block { width: 45%; }
    .address-label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
    .meta-info { margin-bottom: 40px; }
    .meta-row { display: flex; margin-bottom: 4px; }
    .meta-label { width: 150px; color: #6b7280; }
    .meta-value { font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
    th:nth-child(2) { text-align: center; }
    .totals { margin-left: auto; width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .total-row.final { border-top: 2px solid #1f2937; font-weight: bold; font-size: 18px; margin-top: 8px; padding-top: 16px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .footer-grid { display: flex; justify-content: space-between; }
    .footer-section { width: 30%; }
    .footer-label { font-weight: 600; margin-bottom: 4px; }
    .payment-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 500; }
    .payment-stripe { background: #e0f2fe; color: #0369a1; }
    .payment-paypal { background: #fef3c7; color: #92400e; }
    .status-paid { background: #d1fae5; color: #065f46; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        <div class="invoice-title">RECHNUNG</div>
        <div class="invoice-number">${invoice.invoice_number}</div>
      </div>
      <div class="company-info">
        <div class="company-name">${company.company_name}</div>
        <div>${company.company_address.replace(/\n/g, '<br>')}</div>
        ${company.company_email ? `<div>${company.company_email}</div>` : ''}
        ${company.company_website ? `<div>${company.company_website}</div>` : ''}
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <div class="address-label">Rechnungsempfänger</div>
        <div><strong>${invoice.customer_name || invoice.customer_email}</strong></div>
        ${invoice.customer_company ? `<div>${invoice.customer_company}</div>` : ''}
        ${invoice.customer_address ? `<div>${invoice.customer_address.replace(/\n/g, '<br>')}</div>` : ''}
        <div>${invoice.customer_email}</div>
        ${invoice.customer_vat_id ? `<div>USt-IdNr.: ${invoice.customer_vat_id}</div>` : ''}
      </div>
      <div class="address-block">
        <div class="address-label">Rechnungsdetails</div>
        <div class="meta-row">
          <span class="meta-label">Rechnungsnummer:</span>
          <span class="meta-value">${invoice.invoice_number}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Rechnungsdatum:</span>
          <span class="meta-value">${formatDate(invoice.created_at)}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Zahlungsart:</span>
          <span class="meta-value">
            <span class="payment-badge ${invoice.payment_provider === 'stripe' ? 'payment-stripe' : 'payment-paypal'}">
              ${invoice.payment_provider === 'stripe' ? 'Kreditkarte (Stripe)' : 'PayPal'}
            </span>
          </span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Status:</span>
          <span class="meta-value">
            <span class="payment-badge status-paid">Bezahlt</span>
          </span>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Beschreibung</th>
          <th>Menge</th>
          <th>Einzelpreis</th>
          <th>Gesamt</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Zwischensumme (netto):</span>
        <span>${formatCurrency(invoice.subtotal_cents, invoice.currency)}</span>
      </div>
      <div class="total-row">
        <span>MwSt. (${invoice.tax_rate}%):</span>
        <span>${formatCurrency(invoice.tax_amount_cents, invoice.currency)}</span>
      </div>
      <div class="total-row final">
        <span>Gesamtbetrag:</span>
        <span>${formatCurrency(invoice.total_cents, invoice.currency)}</span>
      </div>
    </div>

    <div class="footer">
      <div class="footer-grid">
        <div class="footer-section">
          <div class="footer-label">Steuernummer</div>
          <div>${company.tax_id || '-'}</div>
          ${company.vat_id ? `<div class="footer-label" style="margin-top: 8px;">USt-IdNr.</div><div>${company.vat_id}</div>` : ''}
        </div>
        ${company.bank_iban ? `
        <div class="footer-section">
          <div class="footer-label">Bankverbindung</div>
          ${company.bank_name ? `<div>${company.bank_name}</div>` : ''}
          <div>IBAN: ${company.bank_iban}</div>
          ${company.bank_bic ? `<div>BIC: ${company.bank_bic}</div>` : ''}
        </div>
        ` : ''}
        <div class="footer-section">
          ${company.invoice_footer ? `<div>${company.invoice_footer}</div>` : ''}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { invoiceId, userId } = await req.json();

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: 'Missing invoice ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns this invoice (if userId provided)
    if (userId && invoice.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company settings
    const { data: company, error: companyError } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: 'Company settings not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate HTML
    const html = generateInvoiceHTML(invoice as Invoice, company as CompanySettings);

    // Return HTML (client will convert to PDF using browser print or jsPDF)
    return new Response(
      JSON.stringify({ 
        success: true, 
        html,
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          created_at: invoice.created_at,
          total_cents: invoice.total_cents,
          currency: invoice.currency,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate invoice PDF error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
