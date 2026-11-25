import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Package } from 'lucide-react';
import { formatPrice } from '../lib/format';

export default function PaymentSuccessPage() {
  const location = useLocation();
  const order = location.state?.order;

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl rounded-lg border border-line bg-white p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-semibold text-navy">
          {order ? 'Order placed successfully' : 'Payment completed'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Thank you for shopping with us. Your vendors have been notified and your
          order is now being prepared.
        </p>

        {order && (
          <div className="mt-6 rounded-md bg-slate-50 p-5 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Order number</p>
                <p className="font-semibold text-navy">{order.order_number}</p>
              </div>
              <span className={`badge ${order.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {order.paid ? 'Paid' : 'Payment pending'}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {order.items?.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-slate-600">{item.product.title} × {item.quantity}</span>
                  <span className="font-medium">{formatPrice(item.total_price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-sm font-semibold text-navy">Total</span>
              <span className="font-semibold text-brand">{formatPrice(order.sub_total_price)}</span>
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/account" className="btn-primary">
            <Package className="h-4 w-4" /> View my orders
          </Link>
          <Link to="/shop" className="btn-outline">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
