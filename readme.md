# Multi Vendor Ecommerce

A multivendor marketplace with a Django REST Framework API and a React
(Vite + Tailwind) storefront. Customers shop across vendors, vendors manage
their own store and products, and administrators oversee every order.

The original models and relationships are preserved and extended additively with
vendor approval status, product moderation state, and return/refund tracking.
The legacy template views remain available as a fallback; all new client
functionality uses the `/api/` surface.

## Architecture

```
accounts/ Vendors/ products/ home/ payments/   # unchanged models & migrations
api/                                            # DRF application
  serializers/  views/  permissions.py  filters.py
  pagination.py services.py exceptions.py middleware.py urls.py
  serializers/admin_center.py views/admin_center.py
ai_assistant/                                   # AI buyer/seller features
  models.py  serializers.py  views.py  urls.py  tests.py
  services/ sourcing_engine.py content_generator.py pricing_analyzer.py
            provider.py image_service.py listing_service.py
ecommerce/                                      # settings, root URLs, JWT/CORS
frontend/                                       # React client
  src/
    components/  layout/ products/ ui/ ai/
    context/     AuthContext, CartContext
    pages/       storefront, checkout, account, vendor, admin
    services/    api.js + auth/catalog/cart/orders/ai
    lib/         formatting helpers
templates/                                      # retained legacy templates
```

- **Authentication:** JWT through `djangorestframework-simplejwt`. Access tokens
  last 12 hours, refresh tokens 7 days, sent as `Authorization: Bearer …`.
- **Roles:** `'1'` customer, `'2'` employee/editor, `'3'` vendor. Superusers
  always pass. `is_staff` is not used for authorization because the legacy model
  defaults it to `True`. `/api/admin/*` uses the role-aware
  `api.permissions.IsAdminUser` guard, which admits superusers and role `'2'`
  employees while returning `403` for customers and vendors.
- **Vendor isolation:** products are scoped through `Product.vendor_stores.user`;
  order items are scoped through `product__vendor_stores__user`.
- **Checkout:** `api/services.py` owns atomic, stock-safe order placement and
  order completion, shared by the customer checkout endpoint and Stripe
  confirmation.

