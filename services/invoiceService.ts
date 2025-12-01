import { supabase } from './supabaseClient';

export interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  customer_email: string;
  customer_name: string | null;
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
  payment_provider: 'stripe' | 'paypal';
  payment_id: string;
  pdf_url: string | null;
  created_at: string;
}

/**
 * Get all invoices for a user
 */
export async function getUserInvoices(userId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single invoice by ID
 */
export async function getInvoice(invoiceId: string, userId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching invoice:', error);
    return null;
  }

  return data;
}

/**
 * Generate and download invoice PDF
 */
export async function downloadInvoicePDF(invoiceId: string, userId: string): Promise<void> {
  try {
    // Call the edge function to get HTML
    const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
      body: { invoiceId, userId },
    });

    if (error) {
      throw error;
    }

    if (!data?.html) {
      throw new Error('No HTML returned from server');
    }

    // Open HTML in new window for printing/saving as PDF
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(data.html);
      printWindow.document.close();
      
      // Wait for content to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    } else {
      // Fallback: download as HTML file
      const blob = new Blob([data.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rechnung_${data.invoice?.invoice_number || invoiceId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Error downloading invoice:', error);
    throw error;
  }
}

/**
 * Format currency for display
 */
export function formatCurrency(cents: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateString));
}

/**
 * Export invoices to DATEV format (CSV)
 */
export async function exportToDatev(userId: string, startDate?: Date, endDate?: Date): Promise<string> {
  let query = supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data: invoices, error } = await query;

  if (error) {
    throw error;
  }

  if (!invoices || invoices.length === 0) {
    throw new Error('Keine Rechnungen im ausgewählten Zeitraum');
  }

  // DATEV CSV format headers
  const headers = [
    'Umsatz (ohne Soll/Haben-Kz)',
    'Soll/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Kurs',
    'Basis-Umsatz',
    'WKZ Basis-Umsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel',
    'Belegdatum',
    'Belegfeld 1',
    'Belegfeld 2',
    'Skonto',
    'Buchungstext',
  ];

  const rows = invoices.map((inv: Invoice) => {
    const date = new Date(inv.created_at);
    const belegdatum = `${date.getDate().toString().padStart(2, '0')}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    return [
      (inv.total_cents / 100).toFixed(2).replace('.', ','), // Umsatz
      'S', // Soll
      'EUR', // Währung
      '', // Kurs
      '', // Basis-Umsatz
      '', // WKZ Basis-Umsatz
      '8400', // Erlöskonto (19% USt)
      '10000', // Debitorenkonto (Sammelkonto)
      '', // BU-Schlüssel
      belegdatum, // Belegdatum TTMM
      inv.invoice_number, // Belegfeld 1 (Rechnungsnummer)
      inv.payment_provider, // Belegfeld 2
      '', // Skonto
      `Credits ${inv.line_items[0]?.description || ''}`, // Buchungstext
    ];
  });

  // Build CSV
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';')),
  ].join('\n');

  return csvContent;
}

/**
 * Download DATEV export as CSV file
 */
export async function downloadDatevExport(userId: string, startDate?: Date, endDate?: Date): Promise<void> {
  const csv = await exportToDatev(userId, startDate, endDate);
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const now = new Date();
  const filename = `DATEV_Export_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}.csv`;
  
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
