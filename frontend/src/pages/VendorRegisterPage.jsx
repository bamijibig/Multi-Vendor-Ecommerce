import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { Alert } from '../components/ui/Ui';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

export default function VendorRegisterPage() {
  const navigate = useNavigate();
  const { registerVendor } = useAuth();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    password: '',
    password2: '',
    store_name: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (form.password !== form.password2) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await registerVendor({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        mobile: Number(form.mobile),
        password: form.password,
        store_name: form.store_name.trim(),
      });
      navigate('/vendor/dashboard', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your vendor account.'));
    } finally {
      setBusy(false);
    }
  }

  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <div className="container-page py-12">
      <div className="mx-auto grid max-w-4xl gap-6 overflow-hidden rounded-lg border border-line bg-white shadow-card lg:grid-cols-[1fr_1.2fr]">
        <div className="bg-navy p-8 text-white">
          <Store className="h-10 w-10 text-brand" />
          <h1 className="mt-4 text-2xl font-semibold text-white">Sell with MultiVendor</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Open your storefront, manage your products and stock, and fulfil the
            order items that belong to you. All in one vendor dashboard.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            <li>• Product and inventory management</li>
            <li>• Order items scoped to your store</li>
            <li>• Sales and low-stock overview</li>
          </ul>
          <p className="mt-8 text-xs text-slate-400">
            Already have a vendor account?{' '}
            <Link to="/login" className="font-medium text-white underline">Sign in</Link>
          </p>
        </div>

        <form onSubmit={submit} className="grid gap-4 p-8 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="store">Store name (optional)</label>
            <input id="store" className="input" placeholder="e.g. Pixel Electronics" {...field('store_name')} />
            <p className="mt-1 text-xs text-slate-400">
              You can create or rename your store later in the vendor dashboard.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="first">First name</label>
            <input id="first" required className="input" {...field('first_name')} />
          </div>
          <div>
            <label className="label" htmlFor="last">Last name</label>
            <input id="last" required className="input" {...field('last_name')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="email">Email address</label>
            <input id="email" type="email" required className="input" {...field('email')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="mobile">Mobile number</label>
            <input id="mobile" type="number" required className="input" {...field('mobile')} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required className="input" {...field('password')} />
          </div>
          <div>
            <label className="label" htmlFor="password2">Confirm password</label>
            <input id="password2" type="password" required className="input" {...field('password2')} />
          </div>
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
          <button type="submit" className="btn-primary w-full py-3 sm:col-span-2" disabled={busy}>
            {busy ? 'Creating vendor account…' : 'Create vendor account'}
          </button>
        </form>
      </div>
    </div>
  );
}