## API surface

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/register/` | Public (customer) |
| POST | `/api/auth/vendor/register/` | Public (vendor) |
| POST | `/api/auth/login/` | Public |
| POST | `/api/auth/token/refresh/` | Public |
| GET/PATCH | `/api/auth/me/` | Authenticated |
| GET | `/api/home/` | Public |
| GET | `/api/products/`, `/api/products/{slug}/` | Public |
| GET/POST | `/api/products/{slug}/reviews/` | Public read; customer write |
| GET | `/api/products/my-products/` | Vendor |
| GET/POST | `/api/industries/`, `/api/categories/`, `/api/subcategories/` | Public |
| GET/POST | `/api/vendors/` | Public read; vendor create |
| GET | `/api/vendors/mine/` | Vendor |
| GET/POST/PATCH/DELETE | `/api/cart/`, `/api/cart/{id}/` | Authenticated |
| POST | `/api/cart/apply-coupon/`, `/remove-coupon/`, `/set-address/` | Authenticated |
| CRUD | `/api/addresses/` | Authenticated |
| GET | `/api/orders/`, `/api/completed-orders/` | Authenticated |
| POST | `/api/orders/place/` | Authenticated (creates unpaid order) |
| GET | `/api/vendor/order-items/` | Vendor (own items only) |
| GET/PATCH/DELETE | `/api/admin/orders/` | Admin/employee |
| POST | `/api/admin/orders/{id}/complete/` | Admin/employee |
| GET | `/api/admin/dashboard/overview/` | Admin/employee |
| GET | `/api/admin/vendors/` | Admin/employee |
| PATCH | `/api/admin/vendors/{id}/status/` | Admin/employee |
| POST | `/api/admin/orders/{order_item_id}/resolve-return/` | Admin/employee |
| GET/POST/PATCH | `/api/admin/finance/rules/` | Admin/employee |
| GET/POST | `/api/admin/payouts/` | Admin/employee |
| POST | `/api/admin/payouts/{id}/process/` | Admin/employee |
| GET | `/api/admin/products/` | Admin/employee |
| PATCH | `/api/admin/products/{id}/moderate/` | Admin/employee |
| GET | `/api/dashboard/vendor/` | Vendor |
| GET | `/api/dashboard/admin/` | Admin/employee |
| POST | `/api/ai/buyer/source-and-build-cart/` | Authenticated buyer |
| POST | `/api/ai/buyer/prepare-checkout/` | Authenticated buyer |
| POST | `/api/ai/seller/generate-listing/` | Vendor |
| GET/PATCH | `/api/ai/seller/drafts/`, `/api/ai/seller/drafts/{id}/` | Vendor (own drafts) |
| POST | `/api/ai/seller/drafts/{id}/reject/` | Vendor (own draft) |
| POST | `/api/ai/seller/approve-listing/{id}/` | Vendor (own draft) |
| GET | `/api/finance/vendor/statement/` | Vendor |
| GET | `/api/finance/vendor/statement/export/` | Vendor |
| GET/PATCH | `/api/finance/admin/tax-config/` | Admin/employee |
| GET/POST/PATCH/DELETE | `/api/finance/admin/commission-rules/` | Admin/employee |
| GET | `/api/finance/admin/summary/` | Admin/employee |
| POST | `/api/analytics/events/product-view/` | Public |
| GET | `/api/analytics/vendor/dashboard/` | Vendor |
| POST | `/api/payments/create-intent/` | Authenticated |
| POST | `/api/payments/confirm/` | Authenticated |
| GET | `/api/health/`, `/api/schema/`, `/api/docs/` | Public |

Errors use one envelope:

```json
{"success": false, "error": {"status": 400, "code": "ValidationError", "message": "…", "details": {}}}
```

Interactive API documentation is at `/api/docs/`.

## Run locally

### Backend (terminal 1)

```bash
python -m venv venv
source venv/Scripts/activate     # Git Bash on Windows
# source venv/bin/activate       # macOS / Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # optional; needed to access /admin-center
python manage.py runserver 8000
```

Optional configuration: copy `.env.example` to `.env` and fill in Stripe/CORS
values. `ecommerce/settings.py` loads the root `.env` automatically. Set
`FRONTEND_URL` when the React app is not on `http://localhost:5173`; the legacy
Django-admin URLs use it when redirecting to the React dashboards.

### Frontend (terminal 2)

```bash
cd frontend
npm install
cp .env.example .env             # optional; defaults work with the Vite proxy
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` and `/images`
to Django on port 8000, so the default `VITE_API_URL` (`/api`) needs no CORS
configuration in development. To call the API directly, set
`VITE_API_URL=http://localhost:8000/api`; `CORS_ALLOWED_ORIGINS` already allows
the default Vite origins.

### Stripe (optional)

Set both:

