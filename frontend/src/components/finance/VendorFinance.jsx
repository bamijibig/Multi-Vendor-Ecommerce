import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { financeApi } from '../../services/finance';
import { getErrorMessage } from '../../services/api';
import { Alert } from '../ui/Ui';
import { formatDate, formatPrice } from '../../lib/format';

export default function VendorFinance() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ start: '', end: '', payout_status: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await financeApi.statement(filters);
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the finance statement.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportCsv() {
    try {
      const blob = await financeApi.exportStatement(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'vendor-statement.csv';
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not export the statement.'));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading finance…</p>;

  const balances = data?.balances || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-navy">Finance & statements</h2>
        <button type="button" onClick={exportCsv} className="btn-outline">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-slate-400">Pending clearance</p>
          <p className="mt-2 text-xl font-semibold">{formatPrice(balances.pending_clearance || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">Available for payout</p>
          <p className="mt-2 text-xl font-semibold">{formatPrice(balances.available_for_payout || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">Total paid</p>
          <p className="mt-2 text-xl font-semibold">{formatPrice(balances.total_paid || 0)}</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            type="date"
            className="input"
            value={filters.start}
            onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))}
          />
          <input
            type="date"
            className="input"
            value={filters.end}
            onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))}
          />
          <select
            className="input"
            value={filters.payout_status}
            onChange={(e) => setFilters((f) => ({ ...f, payout_status: e.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="PENDING_CLEARANCE">Pending clearance</option>
            <option value="AVAILABLE_FOR_PAYOUT">Available</option>
            <option value="PAID">Paid</option>
            <option value="REVERSED_ON_RETURN">Reversed</option>
          </select>
          <button type="button" onClick={load} className="btn-dark">
            Apply
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Gross</th>
              <th className="px-3 py-2">Commission</th>
              <th className="px-3 py-2">VAT on fee</th>
              <th className="px-3 py-2">Shipping</th>
              <th className="px-3 py-2">Net</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(data?.rows || []).map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-xs">{formatDate(row.created_at)}</td>
                <td className="px-3 py-2">{row.completed_order}</td>
                <td className="px-3 py-2">{row.product?.title || '—'}</td>
                <td className="px-3 py-2">{formatPrice(row.gross_item_amount)}</td>
                <td className="px-3 py-2">{formatPrice(row.commission_amount)}</td>
                <td className="px-3 py-2">{formatPrice(row.vat_on_commission)}</td>
                <td className="px-3 py-2">{formatPrice(row.shipping_fee_deduction)}</td>
                <td className="px-3 py-2 font-medium">{formatPrice(row.net_vendor_earning)}</td>
                <td className="px-3 py-2 text-xs">{row.payout_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}