import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingBag, User } from 'lucide-react';
import { Alert, EmptyState, Spinner, StatusBadge } from '../components/ui/Ui';
import { useAuth } from '../context/AuthContext';
import { ordersApi } from '../services/orders';
import { getErrorMessage } from '../services/api';
import { formatDate, formatPrice } from '../lib/format';

function OrderCard({ order, completed = false }) {
  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <span>
            <span className="text-xs uppercase tracking-wide text-slate-400">Order</span>{' '}
            <span className="font-semibold text-navy">
              {completed ? order.oder_number : order.order_number}
            </span>
          </span>
          <span className="text-xs text-slate-500">
            {completed ? formatDate(order.complete_date) : formatDate(order.placed_date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={completed ? 'Completed' : order.status} />
          <span className={`badge ${order.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {order.paid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      </header>

      <ul className="divide-y divide-line px-4">
        {order.items?.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            {item.product.primary_image ? (
              <img
                src={item.product.primary_image}
                alt={item.product.title}
                className="h-14 w-14 rounded border border-line object-contain p-1"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded border border-line bg-slate-50">
                <Package className="h-5 w-5 text-slate-300" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Link to={`/product/${item.product.slug}`} className="line-clamp-1 text-sm font-medium text-navy hover:text-brand">
                {item.product.title}
              </Link>
              <p className="text-xs text-slate-500">
                Qty {item.quantity}
                {item.vendor_store?.name ? ` · ${item.vendor_store.name}` : ''}
              </p>
            </div>
            <span className="text-sm font-medium">{formatPrice(item.total_price)}</span>
          </li>
        ))}
      </ul>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
        <span className="text-xs text-slate-500">
          {order.shipping_address
            ? `Ship to ${order.shipping_address.street_address}, ${order.shipping_address.city}`
            : 'No shipping address'}
        </span>
        <span>
          <span className="text-xs text-slate-400">Total </span>
          <span className="font-semibold text-brand">{formatPrice(order.sub_total_price)}</span>
        </span>
      </footer>
    </article>
  );
}

export default function AccountPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('placed');
  const [orders, setOrders] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([ordersApi.list(), ordersApi.completed()])
      .then(([placedData, completedData]) => {
        if (cancelled) return;
        setOrders(placedData.results || []);
        setCompleted(completedData.results || []);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-navy px-6 py-5 text-white">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg font-semibold">
            {(user?.first_name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">
              {user?.full_name || user?.first_name || 'My account'}
            </h1>
            <p className="text-sm text-slate-300">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/account/profile" className="btn-outline border-white/20 bg-transparent text-white hover:bg-white hover:text-navy">
            <User className="h-4 w-4" /> Edit profile
          </Link>
          <Link to="/shop" className="btn-primary">
            <ShoppingBag className="h-4 w-4" /> Shop
          </Link>
        </div>
      </div>

      {error && <Alert className="mt-5">{error}</Alert>}

      <div className="mt-6 flex gap-1 border-b border-line">
        <button
          type="button"
          onClick={() => setTab('placed')}
          className={`px-5 py-3 text-sm font-medium ${
            tab === 'placed' ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-navy'
          }`}
        >
          Active orders ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`px-5 py-3 text-sm font-medium ${
            tab === 'completed' ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-navy'
          }`}
        >
          Completed ({completed.length})
        </button>
      </div>

      <div className="mt-5">
        {loading ? (
          <Spinner label="Loading your orders…" />
        ) : tab === 'placed' ? (
          orders.length ? (
            <div className="space-y-4">
              {orders.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="No active orders"
              message="Once you check out, your order will appear here."
              action={<Link to="/shop" className="btn-primary">Start shopping</Link>}
            />
          )
        ) : completed.length ? (
          <div className="space-y-4">
            {completed.map((order) => <OrderCard key={order.id} order={order} completed />)}
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="No completed orders"
            message="Completed orders are archived here after an administrator fulfils them."
          />
        )}
      </div>
    </div>
  );
}
