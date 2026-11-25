import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Alert } from '../components/ui/Ui';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    password: '',
    password2: '',
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
      await register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        mobile: Number(form.mobile),
        password: form.password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  }

  const field = (key) => ({
    value: form[key],
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-12">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white p-7 shadow-card">
        <h1 className="text-2xl font-semibold text-navy">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Shop across every vendor with one customer account.
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
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
            <input id="email" type="email" autoComplete="email" required className="input" {...field('email')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="mobile">Mobile number</label>
            <input id="mobile" type="number" required className="input" {...field('mobile')} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="new-password" required className="input" {...field('password')} />
          </div>
          <div>
            <label className="label" htmlFor="password2">Confirm password</label>
            <input id="password2" type="password" autoComplete="new-password" required className="input" {...field('password2')} />
          </div>
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
          <button type="submit" className="btn-primary w-full py-3 sm:col-span-2" disabled={busy}>
            <UserPlus className="h-4 w-4" /> {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-brand">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
