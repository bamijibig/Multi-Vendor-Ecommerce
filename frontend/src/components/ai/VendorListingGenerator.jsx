import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import { Alert, EmptyState, Spinner } from '../ui/Ui';
import { aiApi } from '../../services/ai';
import { getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../lib/format';

function formFromDraft(draft) {
  return {
    title: draft?.title || '',
    description: draft?.description || '',
    details_description: draft?.details_description || '',
    category: draft?.category || '',
    condition: draft?.condition || 'new',
    tag: draft?.tag || '',
    modle: draft?.modle || '',
    price: draft?.price ?? draft?.suggested_price ?? '',
    stock: draft?.stock ?? 10,
    discount_percent: draft?.discount_percent ?? 0,
  };
}

function statusClasses(status) {
  if (status === 'published') return 'bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'bg-red-50 text-red-600';
  return 'bg-amber-50 text-amber-700';
}

export default function VendorListingGenerator({ store, categories = [], onPublished }) {
  const [prompt, setPrompt] = useState('');
  const [categoryHint, setCategoryHint] = useState('');
  const [condition, setCondition] = useState('new');
  const [drafts, setDrafts] = useState([]);
  const [activeDraft, setActiveDraft] = useState(null);
  const [form, setForm] = useState(formFromDraft(null));
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [market, setMarket] = useState(null);

  const loadDrafts = useCallback(async () => {
    if (!store) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await aiApi.drafts();
      setDrafts(data.results || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load AI drafts.'));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    if (!activeDraft && drafts.length) {
      setActiveDraft(drafts[0]);
      setForm(formFromDraft(drafts[0]));
    }
  }, [drafts, activeDraft]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(activeDraft?.image_url || '');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile, activeDraft?.image_url]);

  function openDraft(draft) {
    setActiveDraft(draft);
    setForm(formFromDraft(draft));
    setImageFile(null);
    setError('');
    setNotice('');
  }

  async function generate(event) {
    event.preventDefault();
    if (!prompt.trim()) {
      setError('Describe the product you want to list.');
      return;
    }
    setGenerating(true);
    setError('');
    setNotice('');
    try {
      const data = await aiApi.generateListing({
        prompt: prompt.trim(),
        category: categoryHint ? Number(categoryHint) : null,
        condition,
        store_id: store.id,
      });
      setActiveDraft(data.draft);
      setForm(formFromDraft(data.draft));
      setMarket(data.market || null);
      setImageFile(null);
      setDrafts((current) => [data.draft, ...current.filter((draft) => draft.id !== data.draft.id)]);
      setNotice(
        data.draft.provider_used === 'fallback'
          ? 'A local draft is ready for your review.'
          : 'AI draft generated. Review every field before publishing.'
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not generate the listing.'));
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft({ silent = false } = {}) {
    if (!activeDraft) return null;
    setSaving(true);
    setError('');
    if (!silent) setNotice('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        details_description: form.details_description,
        category: form.category ? Number(form.category) : null,
        condition: form.condition,
        tag: form.tag,
        modle: form.modle,
        price: form.price === '' ? null : Number(form.price),
        stock: Number(form.stock || 0),
        discount_percent: Number(form.discount_percent || 0),
      };
      if (imageFile) payload.image = imageFile;
      const data = await aiApi.updateDraft(activeDraft.id, payload);
      setActiveDraft(data.draft);
      setForm(formFromDraft(data.draft));
      setImageFile(null);
      setDrafts((current) =>
        current.map((draft) => (draft.id === data.draft.id ? data.draft : draft))
      );
      if (!silent) setNotice('Draft saved. Review the fields, then approve or reject.');
      return data.draft;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the draft.'));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!activeDraft) return;
    setApproving(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveDraft({ silent: true });
      if (!saved) return;
      const data = await aiApi.approveDraft(saved.id);
      setActiveDraft(data.draft);
      setForm(formFromDraft(data.draft));
      setDrafts((current) =>
        current.map((draft) => (draft.id === data.draft.id ? data.draft : draft))
      );
      setNotice('Listing approved and published to your live storefront.');
      onPublished?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not approve the listing.'));
    } finally {
      setApproving(false);
    }
  }

  async function reject() {
    if (!activeDraft) return;
    if (!window.confirm('Reject this AI draft? It will not be published.')) return;
    setRejecting(true);
    setError('');
    setNotice('');
    try {
      const data = await aiApi.rejectDraft(activeDraft.id, 'Rejected by vendor');
      setActiveDraft(data.draft);
      setForm(formFromDraft(data.draft));
      setDrafts((current) =>
        current.map((draft) => (draft.id === data.draft.id ? data.draft : draft))
      );
      setNotice('Draft rejected. You can generate a new one whenever you are ready.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reject the draft.'));
    } finally {
      setRejecting(false);
    }
  }

  if (!store) {
    return (
      <EmptyState
        icon={Sparkles}
        title="AI Quick-List needs a store"
        message="Create your vendor store first, then generate a draft with AI."
      />
    );
  }

  const isPublished = activeDraft?.status === 'published';
  const isRejected = activeDraft?.status === 'rejected';
  const disabled = saving || approving || isPublished || isRejected;

  return (
    <div className="space-y-5">
      <section className="card border-brand/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-navy">
              <Sparkles className="h-4 w-4 text-brand" /> AI Quick-List
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Describe the item in your own words. The assistant drafts a title,
              description and a price benchmarked against comparable catalogue
              products. Nothing goes live until you approve it.
            </p>
          </div>
          <span className="badge bg-brand-light text-brand">{store.name}</span>
        </div>

        <form onSubmit={generate} className="mt-4">
          <label className="label" htmlFor="ai-listing-prompt">What are you selling?</label>
          <textarea
            id="ai-listing-prompt"
            rows={3}
            className="input resize-none"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="e.g. Used iPhone 13 128GB, good battery, small scratch on the back, with charger"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div>
              <label className="label" htmlFor="ai-listing-category">Category hint</label>
              <select
                id="ai-listing-category"
                className="input"
                value={categoryHint}
                onChange={(event) => setCategoryHint(event.target.value)}
              >
                <option value="">Let the AI infer it</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ai-listing-condition">Condition</label>
              <select
                id="ai-listing-condition"
                className="input"
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
              >
                <option value="new">New</option>
                <option value="like_new">Like new</option>
                <option value="used">Used</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </div>
            <button type="submit" className="btn-primary h-[42px]" disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? 'Drafting…' : 'Generate draft'}
            </button>
          </div>
        </form>

        {error && <Alert className="mt-4">{error}</Alert>}
        {notice && <Alert type="success" className="mt-4">{notice}</Alert>}
      </section>

      {loading ? (
        <Spinner label="Loading your AI drafts…" />
      ) : activeDraft ? (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-slate-50 px-5 py-4">
            <div className="flex items-start gap-3">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt={activeDraft.title}
                  className="h-16 w-16 rounded-md border border-line bg-white object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-line bg-white">
                  <FileText className="h-5 w-5 text-slate-300" />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-navy">Review draft</h3>
                  <span className={`badge ${statusClasses(activeDraft.status)}`}>
                    {activeDraft.status_display || activeDraft.status}
                  </span>
                </div>
                <p className="mt-1 max-w-xl text-xs text-slate-500">
                  {activeDraft.ai_note || 'Review all fields before publishing.'}
                </p>
                {market && (
                  <div className="mt-2 rounded-lg border border-line bg-white p-3 text-xs text-slate-600">
                    <p>{market.notes}</p>
                    {market.estimated_net_payout !== null && market.estimated_net_payout !== undefined && (
                      <p className="mt-1">
                        Estimated commission {formatCurrency(market.estimated_commission, market.currency || 'NGN')},
                        {' '}VAT on fees {formatCurrency(market.estimated_vat_on_commission, market.currency || 'NGN')},
                        {' '}net payout {formatCurrency(market.estimated_net_payout, market.currency || 'NGN')}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            {activeDraft.published_product?.slug && (
              <Link to={`/product/${activeDraft.published_product.slug}`} className="btn-outline text-xs">
                View live listing <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ai-draft-title">Title</label>
                <input
                  id="ai-draft-title"
                  className="input"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="label" htmlFor="ai-draft-category">Category</label>
                <select
                  id="ai-draft-category"
                  className="input"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  disabled={disabled}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ai-draft-price">Selling price (NGN)</label>
                <input
                  id="ai-draft-price"
                  type="number"
                  min="1"
                  className="input"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="label" htmlFor="ai-draft-stock">Stock</label>
                <input
                  id="ai-draft-stock"
                  type="number"
                  min="0"
                  className="input"
                  value={form.stock}
                  onChange={(event) => setForm({ ...form, stock: event.target.value })}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="label" htmlFor="ai-draft-discount">Discount %</label>
                <input
                  id="ai-draft-discount"
                  type="number"
                  min="0"
                  max="100"
                  className="input"
                  value={form.discount_percent}
                  onChange={(event) => setForm({ ...form, discount_percent: event.target.value })}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="label" htmlFor="ai-draft-condition">Condition</label>
                <select
                  id="ai-draft-condition"
                  className="input"
                  value={form.condition}
                  onChange={(event) => setForm({ ...form, condition: event.target.value })}
                  disabled={disabled}
                >
                  <option value="new">New</option>
                  <option value="like_new">Like new</option>
                  <option value="used">Used</option>
                  <option value="refurbished">Refurbished</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ai-draft-tags">Tags</label>
                <input
                  id="ai-draft-tags"
                  className="input"
                  value={form.tag}
                  onChange={(event) => setForm({ ...form, tag: event.target.value })}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="label" htmlFor="ai-draft-model">Model</label>
                <input
                  id="ai-draft-model"
                  className="input"
                  value={form.modle}
                  onChange={(event) => setForm({ ...form, modle: event.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="label" htmlFor="ai-draft-description">Short description</label>
                <textarea
                  id="ai-draft-description"
                  rows={4}
                  className="input"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="label" htmlFor="ai-draft-details">Full details</label>
                <textarea
                  id="ai-draft-details"
                  rows={5}
                  className="input"
                  value={form.details_description}
                  onChange={(event) => setForm({ ...form, details_description: event.target.value })}
                  disabled={disabled}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="label" htmlFor="ai-draft-image">Listing image</label>
                <input
                  id="ai-draft-image"
                  type="file"
                  accept="image/*"
                  className="input py-2 text-xs"
                  onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                  disabled={disabled}
                />
                <p className="mt-1 text-xs text-slate-400">
                  The generated preview is saved under the media folder. Upload a real
                  photo to replace it before approval.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-md bg-brand-light/50 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-navy">
                <Sparkles className="h-4 w-4 text-brand" /> Market guidance
              </p>
              <p className="mt-1 text-slate-600">
                Suggested price:{' '}
                <strong className="text-brand">
                  {activeDraft.suggested_price
                    ? formatCurrency(activeDraft.suggested_price, activeDraft.currency)
                    : 'Set manually'}
                </strong>
              </p>
              {activeDraft.market_sample_size > 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  Comparable range{' '}
                  {formatCurrency(activeDraft.market_min, activeDraft.currency)} –{' '}
                  {formatCurrency(activeDraft.market_max, activeDraft.currency)} across{' '}
                  {activeDraft.market_sample_size} product(s) in your category.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  No comparable products yet. Set a price manually before publishing.
                </p>
              )}
            </div>

            {!isPublished && !isRejected && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <button type="button" className="btn-dark" onClick={() => saveDraft()} disabled={saving || approving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {saving ? 'Saving…' : 'Save draft'}
                </button>
                <button type="button" className="btn-primary" onClick={approve} disabled={approving || saving}>
                  {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {approving ? 'Publishing…' : 'Approve & publish'}
                </button>
                <button type="button" className="btn-outline text-red-600 hover:border-red-200 hover:text-red-700" onClick={reject} disabled={rejecting || saving || approving}>
                  {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  {rejecting ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            )}
            {isPublished && (
              <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> This draft is live.
              </p>
            )}
            {isRejected && (
              <p className="mt-4 flex items-center gap-2 text-sm text-red-600">
                <XCircle className="h-4 w-4" /> This draft was rejected and cannot be published.
              </p>
            )}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="No AI drafts yet"
          message="Generate a listing above and it will appear here for review before publishing."
        />
      )}

      {drafts.length > 0 && (
        <section className="card p-5">
          <h3 className="font-semibold text-navy">Recent AI drafts</h3>
          <ul className="mt-3 divide-y divide-line">
            {drafts.slice(0, 8).map((draft) => (
              <li key={draft.id} className="flex items-center justify-between gap-3 py-3">
                <button type="button" onClick={() => openDraft(draft)} className="min-w-0 text-left">
                  <span className="line-clamp-1 text-sm font-medium text-navy">{draft.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {draft.condition_display} ·{' '}
                    {draft.suggested_price
                      ? formatCurrency(draft.suggested_price, draft.currency)
                      : 'No price yet'}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`badge ${statusClasses(draft.status)}`}>{draft.status_display}</span>
                  <button type="button" onClick={() => openDraft(draft)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand" aria-label="Review draft">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-slate-400">
        The vendor remains the publisher of record. AI output is a draft only and is
        never added to the catalogue until you approve it.
      </p>
    </div>
  );
}
