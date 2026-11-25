import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Sparkles, Truck } from 'lucide-react';

const BANNERS = [
  {
    eyebrow: 'Official Stores',
    title: 'Microsoft Surface Laptop 14"',
    offer: 'Up To -30%',
    href: '/official-stores',
    icon: BadgeCheck,
  },
  {
    eyebrow: 'AI Bulk Listing',
    title: 'Publish a whole catalogue in minutes',
    offer: 'Quick List',
    href: '/vendor/register',
    icon: Sparkles,
  },
  {
    eyebrow: 'Nationwide Delivery',
    title: 'Cameras — Best Sport Edition',
    offer: 'Up To -20%',
    href: '/shop',
    icon: Truck,
  },
];

export function HeroPromoStrip({ categories = [] }) {
  const firstCategory = Array.isArray(categories) ? categories.filter(Boolean)[0] : null;

  return (
    <section className="bg-canvas pt-6">
      <div className="container-page">
        <div className="grid gap-4 sm:grid-cols-3">
          {BANNERS.map(({ eyebrow, title, offer, href, icon: Icon }, index) => (
            <Link
              key={eyebrow}
              to={index === 0 && firstCategory?.slug ? `/shop?category=${encodeURIComponent(firstCategory.slug)}` : href}
              className="group relative flex min-h-[170px] flex-col justify-end overflow-hidden rounded-card bg-navy-header p-6 text-white transition hover:shadow-card"
            >
              <span className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5" />
              <span className="relative mb-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand text-ink">
                <Icon className="h-4 w-4" />
              </span>
              <span className="relative block text-[10px] font-medium uppercase tracking-[0.18em] text-white/60">
                {eyebrow}
              </span>
              <span className="relative mt-1 block font-display text-[17px] font-medium leading-snug text-white group-hover:text-brand">
                {title}
              </span>
              <span className="relative mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-brand">
                {offer} <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HeroPromoStrip;
