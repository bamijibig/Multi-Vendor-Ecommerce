import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  LayoutDashboard,
  PackageSearch,
  ShoppingBag,
  Store,
} from 'lucide-react';
import AdminOverview from '../components/admin/AdminOverview';
import AdminVendors from '../components/admin/AdminVendors';
import AdminOrdersReturns from '../components/admin/AdminOrdersReturns';
import AdminFinancePayouts from '../components/admin/AdminFinancePayouts';
import AdminCatalog from '../components/admin/AdminCatalog';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'vendors', label: 'Vendors', icon: Store },
  { key: 'orders', label: 'Orders & Returns', icon: ShoppingBag },
  { key: 'finance', label: 'Finance & Payouts', icon: Banknote },
  { key: 'catalog', label: 'Catalog Moderation', icon: PackageSearch },
];

export default function AdminCenterPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">General Admin Center</p>
          <h1 className="text-2xl font-semibold text-navy">Marketplace control room</h1>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as {user?.email}
            {user?.is_superuser ? ' · Superuser' : ' · Employee'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/shop" className="btn-outline">
            <Store className="h-4 w-4" /> Storefront
          </Link>
          <Link to="/admin/dashboard" className="btn-dark">
            <LayoutDashboard className="h-4 w-4" /> Operations
          </Link>
        </div>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium ${
              tab === key
                ? 'border-b-2 border-brand text-brand'
                : 'text-slate-500 hover:text-navy'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === 'overview' && <AdminOverview onNavigate={setTab} />}
        {tab === 'vendors' && <AdminVendors />}
        {tab === 'orders' && <AdminOrdersReturns />}
        {tab === 'finance' && <AdminFinancePayouts />}
        {tab === 'catalog' && <AdminCatalog />}
      </div>
    </div>
  );
}
