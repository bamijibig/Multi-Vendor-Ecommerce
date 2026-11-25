import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from '../products/ProductCard';
import { categoryHref } from './categoryVisuals';

const PRODUCT_WIDTHS = 'w-[168px] shrink-0 snap-start sm:w-[200px] lg:w-[216px]';

export default function CategoryShelf({ shelf, vendorId }) {
  const category = shelf?.category || null;
  const products = Array.isArray(shelf?.products) ? shelf.products.filter(Boolean) : [];
  if (!category || products.length === 0) return null;

  const productCount = category.product_count ?? products.length;

  return (
    <section className="bg-canvas pt-8">
      <div className="container-page">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="section__title">
            <h2 className="section-title">{category.name}</h2>
            <p className="mt-1 text-xs text-subtle">{productCount} Products</p>
          </div>
          <Link
            to={categoryHref(category, vendorId)}
            className="inline-flex items-center gap-1 text-[13px] font-medium uppercase tracking-wide text-ink transition hover:text-accent"
          >
            See All Product <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="relative">
          <div className="rail">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
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
            <span className="text-[11px] text-subtle">{productCount} Products</span>
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
  );
}
