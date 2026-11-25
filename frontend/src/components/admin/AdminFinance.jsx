import { useCallback, useEffect, useState } from 'react';
import { financeApi } from '../../services/finance';
import { getErrorMessage } from '../../services/api';
import { Alert } from '../ui/Ui';
import { formatPrice } from '../../lib/format';

export default function AdminFinance() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rules, setRules] = useState([]);
  const [tax, setTax] = useState(null);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState({ category: '', commission_rate: '', shipping_contribution_fee: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ruleData, taxData, summaryData] = await Promise.all([
        financeApi.commissionRules(),
        financeApi.taxConfig(),
        financeApi.summary(),
      ]);
      setRules(ruleData.results || ruleData || []);
      setTax(taxData.config);
      setSummary(summaryData.summary);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load finance settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTax(event) {
    event.preventDefault();
    try {
      const data = await financeApi.updateTaxConfig(tax);
      setTax(data.config);
      setNotice('Tax configuration updated.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update tax configuration.'));
    }
  }

  async function createRule(event) {
    event.preventDefault();
    try {
      await financeApi.createCommissionRule({
        category: Number(form.category),
        commission_rate: form.commission_rate,
        shipping_contribution_fee: form.shipping_contribution_fee || '0',
      });
      setForm({ category: '', commission_rate: '', shipping_contribution_fee: '' });
      setNotice('Commission rule created.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create commission rule.'));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading finance settings…</p>;

  return (
    <div className="space-y-5">
      <h2 className="font-semibold text-navy">Commission & tax settings</h2>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert type="success">{notice}</Alert>}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-xs text-slate-400">GMV</p>
            <p className="mt-2 text-xl font-semibold">{formatPrice(summary.gmv)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400">Commission earned</p>
            <p className="mt-2 text-xl font-semibold">{formatPrice(summary.commission_earned)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400">VAT collected</p>
            <p className="mt-2 text-xl font-semibold">{formatPrice(summary.total_vat_collected)}</p>
          </div>
        </div>
      )}

      {tax && (
        <form onSubmit={saveTax} className="card p-5 space-y-3">
          <h3 className="font-semibold text-navy">Tax configuration</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className="input"
              value={tax.name}
              onChange={(e) => setTax({ ...tax, name: e.target.value })}
              placeholder="Name"
            />
            <input
              type="number"
              step="0.01"
              className="input"
              value={tax.vat_rate}
              onChange={(e) => setTax({ ...tax, vat_rate: e.target.value })}
              placeholder="VAT %"
            />
            <input
              type="number"
              step="0.01"
              className="input"
              value={tax.wht_rate}
              onChange={(e) => setTax({ ...tax, wht_rate: e.target.value })}
              placeholder="WHT %"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={tax.wht_enabled}
              onChange={(e) => setTax({ ...tax, wht_enabled: e.target.checked })}
            />
            Enable WHT
          </label>
          <button type="submit" className="btn-primary">Save tax settings</button>
        </form>
      )}

      <form onSubmit={createRule} className="card p-5 space-y-3">
        <h3 className="font-semibold text-navy">New commission rule</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Category ID"
          />
          <input
            type="number"
            step="0.01"
            className="input"
            value={form.commission_rate}
            onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
            placeholder="Commission %"
          />
          <input
            type="number"
            step="0.01"
            className="input"
            value={form.shipping_contribution_fee}
            onChange={(e) => setForm({ ...form, shipping_contribution_fee: e.target.value })}
            placeholder="Shipping fee"
          />
        </div>
        <button type="submit" className="btn-primary">Create rule</button>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Commission %</th>
              <th className="px-3 py-2">Shipping fee</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-3 py-2">{rule.category_name}</td>
                <td className="px-3 py-2">{rule.commission_rate}</td>
                <td className="px-3 py-2">{rule.shipping_contribution_fee}</td>
                <td className="px-3 py-2">{rule.is_active ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}