```bash
# root .env
STRIPE_SECRET_KEY=sk_test_...
# frontend/.env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Without a publishable key the payment page explains that card payments are not
configured and offers **Place order and pay on delivery**, which creates an
unpaid order. The confirmed-payment endpoint verifies the PaymentIntent owner,
status, and amount, and is idempotent through `placed_order_id` metadata.

### AI assistant (optional)

The buyer concierge and seller generator work without an external model. The
seller fallback creates a deterministic draft from the prompt, category and
market data; the buyer concierge always ranks the local catalogue. To enable a
provider, add these values to the root `.env`:

```bash
AI_PROVIDER=openai        # openai, openrouter, or gemini
AI_API_KEY=your-key
AI_MODEL=gpt-4o-mini      # or gemini-1.5-flash
# Optional for OpenAI-compatible gateways:
AI_BASE_URL=
# Optional; leaving this blank uses the local generated preview image:
AI_IMAGE_MODEL=
AI_TIMEOUT_SECONDS=15
```

`ai_assistant` makes no external call unless `AI_PROVIDER` and `AI_API_KEY` are
both set. Provider errors, timeouts and invalid JSON automatically fall back to
the local draft; the vendor still reviews and approves every listing. Generated
or sourced listing files are stored under `MEDIA_ROOT/ai-listings/` and become
`ProductImage` URLs only after approval. `ProductImage.image` remains the
existing `CharField`, so the published catalogue keeps its original image URL
contract.

### Production build

```bash
cd frontend
npm run build                    # writes frontend/dist/
```

Serve `dist/` from any static host and point `VITE_API_URL` at the deployed API.
Remember to add the production origin to `CORS_ALLOWED_ORIGINS`.

## Roles and dashboards

| Role | React route | Capabilities |
| --- | --- | --- |
| Customer | `/account` | Cart, addresses, checkout, placed/completed orders, reviews, AI concierge |
| Vendor | `/vendor/dashboard` | Store setup/branding, product CRUD, image URLs, own order items, sales and low-stock stats, AI Quick-List drafts |
| Admin/employee | `/admin-center` or `/admin` | Platform KPIs, vendor onboarding, cross-vendor orders and returns, commission/VAT/payout controls, catalog moderation |
| Admin/employee | `/admin/dashboard` | Operations dashboard: all orders, status/payment updates, order completion |

Every dashboard is implemented in React. The old Django admin sites are no
longer mounted: `/super-admin/` and `/employee-dashboard/` redirect to
`/admin-center`, and `/vendor-dashboard/` redirects to `/vendor/dashboard`. The
five General Admin Center workflows do not require the Django admin interface.

Vendor registration optionally creates a store immediately in `PENDING` status;
a vendor with no store can create one from the dashboard before adding products.
An admin must approve the store before its products become publicly visible.

## AI workflows

**Buyer concierge.** `POST /api/ai/buyer/source-and-build-cart/` accepts a
natural-language prompt, optional total budget, item count cap and currency.
It extracts keywords and a budget (NGN by default), ranks in-stock products by
average rating, review volume, units sold, stock and price fit, then updates the
buyer's cart through the shared stock-safe cart service. Each selection includes
the score breakdown, human-readable reasons and up to three swap alternatives.
The React header opens a responsive **Shop with AI** drawer with voice input
(where the browser supports the Web Speech API), per-item swap/remove and
quantity controls, and a checkout handoff. `prepare-checkout` validates stock
and the buyer's shipping address, pins the address to the cart, and returns a
payment-ready summary without creating an order or charging a card.

**Seller Quick-List.** Vendors use **AI Quick-List** in `/vendor/dashboard`.
`generate-listing` creates a `ProductDraft`; it never publishes a `Product`.
The reviewer can edit every field, upload or swap the image, reject the draft,
or approve it. Approval is idempotent and creates the live vendor product plus
its `ProductImage` only once. Cross-vendor draft access is rejected by the
scoped queryset.

**Bulk upload.** Vendors can download an Excel template, upload `.xlsx` rows,
and optionally attach a `.zip` of images. ZIP images are matched by normalized
SKU (`<sku>.ext`, plus `<sku>_1.ext` and `<sku>_2.ext` gallery images). Supplied
values are retained; AI enrichment fills only blank descriptions, prices, or
images when the corresponding toggles are enabled. Each row becomes an unreviewed
`ProductDraft` linked to a `BulkUploadBatch`; approval is explicit through
`approve-all` or the existing single-draft approval endpoint. Processing runs
synchronously by default; install/configure Celery with `CELERY_BROKER_URL` for
background processing, or set `AI_BULK_ASYNC=1` for a local background thread.

**Finance.** `finance` tracks category commission rules, configurable 7.5% VAT on
marketplace fees, immutable vendor ledger entries, and payout batches. Ledger
rows are created or reversed atomically when orders are completed or returned.
Vendors can view/export statements and wallet balances; admins manage commission
rules, tax settings, and platform GMV/commission/VAT summaries.

**Analytics.** `analytics` tracks product view events and provides seller dashboards
with GMV, net earnings, units sold, AOV, growth, view-to-order funnel, Seller Score
(0.0–5.0), and top/low-stock/high-return SKUs. Seller Score combines cancellation,
late shipment, return/refund, and buyer review penalties.

**General Admin Center.** `/admin-center` (also `/admin`) is role-protected for
admin/employee accounts and exposes five tabs:

1. **Overview** — net GMV, platform commission, 7.5% VAT collected, pending vendor
   payouts, order status counts, and alerts for pending vendors, open return
   disputes, and pending payout requests.
2. **Vendors** — onboarding approval queue, suspend/reactivate controls, Seller
   Score, product counts, and wallet balances. A store must be `ACTIVE` before its
   products appear in the public catalog, home page, or AI sourcing results.
3. **Orders & Returns** — platform-wide placed orders plus completed order items
   with return requests. Approving a return runs inside `transaction.atomic()`,
   marks the item `APPROVED`/`REFUNDED`, updates the order status, and reverses the
   vendor's delivery ledger entry to `REVERSED_ON_RETURN`. Rejection records
   `REJECTED`/`DECLINED` without touching the ledger.
4. **Finance & Payouts** — category commission and VAT editors plus the payout
   queue. Processing a payout as `PAID` requires a payment reference and marks its
   linked ledger entries `PAID`; rejecting a payout returns funds to
   `AVAILABLE_FOR_PAYOUT`.
5. **Catalog Moderation** — search/filter vendor, AI-generated, and bulk-uploaded
   listings; approve, flag, or unpublish products. Flagged and unpublished items
   are hidden from buyers while remaining visible to admins and the owning vendor.

## Tests

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py test api
python manage.py test ai_assistant
cd frontend && npm run build
```

