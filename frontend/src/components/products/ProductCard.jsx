import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, ImageOff, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { getErrorMessage } from '../../services/api';
import { formatPrice } from '../../lib/format';
import { Rating } from '../ui/Ui';

export default function ProductCard({
  product,
  compact = false,
  shelf = false,
  square = false,
  className = '',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!product) return null;

  const discount = Number(product.discount_percent) || 0;
  const inStock = Boolean(product.in_stock);
  const lowStock = inStock && Number(product.stoc) <= 5;
  const stockWidth = Math.max(8, Math.min((Number(product.stoc || 0) / 20) * 100, 100));
  const vendor = product.vendor_store || null;

  async function handleAdd(event) {
    event.preventDefault();
    if (!inStock) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await addItem(product.id, 1);
      setMessage('Added to cart');
      setTimeout(() => setMessage(''), 1800);
    } catch (error) {
      setMessage(getErrorMessage(error, 'Could not add to cart.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={`group relative flex h-full flex-col rounded-card bg-paper p-4 transition duration-300 hover:shadow-card ${className}`}
    >
      <Link
        to={`/product/${product.slug}`}
        className={`product-frame block ${square ? '' : '!aspect-[4/5]'}`}
      >
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.title}
            className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-line">
            <ImageOff className="h-10 w-10" />
          </div>
        )}

        {/* Template discount chip: green, 2px radius, 12px. */}
        {discount > 0 && (
          <span className="absolute left-0 top-0 rounded-sm bg-stock px-2.5 py-0.5 text-xs font-normal text-white">
            -{discount}%
          </span>
        )}
        {vendor?.is_official && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm bg-brand px-2 py-1 text-[10px] font-medium text-ink">
            <BadgeCheck className="h-3 w-3" /> Official
          </span>
        )}
        {!inStock && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/85 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-white">
            Out of stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col pt-3">
        {product.category?.name && (
          <p className="text-[11px] uppercase tracking-wide text-subtle">{product.category.name}</p>
        )}

        <h3 className="mt-0.5 line-clamp-2 font-display text-[15px] font-medium leading-snug text-ink">
          <Link to={`/product/${product.slug}`} className="hover:text-accent">
            {product.title}
          </Link>
        </h3>

        {vendor?.name && !compact && (
          <Link
            to={`/store/${vendor.slug}`}
            className="mt-1 inline-flex items-center gap-1 text-xs text-subtle hover:text-accent"
          >
            by {vendor.name}
            {vendor.is_official && <BadgeCheck className="h-3.5 w-3.5 text-brand" />}
          </Link>
        )}

        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <Rating value={product.average_rating} count={product.review_count} />
        </div>

        {inStock && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${lowStock ? 'bg-sale' : 'bg-stock'}`}
                style={{ width: `${stockWidth}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-subtle">
              {lowStock ? 'Few units left' : `Available Item: ${product.stoc ?? 0}`}
            </p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
          <div className="flex items-baseline gap-2">
            <span className={`price text-[16px] ${discount > 0 ? 'price-sale' : ''}`}>
              {formatPrice(product.discounted_price)}
            </span>
            {product.regular_price > 0 && discount > 0 && (
              <span className="text-xs text-subtle line-through">
                {formatPrice(product.regular_price)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !inStock}
            title={inStock ? 'Add to cart' : 'Out of stock'}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Add ${product.title} to cart`}
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>

        {message && <p className="mt-1 text-[11px] text-muted">{message}</p>}
      </div>
    </article>
  );
}
