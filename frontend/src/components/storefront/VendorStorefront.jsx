import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Store } from 'lucide-react';
import CategoryShelf from './CategoryShelf';
import { Alert, EmptyState, Spinner } from '../ui/Ui';
import { catalogApi } from '../../services/catalog';
import { getErrorMessage } from '../../services/api';

export default function VendorStorefront() {
  const { slug } = useParams();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    catalogApi
      .vendor(slug)
      .then((data) => {
        if (!cancelled) setVendor(data || null);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, 'Vendor store not found.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading && !vendor) return <Spinner label="Loading vendor store…" />;

  if (error) {
    return (
      <div className="container-page py-16">
        <Alert>{error}</Alert>
        <Link to="/shop" className="btn-primary mt-4">
          Back to shop
        </Link>
      </div>
    );
  }

  const shelves = Array.isArray(vendor?.category_shelves)
    ? vendor.category_shelves.filter((shelf) => shelf?.category)
    : [];
  const categories = Array.isArray(vendor?.categories)
    ? vendor.categories.filter(Boolean)
    : [];

  return (
    <div className="bg-canvas">
      <div className="relative h-48 overflow-hidden bg-navy-header sm:h-64">
        {vendor?.cover_photo && (
          <img src={vendor.cover_photo} alt="" className="h-full w-full object-cover opacity-60" />
        )}
        <span className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-header via-navy-header/60 to-transparent" />
        {vendor?.is_official && (
          <div className="absolute right-4 top-4 sm:right-6">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand px-3 py-1.5 text-xs font-medium text-ink">
              <BadgeCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Official Store · Verified</span>
              <span className="sm:hidden">Official Store</span>
            </span>
          </div>
        )}
      </div>

      <div className="container-page">
        <div className="relative -mt-20 flex flex-wrap items-end justify-between gap-4 rounded-card bg-paper p-5 shadow-card sm:-mt-24 sm:p-6">
          <div className="flex items-center gap-4">
            {vendor?.logo ? (
              <img
                src={vendor.logo}
                alt={vendor.name}
                className="h-20 w-20 rounded-full border-4 border-paper object-cover"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-paper bg-canvas text-brand-dark">
                <Store className="h-9 w-9" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-medium text-ink sm:text-3xl">
                  {vendor?.name || 'Vendor store'}
                </h1>
                {vendor?.is_official && (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-brand px-2 py-1 text-[11px] font-medium text-ink">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Official
                  </span>
                )}
              </div>
              {vendor?.official_tagline && (
                <p className="mt-1 text-sm text-muted">{vendor.official_tagline}</p>
              )}
              <p className="mt-1 text-sm text-subtle tabular-nums">
                {vendor?.product_count ?? 0} products · since{' '}
                {vendor?.created_at ? new Date(vendor.created_at).getFullYear() : '—'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/shop?vendor_store=${vendor?.id}`} className="btn-outline">
              All products
            </Link>
            <Link to="/shop" className="btn-ghost">
              Browse vendors
            </Link>
          </div>
        </div>

        {categories.length > 0 && (
          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Store categories">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/shop?category=${encodeURIComponent(category.slug)}&vendor_store=${vendor?.id}`}
                className="inline-flex shrink-0 items-center rounded-full border border-line bg-paper px-4 py-1.5 text-xs font-medium text-ink transition hover:border-brand hover:bg-brand-light"
              >
                {category.name}
                <span className="ml-2 rounded-full bg-canvas px-1.5 text-[10px] text-subtle tabular-nums">
                  {category.product_count ?? 0}
                </span>
              </Link>
            ))}
          </nav>
        )}

        <div className="pb-14">
          {loading ? (
            <Spinner label="Loading store shelves…" />
          ) : shelves.length > 0 ? (
            shelves.map((shelf) => (
              <CategoryShelf key={shelf.category.id} shelf={shelf} vendorId={vendor?.id} />
            ))
          ) : (
            <div className="mt-6">
              <EmptyState
                icon={Store}
                title="No products yet"
                message="This vendor has not published any products yet."
                action={
                  <Link to="/shop" className="btn-primary">
                    Keep shopping
                  </Link>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
