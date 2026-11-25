import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { catalogApi } from '../../services/catalog';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../lib/format';

const FALLBACK_IMAGE = '/assets/img/features-product/fp-1.jpg';
const asArray = (value) => (Array.isArray(value) ? value : []);

const FALLBACK_SLIDES = [
  {
    id: 'fallback-slide',
    image: '/assets/img/slider/01-slide-1.jpg',
    title: 'MultiVendorEshop',
    discount: 60,
    product_url: '/shop',
  },
];

const BANNERS = [
  {
    image: '/assets/img/banner/banner-14.jpg',
    title: (
      <>
        Microsoft <br />
        Surface Laptop 14”
      </>
    ),
    note: 'Up To -30%',
  },
  {
    image: '/assets/img/banner/banner-15.jpg',
    title: (
      <>
        Cameras <br />
        Best Sport Edition
      </>
    ),
    note: 'Up To -20%',
  },
  {
    image: '/assets/img/banner/banner-16.jpg',
    title: (
      <>
        Sneaker <br />
        Nike Air Max 90
      </>
    ),
    note: 'Up To -60%',
  },
];

function Stars({ rating = 0 }) {
  return (
    <ul>
      {[0, 1, 2, 3, 4].map((index) => (
        <li key={index}>
          <a href="#rating" onClick={(event) => event.preventDefault()}>
            <i className={index < Math.round(Number(rating) || 0) ? 'fas fa-star' : 'fal fa-star'}></i>
          </a>
        </li>
      ))}
    </ul>
  );
}

function stockPercent(product) {
  const stock = Number(product?.stoc) || 0;
  return Math.max(6, Math.min(100, stock));
}

function useAddToCart(onError) {
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return async (productId) => {
    if (!productId) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      await addItem(productId, 1);
    } catch (error) {
      onError?.('We could not add that product to your cart. Please try again.');
    }
  };
}

/** Trending product card from templates/home/trending-product.html. */
function TemplateProductCard({ product, onAdd }) {
  const vendor = product.vendor_store;
  const discount = Number(product.discount_percent ?? product.discounted_parcent) || 0;
  const inStock = product.in_stock ?? (Number(product.stoc) > 0 && !product.out_of_stoc);
  const productHref = `/product/${product.slug}`;

  return (
    <div className="product__item product__item-2 b-radius-2 mb-20">
      <div className="product__thumb fix">
        <div className="product-image w-img">
          <Link to={productHref}>
            <img src={product.primary_image || FALLBACK_IMAGE} alt={product.title || 'product'} />
          </Link>
        </div>
        {discount > 0 && (
          <div className="product__offer">
            <span className="discount">-{discount}%</span>
          </div>
        )}
        <div className="product-action product-action-2">
          <Link to={productHref} className="icon-box icon-box-1">
            <i className="fal fa-eye"></i>
            <i className="fal fa-eye"></i>
          </Link>
          <Link to={productHref} className="icon-box icon-box-1">
            <i className="fal fa-heart"></i>
            <i className="fal fa-heart"></i>
          </Link>
          <Link to={productHref} className="icon-box icon-box-1">
            <i className="fal fa-layer-group"></i>
            <i className="fal fa-layer-group"></i>
          </Link>
        </div>
      </div>
      <div className="product__content product__content-2">
        <h6>
          <Link to={productHref}>{product.title}</Link>
        </h6>
        {vendor && (
          <strong>
            <Link to={`/store/${vendor.slug}`}>{vendor.name}</Link>
          </strong>
        )}
        <div className="rating mb-5 mt-10">
          <Stars rating={product.average_rating} />
          <span>({product.review_count ?? 0} review)</span>
        </div>
        <div className="price">
          <p>{formatPrice(product.discounted_price)}</p>
        </div>
        <div className="progress mb-5">
          <div className="progress-bar bg-danger" role="progressbar" style={{ width: `${stockPercent(product)}%` }}></div>
        </div>
        <div className="progress-rate mb-15">
          <span>Avilable Item: {product.stoc ?? 0}</span>
        </div>
      </div>
      <div className="product__add-cart text-center">
        {inStock ? (
          <a
            href={`#add-to-cart-${product.id}`}
            className="cart-btn-3 product-modal-sidebar-open-btn d-flex align-items-center justify-content-center w-100"
            onClick={(event) => {
              event.preventDefault();
              onAdd(product.id);
            }}
          >
            Add to Cart
          </a>
        ) : (
          <p className="cart-btn-3 product-modal-sidebar-open-btn d-flex align-items-center justify-content-center w-100">
            Out of Stock
          </p>
        )}
      </div>
    </div>
  );
}

