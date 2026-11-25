import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  LayoutDashboard,
  Package,
  Search,
  ShoppingBag,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { Alert, EmptyState, Pagination, Spinner, StatusBadge } from '../components/ui/Ui';
import { useAuth } from '../context/AuthContext';
import { ordersApi } from '../services/orders';
import AdminFinance from '../components/admin/AdminFinance';
import { getErrorMessage } from '../services/api';
import { formatDate, formatPrice } from '../lib/format';

const STATUSES = ['Oder Recived', 'Oder Packed', 'Oder OnTheWay', 'Oder Shipped'];

function StatCard({ label, value, hint }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [meta, setMeta] = useState({ num_pages: 1, count: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [dash, orderData, completedData] = await Promise.all([
        ordersApi.adminDashboard(),
        ordersApi.adminList(),
        ordersApi.completed(),
      ]);
      setDashboard(dash);
      setOrders(orderData.results || []);
      setMeta({ num_pages: orderData.num_pages || 1, count: orderData.count || 0 });
      setCompleted(completedData.results || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the admin dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function fetchOrders(nextPage = 1, term = search) {
    try {
      const data = await ordersApi.adminList({ page: nextPage, search: term });
      setOrders(data.results || []);
      setMeta({ num_pages: data.num_pages || 1, count: data.count || 0 });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function updateOrder(order, changes) {
    setBusyId(order.id);
    setError('');
    setNotice('');
    try {
      const data = await ordersApi.adminUpdate(order.id, changes);
      setOrders((current) => current.map((item) => (item.id === order.id ? data.order : item)));
      setNotice('Order updated.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update order.'));
    } finally {
      setBusyId(null);
    }
  }

  async function completeOrder(order) {
    if (!window.confirm(`Mark order ${order.order_number} as completed?`)) return;
    setBusyId(order.id);
    setError('');
    setNotice('');
    try {
      const data = await ordersApi.adminComplete(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setCompleted((current) => [data.completed_order, ...current]);
      setNotice(`Order ${order.order_number} moved to completed.`);
      const dash = await ordersApi.adminDashboard();
      setDashboard(dash);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not complete order.'));
    } finally {
      setBusyId(null);
    }
  }

  async function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    await fetchOrders(1, search);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    fetchOrders(nextPage, search);
  }

  if (loading) return <Spinner label="Loading admin dashboard…" />;

  const stats = dashboard?.stats || {};

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Admin dashboard</p>
          <h1 className="text-2xl font-semibold text-navy">Marketplace overview</h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as {user?.email}
            {user?.is_superuser ? ' · Superuser' : ' · Employee'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/shop" className="btn-outline">
            <Store className="h-4 w-4" /> Storefront
          </Link>
          <Link to="/admin-center" className="btn-dark">
            <LayoutDashboard className="h-4 w-4" /> Admin Center
          </Link>
        </div>
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}
      {notice && <Alert type="success" className="mt-4">{notice}</Alert>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Placed orders" value={stats.total_placed_orders ?? 0} hint="Awaiting fulfilment" />
        <StatCard label="Completed orders" value={stats.total_completed_orders ?? 0} hint={`${stats.completed_last_30_days ?? 0} in last 30 days`} />
        <StatCard label="Gross revenue" value={formatPrice(stats.gross_revenue ?? 0)} hint="From completed orders" />
        <StatCard label="Customers" value={stats.total_customers ?? 0} hint={`${stats.total_vendors ?? 0} vendors`} />
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {[
          ['overview', 'Overview'],
          ['orders', `All orders (${meta.count})`],
          ['completed', `Completed (${completed.length})`],
          ['finance', 'Commission & Tax'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`whitespace-nowrap px-5 py-3 text-sm font-medium ${
              tab === key ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-navy'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="flex items-center gap-2 font-semibold text-navy">
                  <ShoppingBag className="h-4 w-4 text-brand" /> Recent orders
                </h2>
                <button type="button" onClick={() => setTab('orders')} className="text-xs font-medium text-brand">
                  Manage orders
                </button>
              </div>
              {dashboard?.recent_orders?.length ? (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {dashboard.recent_orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-navy">{order.order_number}</p>
                          <p className="text-xs text-slate-400">{order.customer?.email}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(order.placed_date)}</td>
                        <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                        <td className="px-4 py-3 text-right font-medium">{formatPrice(order.sub_total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 py-8 text-sm text-slate-500">No orders have been placed yet.</p>
              )}
            </section>

            <section className="space-y-3">
              <div className="card p-5">
                <h2 className="flex items-center gap-2 font-semibold text-navy">
                  <Package className="h-4 w-4 text-brand" /> Catalogue
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Products</dt>
                    <dd className="font-medium">{stats.total_products ?? 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Vendor stores</dt>
                    <dd className="font-medium">{stats.total_vendors ?? 0}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Customers with cart</dt>
                    <dd className="font-medium">{stats.customers_with_cart ?? 0}</dd>
                  </div>
                </dl>
                <Link to="/shop" className="btn-outline mt-4 w-full">Browse catalogue</Link>
              </div>

              <div className="card p-5">
                <h2 className="flex items-center gap-2 font-semibold text-navy">
                  <Users className="h-4 w-4 text-brand" /> Oversight
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Admins can update or complete any order here. Vendor onboarding,
                  returns, payouts, and catalog moderation live in the Admin Center.
                </p>
                <Link to="/admin-center" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand">
                  Open Admin Center <LayoutDashboard className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="card p-5">
                <h2 className="flex items-center gap-2 font-semibold text-navy">
                  <Wallet className="h-4 w-4 text-brand" /> Revenue
                </h2>
                <p className="mt-2 text-xl font-semibold text-brand">{formatPrice(stats.gross_revenue ?? 0)}</p>
                <p className="text-xs text-slate-400">Total of completed orders</p>
              </div>
            </section>
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-4">
            <form onSubmit={submitSearch} className="flex gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search order number, email, name…"
                  aria-label="Search orders"
                />
              </div>
              <button type="submit" className="btn-dark shrink-0">Search</button>
            </form>

            {orders.length ? (
              <>
                <div className="card overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Items</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Paid</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-navy">{order.order_number}</p>
                            <p className="text-xs text-slate-400">{formatDate(order.placed_date)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-700">{order.customer?.email}</p>
                            <p className="text-xs text-slate-400">{order.customer?.full_name}</p>
                          </td>
                          <td className="px-4 py-3">{order.item_count}</td>
                          <td className="px-4 py-3 font-medium">{formatPrice(order.sub_total_price)}</td>
                          <td className="px-4 py-3">
                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={Boolean(order.paid)}
                                disabled={busyId === order.id}
                                onChange={() => updateOrder(order, { paid: !order.paid })}
                              />
                              {order.paid ? 'Paid' : 'Unpaid'}
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="input py-1.5 text-xs"
                              value={order.status}
                              disabled={busyId === order.id}
                              onChange={(event) => updateOrder(order, { status: event.target.value })}
                              aria-label={`Status for order ${order.order_number}`}
                            >
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => completeOrder(order)}
                                disabled={busyId === order.id}
                                className="btn-outline px-3 py-1.5 text-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} numPages={meta.num_pages} onChange={changePage} />
              </>
            ) : (
              <EmptyState
                icon={ShoppingBag}
                title="No orders found"
                message="Orders placed by customers will appear here for fulfilment."
              />
            )}
          </div>
        )}

        {tab === 'finance' && <AdminFinance />}

        {tab === 'completed' && (
          completed.length ? (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Completed</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {completed.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-medium text-navy">{order.oder_number}</td>
                      <td className="px-4 py-3 text-slate-600">{order.customer?.email}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(order.complete_date)}</td>
                      <td className="px-4 py-3">{order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}</td>
                      <td className="px-4 py-3 font-medium">{formatPrice(order.sub_total_price)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${order.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {order.paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="No completed orders"
              message="Complete a placed order to archive it here."
            />
          )
        )}
      </div>
    </div>
  );
}
