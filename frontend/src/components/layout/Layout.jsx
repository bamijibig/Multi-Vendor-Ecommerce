import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

/**
 * Page shell from templates/baseFiles/base.html: preloader, back-to-top button,
 * header, <main>, footer. Class names are the template's own.
 */
export default function Layout() {
  const { pathname } = useLocation();
  const [loading, setLoading] = useState(true);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* preloader start */}
      <div
        id="loading"
        style={{
          opacity: loading ? 1 : 0,
          visibility: loading ? 'visible' : 'hidden',
          transition: 'opacity 0.4s ease, visibility 0.4s ease',
        }}
        aria-hidden="true"
      >
        <div id="loading-center">
          <div id="loading-center-absolute">
            <div className="cart-container">
              <svg viewBox="0 0 512 512" id="cart">
                <circle cx="376.8" cy="440" r="55" />
                <circle cx="192" cy="440" r="55" />
                <polygon points="128,0 0.8,0 0.8,32 104.8,32 136.8,124.8 170.4,124.8 " />
                <polygon style={{ fill: '#ed7161' }} points="250.4,49.6 224,124.8 411.2,124.8 " />
                <polygon
                  style={{ fill: '#ee5a46' }}
                  points="411.2,124.8 224,124.8 170.4,124.8 136.8,124.8 68,124.8 141.6,361.6 427.2,361.6 511.2,124.8 "
                />
                <g>
                  <rect x="166.4" y="185.6" style={{ fill: '#ffffff' }} width="255.2" height="16" />
                  <rect x="166.4" y="237.6" style={{ fill: '#ffffff' }} width="166.4" height="16" />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
      {/* preloader end */}

      {/* back to top start */}
      <div
        className={`progress-wrap${showTop ? ' active-progress' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        <svg className="progress-circle svg-content" width="100%" height="100%" viewBox="-1 -1 102 102">
          <path d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
        </svg>
      </div>
      {/* back to top end */}

      <Header />

      <main>
        <Outlet />
      </main>

      <Footer />
    </>
  );
}
