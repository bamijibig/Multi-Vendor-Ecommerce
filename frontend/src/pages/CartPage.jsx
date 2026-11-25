import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Loader2, Minus, Plus, ShoppingBag, Store, Tag, Trash2, X } from 'lucide-react';
import { Alert, EmptyState, Spinner } from '../components/ui/Ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getErrorMessage } from '../services/api';
import { formatPrice } from '../lib/format';

export default function CartPage() {
  const { isAuthenticated } = useAuth();
  const { cart, loading, updateItem, removeItem, applyCoupon, removeCoupon } = useCart();
  const [coupon, setCoupon] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);

  const itemsSubtotal = cart.items.reduce(
    (sum, item) => sum + Number(item.total_product_price || 0),
    0
  );
  const couponDiscount = Math.max(itemsSubtotal - Number(cart.subtotal || 0), 0);
  const total = Number(cart.subtotal || 0);
  const vatIncluded = total > 0 ? total - total / 1.075 : 0;

  const groups = useMemo(() => {
    const byStore = new Map();
    cart.items.forEach((item) => {
      const store = item.product.vendor_store;
      const key = store?.id ?? 'marketplace';
      if (!byStore.has(key)) {
        byStore.set(key, { key, store, items: [], subtotal: 0 });
      }
      const group = byStore.get(key);
      group.items.push(item);
      group.subtotal += Number(item.total_product_price || 0);
    });
    return Array.from(byStore.values());
  }, [cart.items]);

  async function changeQuantity(item, quantity) {
    setError('');
    setBusyId(item.id);
    try {
      await updateItem(item.id, quantity);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(item) {
    setError('');
    setBusyId(item.id);
    try {
      await removeItem(item.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCoupon(event) {
    event.preventDefault();
    setCouponError('');
    if (!coupon.trim()) return;
    setCouponBusy(true);
    try {
      await applyCoupon(coupon.trim());
      setCoupon('');
    } catch (err) {
      setCouponError(getErrorMessage(err, 'Invalid coupon.'));
    } finally {
      setCouponBusy(false);
    }
  }

  async function handleRemoveCoupon() {
    setCouponError('');
    setCouponBusy(true);
    try {
      await removeCoupon();
    } catch (err) {
      setCouponError(getErrorMessage(err));
    } finally {
      setCouponBusy(false);
    }
  }

  if (loading && !cart.items.length) return <Spinner label="Loading cart…" />;

  if (!isAuthenticated) {
    return (
      <div className="container-page py-12">
        <EmptyState
          icon={ShoppingBag}
          title="Log in to see your cart"
          message="Your cart is linked to your customer account."
          action={<Link to="/login" className="btn-primary">Log in</Link>}
        />
      </div>
    );
  }

  if (!cart.items.length) {
    return (
      <div className="container-page py-12">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          message="Browse the shop and add products from your favourite vendors."
          action={<Link to="/shop" className="btn-primary">Continue shopping</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-xs text-slate-500">
        <Link to="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-navy">Shopping cart</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-eyebrow">Your selection</p>
          <h1 className="section-title">Shopping cart</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="tabular-nums">{cart.count}</span> item(s) from{' '}
            <span className="tabular-nums">{groups.length}</span> seller
            {groups.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link to="/shop" className="btn-outline">Continue shopping</Link>
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {groups.map((group) => {
            const store = group.store;
            return (
              <section key={group.key} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-[#f1ece3] px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper text-brand">
                      {store?.logo ? (
                        <img src={store.logo} alt={store.name} className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {store ? (
                          <Link
                            to={`/store/${store.slug}`}
                            className="truncate font-display text-sm font-semibold text-navy hover:text-brand"
                          >
                            {store.name}
                          </Link>
                        ) : (
                          <span className="font-display text-sm font-semibold text-navy">Marketplace</span>
                        )}
                        {store?.is_official && (
                          <span className="official-badge !px-2 !py-0.5 text-[10px]">
                            <BadgeCheck className="h-3 w-3" />
                            {store.official_badge || 'Official Store'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {group.items.length} line item{group.items.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <p className="price text-sm font-semibold text-navy">
                    {formatPrice(group.subtotal)}
                    <span className="ml-1 text-[11px] font-medium text-muted">store subtotal</span>
                  </p>
                </div>

                <div className="hidden grid-cols-[1fr_130px_120px_40px] gap-3 border-b border-line bg-paper px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted sm:grid">
                  <span>Product</span>
                  <span>Quantity</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>

                <ul>
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="grid gap-3 border-b border-line px-4 py-4 last:border-0 sm:grid-cols-[1fr_130px_120px_40px] sm:items-center"
                    >
                      <div className="flex gap-3">
                        <Link
                          to={`/product/${item.product.slug}`}
                          className="aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-[#f0ebe2]"
                        >
                          {item.product.primary_image ? (
                            <img
                              src={item.product.primary_image}
                              alt={item.product.title}
                              className="h-full w-full object-contain p-1.5"
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[10px] text-slate-400">
                              No image
                            </span>
                          )}
                        </Link>
                        <div>
                          <Link
                            to={`/product/${item.product.slug}`}
                            className="font-display text-sm font-semibold text-navy hover:text-brand"
                          >
                            {item.product.title}
                          </Link>
                          <p className="price mt-1 text-xs text-muted">
                            {formatPrice(item.product.discounted_price)} each
                          </p>
                          {item.product.vendor_store && (
                            <Link
                              to={`/store/${item.product.vendor_store.slug}`}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand"
                            >
                              {item.product.vendor_store.name}
                              {item.product.vendor_store.is_official && (
                                <BadgeCheck className="h-3 w-3 text-amber-500" />
                              )}
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="flex w-fit items-center rounded-lg border border-line bg-paper">
                        <button
                          type="button"
                          disabled={busyId === item.id || item.quantity <= 1}
                          onClick={() => changeQuantity(item, item.quantity - 1)}
                          className="px-2.5 py-2 text-slate-500 transition hover:text-brand disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium tabular-nums">
                          {busyId === item.id ? (
                            <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin text-brand" />
                          ) : (
                            item.quantity
                          )}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => changeQuantity(item, item.quantity + 1)}
                          className="px-2.5 py-2 text-slate-500 transition hover:text-brand disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <p className="price text-sm font-semibold text-navy sm:text-right">
                        {formatPrice(item.total_product_price)}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleRemove(item)}
                        disabled={busyId === item.id}
                        className="w-fit rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        aria-label={`Remove ${item.product.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-navy">Order summary</h2>
              <span className="badge bg-slate-100 text-slate-600">
                {cart.total_quantity} item{cart.total_quantity === 1 ? '' : 's'}
              </span>
            </div>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Items subtotal</dt>
                <dd className="price font-medium">{formatPrice(itemsSubtotal)}</dd>
              </div>
              {cart.coupon && couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <dt>Coupon ({cart.coupon.cupon_code})</dt>
                  <dd className="price">-{formatPrice(couponDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Est. VAT (7.5%, included)</dt>
                <dd className="price font-medium">{formatPrice(vatIncluded)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Delivery</dt>
                <dd className="font-medium text-emerald-600">Free</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base">
                <dt className="font-display font-semibold text-navy">Total</dt>
                <dd className="price text-lg font-semibold text-brand">{formatPrice(total)}</dd>
              </div>
            </dl>
            <Link to="/checkout" className="btn-primary mt-5 w-full py-3">
              Proceed to checkout
            </Link>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
              VAT is shown for transparency and included in the displayed prices.
            </p>
          </div>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-navy">
              <Tag className="h-4 w-4 text-brand" /> Coupon code
            </h2>
            {cart.coupon_applied && cart.coupon ? (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <span>
                  {cart.coupon.cupon_code} applied ({cart.coupon.discoun_parcent}% off)
                </span>
                <button type="button" onClick={handleRemoveCoupon} disabled={couponBusy} aria-label="Remove coupon">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleCoupon} className="mt-3 flex gap-2">
                <input
                  value={coupon}
                  onChange={(event) => setCoupon(event.target.value)}
                  placeholder="Enter code"
                  className="input"
                  aria-label="Coupon code"
                />
                <button type="submit" className="btn-dark shrink-0" disabled={couponBusy}>
                  {couponBusy ? '…' : 'Apply'}
                </button>
              </form>
            )}
            {couponError && <p className="mt-2 text-xs text-red-600">{couponError}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