`api/tests.py` covers public catalog access and JWT login, vendor product
ownership, customer-only reviews, cart/order stock handling and vendor order
isolation, admin oversight and completion, vendor-only store creation, and the
Stripe-missing-configuration guard. `ai_assistant/tests.py` covers budget
parsing and weighted ranking, cart sourcing with reasons, prepare-checkout
address/stock validation without order creation, vendor-only generation,
provider timeout fallback, cross-vendor draft isolation, rejection,
idempotent approval/publishing, mixed supplied/AI-filled bulk rows,
case-insensitive ZIP SKU matching, path-traversal rejection, and bulk vendor
ownership/approval. `api/tests_admin_center.py` covers 403 responses for non-admin
users across `/api/admin/*`, vendor approval toggling catalog visibility, atomic
return reversal, payout completion/rejection ledger updates, and product moderation
visibility. `finance/tests.py` covers Decimal commission and 7.5% VAT math,
return reversals, and idempotent ledger recording. `analytics/tests.py` covers Seller
Score calculation.

Interactive API documentation and Swagger UI are available at `/api/docs/`.

## Notes and current limitations

- The legacy Django templates/views and URLs are intentionally retained; they
  were not deleted during the decoupling. The custom Django admin sites are not
  mounted, so admin and vendor management happens in the React app.
- The React Admin Center covers overview KPIs, vendor onboarding, orders and
  returns, finance/payouts, and catalog moderation. Django-admin-only CRUD for
  users, categories, sliders, coupons, and raw model records has not been
  recreated in React.
- `ProductImage.image` is a `CharField` in the existing schema, so product
  images are managed as URLs rather than direct catalogue uploads. AI listing
  images are files under `MEDIA_ROOT/ai-listings/`; the approved draft stores
  that media URL in `ProductImage`. Vendor logos and covers remain
  `ImageField`s and support uploads.
- With no `AI_IMAGE_MODEL`, the seller flow uses a local generated preview
  image instead of an external image service. Configure a provider only if you
  want model-generated listing art and accept the associated API cost.
- Stripe webhooks are not implemented. Orders are placed by the authenticated
  confirmation endpoint after the client completes the PaymentIntent; the same
  atomic service is ready for a future webhook.
- Order cancellation, password reset, and email notifications are not part of
  this refactor.
- Buyer return requests are stored on `CompletedOderItems.return_status`; this
  change adds the admin resolution workflow, not a separate buyer-facing return
  form. A request must be set to `REQUESTED` before it appears in the admin queue.
- Vendor and product records created before this change default to `ACTIVE` and
  `APPROVED` respectively, so existing catalog data stays visible. New vendor
  stores start in `PENDING` until an admin approves them.
- `ALLOWED_HOSTS` is left empty for local development (`DEBUG=True`). Configure
  it explicitly for deployment.
