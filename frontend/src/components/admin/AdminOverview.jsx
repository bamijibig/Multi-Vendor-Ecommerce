import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Landmark,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Wallet,
} from 'lucide-react';
import { adminCenterApi } from '../../services/adminCenter';
import { getErrorMessage } from '../../services/api';
import { Alert, Spinner } from '../ui/Ui';
import { formatPrice } from '../../lib/format';

function KpiCard({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-light text-brand',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    navy: 'bg-slate-100 text-navy',
  };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-navy">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export default function AdminOverview({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminCenterApi.overview());
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load platform overview.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Loading platform overview…" />;

  const kpis = data?.kpis || {};
  const alerts = data?.alerts || {};
  const statuses = kpis.orders_by_status || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-navy">Platform overview</h2>
          <p className="text-sm text-slate-500">Marketplace-wide sales, tax, vendors, and disputes.</p>
        </div>
        <button type="button" onClick={load} className="btn-outline px-3 py-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={ShoppingBag} label="Total GMV" value={formatPrice(kpis.total_gmv)} hint="Net of approved returns" />
        <KpiCard icon={Landmark} label="Platform commission" value={formatPrice(kpis.platform_commission)} hint="Commission net of reversals" tone="emerald" />
        <KpiCard icon={ShieldCheck} label="VAT collected" value={formatPrice(kpis.total_vat_collected)} hint="7.5% VAT on marketplace fees" tone="navy" />
        <KpiCard
          icon={Wallet}
          label="Pending vendor payouts"
          value={formatPrice(kpis.pending_vendor_payouts)}
          hint={`${alerts.pending_payout_requests ?? 0} request(s) awaiting disbursement`}
          tone="amber"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => alerts.pending_vendors && onNavigate('vendors')}
          className="card flex items-center justify-between gap-3 p-4 text-left transition hover:border-brand"
        >
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-navy">
              <Store className="h-4 w-4 text-amber-500" /> Pending vendors
            </span>
            <span className="mt-1 block text-xs text-slate-500">Awaiting onboarding approval</span>
          </span>
          <span className="text-2xl font-semibold text-navy">{alerts.pending_vendors ?? 0}</span>
        </button>

        <button
          type="button"
          onClick={() => alerts.open_return_disputes && onNavigate('orders')}
          className="card flex items-center justify-between gap-3 p-4 text-left transition hover:border-brand"
        >
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-navy">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Open return disputes
            </span>
            <span className="mt-1 block text-xs text-slate-500">Buyer requests needing review</span>
          </span>
          <span className="text-2xl font-semibold text-navy">{alerts.open_return_disputes ?? 0}</span>
        </button>

        <button
          type="button"
          onClick={() => alerts.pending_payout_requests && onNavigate('finance')}
          className="card flex items-center justify-between gap-3 p-4 text-left transition hover:border-brand"
        >
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-navy">
              <Banknote className="h-4 w-4 text-emerald-500" /> Pending payout requests
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {formatPrice(kpis.pending_payout_requests)} requested
            </span>
          </span>
          <span className="text-2xl font-semibold text-navy">{alerts.pending_payout_requests ?? 0}</span>
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-semibold text-navy">Orders by status</h3>
          </div>
          {statuses.length ? (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {statuses.map((row) => (
                  <tr key={row.status}>
                    <td className="px-4 py-3 text-slate-600">{row.status}</td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-8 text-sm text-slate-500">No orders yet.</p>
          )}
        </section>

        <section className="card p-5">
          <h3 className="flex items-center gap-2 font-semibold text-navy">
            <Store className="h-4 w-4 text-brand" /> Vendor health
          </h3>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Active stores</dt>
              <dd className="font-semibold text-emerald-600">{kpis.active_vendors ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Pending approval</dt>
              <dd className="font-semibold text-amber-600">{kpis.pending_vendors ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Suspended</dt>
              <dd className="font-semibold text-red-600">{kpis.suspended_vendors ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-3">
              <dt className="text-slate-500">Available vendor balance</dt>
              <dd className="font-semibold text-navy">
                {formatPrice(kpis.available_vendor_balance)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Open return disputes</dt>
              <dd className="font-semibold text-navy">{kpis.open_return_disputes ?? 0}</dd>
            </div>
          </dl>
          <button type="button" onClick={() => onNavigate('vendors')} className="btn-outline mt-4 w-full text-xs">
            Manage vendors
          </button>
        </section>
      </div>
    </div>
  );
}
