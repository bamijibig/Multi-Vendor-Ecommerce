import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from '../products/ProductCard';
import CategoryCircleGrid from './CategoryCircleGrid';
import { categoryHref } from './categoryVisuals';

const SHELF_TITLES = ['Flash Sales', 'Top Deals Of The Day', 'Top Sellers', 'New Arrivals'];

const PRODUCT_WIDTHS =
  'w-[168px] shrink-0 snap-start sm:w-[200px] lg:w-[216px]';

function placeholderProduct(index) {
  return {
    id: `placeholder-${index}`,
    title: 'No product for this shelf yet',
    slug: `placeholder-${index}`,
    discounted_price: 0,
    regular_price: 0,
    discount_percent: 0,
    primary_image: null,
    stoc: 0,
    out_of_stock: true,
    in_stock: false,
    average_rating: null,
    review_count: 0,
    category: { name: '' },
    vendor_store: null,
  };
}

export default function HomeShelves({ categories = [], categoryShelfCount = 0 }) {
  const safeCategories = Array.isArray(categories) ? categories.filter(Boolean) : [];

  return (
    <>
      <section className="bg-canvas pt-8">
        <div className="container-page">
          <CategoryCircleGrid categories={safeCategories} />
        </div>
      </section>

      {SHELF_TITLES.map((title, index) => (
        <section key={title} className="bg-canvas pt-8">
          <div className="container-page">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="section__title">
                <h2 className="section-title">{title}</h2>
              </div>
              <Link
                to="/shop"
                className="inline-flex items-center gap-1 text-[13px] font-medium uppercase tracking-wide text-ink transition hover:text-accent"
              >
                See All Product <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="relative">
              <div className="rail">
                {Array.from({ length: 6 }).map((_, itemIndex) => (
                  <ProductCard
                    key={`${title}-${itemIndex}`}
                    product={placeholderProduct(itemIndex)}
                    compact
                    shelf
                    className={PRODUCT_WIDTHS}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
                <button
                  type="button"
                  aria-label="Scroll products left"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] text-subtle">
                  {categoryShelfCount} categor{categoryShelfCount === 1 ? 'y' : 'ies'}
                </span>
                <button
                  type="button"
                  aria-label="Scroll products right"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper text-muted"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      ))}

      {safeCategories.length > 0 && (
        <section className="bg-canvas pt-8">
          <div className="container-page">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="section__title">
                <h2 className="section-title">Popular Categories</h2>
              </div>
              <Link
                to="/shop"
                className="inline-flex items-center gap-1 text-[13px] font-medium uppercase tracking-wide text-ink transition hover:text-accent"
              >
                See All <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {safeCategories.slice(0, 6).map((category) => (
                <Link
                  key={category.id}
                  to={categoryHref(category)}
                  className="group rounded-card bg-paper p-4 text-center transition hover:shadow-card"
                >
                  <span className="mx-auto block h-16 w-16 overflow-hidden rounded-full bg-canvas">
                    {category.banner_url || category.banner ? (
                      <img
                        src={category.banner_url || category.banner}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-medium text-brand-dark">
                        {String(category.name || '?').charAt(0)}
                      </span>
                    )}
                  </span>
                  <span className="mt-3 block truncate font-display text-sm font-medium text-ink group-hover:text-accent">
                    {category.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-subtle">
                    {category.product_count ?? 0} Products
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
