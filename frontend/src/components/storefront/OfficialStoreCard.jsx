import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, Store } from 'lucide-react';

export default function OfficialStoreCard({ store }) {
  if (!store) return null;

  return (
    <Link
      to={`/store/${store.slug}`}
      className="group overflow-hidden rounded-card bg-paper transition duration-300 hover:shadow-card"
    >
      <div className="relative h-28 overflow-hidden bg-navy-header">
        {store.cover_photo ? (
          <img
            src={store.cover_photo}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-105"
          />
        ) : (
          <>
            <span className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-brand/25 blur-2xl" />
            <span className="absolute -bottom-14 left-8 h-32 w-32 rounded-full border border-white/15" />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-header/85 to-transparent" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-sm bg-brand px-2 py-1 text-[10px] font-medium text-ink">
          <BadgeCheck className="h-3.5 w-3.5" />
          {store.official_badge || 'Official Store'}
        </span>
      </div>

      <div className="relative px-4 pb-4 pt-10">
        <div className="absolute -top-8 left-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-paper bg-canvas text-brand-dark">
          {store.logo ? (
            <img src={store.logo} alt={store.name} className="h-full w-full object-cover" />
          ) : (
            <Store className="h-7 w-7" />
          )}
        </div>
        <span className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink transition group-hover:border-accent group-hover:bg-accent group-hover:text-white">
          <ArrowUpRight className="h-4 w-4" />
        </span>
        <h3 className="pr-10 font-display text-[15px] font-medium text-ink group-hover:text-accent">
          {store.name}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-muted">
          {store.official_tagline ||
            'Verified flagship store with curated products and dependable fulfilment.'}
        </p>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
          {store.product_count ?? 0} product{store.product_count === 1 ? '' : 's'}
        </p>
      </div>
    </Link>
  );
}
