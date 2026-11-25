import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Loader2,
  Mic,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { aiApi } from '../../services/ai';
import { getErrorMessage } from '../../services/api';
import { formatCurrency } from '../../lib/format';
import { Alert } from '../ui/Ui';

const EXAMPLES = [
  'A reliable phone for work under ₦300,000',
  'Set up a small home office under ₦150,000',
  'Best-rated skincare products under ₦50,000',
];

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

export default function ShopWithAI({
  className = 'btn-outline',
  label = 'Shop with AI',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { cart, refresh, updateItem, removeItem, addItem } = useCart();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [budget, setBudget] = useState('');
  const [result, setResult] = useState(null);
  const [selections, setSelections] = useState([]);
  const [busy, setBusy] = useState(false);
  const [lineBusy, setLineBusy] = useState(null);
  const [proceeding, setProceeding] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(Boolean(Recognition));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      recognitionRef.current?.abort?.();
    };
  }, [open]);

  function openDrawer() {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setError('');
    setOpen(true);
  }

  function startVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = 'en-NG';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => {
      setListening(true);
      setError('');
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setPrompt((current) => `${current} ${transcript}`.trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      setError(event.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Voice input could not start.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }

  async function sourceCart(event) {
    event.preventDefault();
    if (!prompt.trim()) {
      setError('Describe what you need first.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await aiApi.sourceAndBuildCart({
        prompt: prompt.trim(),
        budget: budget ? Number(budget) : undefined,
        max_items: 4,
      });
      setResult(data);
      setSelections(data.selections || []);
      await refresh();
    } catch (err) {
      setError(getErrorMessage(err, 'The concierge could not build a cart.'));
    } finally {
      setBusy(false);
    }
  }

  async function changeQuantity(selection, nextQuantity) {
    const quantity = Math.max(1, Math.min(Number(nextQuantity) || 1, 50));
    if (quantity === selection.quantity) return;
    if (
      quantity > selection.quantity &&
      result?.budget &&
      selectedTotal - Number(selection.line_total) + Number(selection.unit_price) * quantity >
        Number(result.budget)
    ) {
      setError('That quantity would exceed your AI budget. Remove or swap an item first.');
      return;
    }
    setLineBusy(selection.product.id);
    setError('');
    try {
      await updateItem(selection.cart_item_id, quantity);
      setSelections((current) =>
        current.map((item) =>
          item.cart_item_id === selection.cart_item_id
            ? {
                ...item,
                quantity,
                line_total: roundMoney(Number(item.unit_price) * quantity),
              }
            : item
        )
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update that quantity.'));
    } finally {
      setLineBusy(null);
    }
  }

  async function removeSelection(selection) {
    setLineBusy(selection.product.id);
    setError('');
    try {
      await removeItem(selection.cart_item_id);
      setSelections((current) =>
        current.filter((item) => item.cart_item_id !== selection.cart_item_id)
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not remove that item.'));
    } finally {
      setLineBusy(null);
    }
  }

  async function swapSelection(selection, alternativeId) {
    const alternative = selection.alternatives?.find(
      (item) => String(item.product.id) === String(alternativeId)
    );
    if (!alternative) return;
    setLineBusy(selection.product.id);
    setError('');
    try {
      await removeItem(selection.cart_item_id);
      const cartData = await addItem(alternative.product.id, selection.quantity);
      const newItem = (cartData.items || []).find(
        (item) => item.product.id === alternative.product.id
      );
      const newQuantity = newItem?.quantity || selection.quantity;
      const oldProductAlternative = {
        product: selection.product,
        price: selection.unit_price,
        reasons: selection.reasons,
        score: selection.score,
        score_breakdown: selection.score_breakdown,
        line_total: selection.line_total,
      };
      setSelections((current) =>
        current.map((item) => {
          if (item.cart_item_id !== selection.cart_item_id) return item;
          return {
            ...item,
            cart_item_id: newItem?.id || item.cart_item_id,
            product: newItem?.product || alternative.product,
            unit_price: Number(alternative.price || alternative.product.discounted_price || 0),
            quantity: newQuantity,
            line_total: roundMoney(
              Number(alternative.price || alternative.product.discounted_price || 0) *
                newQuantity
            ),
            score: alternative.score,
            score_breakdown: alternative.score_breakdown,
            reasons: alternative.reasons,
            selection_reason: (alternative.reasons || []).slice(0, 3).join('; '),
            alternatives: [
              oldProductAlternative,
              ...(item.alternatives || []).filter(
                (entry) => entry.product.id !== alternative.product.id
              ),
            ].slice(0, 3),
          };
        })
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Could not swap that item.'));
    } finally {
      setLineBusy(null);
    }
  }

  async function proceedToCheckout() {
    if (!selections.length) {
      setError('Keep at least one item before proceeding.');
      return;
    }
    setProceeding(true);
    setError('');
    try {
      await aiApi.prepareCheckout({
        address_id: cart.items?.[0]?.shipping_address?.id || null,
      });
      setOpen(false);
      navigate('/checkout');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not prepare checkout.'));
    } finally {
      setProceeding(false);
    }
  }

  const selectedTotal = selections.reduce(
    (sum, item) => sum + Number(item.line_total || 0),
    0
  );
  const budgetNumber = Number(result?.budget ?? budget ?? 0);
  const remaining = result?.budget
    ? Math.max(Number(result.budget) - selectedTotal, 0)
    : null;

  const drawer = (
    <div
      className="fixed inset-0 z-[100] flex justify-end bg-navy/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Shop with AI"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-line px-5 py-4 sm:px-7">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
              <Sparkles className="h-3.5 w-3.5" /> AI concierge
            </p>
            <h2 className="mt-1 text-xl font-semibold text-navy">Shop with AI</h2>
            <p className="mt-1 text-sm text-slate-500">
              Describe the job, set a budget, and review the sourced cart before paying.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-navy"
            aria-label="Close AI concierge"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <form onSubmit={sourceCart} className="card p-4">
            <label className="label" htmlFor="ai-prompt">What are you shopping for?</label>
            <textarea
              id="ai-prompt"
              rows={3}
              className="input resize-none"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="e.g. A reliable phone for work under ₦300,000, with good battery life"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-brand-light hover:text-brand"
                >
                  {example}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <div>
                <label className="label" htmlFor="ai-budget">Budget (NGN)</label>
                <input
                  id="ai-budget"
                  type="number"
                  min="1"
                  className="input"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder="Optional total budget"
                />
              </div>
              <button
                type="button"
                onClick={startVoice}
                disabled={!voiceSupported || listening}
                className="btn-outline h-[42px]"
                title={voiceSupported ? 'Speak your request' : 'Voice input is not supported in this browser'}
              >
                {listening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {listening ? 'Listening…' : 'Voice'}
              </button>
              <button type="submit" className="btn-primary h-[42px]" disabled={busy}>
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy ? 'Sourcing…' : 'Build my cart'}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Ranked by ratings, reviews, sales, stock and budget fit. Nothing is charged here.
            </p>
          </form>

          {error && <Alert className="mt-4">{error}</Alert>}

          {result && (
            <div className="mt-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-navy">Your AI-sourced cart</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {result.fallback_used
                      ? 'No exact keyword matches; showing the strongest available in-stock picks.'
                      : `${result.candidate_count} candidate product(s) ranked for this request.`}
                  </p>
                </div>
                {result.budget && (
                  <span className={`badge ${remaining > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {formatCurrency(remaining, result.currency)} left
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-3">
                {selections.map((selection) => (
                  <article key={selection.cart_item_id} className="card p-3">
                    <div className="flex gap-3">
                      {selection.product.primary_image ? (
                        <img
                          src={selection.product.primary_image}
                          alt={selection.product.title}
                          className="h-20 w-20 shrink-0 rounded-md border border-line object-contain p-1"
                        />
                      ) : (
                        <div className="h-20 w-20 shrink-0 rounded-md border border-dashed border-line bg-slate-50" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-medium text-navy">
                              {selection.product.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {selection.product.vendor_store?.name || selection.product.category?.name}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-brand">
                            {formatCurrency(selection.line_total, result.currency)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {selection.reasons?.slice(0, 4).map((reason) => (
                            <span key={reason} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              {reason}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="h-7 w-7 rounded border border-line text-sm hover:border-brand hover:text-brand"
                          onClick={() => changeQuantity(selection, selection.quantity - 1)}
                          disabled={lineBusy === selection.product.id || selection.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center text-sm">{selection.quantity}</span>
                        <button
                          type="button"
                          className="h-7 w-7 rounded border border-line text-sm hover:border-brand hover:text-brand"
                          onClick={() => changeQuantity(selection, selection.quantity + 1)}
                          disabled={lineBusy === selection.product.id}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {selection.alternatives?.length > 0 && (
                          <select
                            className="max-w-[145px] rounded border border-line bg-white px-1.5 py-1 text-[11px] text-slate-600"
                            value=""
                            onChange={(event) => swapSelection(selection, event.target.value)}
                            disabled={lineBusy === selection.product.id}
                            aria-label={`Swap ${selection.product.title}`}
                          >
                            <option value="">Swap item…</option>
                            {selection.alternatives.map((alternative) => (
                              <option key={alternative.product.id} value={alternative.product.id}>
                                {alternative.product.title.slice(0, 36)}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={() => removeSelection(selection)}
                          disabled={lineBusy === selection.product.id}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${selection.product.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {selections.length === 0 && (
                <p className="mt-3 rounded-md border border-dashed border-line bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  All AI picks were removed. Try a new request.
                </p>
              )}

              <div className="mt-4 rounded-md bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">AI picks total</span>
                  <span className="text-base font-semibold text-navy">
                    {formatCurrency(selectedTotal, result.currency)}
                  </span>
                </div>
                {result.budget && (
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Budget</span>
                    <span>{formatCurrency(budgetNumber, result.currency)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-line bg-white px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={proceedToCheckout}
            className="btn-primary w-full py-3"
            disabled={!selections.length || proceeding || busy}
          >
            {proceeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {proceeding ? 'Preparing checkout…' : 'Proceed to checkout'}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Stock and address are validated first; payment still requires your explicit confirmation.
          </p>
        </footer>
      </section>
    </div>
  );

  return (
    <>
      <button type="button" onClick={openDrawer} className={className}>
        <Sparkles className="h-4 w-4" />
        {label}
      </button>
      {open && typeof document !== 'undefined' ? createPortal(drawer, document.body) : null}
    </>
  );
}
