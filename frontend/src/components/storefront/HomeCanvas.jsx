import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Layers, Sparkles, Store, Truck } from 'lucide-react';
import { MobileCategoryPills } from './CategorySidebar';

const QUICK_LINKS = [
  { label: 'Official Stores', icon: BadgeCheck, href: '/official-stores' },
  { label: 'Free Delivery', icon: Truck, href: '/shop' },
  { label: 'Top Deals', icon: Layers, href: '/shop' },
  { label: 'Sell With Us', icon: Store, href: '/vendor/register' },
];

const HERO_BANNERS = [
  {
    title: 'Top Cameras',
    subtitle: 'Bestseller Products',
    offer: 'Sale Up To 60% Off',
    href: '/shop',
  },
  {
    title: 'Smart Watches',
    subtitle: 'Everyday Essentials',
    offer: 'Up To -30%',
    href: '/shop',
  },
  {
    title: 'Fresh Arrivals',
    subtitle: 'New Season Picks',
    offer: 'Up To -20%',
    href: '/shop',
  },
  {
    title: 'Official Brands',
    subtitle: 'Verified Storefronts',
    offer: 'Free Shipping',
    href: '/official-stores',
  },
];

export function HomeCanvas({ categories = [] }) {
  const safeCategories = Array.isArray(categories) ? categories.filter(Boolean) : [];
  const featured = safeCategories[0];

  return (
    <section className="bg-canvas pt-6">
      <div className="container-page">
        {/* Category pill rail */}
        <MobileCategoryPills categories={safeCategories} />

        <div className="mb-5 flex flex-wrap items-center gap-2 lg:flex-nowrap">
          {QUICK_LINKS.map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              to={href}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-xs font-medium text-ink transition hover:border-brand hover:bg-brand-light"
            >
              <Icon className="h-3.5 w-3.5 text-accent" />
              {label}
            </Link>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Slider area */}
          <div className="relative flex min-h-[320px] flex-col justify-center overflow-hidden rounded-card bg-navy-header px-7 py-10 text-white sm:px-12 lg:min-h-[430px]">
            <span className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
            <span className="absolute -bottom-20 left-10 h-44 w-44 rounded-full border border-white/10" />

            <div className="relative max-w-lg">
              <span className="inline-flex items-center gap-2 rounded-sm bg-brand px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink">
                <Sparkles className="h-3.5 w-3.5" />
                Sale 60% Off
              </span>
              <h1 className="mt-4 font-display text-3xl font-medium leading-tight text-white sm:text-4xl lg:text-[44px]">
                {featured?.name || 'MultiVendorEshop'}
                <br />
                <span className="text-brand">Marketplace</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
                Discounts up to 60% on products from verified vendors, with free shipping on
                qualifying orders.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={featured?.slug ? `/shop?category=${encodeURIComponent(featured.slug)}` : '/shop'}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3 text-[13px] font-medium uppercase tracking-wide text-ink transition hover:bg-brand-dark"
                >
                  Discover now <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3 text-[13px] font-medium uppercase tracking-wide text-white transition hover:border-brand hover:text-brand"
                >
                  Shop all
                </Link>
              </div>
            </div>
          </div>

          {/* Four banner cards */}
          <div className="grid grid-cols-2 gap-4">
            {HERO_BANNERS.map(({ title, subtitle, offer, href }) => (
              <Link
                key={title}
                to={href}
                className="group flex flex-col justify-between rounded-card bg-paper p-5 transition hover:shadow-card"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-brand-dark">
                  <BadgeCheck className="h-4 w-4" />
                </span>
                <span className="mt-6 block">
                  <span className="block font-display text-[15px] font-medium leading-snug text-ink group-hover:text-accent">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-xs text-subtle">{subtitle}</span>
                  <span className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-sale">
                    {offer}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomeCanvas;
