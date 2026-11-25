import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  EyeOff,
  Flag,
  Package,
  Search,
  UploadCloud,
} from 'lucide-react';
import { adminCenterApi } from '../../services/adminCenter';
import { getErrorMessage } from '../../services/api';
import { Alert, EmptyState, Pagination, Spinner } from '../ui/Ui';
import { formatDate, formatPrice } from '../../lib/format';

const STATUS_TONES = {
  APPROVED: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  FLAGGED: 'bg-red-50 text-red-600',
  UNPUBLISHED: 'bg-slate-100 text-slate-600',
};

export default function AdminCatalog() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ count: 0, num_pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (nextPage = 1, term = '', moderation = '', source = '') => {
    setLoading(true);
    setError('');
    try {
      const data = await adminCenterApi.products({
        page: nextPage,
        search: term || undefined,
        moderation_status: moderation || undefined,
        source: source || undefined,
      });
      setProducts(data.results || []);
      setMeta({ count: data.count || 0, num_pages: data.num_pages || 1 });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the catalog.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    load(1, search, statusFilter, sourceFilter);
  }

  function changeFilter(nextStatus, nextSource = sourceFilter) {
    setStatusFilter(nextStatus);
    setSourceFilter(nextSource);
    setPage(1);
    load(1, search, nextStatus, nextSource);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    load(nextPage, search, statusFilter, sourceFilter);
  }

  async function moderate(product, action) {
    let note = '';
    if (action === 'flag' || action === 'unpublish') {
      note = window.prompt(
        `Moderation note for “${product.title}” (optional):`,
        action === 'flag' ? 'Needs listing review' : 'Listing unpublished by admin'
      ) || '';
    }
    setBusyId(product.id);
    setError('');
    setNotice('');
    try {
      const data = await adminCenterApi.moderateProduct(product.id, { action, note });
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? data.product : item))
      );
      setNotice(`“${product.title}” is now ${data.product.moderation_status_display.toLowerCase()}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not moderate this product.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy">Catalog moderation</h2>
          <p className="text-sm text-slate-500">
            Review vendor, AI-generated, and bulk-uploaded listings. Unpublished and flagged products are hidden from buyers.
          </p>
        </div>
        <span className="badge bg-slate-100 text-slate-600">{meta.count} listings</span>
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
              placeholder="Search title, SKU, vendor, or email…"
              aria-label="Search catalog"
            />
          </div>
          <button type="submit" className="btn-dark shrink-0">Search</button>
        </form>
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(event) => changeFilter(event.target.value)}
          aria-label="Filter moderation status"
        >
          <option value="">All moderation states</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending review</option>
          <option value="FLAGGED">Flagged</option>
          <option value="UNPUBLISHED">Unpublished</option>
        </select>
        <select
          className="input w-auto"
          value={sourceFilter}
          onChange={(event) => changeFilter(statusFilter, event.target.value)}
          aria-label="Filter listing source"
        >
          <option value="">All sources</option>
          <option value="vendor">Vendor created</option>
          <option value="ai">AI generated</option>
          <option value="bulk">Bulk uploaded</option>
        </select>
      </div>

      {loading ? (
        <Spinner label="Loading catalog…" />
      ) : products.length ? (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Moderation</th>
                  <th className="px-4 py-3">Listed</th>
                  <th className="px-4 py-3 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3">
                      <p className="max-w-[250px] truncate font-medium text-navy">{product.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {product.ai_generated && (
                          <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                            <Bot className="h-3 w-3" /> AI
                          </span>
                        )}
                        {product.bulk_uploaded && (
                          <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                            <UploadCloud className="h-3 w-3" /> Bulk
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{product.slug}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{product.vendor_store?.name || 'Marketplace'}</p>
                      <p className="text-xs text-slate-400">{product.vendor_email || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.category_name}</td>
                    <td className="px-4 py-3 font-medium">{formatPrice(product.regular_price)}</td>
                    <td className="px-4 py-3 text-slate-600">{product.stoc}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_TONES[product.moderation_status] || 'bg-slate-100 text-slate-600'}`}>
                        {product.moderation_status_display}
                      </span>
                      {product.moderation_note && (
                        <p className="mt-1 max-w-[190px] text-xs text-slate-400">{product.moderation_note}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(product.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {product.moderation_status !== 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => moderate(product, 'approve')}
                            disabled={busyId === product.id}
                            className="btn-outline px-2.5 py-1.5 text-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </button>
                        )}
                        {product.moderation_status !== 'FLAGGED' && (
                          <button
                            type="button"
                            onClick={() => moderate(product, 'flag')}
                            disabled={busyId === product.id}
                            className="rounded-md border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                          >
                            <Flag className="mr-1 inline h-3.5 w-3.5" /> Flag
                          </button>
                        )}
                        {product.moderation_status !== 'UNPUBLISHED' && (
                          <button
                            type="button"
                            onClick={() => moderate(product, 'unpublish')}
                            disabled={busyId === product.id}
                            className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <EyeOff className="mr-1 inline h-3.5 w-3.5" /> Unpublish
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
          icon={Package}
          title="No listings found"
          message="Products matching your filters will appear here for moderation."
        />
      )}
    </div>
  );
}
