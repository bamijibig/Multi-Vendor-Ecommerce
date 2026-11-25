import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '../components/ui/Ui';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        mobile: user.mobile || '',
      });
    }
  }, [user]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await updateProfile({ ...form, mobile: Number(form.mobile) });
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update your profile.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page py-8">
      <Link to="/account" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Back to account
      </Link>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-navy">My profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Keep your contact details up to date for order updates.
        </p>

        <form onSubmit={submit} className="card mt-6 grid gap-4 p-6 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="first">First name</label>
            <input
              id="first"
              className="input"
              value={form.first_name}
              onChange={(event) => setForm({ ...form, first_name: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="last">Last name</label>
            <input
              id="last"
              className="input"
              value={form.last_name}
              onChange={(event) => setForm({ ...form, last_name: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="input"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="mobile">Mobile number</label>
            <input
              id="mobile"
              type="number"
              className="input"
              value={form.mobile}
              onChange={(event) => setForm({ ...form, mobile: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <span className="label">Account type</span>
            <p className="text-sm text-slate-600">
              {user?.is_superuser || user?.user_role === '2'
                ? 'Administrator / employee'
                : user?.user_role === '3'
                ? 'Vendor'
                : 'Customer'}
            </p>
          </div>
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
          {success && <div className="sm:col-span-2"><Alert type="success">{success}</Alert></div>}
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
