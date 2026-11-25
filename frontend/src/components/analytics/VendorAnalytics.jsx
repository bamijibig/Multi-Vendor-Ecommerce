import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '../../services/analytics';
import { getErrorMessage } from '../../services/api';
import { Alert } from '../ui/Ui';
import { formatPrice } from '../../lib/format';

export default function VendorAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await analyticsApi.vendorDashboard({ range });
      setData(result);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load analytics.'));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">Loading analytics…</p>;

  const score = data?.seller_score || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-navy">Analytics</h2>
        <select className="input w-32" value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="90d">90 days</option>
        </select>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-slate-400">GMV</p>
          <p className="mt-2 text-xl font-semibold">{formatPrice(data?.gmv || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">Net earnings</p>
          <p className="mt-2 text-xl font-semibold">{formatPrice(data?.net_earnings || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">Units sold</p>
          <p className="mt-2 text-xl font-semibold">{data?.units_sold ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">Avg order value</p>
          <p className="mt-2 text-xl font-semibold">{formatPrice(data?.average_order_value || 0)}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold text-navy">View-to-order funnel</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Product views</dt>
              <dd className="font-medium">{data?.funnel?.product_views ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Orders</dt>
              <dd className="font-medium">{data?.funnel?.orders ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Conversion rate</dt>
              <dd className="font-medium">{data?.funnel?.conversion_rate ?? 0}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Growth</dt>
              <dd className="font-medium">{data?.growth_percent ?? 0}%</dd>
            </div>
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-navy">Seller score</h3>
          <p className="mt-2 text-3xl font-bold text-brand">{score.score ?? 0}/5.0</p>
          <p className="text-xs text-slate-500">Average rating: {score.average_rating ?? 0}</p>
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            <li>Cancellation: {score.penalties?.cancellation ?? 0}</li>
            <li>Late shipment: {score.penalties?.late_shipment ?? 0}</li>
            <li>Returns: {score.penalties?.returns ?? 0}</li>
            <li>Reviews: {score.penalties?.reviews ?? 0}</li>
          </ul>
          {score.warnings?.length ? (
            <ul className="mt-3 space-y-1 text-xs text-amber-700">
              {score.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="font-semibold text-navy">Top SKUs</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {(data?.top_skus || []).map((sku) => (
              <li key={sku.product_id} className="flex justify-between">
                <span className="line-clamp-1">{sku.title}</span>
                <span className="font-medium">{formatPrice(sku.revenue)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-navy">Low stock</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {(data?.low_stock_skus || []).map((sku) => (
              <li key={sku.product_id} className="flex justify-between">
                <span className="line-clamp-1">{sku.title}</span>
                <span className="text-red-600">{sku.stock} left</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-navy">High returns</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {(data?.high_return_skus || []).map((sku) => (
              <li key={sku.product_id} className="flex justify-between">
                <span className="line-clamp-1">{sku.title}</span>
                <span className="text-amber-700">{sku.returns}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}