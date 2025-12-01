import React, { useState, useEffect } from 'react';
import { 
  getUserInvoices, 
  downloadInvoicePDF, 
  downloadDatevExport,
  formatCurrency, 
  formatDate,
  Invoice 
} from '../services/invoiceService';

interface InvoiceListProps {
  userId: string;
  isAdmin?: boolean;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ userId, isAdmin = false }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, [userId]);

  const loadInvoices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getUserInvoices(userId);
      setInvoices(data);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Rechnungen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    try {
      setDownloadingId(invoice.id);
      await downloadInvoicePDF(invoice.id, userId);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Herunterladen');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDatevExport = async () => {
    try {
      setIsExporting(true);
      setError(null);
      await downloadDatevExport(userId);
    } catch (err: any) {
      setError(err.message || 'Fehler beim DATEV-Export');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        <span className="ml-3 text-gray-400">Lade Rechnungen...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Meine Rechnungen
        </h3>
        
        {isAdmin && invoices.length > 0 && (
          <button
            onClick={handleDatevExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300"></div>
                Exportiere...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                DATEV Export
              </>
            )}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Empty State */}
      {invoices.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400">Noch keine Rechnungen vorhanden</p>
          <p className="text-gray-500 text-sm mt-1">Nach deinem ersten Kauf erscheinen hier deine Rechnungen</p>
        </div>
      ) : (
        /* Invoice List */
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Invoice Icon */}
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>

                  {/* Invoice Details */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{invoice.invoice_number}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        invoice.status === 'paid' 
                          ? 'bg-green-500/20 text-green-400' 
                          : invoice.status === 'refunded'
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {invoice.status === 'paid' ? 'Bezahlt' : 
                         invoice.status === 'refunded' ? 'Erstattet' : invoice.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-0.5">
                      <span>{formatDate(invoice.created_at)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {invoice.payment_provider === 'stripe' ? (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z"/>
                          </svg>
                        )}
                        {invoice.payment_provider === 'stripe' ? 'Stripe' : 'PayPal'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amount & Download */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold text-white">
                      {formatCurrency(invoice.total_cents, invoice.currency)}
                    </div>
                    <div className="text-xs text-gray-500">
                      inkl. {invoice.tax_rate}% MwSt.
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(invoice)}
                    disabled={downloadingId === invoice.id}
                    className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Rechnung herunterladen"
                  >
                    {downloadingId === invoice.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                </div>
              </div>

              {/* Line Items (collapsed by default, could be expandable) */}
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <div className="text-sm text-gray-400">
                  {(typeof invoice.line_items === 'string' 
                    ? JSON.parse(invoice.line_items) 
                    : invoice.line_items || []
                  ).map((item: any, idx: number) => (
                    <span key={idx}>{item.description}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoiceList;
