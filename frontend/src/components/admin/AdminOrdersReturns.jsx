import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Search,
  ShoppingBag,
  X,
  XCircle,
} from 'lucide-react';
import { adminCenterApi } from '../../services/adminCenter';
import { getErrorMessage } from '../../services/api';
import { Alert, EmptyState, Pagination, Spinner, StatusBadge } from '../ui/Ui';
import { formatDate, formatPrice } from '../../lib/format';

const RETURN_TONES = {
  REQUESTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-600',
};

function ReturnModal({ item, onClose, onResolved }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function resolve(action) {
    setBusy(true);
    setError('');
    try {
      await adminCenterApi.resolveReturn(item.id, {
        action,
        note: note.trim(),
      });
      onResolved(action);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not resolve this return.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Return dispute</p>
            <h3 className="font-semibold text-navy">{item.order_number}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="font-medium text-navy">{item.product_title}</p>
            <p className="text-xs text-slate-500">
              {item.vendor_store?.name || 'Vendor'} · Qty {item.quantity} · {formatPrice(item.total_price)}
            </p>
          </div>
          <p>
            <span className="text-slate-500">Buyer:</span>{' '}
            <span className="text-slate-700">{item.customer_name} ({item.customer_email})</span>
          </p>
          <p>
            <span className="text-slate-500">Reason:</span>{' '}
            <span className="text-slate-700">{item.return_reason || 'No reason supplied'}</span>
          </p>
          <div>
            <label className="label" htmlFor="return-note">Resolution note</label>
            <textarea
              id="return-note"
              rows={3}
              className="input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add a note for the vendor and buyer…"
            />
          </div>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Approving reverses the vendor's delivery ledger entry and marks the item refunded.
          </p>
          {error && <Alert>{error}</Alert>}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>Cancel</button>
          <button
            type="button"
            onClick={() => resolve('reject')}
            disabled={busy}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <XCircle className="mr-1 inline h-4 w-4" /> Reject return
          </button>
          <button type="button" onClick={() => resolve('approve')} disabled={busy} className="btn-primary">
            <CheckCircle2 className="mr-1 inline h-4 w-4" /> Approve refund
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminOrdersReturns() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [counts, setCounts] = useState({});
  const [meta, setMeta] = useState({ count: 0, num_pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (nextPage = 1, term = '', quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const data = await adminCenterApi.orders({
        page: nextPage,
        search: term || undefined,
      });
      setOrders(data.results || []);
      setReturns(data.returns || []);
      setCounts(data.return_counts || {});
      setMeta({ count: data.count || 0, num_pages: data.num_pages || 1 });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load orders and returns.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    load(1, search);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    load(nextPage, search);
  }

  function resolved(action) {
    setSelected(null);
    setNotice(
      action === 'approve'
        ? 'Return approved. Vendor ledger reversed and refund marked.'
        : 'Return rejected. No ledger reversal was made.'
    );
    load(page, search, true);
  }

  const openDisputes = returns.filter((item) => item.return_status === 'REQUESTED');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy">Orders & returns</h2>
          <p className="text-sm text-slate-500">Monitor cross-vendor orders and resolve buyer return disputes.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="badge bg-amber-50 text-amber-700">{counts.requested ?? 0} open</span>
          <span className="badge bg-emerald-50 text-emerald-700">{counts.approved ?? 0} approved</span>
          <span className="badge bg-red-50 text-red-600">{counts.rejected ?? 0} rejected</span>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}

      <form onSubmit={submitSearch} className="flex gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, buyer, product, vendor…"
            aria-label="Search orders and returns"
          />
        </div>
        <button type="submit" className="btn-dark shrink-0">Search</button>
      </form>

      {loading ? (
        <Spinner label="Loading orders and returns…" />
      ) : (
        <>
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="flex items-center gap-2 font-semibold text-navy">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Return disputes
              </h3>
              <span className="text-xs text-slate-400">{openDisputes.length} awaiting a decision</span>
            </div>
            {returns.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Order / item</th>
                      <th className="px-4 py-3">Buyer</th>
                      <th className="px-4 py-3">Vendor</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Return</th>
                      <th className="px-4 py-3">Refund</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {returns.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-navy">{item.order_number}</p>
                          <p className="max-w-[240px] truncate text-xs text-slate-400">{item.product_title}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700">{item.customer_name}</p>
                          <p className="text-xs text-slate-400">{item.customer_email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.vendor_store?.name || '—'}</td>
                        <td className="px-4 py-3 font-medium">{formatPrice(item.total_price)}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${RETURN_TONES[item.return_status] || 'bg-slate-100 text-slate-600'}`}>
                            {item.return_status_display}
                          </span>
                          {item.return_reason && (
                            <p className="mt-1 max-w-[220px] text-xs text-slate-400">{item.return_reason}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{item.refund_status_display}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            {item.return_status === 'REQUESTED' ? (
                              <button
                                type="button"
                                onClick={() => setSelected(item)}
                                className="btn-outline px-3 py-1.5 text-xs"
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Review
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {item.return_resolved_at ? formatDate(item.return_resolved_at) : 'Resolved'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-8 text-sm text-slate-500">No return disputes have been raised.</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-navy">
              <ShoppingBag className="h-4 w-4 text-brand" /> Platform orders ({meta.count})
            </h3>
            {orders.length ? (
              <>
                <div className="card overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Items</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Paid</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Placed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-4 py-3 font-medium text-navy">{order.order_number}</td>
                          <td className="px-4 py-3">
                            <p className="text-slate-700">{order.customer?.full_name || '—'}</p>
                            <p className="text-xs text-slate-400">{order.customer?.email}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{order.item_count}</td>
                          <td className="px-4 py-3 font-medium">{formatPrice(order.sub_total_price)}</td>
                          <td className="px-4 py-3">
                            <span className={`badge ${order.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {order.paid ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                          <td className="px-4 py-3 text-xs text-slate-500">{formatDate(order.placed_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} numPages={meta.num_pages} onChange={changePage} />
              </>
            ) : (
              <EmptyState icon={ShoppingBag} title="No orders found" message="Orders placed by buyers will appear here." />
            )}
          </section>
        </>
      )}

      {selected && (
        <ReturnModal
          item={selected}
          onClose={() => setSelected(null)}
          onResolved={resolved}
        />
      )}
    </div>
  );
}
