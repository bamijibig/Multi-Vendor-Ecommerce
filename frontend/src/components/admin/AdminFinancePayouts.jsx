import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, Percent, Plus, Save, XCircle } from 'lucide-react';
import { adminCenterApi } from '../../services/adminCenter';
import { getErrorMessage } from '../../services/api';
import { Alert, EmptyState, Spinner } from '../ui/Ui';
import { formatDate, formatPrice } from '../../lib/format';

const PAYOUT_TONES = {
  PENDING: 'bg-amber-50 text-amber-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-600',
};

export default function AdminFinancePayouts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rules, setRules] = useState([]);
  const [tax, setTax] = useState(null);
  const [categories, setCategories] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [payoutCounts, setPayoutCounts] = useState({});
  const [payoutFilter, setPayoutFilter] = useState('PENDING');
  const [references, setReferences] = useState({});
  const [newRule, setNewRule] = useState({
    category: '',
    commission_rate: '10.00',
    shipping_contribution_fee: '0.00',
  });
  const [busyId, setBusyId] = useState(null);
  const [savingTax, setSavingTax] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [finance, payoutData] = await Promise.all([
        adminCenterApi.financeRules(),
        adminCenterApi.payouts({ status: payoutFilter || undefined }),
      ]);
      setRules(finance.commission_rules || []);
      setTax(finance.tax_config);
      setCategories(finance.categories || []);
      setPayouts(payoutData.results || []);
      setPayoutCounts(payoutData.counts || {});
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load finance settings.'));
    } finally {
      setLoading(false);
    }
  }, [payoutFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTax(event) {
    event.preventDefault();
    setSavingTax(true);
    setError('');
    setNotice('');
    try {
      const data = await adminCenterApi.updateFinanceRules({
        tax: {
          name: tax.name,
          vat_rate: tax.vat_rate,
          wht_rate: tax.wht_rate,
          wht_enabled: tax.wht_enabled,
        },
      });
      setTax(data.tax_config);
      setNotice('Tax configuration saved.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save tax configuration.'));
    } finally {
      setSavingTax(false);
    }
  }

  async function createRule(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const data = await adminCenterApi.createCommissionRule({
        category: Number(newRule.category),
        commission_rate: newRule.commission_rate,
        shipping_contribution_fee: newRule.shipping_contribution_fee,
      });
      setRules(data.commission_rules || []);
      setTax(data.tax_config);
      setNewRule({ category: '', commission_rate: '10.00', shipping_contribution_fee: '0.00' });
      setNotice('Category commission rule created.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create commission rule.'));
    }
  }

  async function updateRule(rule) {
    setBusyId(rule.id);
    setError('');
    setNotice('');
    try {
      const data = await adminCenterApi.updateFinanceRules({
        id: rule.id,
        commission_rate: rule.commission_rate,
        shipping_contribution_fee: rule.shipping_contribution_fee,
        is_active: rule.is_active,
      });
      setRules(data.commission_rules || []);
      setNotice(`${rule.category_name} commission rule updated.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update commission rule.'));
    } finally {
      setBusyId(null);
    }
  }

  function patchRule(id, changes) {
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule))
    );
  }

  async function processPayout(payout, action) {
    const reference = (references[payout.id] || '').trim();
    if (action === 'approve' && !reference) {
      setError('Enter a payment reference before marking this payout as paid.');
      return;
    }
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt(`Reason for rejecting ${payout.vendor_email}'s payout?`, 'Bank details invalid') || '';
      if (!reason) return;
    }
    setBusyId(payout.id);
    setError('');
    setNotice('');
    try {
      await adminCenterApi.processPayout(payout.id, {
        action,
        reference,
        reason,
      });
      setNotice(
        action === 'approve'
          ? `Payout to ${payout.vendor_email} marked as paid.`
          : `Payout to ${payout.vendor_email} rejected and funds released.`
      );
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not process payout.'));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Spinner label="Loading finance and payouts…" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-navy">Finance & payouts</h2>
        <p className="text-sm text-slate-500">Manage commission rules, 7.5% VAT, and vendor disbursements.</p>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {tax && (
          <form onSubmit={saveTax} className="card space-y-3 p-5">
            <h3 className="flex items-center gap-2 font-semibold text-navy">
              <Percent className="h-4 w-4 text-brand" /> Tax configuration
            </h3>
            <div>
              <label className="label" htmlFor="tax-name">Name</label>
              <input
                id="tax-name"
                className="input"
                value={tax.name}
                onChange={(event) => setTax({ ...tax, name: event.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="tax-vat">VAT rate (%)</label>
                <input
                  id="tax-vat"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={tax.vat_rate}
                  onChange={(event) => setTax({ ...tax, vat_rate: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="tax-wht">WHT rate (%)</label>
                <input
                  id="tax-wht"
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={tax.wht_rate}
                  onChange={(event) => setTax({ ...tax, wht_rate: event.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(tax.wht_enabled)}
                onChange={(event) => setTax({ ...tax, wht_enabled: event.target.checked })}
              />
              Enable withholding tax
            </label>
            <p className="text-xs text-slate-400">
              VAT is applied to marketplace commission and shipping fees. The marketplace default is 7.5%.
            </p>
            <button type="submit" className="btn-primary" disabled={savingTax}>
              <Save className="h-4 w-4" /> {savingTax ? 'Saving…' : 'Save tax settings'}
            </button>
          </form>
        )}

        <form onSubmit={createRule} className="card space-y-3 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-navy">
            <Plus className="h-4 w-4 text-brand" /> New category commission rule
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="rule-category">Category</label>
              <select
                id="rule-category"
                className="input"
                required
                value={newRule.category}
                onChange={(event) => setNewRule({ ...newRule, category: event.target.value })}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rule-rate">Commission %</label>
              <input
                id="rule-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="input"
                required
                value={newRule.commission_rate}
                onChange={(event) => setNewRule({ ...newRule, commission_rate: event.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="rule-shipping">Shipping fee</label>
              <input
                id="rule-shipping"
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={newRule.shipping_contribution_fee}
                onChange={(event) => setNewRule({ ...newRule, shipping_contribution_fee: event.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Categories without a rule use the default 10.00% commission and no shipping fee.
          </p>
          <button type="submit" className="btn-dark">
            <Plus className="h-4 w-4" /> Create rule
          </button>
        </form>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-semibold text-navy">Commission rules</h3>
        </div>
        {rules.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Commission %</th>
                  <th className="px-4 py-3">Shipping fee</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-4 py-3 font-medium text-navy">{rule.category_name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className="input w-24 py-1.5"
                        value={rule.commission_rate}
                        onChange={(event) => patchRule(rule.id, { commission_rate: event.target.value })}
                        aria-label={`Commission rate for ${rule.category_name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input w-28 py-1.5"
                        value={rule.shipping_contribution_fee}
                        onChange={(event) => patchRule(rule.id, { shipping_contribution_fee: event.target.value })}
                        aria-label={`Shipping fee for ${rule.category_name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(rule.is_active)}
                        onChange={(event) => patchRule(rule.id, { is_active: event.target.checked })}
                        aria-label={`Active rule for ${rule.category_name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => updateRule(rule)}
                          disabled={busyId === rule.id}
                          className="btn-outline px-3 py-1.5 text-xs"
                        >
                          <Save className="h-3.5 w-3.5" /> Save
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-sm text-slate-500">No category-specific rules yet; the 10% default applies.</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold text-navy">
            <Banknote className="h-4 w-4 text-brand" /> Vendor payout queue
          </h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="badge bg-amber-50 text-amber-700">{payoutCounts.pending ?? 0} pending</span>
            <span className="badge bg-emerald-50 text-emerald-700">{payoutCounts.paid ?? 0} paid</span>
            <select
              className="input w-auto py-1.5 text-xs"
              value={payoutFilter}
              onChange={(event) => setPayoutFilter(event.target.value)}
              aria-label="Filter payouts"
            >
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="FAILED">Rejected / failed</option>
              <option value="">All</option>
            </select>
          </div>
        </div>

        {payouts.length ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Payment reference</th>
                  <th className="px-4 py-3 text-right">Process</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{payout.store_name || payout.vendor_name}</p>
                      <p className="text-xs text-slate-400">{payout.vendor_email}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatPrice(payout.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${PAYOUT_TONES[payout.status] || 'bg-slate-100 text-slate-600'}`}>
                        {payout.status}
                      </span>
                      {payout.reference && <p className="mt-1 text-xs text-slate-400">{payout.reference}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(payout.created_at)}</td>
                    <td className="px-4 py-3">
                      {payout.status === 'PENDING' ? (
                        <input
                          className="input py-1.5 text-xs"
                          value={references[payout.id] || ''}
                          onChange={(event) =>
                            setReferences((current) => ({ ...current, [payout.id]: event.target.value }))
                          }
                          placeholder="Bank / transfer reference"
                          aria-label={`Payment reference for ${payout.vendor_email}`}
                        />
                      ) : (
                        <span className="text-xs text-slate-400">{payout.paid_at ? formatDate(payout.paid_at) : '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {payout.status === 'PENDING' ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => processPayout(payout, 'reject')}
                            disabled={busyId === payout.id}
                            className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="mr-1 inline h-3.5 w-3.5" /> Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => processPayout(payout, 'approve')}
                            disabled={busyId === payout.id}
                            className="btn-primary px-2.5 py-1.5 text-xs"
                          >
                            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> Mark paid
                          </button>
                        </div>
                      ) : (
                        <p className="text-right text-xs text-slate-400">
                          {payout.entry_count} ledger entr{payout.entry_count === 1 ? 'y' : 'ies'}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Banknote}
            title="No payouts in this queue"
            message="Vendor payout requests will appear here for disbursement."
          />
        )}
      </section>
    </div>
  );
}
