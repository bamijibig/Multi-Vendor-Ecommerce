import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { BadgeCheck, Check, ImageOff, Minus, Plus, ShoppingCart, Star, Store, Truck } from 'lucide-react';
import { Alert, EmptyState, Rating, Spinner } from '../components/ui/Ui';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { catalogApi } from '../services/catalog';
import { getErrorMessage } from '../services/api';
import { formatDate, formatPrice } from '../lib/format';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isCustomer, user } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState('description');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartMessage, setCartMessage] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewForm, setReviewForm] = useState({ stars: 5, review_message: '', review_images: null });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([catalogApi.product(slug), catalogApi.reviews(slug)])
      .then(([productData, reviewData]) => {
        if (cancelled) return;
        setProduct(productData);
        setSelectedImage(productData.images?.[0]?.url || productData.primary_image);
        setReviews(reviewData.results || []);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, 'Product not found.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const safeDescription = useMemo(
    () => DOMPurify.sanitize(product?.description || ''),
    [product?.description]
  );
  const safeDetails = useMemo(
    () => DOMPurify.sanitize(product?.details_description || ''),
    [product?.details_description]
  );

  async function handleAddToCart() {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setCartMessage('');
    try {
      await addItem(product.id, quantity);
      setCartMessage('Product added to your cart.');
    } catch (err) {
      setCartMessage(getErrorMessage(err, 'Could not add to cart.'));
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    setReviewError('');
    setReviewSuccess('');
    if (!reviewForm.review_message.trim()) {
      setReviewError('Please write a short review.');
      return;
    }
    setReviewBusy(true);
    try {
      await catalogApi.addReview(slug, {
        stars: reviewForm.stars,
        review_message: reviewForm.review_message,
        review_images: reviewForm.review_images || undefined,
      });
      setReviewSuccess('Thank you! Your review has been published.');
      setReviewForm({ stars: 5, review_message: '', review_images: null });
      const data = await catalogApi.reviews(slug);
      setReviews(data.results || []);
    } catch (err) {
      setReviewError(getErrorMessage(err, 'Could not submit review.'));
    } finally {
      setReviewBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading product…" />;
  if (error || !product) {
    return (
      <div className="container-page py-16">
        <Alert>{error || 'Product not found.'}</Alert>
        <Link to="/shop" className="btn-primary mt-4">Back to shop</Link>
      </div>
    );
  }

  const gallery = product.images?.length
    ? product.images.map((image) => image.url)
    : product.primary_image
    ? [product.primary_image]
    : [];
  const discount = product.discount_percent || 0;
  const maxQuantity = Math.min(50, product.stoc || 1);

  return (
    <div className="container-page py-8">
      <nav className="mb-5 text-xs text-slate-500">
        <Link to="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/shop" className="hover:text-brand">Shop</Link>
        {product.category && (
          <>
            <span className="mx-2">/</span>
            <Link to={`/shop?category=${product.category.id}`} className="hover:text-brand">
              {product.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-[#f0ebe2]">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={product.title}
                className="h-full w-full object-contain p-6 sm:p-10"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-300">
                <ImageOff className="h-16 w-16" />
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((image) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                  className={`aspect-square w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-paper p-1 transition ${
                    selectedImage === image ? 'border-brand' : 'border-line hover:border-brand/50'
                  }`}
                >
                  <img src={image} alt="Product thumbnail" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {product.vendor_store && (
            <Link
              to={`/store/${product.vendor_store.slug}`}
              className="mb-3 inline-flex flex-wrap items-center gap-2 rounded-full border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold text-navy transition hover:border-brand hover:text-brand"
            >
              <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-brand-light text-brand">
                {product.vendor_store.logo ? (
                  <img
                    src={product.vendor_store.logo}
                    alt={product.vendor_store.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Store className="h-3.5 w-3.5" />
                )}
              </span>
              {product.vendor_store.name}
              {product.vendor_store.is_official && (
                <span className="official-badge !px-2 !py-0.5 text-[10px]">
                  <BadgeCheck className="h-3 w-3" />
                  {product.vendor_store.official_badge || 'Official Store'}
                </span>
              )}
            </Link>
          )}
          <h1 className="text-2xl font-semibold leading-snug text-navy sm:text-3xl">
            {product.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Rating value={product.average_rating} count={product.review_count} size="lg" />
            <span className={`badge gap-1.5 ${product.in_stock ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${product.in_stock ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="tabular-nums">
                {product.in_stock ? `${product.stoc} in stock` : 'Out of stock'}
              </span>
            </span>
            {product.modle && (
              <span className="text-xs text-slate-500">Model: {product.modle}</span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <span className="price text-4xl font-semibold text-brand">
              {formatPrice(product.discounted_price)}
            </span>
            {discount > 0 && (
              <>
                <span className="price text-lg text-slate-400 line-through">
                  {formatPrice(product.regular_price)}
                </span>
                <span className="badge bg-navy text-white">Save {discount}%</span>
              </>
            )}
          </div>

          <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-slate-600">
            {product.description?.replace(/<[^>]+>/g, ' ').slice(0, 260)}…
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-md border border-line">
              <button
                type="button"
                aria-label="Decrease quantity"
                className="px-3 py-2.5 text-slate-500 hover:text-brand"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-sm font-medium tabular-nums">{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                className="px-3 py-2.5 text-slate-500 hover:text-brand"
                onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              className="btn-primary px-7 py-3"
              disabled={!product.in_stock}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4 w-4" />
              {product.in_stock ? 'Add to cart' : 'Out of stock'}
            </button>
            <Link to="/cart" className="btn-outline px-5 py-3">View cart</Link>
          </div>
          {cartMessage && <p className="mt-2 text-sm text-slate-600">{cartMessage}</p>}

          {product.tag_list?.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-navy">Tags:</span>
              {product.tag_list.map((tag) => (
                <Link key={tag} to={`/shop?search=${encodeURIComponent(tag)}`} className="badge bg-slate-100 hover:bg-brand-light hover:text-brand">
                  {tag}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-2 text-slate-600">
              <Truck className="h-4 w-4 text-brand" /> Tracked delivery from the vendor
            </p>
            <p className="flex items-center gap-2 text-slate-600">
              <Check className="h-4 w-4 text-brand" /> Secure Stripe checkout
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <section className="mt-12">
        <div className="flex gap-1 overflow-x-auto border-b border-line">
          {[
            ['description', 'Description'],
            ['additional', 'Specifications'],
            ['reviews', `Reviews (${reviews.length})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`whitespace-nowrap px-5 py-3 text-sm font-medium transition ${
                tab === key
                  ? 'border-b-2 border-brand text-brand'
                  : 'text-slate-500 hover:text-navy'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="py-6">
          {tab === 'description' && (
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="prose-html max-w-none" dangerouslySetInnerHTML={{ __html: safeDescription }} />
              <div className="prose-html max-w-none text-sm" dangerouslySetInnerHTML={{ __html: safeDetails }} />
            </div>
          )}

          {tab === 'additional' && (
            product.additional_information?.length ? (
              <table className="w-full max-w-xl text-sm">
                <tbody>
                  {product.additional_information.map((info) => (
                    <tr key={info.id} className="border-b border-line">
                      <th className="w-1/3 py-3 pr-4 text-left font-medium text-navy">{info.specification}</th>
                      <td className="py-3 text-slate-600">{info.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500">No additional information provided.</p>
            )
          )}

          {tab === 'reviews' && (
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <div>
                {reviews.length === 0 ? (
                  <EmptyState
                    icon={Star}
                    title="No reviews yet"
                    message="Be the first customer to review this product."
                  />
                ) : (
                  <ul className="space-y-4">
                    {reviews.map((review) => (
                      <li key={review.id} className="card p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-navy">{review.user_name || 'Customer'}</p>
                            <p className="text-xs text-slate-400">{formatDate(review.created_at)}</p>
                          </div>
                          <Rating value={review.stars} />
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{review.review_message}</p>
                        {review.review_images && (
                          <img src={review.review_images} alt="Review attachment" className="mt-3 h-24 rounded object-cover" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card h-fit p-5">
                <h3 className="text-base font-semibold text-navy">Write a review</h3>
                {isCustomer ? (
                  <form className="mt-3 space-y-3" onSubmit={submitReview}>
                    <div>
                      <span className="label">Your rating</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            aria-label={`${star} star`}
                            onClick={() => setReviewForm((form) => ({ ...form, stars: star }))}
                          >
                            <Star
                              className={`h-6 w-6 ${
                                star <= reviewForm.stars
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="review-message">Review</label>
                      <textarea
                        id="review-message"
                        rows={4}
                        className="input"
                        value={reviewForm.review_message}
                        onChange={(event) => setReviewForm((form) => ({ ...form, review_message: event.target.value }))}
                        placeholder="What did you like or dislike?"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="review-image">Photo (optional)</label>
                      <input
                        id="review-image"
                        type="file"
                        accept="image/*"
                        className="input py-2 text-xs"
                        onChange={(event) => setReviewForm((form) => ({ ...form, review_images: event.target.files?.[0] || null }))}
                      />
                    </div>
                    {reviewError && <Alert>{reviewError}</Alert>}
                    {reviewSuccess && <Alert type="success">{reviewSuccess}</Alert>}
                    <button type="submit" className="btn-primary w-full" disabled={reviewBusy}>
                      {reviewBusy ? 'Submitting…' : 'Publish review'}
                    </button>
                  </form>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    {isAuthenticated
                      ? 'Only customer accounts can leave reviews.'
                      : 'Please log in as a customer to leave a review.'}{' '}
                    {!isAuthenticated && (
                      <Link to="/login" className="font-medium text-brand">Log in</Link>
                    )}
                    {isAuthenticated && ` Signed in as ${user?.email}.`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