function CatalogueHead({ title, className = 'st-titile' }) {
  return (
    <div className="row">
      <div className="col-xl-12">
        <div className="section__head d-flex justify-content-between mb-30">
          <div className="section__title section__title-2">
            <h5 className={className}>{title}</h5>
          </div>
          <div className="button-wrap button-wrap-2">
            <Link to="/shop">
              See All Product <i className="fal fa-chevron-right"></i>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** templates/home/front-slider.html */
function SliderArea({ slides, hotProducts }) {
  const [active, setActive] = useState(0);
  const items = slides.length ? slides : FALLBACK_SLIDES;

  useEffect(() => {
    if (items.length < 2) return undefined;
    const timer = setInterval(() => setActive((index) => (index + 1) % items.length), 6000);
    return () => clearInterval(timer);
  }, [items.length]);

  return (
    <div className="slider-area light-bg-s pt-60">
      <div className="container custom-conatiner">
        <div className="row">
          <div className="col-xl-7">
            <div className="swiper-container slider__active pb-30">
              <div className="slider-wrapper swiper-wrapper">
                {items.map((slide, index) => (
                  <div
                    key={slide.id ?? index}
                    className={`single-slider swiper-slide b-radius-2 slider-height-2 d-flex align-items-center${
                      index === active ? ' swiper-slide-active' : ''
                    }`}
                    data-background={slide.image}
                    style={{
                      backgroundImage: `url(${slide.image || FALLBACK_SLIDES[0].image})`,
                      display: index === active ? 'flex' : 'none',
                    }}
                  >
                    <div className="slider-content slider-content-2">
                      <h2 className="pt-15 slider-title pb-5">
                        SALE {slide.discount ?? 60}% OFF
                        <br />
                        {slide.title}
                      </h2>
                      <p className="pr-20 slider_text">
                        Discount {slide.discount ?? 60}% On Products &amp; Free Shipping
                      </p>
                      <div className="slider-bottom-btn mt-65">
                        <Link
                          to={slide.product_url || '/shop'}
                          className="st-btn-border b-radius-2"
                        >
                          Discover now
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="main-slider-paginations">
                  {items.map((slide, index) => (
                    <button
                      key={slide.id ?? index}
                      type="button"
                      aria-label={`Go to slide ${index + 1}`}
                      className={`swiper-pagination-bullet${
                        index === active ? ' swiper-pagination-bullet-active' : ''
                      }`}
                      style={{ border: 0, marginRight: 6 }}
                      onClick={() => setActive(index)}
                    ></button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-5">
            <div className="row">
              {hotProducts.map((hotProduct) => (
                <div className="col-xl-6 col-lg-6 col-md-6" key={hotProduct.id}>
                  <div className="banner__item p-relative w-img mb-30">
                    <div className="banner__img b-radius-2">
                      <Link to={hotProduct.product_url || '/shop'}>
                        <img
                          src={hotProduct.image || FALLBACK_IMAGE}
                          alt={hotProduct.title || 'featured'}
                        />
                      </Link>
                    </div>
                    <div className="banner__content banner__content-2">
                      <h6>
                        <Link to={hotProduct.product_url || '/shop'}>{hotProduct.title}</Link>
                      </h6>
                      <p>
                        <Link to={`/shop?category=${hotProduct.category_slug || hotProduct.categories}`}>
                          {hotProduct.category_name || 'Category'}
                        </Link>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** templates/home/trending-product.html */
function TrendingProducts({ products, onAdd }) {
  return (
    <section className="trending-product-area light-bg-s pt-25 pb-15">
      <div className="container custom-conatiner">
        <CatalogueHead title="Trending Product" />
        <div className="row">
          {products.map((product) => (
            <div className="col-sm-6 col-md-4 col-lg-3 col-xl-3 col-xxl-2" key={product.id}>
              <TemplateProductCard product={product} onAdd={onAdd} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Countdown() {
  const target = useMemo(() => Date.now() + 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 32, []);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(0, target - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining / 3600000) % 24);
  const minutes = Math.floor((remaining / 60000) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);
  const pad = (value) => String(value).padStart(2, '0');

  return (
    <div className="countdown">
      <div className="countdown-inner b-radius-2" data-countdown="" data-date="">
        <ul className="text-center">
          <li><span data-days="">{pad(days)}</span> Days</li>
          <li><span data-hours="">{pad(hours)}</span> Hours</li>
          <li><span data-minutes="">{pad(minutes)}</span> Mins</li>
          <li><span data-seconds="">{pad(seconds)}</span> Secs</li>
        </ul>
      </div>
    </div>
  );
}

function DealItem({ product, onAdd, discounted }) {
  if (!product) return null;
  const bullets =
    asArray(product.tag_list).length > 0
      ? asArray(product.tag_list)
      : [product.category?.name || 'Top rated by customers'];
  const href = `/product/${product.slug}`;

  return (
    <div className="single-features-item single-features-item-d single-features-item-d-2 b-radius-2 mb-20">
      <div className="row g-0 align-items-center">
        <div className="col-lg-6">
          <div className="features-thum">
            <div className="features-product-image w-img">
              <Link to={href}>
                <img src={product.primary_image || FALLBACK_IMAGE} alt={product.title || 'deal'} />
              </Link>
            </div>
            {Number(product.discount_percent) > 0 && (
              <div className="product__offer">
                <span className="discount">-{product.discount_percent}%</span>
              </div>
            )}
            <div className="product-action product-action-2">
              <Link to={href} className="icon-box icon-box-1">
                <i className="fal fa-eye"></i>
                <i className="fal fa-eye"></i>
              </Link>
              <Link to="/cart" className="icon-box icon-box-1">
                <i className="fal fa-layer-group"></i>
                <i className="fal fa-layer-group"></i>
              </Link>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="product__content product__content-d product__content-d-2">
            <h6>
              <Link to={href}>{product.title}</Link>
            </h6>
            <div className="rating mb-5">
              <ul className="rating-d">
                {[0, 1, 2, 3, 4].map((index) => (
                  <li key={index}>
                    <a href="#rating" onClick={(event) => event.preventDefault()}>
                      <i className="fal fa-star"></i>
                    </a>
                  </li>
                ))}
              </ul>
              <span>({product.review_count ?? 0} review)</span>
            </div>
            <div className="price mb-10">
              <span>
                {formatPrice(product.discounted_price)}{' '}
                {Number(product.regular_price) > Number(product.discounted_price) && (
                  <del>{formatPrice(product.regular_price)}</del>
                )}
              </span>
            </div>
            <div className="features-des mb-20">
              <ul>
                {bullets.slice(0, 4).map((bullet) => (
                  <li key={bullet}>
                    <Link to={href}>
                      <i className="fas fa-circle"></i> {bullet}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="progress mb-5">
              <div
                className="progress-bar bg-danger"
                role="progressbar"
                style={{ width: `${discounted ? 80 : stockPercent(product)}%` }}
              ></div>
            </div>
            <div className="progress-rate mb-15">
              <span>Sold: {product.stoc ?? 0}/{Math.max(Number(product.stoc) || 0, 1)}</span>
            </div>
            <div className="cart-option">
              <a
                href={`#add-to-cart-${product.id}`}
                className="cart-btn-4 w-100"
                onClick={(event) => {
                  event.preventDefault();
                  onAdd(product.id);
                }}
              >
                Add to Cart
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** templates/home/bottom-area.html (popular categories, top deals, banners, featured) */
function BottomArea({ popularCategories, categoriesById, products, onAdd }) {
  const deals = products.slice(0, 2);
  const featured = products.slice(2, 7);
  const featuredLead = featured[0];
  const featuredSmall = featured.slice(1, 5);

  return (
    <>
      <section className="categories__area light-bg-s pt-20 pb-10">
        <div className="container custom-conatiner">
          <CatalogueHead title="Popular Categories" />
          <div className="row">
            {popularCategories.map((category) => {
              const count = categoriesById.get(category.categories)?.product_count;
              return (
                <div className="col-xl-2 col-lg-3 col-md-4" key={category.id}>
                  <div className="categories__item p-relative w-img mb-30">
                    <div className="categories__img b-radius-2">
                      <Link to={`/shop?category=${category.category_slug || category.categories}`}>
                        <img src={category.image || FALLBACK_IMAGE} alt={category.category_name || ''} />
                      </Link>
                    </div>
                    <div className="categories__content">
                      <h6>
                        <Link to={`/shop?category=${category.category_slug || category.categories}`}>
                          {category.category_name}
                        </Link>
                      </h6>
                      <p>({count ?? 0} Products)</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="topsell__area light-bg-s pt-15">
        <div className="container custom-conatiner">
          <div className="row">
            <div className="col-xl-12">
              <div className="section__head d-flex justify-content-between mb-30">
                <div className="section__title section__title-2">
                  <h5 className="st-titile-d st-titile-d-2">Top Deals Of The Day</h5>
                </div>
                <div className="offer-time">
                  <span className="offer-title d-none d-sm-block">Hurry Up! Offer ends in:</span>
                  <Countdown />
                </div>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-xl-6 col-lg-12">
              <DealItem product={deals[0]} onAdd={onAdd} />
            </div>
            <div className="col-xl-6 col-lg-12">
              <DealItem product={deals[1]} onAdd={onAdd} discounted />
            </div>
          </div>
        </div>
      </section>

      <section className="banner__area light-bg-s pt-40 pb-10">
        <div className="container custom-conatiner">
          <div className="row">
            {BANNERS.map((banner) => (
              <div className="col-xl-4 col-lg-4 col-md-12" key={banner.image}>
                <div className="banner__item p-relative w-img mb-30">
                  <div className="banner__img b-radius-2">
                    <Link to="/shop">
                      <img src={banner.image} alt="" />
                    </Link>
                  </div>
                  <div className="banner__content banner__content-2">
                    <h6>
                      <Link to="/shop">{banner.title}</Link>
                    </h6>
                    <p className="sm-p">{banner.note}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="featured light-bg pt-50 pb-40">
        <div className="container custom-conatiner">
          <CatalogueHead title="Top Featured Products" />
          <div className="row">
            <div className="col-xl-6 col-lg-12">
              {featuredLead && (
                <div className="single-features-item single-features-item-d b-radius-2 mb-20">
                  <div className="row g-0 align-items-center">
                    <div className="col-md-6">
                      <div className="features-thum">
                        <div className="features-product-image w-img">
                          <Link to={`/product/${featuredLead.slug}`}>
                            <img
                              src={featuredLead.primary_image || '/assets/img/features-product/fpsm-1.jpg'}
                              alt={featuredLead.title || 'featured'}
                            />
                          </Link>
                        </div>
                        {Number(featuredLead.discount_percent) > 0 && (
                          <div className="product__offer">
                            <span className="discount">-{featuredLead.discount_percent}%</span>
                          </div>
                        )}
                        <div className="product-action product-action-2">
                          <Link to={`/product/${featuredLead.slug}`} className="icon-box icon-box-1">
                            <i className="fal fa-eye"></i>
                            <i className="fal fa-eye"></i>
                          </Link>
                          <Link to="/cart" className="icon-box icon-box-1">
                            <i className="fal fa-heart"></i>
                            <i className="fal fa-heart"></i>
                          </Link>
                          <Link to="/cart" className="icon-box icon-box-1">
                            <i className="fal fa-layer-group"></i>
                            <i className="fal fa-layer-group"></i>
                          </Link>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="product__content product__content-d product__content-d-2">
                        <h6>
                          <Link to={`/product/${featuredLead.slug}`}>{featuredLead.title}</Link>
                        </h6>
                        <div className="rating mb-5">
                          <ul className="rating-d">
                            {[0, 1, 2, 3, 4].map((index) => (
                              <li key={index}>
                                <a href="#rating" onClick={(event) => event.preventDefault()}>
                                  <i className="fal fa-star"></i>
                                </a>
                              </li>
                            ))}
                          </ul>
                          <span>({featuredLead.review_count ?? 0} review)</span>
                        </div>
                        <div className="price d-price mb-10">
                          <span>
                            {formatPrice(featuredLead.discounted_price)}{' '}
                            {Number(featuredLead.regular_price) > Number(featuredLead.discounted_price) && (
                              <del>{formatPrice(featuredLead.regular_price)}</del>
                            )}
                          </span>
                        </div>
                        <div className="features-des mb-25">
                          <ul>
                            <li>
                              <Link to={`/product/${featuredLead.slug}`}>
                                <i className="fas fa-circle"></i>{' '}
                                {featuredLead.category?.name || 'Top featured product'}
                              </Link>
                            </li>
                            <li>
                              <Link to={`/product/${featuredLead.slug}`}>
                                <i className="fas fa-circle"></i> In stock: {featuredLead.stoc ?? 0}
                              </Link>
                            </li>
                          </ul>
                        </div>
                        <div className="cart-option">
                          <a
                            href={`#add-to-cart-${featuredLead.id}`}
                            className="cart-btn-4 w-100 mr-10"
                            onClick={(event) => {
                              event.preventDefault();
                              onAdd(featuredLead.id);
                            }}
                          >
                            Add to Cart
                          </a>
                          <Link to="/cart" className="transperant-btn-2">
                            <i className="fal fa-heart"></i>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="col-xl-6 col-lg-12">
              <div className="row">
                {featuredSmall.map((product) => (
                  <div className="col-md-6" key={product.id}>
                    <div className="single-features-item b-radius-2 mb-20">
                      <div className="row g-0 align-items-center">
                        <div className="col-6">
                          <div className="features-thum">
                            <div className="features-product-image w-img">
                              <Link to={`/product/${product.slug}`}>
                                <img src={product.primary_image || FALLBACK_IMAGE} alt={product.title || ''} />
                              </Link>
                            </div>
                            {Number(product.discount_percent) > 0 && (
                              <div className="product__offer">
                                <span className="discount">-{product.discount_percent}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="product__content product__content-d product__content-d-2">
                            <h6>
                              <Link to={`/product/${product.slug}`}>{product.title}</Link>
                            </h6>
                            <div className="rating mb-5">
                              <Stars rating={product.average_rating} />
                              <span>({product.review_count ?? 0} review)</span>
                            </div>
                            <div className="price">
                              <span>{formatPrice(product.discounted_price)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Homepage assembled from templates/home/home.html's includes:
 * front-slider.html, trending-product.html, bottom-area.html.
 * All content comes from GET /api/home/.
 */
export default function HomePageShell() {
  const [payload, setPayload] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const onAdd = useAddToCart(setNotice);

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .home()
      .then((data) => {
        if (cancelled) return;
        setPayload(data && typeof data === 'object' ? data : {});
      })
      .catch(() => {
        if (!cancelled) setError('We could not load the storefront right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slides = asArray(payload.slider).filter(Boolean);
  const hotProducts = asArray(payload.hot_products_in_categories).filter(Boolean);
  const trending = asArray(payload.trending_products).filter(Boolean);
  const popularCategories = asArray(payload.popular_categories).filter(Boolean);

  const categoriesById = useMemo(() => {
    const map = new Map();
    asArray(payload.categories).forEach((category) => {
      if (category?.id != null) map.set(category.id, category);
    });
    return map;
  }, [payload.categories]);

  return (
    <div className="home-page">
      {notice && (
        <div className="container custom-conatiner pt-20">
          <div className="alert alert-warning" role="alert">
            {notice}
          </div>
        </div>
      )}
      {error && (
        <div className="container custom-conatiner pt-20">
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        </div>
      )}

      <SliderArea slides={slides} hotProducts={hotProducts} />

      {trending.length > 0 && <TrendingProducts products={trending.slice(0, 8)} onAdd={onAdd} />}

      {loading && trending.length === 0 && !error && (
        <div className="container custom-conatiner pt-30 pb-30 text-center">
          <div className="spinner-border text-warning" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      <BottomArea
        popularCategories={popularCategories}
        categoriesById={categoriesById}
        products={trending}
        onAdd={onAdd}
      />
    </div>
  );
}
