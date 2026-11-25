import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { catalogApi } from '../../services/catalog';
import { formatPrice } from '../../lib/format';
import ShopWithAI from '../ai/ShopWithAI';

const asArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Header reproduced from templates/baseFiles/base.html:
 * header-top, header-mid (logo / search / account + mini cart) and
 * header__bottom (department mega menu, main menu, free-shipping note),
 * plus the offcanvas mobile menu. Class names are the template's own.
 */
export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isVendor, logout } = useAuth();
  const { cart, itemCount } = useCart();
  const [industries, setIndustries] = useState([]);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    catalogApi
      .industries()
      .then((data) => setIndustries(asArray(data) ? data : asArray(data?.results) ? data.results : []))
      .catch(() => setIndustries([]));
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    if (industry) query.set('industry', industry);
    navigate(`/shop${query.toString() ? `?${query.toString()}` : ''}`);
  }

  const dashboardLink = isAdmin ? '/admin-center' : isVendor ? '/vendor/dashboard' : '/account';
  const industryList = asArray(industries).filter(Boolean);
  const cartItems = asArray(cart?.items).filter(Boolean);

  return (
    <>
      <header className="header d-blue-bg">
        <div className="header-top">
          <div className="container">
            <div className="header-inner">
              <div className="row align-items-center">
                <div className="col-xl-6 col-lg-7">
                  <div className="header-inner-start">
                    <div className="header__currency border-right"></div>
                    <div className="header__lang border-right"></div>
                    <div className="support d-none d-sm-block">
                      <p>
                        Need Help? <a href="tel:+001123456789">+001 123 456 789</a>
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-xl-6 col-lg-5 d-none d-lg-block">
                  <div className="header-inner-end text-md-end">
                    <div className="ovic-menu-wrapper">
                      <ul>
                        <li><Link to="/shop">About Us</Link></li>
                        <li><Link to="/account">Order Tracking</Link></li>
                        <li><Link to="/vendor/register">Contact Us</Link></li>
                        <li><Link to="/shop">FAQs</Link></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="header-mid">
          <div className="container">
            <div className="heade-mid-inner">
              <div className="row align-items-center">
                <div className="col-xl-3 col-lg-3 col-md-4 col-sm-4">
                  <div className="header__info">
                    <div className="logo">
                      <Link to="/" className="logo-image">
                        <h4 className="text-white fw-bold">MultiVendorEshop</h4>
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="col-xl-5 col-lg-4 d-none d-lg-block">
                  <div className="header__search">
                    <form onSubmit={submitSearch}>
                      <div className="header__search-box">
                        <input
                          className="search-input"
                          type="text"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="I'm shopping for..."
                          aria-label="Search products"
                        />
                        <button className="button" type="submit">
                          <i className="far fa-search"></i>
                        </button>
                      </div>
                      <div className="header__search-cat">
                        <select
                          value={industry}
                          onChange={(event) => setIndustry(event.target.value)}
                          aria-label="Filter by industry"
                        >
                          <option value="">All Categories</option>
                          {industryList.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="col-xl-4 col-lg-5 col-md-8 col-sm-8">
                  <div className="header-action">
                    {isAuthenticated ? (
                      <>
                        <div className="block-userlink">
                          <a
                            className="icon-link"
                            href="#logout"
                            onClick={(event) => {
                              event.preventDefault();
                              logout();
                              navigate('/');
                            }}
                          >
                            <i className="flaticon-user"></i>
                            <span className="text">
                              <span className="sub">Logout </span>
                            </span>
                          </a>
                        </div>

                        <div className="block-userlink">
                          <Link className="icon-link" to="/account/profile">
                            <i className="flaticon-user"></i>
                            <span className="text">
                              <span className="sub">Profile</span>
                              {user?.first_name || user?.email}
                            </span>
                          </Link>
                        </div>

                        <div className="block-cart action">
                          <Link className="icon-link" to="/cart">
                            <i className="flaticon-shopping-bag"></i>
                            <span className="count">{itemCount}</span>
                            <span className="text">
                              <span className="sub">Your Cart:</span>
                            </span>
                          </Link>
                          <div className="cart">
                            <div className="cart__mini">
                              <ul>
                                <li>
                                  <div className="cart__title">
                                    <h4>Your Cart</h4>
                                    <span>({cartItems.length} Item in Cart)</span>
                                  </div>
                                </li>
                                {cartItems.map((item, index) => (
                                  <li key={item.id ?? index}>
                                    <div className="cart__item d-flex justify-content-between align-items-center">
                                      <div className="cart__inner d-flex">
                                        <div className="cart__thumb">
                                          <Link to={`/product/${item.product?.slug || item.product_slug || ''}`}>
                                            <img
                                              src={
                                                item.product?.primary_image ||
                                                item.primary_image ||
                                                '/assets/img/features-product/fp-1.jpg'
                                              }
                                              alt=""
                                            />
                                          </Link>
                                        </div>
                                        <div className="cart__details">
                                          <h6>
                                            <Link to={`/product/${item.product?.slug || item.product_slug || ''}`}>
                                              {item.product?.title || item.title || 'Product'}
                                            </Link>
                                          </h6>
                                          <div className="cart__price">
                                            <span>{formatPrice(item.total_price ?? item.total_product_price)}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="cart__del">
                                        <Link to="/cart"><i className="fal fa-times"></i></Link>
                                      </div>
                                    </div>
                                  </li>
                                ))}
                                <li>
                                  <div className="cart__sub d-flex justify-content-between align-items-center">
                                    <h6>Subtotal</h6>
                                    <span className="cart__sub-total">{formatPrice(cart?.subtotal)}</span>
                                  </div>
                                </li>
                                <li>
                                  <Link to="/cart" className="wc-cart mb-10">View cart</Link>
                                  <Link to="/checkout" className="wc-checkout">Checkout</Link>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="block-userlink">
                          <Link className="icon-link" to="/login">
                            <i className="flaticon-user"></i>
                            <span className="text">
                              <span className="sub">Login </span>
                              My Account
                            </span>
                          </Link>
                        </div>
                        <div className="block-userlink">
                          <Link className="icon-link" to="/register">
                            <i className="flaticon-user"></i>
                            <span className="text">
                              <span className="sub">Sing Up</span>
                              Create Account
                            </span>
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="header__bottom">
          <div className="container">
            <div className="row g-0 align-items-center">
              <div className="col-lg-3">
                <div className="cat__menu-wrapper side-border d-none d-lg-block">
                  <div className="cat-toggle">
                    <button type="button" className="cat-toggle-btn cat-toggle-btn-1">
                      <i className="fal fa-bars"></i> Shop by department
                    </button>
                    <div className="cat__menu">
                      <nav id="mobile-menu" style={{ display: 'block' }}>
                        <ul>
                          {industryList.map((item) => (
                            <li key={item.id}>
                              <Link to={`/shop?industry=${item.id}`}>
                                {item.name} <i className="far fa-angle-down"></i>
                              </Link>
                              <ul className="mega-menu mega-menu-2">
                                <li>
                                  {asArray(item.categories).map((category) => (
                                    <Link key={category.id} to={`/shop?category=${category.slug || category.id}`}>
                                      {category.name}
                                    </Link>
                                  ))}
                                </li>
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6 col-md-6 col-3">
                <div className="header__bottom-left d-flex d-xl-block align-items-center">
                  <div className="side-menu d-lg-none mr-20">
                    <button
                      type="button"
                      className="side-menu-btn offcanvas-toggle-btn"
                      onClick={() => setMobileOpen(true)}
                      aria-label="Open menu"
                    >
                      <i className="fas fa-bars"></i>
                    </button>
                  </div>
                  <div className="main-menu d-none d-lg-block">
                    <ul>
                      <li><Link to="/">Home</Link></li>
                      <li><Link to="/shop">Shop</Link></li>
                      <li><Link to="/vendor/register">Sell With Us</Link></li>
                      <li><Link to="/cart">Cart</Link></li>
                      {isAuthenticated && <li><Link to={dashboardLink}>Dashboard</Link></li>}
                      {isAdmin && <li><Link to="/admin-center">Admin</Link></li>}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-9">
                <div className="shopeing-text text-sm-end">
                  <p>Spend $120 more and get free shipping!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* offcanvas area start */}
      <div className={`offcanvas__area${mobileOpen ? ' opened' : ''}`}>
        <div className="offcanvas__wrapper">
          <div className="offcanvas__close">
            <button
              type="button"
              className="offcanvas__close-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <i className="fal fa-times"></i>
            </button>
          </div>
          <div className="offcanvas__content">
            <div className="offcanvas__logo mb-40">
              <Link to="/" onClick={() => setMobileOpen(false)}>
                <img src="/assets/img/logo/logo-white.png" alt="logo" />
              </Link>
            </div>
            <div className="offcanvas__search mb-25">
              <form onSubmit={submitSearch}>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="What are you searching for?"
                />
                <button type="submit" aria-label="Search"><i className="far fa-search"></i></button>
              </form>
            </div>
            <div className="mobile-menu fix">
              <ul>
                <li><Link to="/" onClick={() => setMobileOpen(false)}>Home</Link></li>
                <li><Link to="/shop" onClick={() => setMobileOpen(false)}>Shop</Link></li>
                {isAuthenticated ? (
                  <>
                    <li><Link to={dashboardLink} onClick={() => setMobileOpen(false)}>Dashboard</Link></li>
                    <li><Link to="/account" onClick={() => setMobileOpen(false)}>My Account</Link></li>
                    <li><Link to="/cart" onClick={() => setMobileOpen(false)}>Cart ({itemCount})</Link></li>
                  </>
                ) : (
                  <>
                    <li><Link to="/login" onClick={() => setMobileOpen(false)}>Login</Link></li>
                    <li><Link to="/register" onClick={() => setMobileOpen(false)}>Create Account</Link></li>
                  </>
                )}
                <li><Link to="/vendor/register" onClick={() => setMobileOpen(false)}>Become a Seller</Link></li>
              </ul>
            </div>
            <div className="offcanvas__action">
              <ShopWithAI />
            </div>
          </div>
        </div>
      </div>
      {mobileOpen && (
        <div
          className="body-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 998 }}
          onClick={() => setMobileOpen(false)}
        ></div>
      )}
      {/* offcanvas area end */}
    </>
  );
}
