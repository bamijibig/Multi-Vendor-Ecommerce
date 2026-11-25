import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const TONES = [
  'from-[#263C97] via-[#3B5BB5] to-[#7C9BE8]',
  'from-[#0FA5C3] via-[#16BCDC] to-[#8CE4F3]',
  'from-[#8A6A00] via-[#E9AD00] to-[#FFD873]',
  'from-[#2F3037] via-[#5A5C66] to-[#A8AAB3]',
  'from-[#1F6B3B] via-[#5AAB19] to-[#AEDB86]',
];

function categoryHref(category, vendorId) {
  const params = new URLSearchParams({ category: category.id });
  if (vendorId) params.set('vendor_store', vendorId);
  return `/shop?${params.toString()}`;
}

export default function CategoryBannerShelf({
  categories = [],
  vendorId,
  title = 'Shop the edit',
  eyebrow = 'Curated departments',
  description = 'Five categories, hand-picked for the season.',
  limit = 5,
  embedded = false,
}) {
  const visible = categories.slice(0, limit);
  if (!visible.length) return null;

  return (
    <section className={embedded ? 'py-10' : 'container-page py-12'}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 className="section-title">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        </div>
        <Link
          to={vendorId ? `/shop?vendor_store=${vendorId}` : '/shop'}
          className="inline-flex items-center gap-1 text-sm font-semibold text-navy hover:text-brand"
        >
          Browse everything <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {visible.map((category, index) => (
          <Link
            key={category.id}
            to={categoryHref(category, vendorId)}
            className={`group relative flex aspect-[4/5] min-h-[240px] flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift ${TONES[index % TONES.length]}`}
          >
            {category.banner || category.banner_url ? (
              <img
                src={category.banner || category.banner_url}
                alt=""
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <>
                <span className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
                <span className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full border border-white/15" />
              </>
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

            <span className="relative mb-auto w-fit rounded-full border border-white/25 bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="relative">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {(category.product_count ?? 0) > 0
                  ? `${category.product_count} item${category.product_count === 1 ? '' : 's'}`
                  : 'Explore'}
              </span>
              <span className="mt-1 block font-display text-xl font-semibold leading-tight text-white">
                {category.name}
              </span>
              <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-white/75">
                {category.tagline || `Fresh ${category.name.toLowerCase()} picks from trusted sellers.`}
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white">
                Shop now
                <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
