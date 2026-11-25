import { Link } from 'react-router-dom';
import { BadgeCheck, Store } from 'lucide-react';

export function OfficialBrandDayBanners({ stores = [] }) {
  const safeStores = Array.isArray(stores) ? stores.filter(Boolean) : [];
  if (safeStores.length === 0) return null;

  return (
    <section className="bg-canvas pt-10">
      <div className="container-page">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="section-title">Official Brand Days</h2>
          <Link
            to="/official-stores"
            className="inline-flex items-center gap-1 text-[13px] font-medium uppercase tracking-wide text-ink transition hover:text-accent"
          >
            All Stores
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {safeStores.map((store) => (
            <div key={store.id} className="rounded-card bg-paper p-5 transition hover:shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {store.logo ? (
                    <img
                      src={store.logo}
                      alt={store.name}
                      className="h-12 w-12 rounded-full bg-canvas object-contain"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-brand-dark">
                      <Store className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-medium text-ink">{store.name}</p>
                    <p className="text-[11px] text-subtle">Official Store</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-brand px-2 py-1 text-[10px] font-medium text-ink">
                  <BadgeCheck className="h-3 w-3" /> Official
                </span>
              </div>

              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">
                {store.official_tagline || 'Trusted by thousands of buyers. Shop now for curated quality.'}
              </p>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  to={`/store/${store.slug}`}
                  className="flex-1 rounded-full bg-accent py-2 text-center text-[11px] font-medium uppercase tracking-wide text-white transition hover:bg-accent-dark"
                >
                  Shop Now
                </Link>
                <Link
                  to={`/store/${store.slug}`}
                  className="shrink-0 rounded-full border border-line px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-ink transition hover:border-accent hover:text-accent"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OfficialStoreTileRow({ stores = [] }) {
  const safeStores = Array.isArray(stores) ? stores.filter(Boolean) : [];
  if (safeStores.length === 0) return null;

  return (
    <section className="bg-canvas pt-6">
      <div className="container-page">
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-paper p-4">
          <Link
            to="/official-stores"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-navy-dark"
          >
            <BadgeCheck className="h-3.5 w-3.5 text-brand" />
            Official Stores
          </Link>
          {safeStores.map((store) => (
            <Link
              key={store.id}
              to={`/store/${store.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-xs font-medium text-ink transition hover:border-accent hover:text-accent"
            >
              <BadgeCheck className="h-3.5 w-3.5 text-brand" />
              {store.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
