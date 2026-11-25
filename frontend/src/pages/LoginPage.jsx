import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Alert } from '../components/ui/Ui';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form.email.trim(), form.password);
      const fallback = user?.is_superuser || user?.user_role === '2'
        ? '/admin-center'
        : user?.user_role === '3'
        ? '/vendor/dashboard'
        : '/';
      navigate(location.state?.from || fallback, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-7 shadow-card">
        <h1 className="text-2xl font-semibold text-navy">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">Log in to manage your cart and orders.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>
          {error && <Alert>{error}</Alert>}
          <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
            <LogIn className="h-4 w-4" /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 space-y-2 text-center text-sm text-slate-500">
          <p>
            New customer?{' '}
            <Link to="/register" className="font-medium text-brand">Create an account</Link>
          </p>
          <p>
            Want to sell?{' '}
            <Link to="/vendor/register" className="font-medium text-brand">Become a vendor</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
