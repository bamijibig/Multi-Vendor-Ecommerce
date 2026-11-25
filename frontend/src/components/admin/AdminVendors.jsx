import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, PauseCircle, Search, Star, Store } from 'lucide-react';
import { adminCenterApi } from '../../services/adminCenter';
import { getErrorMessage } from '../../services/api';
import { Alert, EmptyState, Pagination, Spinner } from '../ui/Ui';
import { formatDate, formatPrice } from '../../lib/format';

const STATUS_TONES = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  SUSPENDED: 'bg-red-50 text-red-600',
};

function Score({ value }) {
  const score = Number(value || 0);
  const tone = score >= 4 ? 'text-emerald-600' : score >= 3 ? 'text-amber-600' : 'text-red-600';
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}>
      <Star className="h-3.5 w-3.5 fill-current" /> {score.toFixed(1)}
    </span>
  );
}

export default function AdminVendors() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [vendors, setVendors] = useState([]);
  const [counts, setCounts] = useState({});
  const [meta, setMeta] = useState({ count: 0, num_pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [busyId, setBusyId] = useState(null);

  const fetchVendors = useCallback(async (nextPage = 1, term = '', status = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await adminCenterApi.vendors({
        page: nextPage,
        search: term || undefined,
        status: status || undefined,
      });
      setVendors(data.results || []);
      setCounts(data.counts || {});
      setMeta({ count: data.count || 0, num_pages: data.num_pages || 1 });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load vendors.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors(1, '', statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeStatus(vendor, status) {
    let note = '';
    if (status === 'SUSPENDED') {
      note = window.prompt(`Reason for suspending ${vendor.name}?`, 'Policy review') || '';
    }
    if (status === 'SUSPENDED' && !note) return;
    setBusyId(vendor.id);
    setError('');
    setNotice('');
    try {
      await adminCenterApi.setVendorStatus(vendor.id, { status, note });
      setNotice(
        status === 'ACTIVE'
          ? `${vendor.name} is now active and visible in the storefront.`
          : `${vendor.name} has been suspended.`
      );
      await fetchVendors(page, search, statusFilter);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update vendor status.'));
    } finally {
      setBusyId(null);
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    fetchVendors(1, search, statusFilter);
  }

  function changeFilter(value) {
    setStatusFilter(value);
    setPage(1);
    fetchVendors(1, search, value);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    fetchVendors(nextPage, search, statusFilter);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy">Vendor management</h2>
          <p className="text-sm text-slate-500">Approve onboarding, suspend stores, and review seller performance.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge bg-amber-50 text-amber-700">{counts.pending ?? 0} pending</span>
          <span className="badge bg-emerald-50 text-emerald-700">{counts.active ?? 0} active</span>
          <span className="badge bg-red-50 text-red-600">{counts.suspended ?? 0} suspended</span>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}

      <div className="flex flex-wrap gap-2">
        <form onSubmit={submitSearch} className="flex flex-1 gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search store, owner, or email…"
              aria-label="Search vendors"
            />
          </div>
          <button type="submit" className="btn-dark shrink-0">Search</button>
        </form>
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(event) => changeFilter(event.target.value)}
          aria-label="Filter vendor status"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending approval</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {loading ? (
        <Spinner label="Loading vendors…" />
      ) : vendors.length ? (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Seller score</th>
                  <th className="px-4 py-3">Wallet</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-2 font-medium text-navy">
                        <Store className="h-4 w-4 text-slate-300" /> {vendor.name}
                      </p>
                      <p className="text-xs text-slate-400">{vendor.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{vendor.owner_name || '—'}</p>
                      <p className="text-xs text-slate-400">{vendor.user_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_TONES[vendor.status] || 'bg-slate-100 text-slate-600'}`}>
                        {vendor.status_display}
                      </span>
                      {vendor.status_note && (
                        <p className="mt-1 max-w-[190px] text-xs text-slate-400">{vendor.status_note}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{vendor.product_count}</td>
                    <td className="px-4 py-3"><Score value={vendor.seller_score} /></td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{formatPrice(vendor.balances?.available_for_payout)}</p>
                      <p className="text-xs text-slate-400">available</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(vendor.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {vendor.status !== 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => changeStatus(vendor, 'ACTIVE')}
                            disabled={busyId === vendor.id}
                            className="btn-outline px-2.5 py-1.5 text-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {vendor.status === 'PENDING' ? 'Approve' : 'Reactivate'}
                          </button>
                        )}
                        {vendor.status !== 'SUSPENDED' && (
                          <button
                            type="button"
                            onClick={() => changeStatus(vendor, 'SUSPENDED')}
                            disabled={busyId === vendor.id}
                            className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <PauseCircle className="mr-1 inline h-3.5 w-3.5" /> Suspend
                          </button>
                        )}
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
          icon={Store}
          title="No vendors found"
          message="Vendor onboarding requests and stores matching this filter will appear here."
        />
      )}
    </div>
  );
}
