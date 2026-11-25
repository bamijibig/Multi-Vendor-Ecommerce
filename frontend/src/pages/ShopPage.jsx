import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from '../components/products/ProductCard';
import { Alert, EmptyState, Pagination, Spinner } from '../components/ui/Ui';
import { catalogApi } from '../services/catalog';
import { getErrorMessage } from '../services/api';

const SORT_OPTIONS = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'regular_price', label: 'Price: low to high' },
  { value: '-regular_price', label: 'Price: high to low' },
  { value: 'title', label: 'Alphabetical' },
];

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ count: 0, num_pages: 1 });
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const queryString = searchParams.toString();

  const params = useMemo(
    () => Object.fromEntries(new URLSearchParams(queryString).entries()),
    [queryString]
  );
  const page = Number(params.page || 1);

  const activeCategory = useMemo(() => {
    const list = Array.isArray(industries) ? industries : [];
    return list
      .flatMap((industry) => (Array.isArray(industry?.categories) ? industry.categories : []))
      .find(
        (category) =>
          String(category?.id) === String(params.category) || category?.slug === params.category
      );
  }, [industries, params.category]);

  useEffect(() => {
    catalogApi
      .industries()
      .then((data) =>
        setIndustries(Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [])
      )
      .catch(() => setIndustries([]));
  }, []);

  useEffect(() => {
    setMinPrice(params.min_price || '');
    setMaxPrice(params.max_price || '');
  }, [params.min_price, params.max_price]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const query = Object.fromEntries(new URLSearchParams(queryString).entries());
    delete query.page;

    catalogApi
      .products(query)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];
        setProducts(list.filter(Boolean));
        setMeta({
          count: Number(data?.count ?? list.length) || 0,
          num_pages: Number(data?.num_pages) || 1,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setProducts([]);
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  function updateParams(changes) {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') next.delete(key);
      else next.set(key, value);
    });
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  }

  function applyPrice(event) {
    event.preventDefault();
    updateParams({ min_price: minPrice, max_price: maxPrice });
  }

  const activeFilters = ['search', 'category', 'industry', 'min_price', 'max_price'].filter(
    (key) => params[key]
  );
  const industryList = Array.isArray(industries) ? industries.filter(Boolean) : [];

  return (
    <div className="bg-canvas pb-10">
      <div className="container-page pt-6">
        <nav className="mb-4 text-xs text-subtle">
          <Link to="/" className="hover:text-accent">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">Shop</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-medium text-ink sm:text-[26px]">
              {params.search ? `Results for “${params.search}”` : activeCategory?.name || 'All products'}
            </h1>
            <p className="mt-1 text-sm text-muted">{meta.count} product(s) found</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              className="btn-outline lg:hidden"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="hidden sm:inline">Sort</span>
              <select
                value={params.ordering || '-created_at'}
                onChange={(event) => updateParams({ ordering: event.target.value })}
                className="input py-2"
                aria-label="Sort products"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeFilters.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => updateParams({ [key]: '' })}
                className="badge gap-1 border border-line bg-brand-light text-ink"
              >
                {key.replace('_', ' ')}:{' '}
                {key === 'category' ? activeCategory?.name || params[key] : params[key]}
                <X className="h-3 w-3" />
              </button>
            ))}
            <button
              type="button"
              className="text-xs font-medium text-muted underline hover:text-accent"
              onClick={() => setSearchParams({})}
            >
              Clear all
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className={`${filtersOpen ? 'block' : 'hidden'} space-y-5 lg:block`}>
            <div className="rounded-card bg-paper p-5">
              <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-ink">
                <SlidersHorizontal className="h-4 w-4 text-accent" /> Departments
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => updateParams({ industry: '', category: '' })}
                    className={
                      !params.industry && !params.category
                        ? 'font-medium text-accent'
                        : 'text-muted hover:text-accent'
                    }
                  >
                    All departments
                  </button>
                </li>
                {industryList.map((industry) => (
                  <li key={industry.id}>
                    <button
                      type="button"
                      onClick={() => updateParams({ industry: industry.id, category: '' })}
                      className={
                        String(params.industry) === String(industry.id)
                          ? 'font-medium text-accent'
                          : 'text-muted hover:text-accent'
                      }
                    >
                      {industry.name}
                    </button>
                    {String(params.industry) === String(industry.id) && (
                      <ul className="mt-2 space-y-1.5 border-l border-line pl-3">
                        {(Array.isArray(industry.categories) ? industry.categories : []).map(
                          (category) => (
                            <li key={category.id}>
                              <button
                                type="button"
                                onClick={() => updateParams({ category: category.slug })}
                                className={
                                  String(params.category) === String(category.id) ||
                                  params.category === category.slug
                                    ? 'font-medium text-accent'
                                    : 'text-muted hover:text-accent'
                                }
                              >
                                {category.name}
                              </button>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={applyPrice} className="rounded-card bg-paper p-5">
              <h2 className="text-sm font-medium uppercase tracking-wide text-ink">Price</h2>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                  placeholder="Min"
                  className="input py-2"
                  aria-label="Minimum price"
                />
                <span className="text-subtle">–</span>
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="Max"
                  className="input py-2"
                  aria-label="Maximum price"
                />
              </div>
              <button type="submit" className="btn-primary mt-3 w-full">
                Apply
              </button>
            </form>

            <div className="rounded-card bg-paper p-5">
              <h2 className="text-sm font-medium uppercase tracking-wide text-ink">Vendors</h2>
              <p className="mt-2 text-sm text-muted">
                Browse vendor storefronts directly from any product page.
              </p>
              <Link to="/shop" className="mt-3 inline-block text-sm font-medium text-accent">
                Show all products
              </Link>
            </div>
          </aside>

          <section>
            {error && <Alert className="mb-4">{error}</Alert>}
            {loading ? (
              <Spinner label="Loading products…" />
            ) : products.length === 0 ? (
              <EmptyState
                title="No products match your filters"
                message="Try removing a filter or searching for something else."
                action={
                  <button type="button" className="btn-primary" onClick={() => setSearchParams({})}>
                    Clear filters
                  </button>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                <Pagination
                  page={page}
                  numPages={meta.num_pages}
                  onChange={(nextPage) => updateParams({ page: nextPage })}
                />
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
