import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Plus, ShoppingBag, Tag, X } from 'lucide-react';
import { Alert, EmptyState, Spinner } from '../components/ui/Ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cartApi } from '../services/cart';
import { getErrorMessage } from '../services/api';
import { formatPrice } from '../lib/format';

const EMPTY_ADDRESS = {
  state: '',
  city: '',
  zip_code: '',
  street_address: '',
  mobile: '',
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, loading, applyCoupon, removeCoupon, setAddress } = useCart();
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDRESS);
  const [coupon, setCoupon] = useState('');
  const [error, setError] = useState('');
  const [couponError, setCouponError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const itemsSubtotal = cart.items.reduce(
    (sum, item) => sum + Number(item.total_product_price || 0),
    0
  );
  const couponDiscount = Math.max(itemsSubtotal - Number(cart.subtotal || 0), 0);

  useEffect(() => {
    let cancelled = false;
    cartApi
      .getAddresses()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data.results || [];
        setAddresses(list);
        const cartAddressId = cart.items?.[0]?.shipping_address?.id;
        const initial = list.find((item) => item.id === cartAddressId) || list[0];
        setSelected(initial?.id || null);
        setShowForm(list.length === 0);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)))
      .finally(() => !cancelled && setLoadingAddresses(false));
    return () => {
      cancelled = true;
    };
    // The cart address is only used for the initial selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAddress(event) {
    event.preventDefault();
    setError('');
    if (!form.state || !form.city || !form.zip_code || !form.street_address || !form.mobile) {
      setError('Please complete all address fields.');
      return;
    }
    setBusy(true);
    try {
      const created = await cartApi.createAddress({
        ...form,
        zip_code: Number(form.zip_code),
        mobile: Number(form.mobile),
      });
      setAddresses((current) => [created, ...current]);
      setSelected(created.id);
      await setAddress(created.id);
      setForm(EMPTY_ADDRESS);
      setShowForm(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save address.'));
    } finally {
      setBusy(false);
    }
  }

  async function chooseAddress(id) {
    setSelected(id);
    setError('');
    try {
      await setAddress(id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleCoupon(event) {
    event.preventDefault();
    setCouponError('');
    if (!coupon.trim()) return;
    try {
      await applyCoupon(coupon.trim());
      setCoupon('');
    } catch (err) {
      setCouponError(getErrorMessage(err, 'Invalid coupon.'));
    }
  }

  function continueToPayment() {
    if (!selected) {
      setError('Select or add a shipping address first.');
      return;
    }
    navigate('/payment', { state: { addressId: selected } });
  }

  if (loadingAddresses || (loading && !cart.items.length)) return <Spinner label="Preparing checkout…" />;

  if (!cart.items.length) {
    return (
      <div className="container-page py-12">
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          message="Add products before checking out."
          action={<Link to="/shop" className="btn-primary">Browse products</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-xs text-slate-500">
        <Link to="/cart" className="hover:text-brand">Cart</Link>
        <span className="mx-2">/</span>
        <span className="text-navy">Checkout</span>
      </nav>
      <h1 className="text-2xl font-semibold text-navy">Checkout</h1>
      <p className="mt-1 text-sm text-slate-500">
        Signed in as {user?.email}. Delivery and payment details below.
      </p>

      {error && <Alert className="mt-4">{error}</Alert>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
                <MapPin className="h-4 w-4 text-brand" /> Shipping address
              </h2>
              {!showForm && (
                <button type="button" onClick={() => setShowForm(true)} className="btn-ghost text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add new
                </button>
              )}
            </div>

            {loadingAddresses ? (
              <p className="mt-3 text-sm text-slate-500">Loading addresses…</p>
            ) : addresses.length > 0 ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {addresses.map((address) => (
                  <li key={address.id}>
                    <button
                      type="button"
                      onClick={() => chooseAddress(address.id)}
                      className={`w-full rounded-md border p-3 text-left text-sm transition ${
                        selected === address.id
                          ? 'border-brand bg-brand-light/60'
                          : 'border-line hover:border-brand/40'
                      }`}
                    >
                      <span className="font-medium text-navy">
                        {address.street_address}, {address.city}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {address.state} {address.zip_code} · {address.mobile}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              !showForm && <p className="mt-3 text-sm text-slate-500">No saved addresses yet.</p>
            )}

            {showForm && (
              <form onSubmit={saveAddress} className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="street">Street address</label>
                  <input
                    id="street"
                    className="input"
                    value={form.street_address}
                    onChange={(event) => setForm({ ...form, street_address: event.target.value })}
                    placeholder="House, road, area"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="city">City</label>
                  <input
                    id="city"
                    className="input"
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="state">State</label>
                  <input
                    id="state"
                    className="input"
                    value={form.state}
                    onChange={(event) => setForm({ ...form, state: event.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="zip">Zip code</label>
                  <input
                    id="zip"
                    type="number"
                    className="input"
                    value={form.zip_code}
                    onChange={(event) => setForm({ ...form, zip_code: event.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="mobile">Mobile</label>
                  <input
                    id="mobile"
                    type="number"
                    className="input"
                    value={form.mobile}
                    onChange={(event) => setForm({ ...form, mobile: event.target.value })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button type="submit" className="btn-primary flex-1" disabled={busy}>
                    {busy ? 'Saving…' : 'Save address'}
                  </button>
                  {addresses.length > 0 && (
                    <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
              <Tag className="h-4 w-4 text-brand" /> Coupon
            </h2>
            {cart.coupon_applied && cart.coupon ? (
              <div className="mt-3 flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <span>{cart.coupon.cupon_code} applied ({cart.coupon.discoun_parcent}% off)</span>
                <button type="button" onClick={removeCoupon} aria-label="Remove coupon">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleCoupon} className="mt-3 flex gap-2">
                <input
                  className="input"
                  value={coupon}
                  onChange={(event) => setCoupon(event.target.value)}
                  placeholder="Enter coupon code"
                  aria-label="Coupon code"
                />
                <button type="submit" className="btn-dark shrink-0">Apply</button>
              </form>
            )}
            {couponError && <p className="mt-2 text-xs text-red-600">{couponError}</p>}
          </section>

          <section className="card p-5">
            <h2 className="text-base font-semibold text-navy">Review items</h2>
            <ul className="mt-3 divide-y divide-line">
              {cart.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  {item.product.primary_image ? (
                    <img src={item.product.primary_image} alt={item.product.title} className="h-14 w-14 rounded border border-line object-contain p-1" />
                  ) : (
                    <div className="h-14 w-14 rounded border border-line bg-slate-50" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-navy">{item.product.title}</p>
                    <p className="text-xs text-slate-500">Qty {item.quantity}</p>
                  </div>
                  <span className="text-sm font-medium">{formatPrice(item.total_product_price)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="card h-fit p-5">
          <h2 className="text-base font-semibold text-navy">Order total</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Items ({cart.total_quantity})</dt>
              <dd>{formatPrice(itemsSubtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Shipping</dt>
              <dd className="text-emerald-600">Free</dd>
            </div>
            {cart.coupon && couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <dt>Coupon discount</dt>
                <dd>-{formatPrice(couponDiscount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt className="text-navy">Total</dt>
              <dd className="text-brand">{formatPrice(cart.subtotal)}</dd>
            </div>
          </dl>
          <button type="button" onClick={continueToPayment} className="btn-primary mt-5 w-full">
            Continue to payment
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Payments are processed securely by Stripe.
          </p>
        </aside>
      </div>
    </div>
  );
}
