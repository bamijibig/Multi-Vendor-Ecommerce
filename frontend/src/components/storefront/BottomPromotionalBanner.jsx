import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Sparkles, TrendingUp, Truck } from 'lucide-react';

const FEATURES = [
  {
    eyebrow: 'Official Stores',
    title: 'Verified sellers, one destination',
    body: 'Every storefront is brand-verified and buyer-protected before it earns your trust.',
    link: '/official-stores',
    cta: 'Explore Stores',
    icon: BadgeCheck,
  },
  {
    eyebrow: 'AI Bulk & Quick Listing',
    title: 'Publish fast with AI-assisted uploads',
    body: 'Turn a spreadsheet into a live catalogue in minutes, not days.',
    link: '/vendor/register',
    cta: 'Start Selling',
    icon: Sparkles,
  },
  {
    eyebrow: 'Nationwide Delivery',
    title: 'Fast delivery on every order',
    body: 'Track your package from listing day to doorstep across the country.',
    link: '/shop',
    cta: 'Shop Now',
    icon: Truck,
  },
  {
    eyebrow: 'Top Deals',
    title: 'Curated picks from trusted brands',
    body: 'Daily drops, rating-sorted listings, and prices that hold.',
    link: '/shop',
    cta: 'See Deals',
    icon: TrendingUp,
  },
];

export default function BottomPromotionalBanner() {
  return (
    <section className="bg-canvas pt-10">
      <div className="container-page">
        <div className="rounded-card bg-paper p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 className="section-title">Shop With Confidence</h2>
            <Link
              to="/shop"
              className="inline-flex items-center gap-1 text-[13px] font-medium uppercase tracking-wide text-ink transition hover:text-accent"
            >
              See All Product <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ eyebrow, title, body, link, cta, icon: Icon }) => (
              <Link
                key={eyebrow}
                to={link}
                className="group flex flex-col rounded-card border border-line p-5 transition hover:border-brand hover:shadow-card"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-brand-dark">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="mt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-subtle">
                  {eyebrow}
                </span>
                <span className="mt-1 font-display text-[15px] font-medium leading-snug text-ink group-hover:text-accent">
                  {title}
                </span>
                <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{body}</span>
                <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-white transition group-hover:bg-accent-dark">
                  {cta} <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
