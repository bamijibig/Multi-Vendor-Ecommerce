import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CATEGORY_TONES, categoryHref, getCategoryIcon } from './categoryVisuals';

export default function CategoryTileStrip({
  categories = [],
  vendorId,
  title = 'Shop all categories',
}) {
  if (!categories.length) return null;

  return (
    <section className="container-page py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="section-eyebrow">Quick access</p>
          <h2 className="font-display text-xl font-semibold text-navy">{title}</h2>
        </div>
        <Link
          to={vendorId ? `/shop?vendor_store=${vendorId}` : '/shop'}
          className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:text-brand"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-9">
        {categories.map((category, index) => {
          const Icon = getCategoryIcon(category.name);
          return (
            <Link
              key={category.id}
              to={categoryHref(category, vendorId)}
              className="group flex min-w-0 flex-col items-center rounded-xl p-1 text-center transition hover:-translate-y-0.5"
            >
              <span
                className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br shadow-sm ring-1 ring-black/5 ${CATEGORY_TONES[index % CATEGORY_TONES.length]}`}
              >
                {category.banner || category.banner_url ? (
                  <img
                    src={category.banner || category.banner_url}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <Icon className="relative h-6 w-6 text-white/90 transition duration-300 group-hover:scale-110" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
              </span>
              <span className="mt-1.5 line-clamp-2 text-[10.5px] font-semibold leading-tight text-slate-600 transition group-hover:text-brand">
                {category.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
