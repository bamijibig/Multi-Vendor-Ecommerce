import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { Alert, Spinner } from '../components/ui/Ui';
import { useCart } from '../context/CartContext';
import { paymentsApi, ordersApi } from '../services/orders';
import { getErrorMessage } from '../services/api';
import { formatPrice } from '../lib/format';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function CardForm({ addressId, amount, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (stripeError) {
        setError(stripeError.message || 'Payment failed.');
        return;
      }
      if (paymentIntent?.status !== 'succeeded') {
        setError('Payment was not completed. Please try again.');
        return;
      }
      const data = await paymentsApi.confirm(paymentIntent.id, addressId);
      onSuccess(data.order);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not confirm your payment.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <PaymentElement />
      {error && <Alert>{error}</Alert>}
      <button type="submit" className="btn-primary w-full py-3" disabled={!stripe || busy}>
        <CreditCard className="h-4 w-4" />
        {busy ? 'Processing…' : `Pay ${formatPrice(amount)}`}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, refresh } = useCart();
  const [clientSecret, setClientSecret] = useState('');
  const [amount, setAmount] = useState(cart.subtotal || 0);
  const [loading, setLoading] = useState(Boolean(stripePromise));
  const [error, setError] = useState('');
  const [payLaterBusy, setPayLaterBusy] = useState(false);
  const started = useRef(false);

  const addressId =
    location.state?.addressId || cart.items?.[0]?.shipping_address?.id || null;

  useEffect(() => {
    if (!stripePromise || started.current) return;
    started.current = true;
    paymentsApi
      .createIntent()
      .then((data) => {
        setClientSecret(data.clientSecret);
        setAmount(data.amount);
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not start payment.')))
      .finally(() => setLoading(false));
  }, []);

  async function finish(order) {
    await refresh().catch(() => {});
    navigate('/payment/success', { state: { order } });
  }

  async function payLater() {
    setError('');
    if (!addressId) {
      setError('No shipping address selected. Please return to checkout.');
      return;
    }
    setPayLaterBusy(true);
    try {
      const data = await ordersApi.place(addressId);
      await finish(data.order);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not place order.'));
    } finally {
      setPayLaterBusy(false);
    }
  }

  if (!cart.items.length) {
    return (
      <div className="container-page py-12">
        <Alert>Your cart is empty, so there is nothing to pay for.</Alert>
        <Link to="/shop" className="btn-primary mt-4">Back to shop</Link>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <nav className="mb-4 text-xs text-slate-500">
        <Link to="/checkout" className="hover:text-brand">Checkout</Link>
        <span className="mx-2">/</span>
        <span className="text-navy">Payment</span>
      </nav>
      <h1 className="text-2xl font-semibold text-navy">Secure payment</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy">Card details</h2>
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <ShieldCheck className="h-4 w-4" /> Stripe secure
            </span>
          </div>

          {!publishableKey && (
            <Alert className="mt-4">
              Stripe is not configured for the frontend. Set
              <code className="mx-1 rounded bg-white/60 px-1">VITE_STRIPE_PUBLISHABLE_KEY</code>
              and <code className="mx-1 rounded bg-white/60 px-1">STRIPE_SECRET_KEY</code> to
              enable card payments. You can still place the order below for local testing.
            </Alert>
          )}

          {error && <Alert className="mt-4">{error}</Alert>}

          {publishableKey && loading && <Spinner label="Preparing secure payment…" />}

          {publishableKey && clientSecret && addressId && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
              <CardForm addressId={addressId} amount={amount} onSuccess={finish} />
            </Elements>
          )}

          {publishableKey && !loading && !clientSecret && !error && (
            <Alert className="mt-4">Could not initialise payment. Please retry from checkout.</Alert>
          )}

          {!addressId && (
            <Alert className="mt-4">
              No shipping address is selected. <Link to="/checkout" className="font-medium underline">Return to checkout</Link>.
            </Alert>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <button
              type="button"
              onClick={payLater}
              disabled={payLaterBusy || !addressId}
              className="btn-outline w-full"
            >
              {payLaterBusy ? 'Placing order…' : 'Place order and pay on delivery'}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Creates an unpaid order that an administrator can mark as paid.
            </p>
          </div>
        </section>

        <aside className="card h-fit p-5">
          <h2 className="text-base font-semibold text-navy">Order summary</h2>
          <ul className="mt-3 divide-y divide-line">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="line-clamp-1 text-slate-600">
                  {item.product.title} × {item.quantity}
                </span>
                <span className="shrink-0 font-medium">{formatPrice(item.total_product_price)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-base font-semibold">
            <span className="text-navy">Total</span>
            <span className="text-brand">{formatPrice(amount || cart.subtotal)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
