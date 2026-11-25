import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  ExternalLink,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Alert, EmptyState, Pagination, Spinner, StatusBadge } from '../components/ui/Ui';
import VendorListingGenerator from '../components/ai/VendorListingGenerator';
import BulkUpload from '../components/ai/BulkUpload';
import VendorFinance from '../components/finance/VendorFinance';
import VendorAnalytics from '../components/analytics/VendorAnalytics';
import { useAuth } from '../context/AuthContext';
import { catalogApi } from '../services/catalog';
import { ordersApi } from '../services/orders';
import { getErrorMessage } from '../services/api';
import { formatDate, formatPrice } from '../lib/format';

const EMPTY_PRODUCT = {
  title: '',
  regular_price: '',
  stoc: 10,
  discounted_parcent: 0,
  categories: '',
  modle: '',
  tag: '',
  description: '',
  details_description: '',
  out_of_stoc: false,
};

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-brand">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function CreateStoreForm({ onCreated }) {
  const [name, setName] = useState('');
  const [logo, setLogo] = useState(null);
  const [cover, setCover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Store name is required.');
      return;
    }
    setBusy(true);
    try {
      const payload = { name: name.trim() };
      if (logo) payload.logo = logo;
      if (cover) payload.cover_photo = cover;
      await catalogApi.createStore(payload);
      setName('');
      setLogo(null);
      setCover(null);
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create store.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
        <Store className="h-4 w-4 text-brand" /> Create your store
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        You need a store before you can publish products.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="label" htmlFor="store-name">Store name</label>
          <input id="store-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="store-logo">Logo</label>
          <input id="store-logo" type="file" accept="image/*" className="input py-2 text-xs" onChange={(event) => setLogo(event.target.files?.[0] || null)} />
        </div>
        <div>
          <label className="label" htmlFor="store-cover">Cover photo</label>
          <input id="store-cover" type="file" accept="image/*" className="input py-2 text-xs" onChange={(event) => setCover(event.target.files?.[0] || null)} />
        </div>
      </div>
      {error && <Alert className="mt-3">{error}</Alert>}
      <button type="submit" className="btn-primary mt-4" disabled={busy}>
        {busy ? 'Creating store…' : 'Create store'}
      </button>
    </form>
  );
}

function StoreSettings({ store, onSaved }) {
  const [name, setName] = useState(store.name);
  const [logo, setLogo] = useState(null);
  const [cover, setCover] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const payload = { name };
      if (logo) payload.logo = logo;
      if (cover) payload.cover_photo = cover;
      await catalogApi.updateStore(store.slug, payload);
      setLogo(null);
      setCover(null);
      setMessage('Store updated.');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update store.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-navy">{store.name}</h3>
        <Link to={`/store/${store.slug}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand">
          View public store <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <p className="mt-1 text-xs text-slate-400">{store.product_count} product(s)</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`name-${store.id}`}>Store name</label>
          <input id={`name-${store.id}`} className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`logo-${store.id}`}>Replace logo</label>
          <input id={`logo-${store.id}`} type="file" accept="image/*" className="input py-2 text-xs" onChange={(event) => setLogo(event.target.files?.[0] || null)} />
        </div>
        <div>
          <label className="label" htmlFor={`cover-${store.id}`}>Replace cover</label>
          <input id={`cover-${store.id}`} type="file" accept="image/*" className="input py-2 text-xs" onChange={(event) => setCover(event.target.files?.[0] || null)} />
        </div>
      </div>
      {error && <Alert className="mt-3">{error}</Alert>}
      {message && <Alert type="success" className="mt-3">{message}</Alert>}
      <button type="submit" className="btn-dark mt-4" disabled={busy}>
        {busy ? 'Saving…' : 'Save store'}
      </button>
    </form>
  );
}

export default function VendorDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('overview');

  const [dashboard, setDashboard] = useState(null);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [orderMeta, setOrderMeta] = useState({ num_pages: 1, count: 0 });
  const [orderPage, setOrderPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState('');

  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [productOpen, setProductOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState(null);
  const [editingImages, setEditingImages] = useState([]);
  const [productBusy, setProductBusy] = useState(false);
  const [productError, setProductError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageBusy, setImageBusy] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [dash, mine, myProducts, allCategories, vendorItems] = await Promise.all([
        ordersApi.vendorDashboard(),
        catalogApi.myStores(),
        catalogApi.myProducts({ page_size: 100 }),
        catalogApi.categories(),
        ordersApi.vendorItems(),
      ]);
      setDashboard(dash);
      setStores(mine.results || []);
      setProducts(myProducts.results || []);
      setCategories(Array.isArray(allCategories) ? allCategories : allCategories.results || []);
      setOrderItems(vendorItems.results || []);
      setOrderMeta({ num_pages: vendorItems.num_pages || 1, count: vendorItems.count || 0 });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the vendor dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function fetchOrders(page = 1, search = orderSearch) {
    try {
      const data = await ordersApi.vendorItems({ page, search });
      setOrderItems(data.results || []);
      setOrderMeta({ num_pages: data.num_pages || 1, count: data.count || 0 });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function openCreate() {
    setEditingSlug(null);
    setEditingImages([]);
    setProductForm({
      ...EMPTY_PRODUCT,
      categories: categories[0]?.id || '',
    });
    setProductError('');
    setProductOpen(true);
  }

  async function openEdit(product) {
    setProductError('');
    setNotice('');
    try {
      const detail = await catalogApi.product(product.slug);
      setEditingSlug(product.slug);
      setEditingImages(detail.images || []);
      setProductForm({
        title: detail.title || '',
        regular_price: detail.regular_price ?? '',
        stoc: detail.stoc ?? 0,
        discounted_parcent: detail.discounted_parcent ?? 0,
        categories: detail.categories?.id || '',
        modle: detail.modle || '',
        tag: detail.tag || '',
        description: detail.description || '',
        details_description: detail.details_description || '',
        out_of_stoc: Boolean(detail.out_of_stoc),
      });
      setProductOpen(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load product.'));
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setProductError('');
    setProductBusy(true);
    const payload = {
      ...productForm,
      regular_price: Number(productForm.regular_price),
      stoc: Number(productForm.stoc),
      discounted_parcent: Number(productForm.discounted_parcent),
      categories: Number(productForm.categories),
    };
    try {
      if (editingSlug) {
        await catalogApi.updateProduct(editingSlug, payload);
        setNotice('Product updated.');
      } else {
        await catalogApi.createProduct(payload);
        setNotice('Product created. Use Edit to add an image URL.');
      }
      setProductOpen(false);
      setProductForm(EMPTY_PRODUCT);
      setEditingSlug(null);
      setEditingImages([]);
      await load(true);
      setTab('products');
    } catch (err) {
      setProductError(getErrorMessage(err, 'Could not save product.'));
    } finally {
      setProductBusy(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete “${product.title}”? This cannot be undone.`)) return;
    setNotice('');
    try {
      await catalogApi.deleteProduct(product.slug);
      setNotice('Product deleted.');
      if (editingSlug === product.slug) {
        setProductOpen(false);
        setEditingSlug(null);
      }
      await load(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete product.'));
    }
  }

  async function addImage(event) {
    event.preventDefault();
    if (!editingSlug || !imageUrl.trim()) return;
    setImageBusy(true);
    setProductError('');
    try {
      await catalogApi.addProductImage(editingSlug, { image: imageUrl.trim() });
      const detail = await catalogApi.product(editingSlug);
      setEditingImages(detail.images || []);
      setImageUrl('');
      await load(true);
    } catch (err) {
      setProductError(getErrorMessage(err, 'Could not add image.'));
    } finally {
      setImageBusy(false);
    }
  }

  async function removeImage(imageId) {
    if (!editingSlug) return;
    try {
      await catalogApi.deleteProductImage(editingSlug, imageId);
      setEditingImages((current) => current.filter((image) => image.id !== imageId));
      await load(true);
    } catch (err) {
      setProductError(getErrorMessage(err, 'Could not delete image.'));
    }
  }

  async function searchOrders(event) {
    event.preventDefault();
    setOrderPage(1);
    await fetchOrders(1, orderSearch);
  }

  function changeOrderPage(nextPage) {
    setOrderPage(nextPage);
    fetchOrders(nextPage, orderSearch);
  }

  if (loading) return <Spinner label="Loading vendor dashboard…" />;

  const stats = dashboard?.stats || {};

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Vendor dashboard</p>
          <h1 className="text-2xl font-semibold text-navy">
            {stores[0]?.name || 'Your store'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user?.email}</p>
        </div>
        <div className="flex gap-2">
          {stores[0] && (
            <Link to={`/store/${stores[0].slug}`} className="btn-outline">
              <ExternalLink className="h-4 w-4" /> Public store
            </Link>
          )}
          <button type="button" onClick={openCreate} className="btn-primary" disabled={!stores.length}>
            <Plus className="h-4 w-4" /> Add product
          </button>
        </div>
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}
      {notice && <Alert type="success" className="mt-4">{notice}</Alert>}

      {!stores.length && (
        <div className="mt-6">
          <CreateStoreForm onCreated={() => load(true)} />
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Package} label="Products" value={stats.total_products ?? 0} />
        <StatCard icon={AlertTriangle} label="Low stock" value={stats.low_stock_products ?? 0} hint="5 units or fewer" />
        <StatCard icon={ShoppingBag} label="Orders" value={stats.unique_orders ?? 0} hint={`${stats.order_items ?? 0} order item(s)`} />
        <StatCard icon={Wallet} label="Gross sales" value={formatPrice(stats.gross_sales ?? 0)} />
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        {[
          ['overview', 'Overview'],
          ['products', `Products (${products.length})`],
          ['orders', 'Order items'],
          ['ai', 'AI Quick-List'],
          ['bulk', 'Bulk Upload'],
          ['finance', 'Finance'],
          ['analytics', 'Analytics'],
          ['store', 'Store settings'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`whitespace-nowrap px-5 py-3 text-sm font-medium ${
              tab === key ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-navy'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="flex items-center gap-2 font-semibold text-navy">
                <AlertTriangle className="h-4 w-4 text-brand" /> Low stock alerts
              </h2>
              {dashboard?.low_stock?.length ? (
                <ul className="mt-3 divide-y divide-line">
                  {dashboard.low_stock.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                      <Link to={`/product/${item.slug}`} className="line-clamp-1 text-slate-600 hover:text-brand">
                        {item.title}
                      </Link>
                      <span className="shrink-0 text-xs font-medium text-red-600">{item.stoc} left</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">All products are comfortably stocked.</p>
              )}
            </section>

            <section className="card p-5">
              <h2 className="flex items-center gap-2 font-semibold text-navy">
                <TrendingUp className="h-4 w-4 text-brand" /> Recent order items
              </h2>
              {dashboard?.recent_order_items?.length ? (
                <ul className="mt-3 divide-y divide-line">
                  {dashboard.recent_order_items.slice(0, 6).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="line-clamp-1 text-slate-600">{item.product.title}</span>
                        <span className="text-xs text-slate-400">{item.order_number} · Qty {item.quantity}</span>
                      </span>
                      <span className="shrink-0 font-medium">{formatPrice(item.total_price)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No order items yet.</p>
              )}
              <button type="button" onClick={() => setTab('orders')} className="btn-ghost mt-3 px-0 text-xs">
                View all order items
              </button>
            </section>
          </div>
        )}

        {tab === 'products' && (
          <div className="space-y-5">
            {productOpen && (
              <form onSubmit={saveProduct} className="card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-navy">
                    {editingSlug ? 'Edit product' : 'New product'}
                  </h2>
                  <button type="button" className="text-xs text-slate-500 hover:text-brand" onClick={() => setProductOpen(false)}>
                    Close
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="p-title">Title</label>
                    <input id="p-title" className="input" required value={productForm.title} onChange={(event) => setProductForm({ ...productForm, title: event.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor="p-category">Category</label>
                    <select id="p-category" className="input" required value={productForm.categories} onChange={(event) => setProductForm({ ...productForm, categories: event.target.value })}>
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="p-price">Regular price</label>
                    <input id="p-price" type="number" min="0" className="input" required value={productForm.regular_price} onChange={(event) => setProductForm({ ...productForm, regular_price: event.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor="p-discount">Discount %</label>
                    <input id="p-discount" type="number" min="0" max="100" className="input" required value={productForm.discounted_parcent} onChange={(event) => setProductForm({ ...productForm, discounted_parcent: event.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor="p-stock">Stock</label>
                    <input id="p-stock" type="number" min="0" className="input" required value={productForm.stoc} onChange={(event) => setProductForm({ ...productForm, stoc: event.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor="p-model">Model</label>
                    <input id="p-model" className="input" value={productForm.modle} onChange={(event) => setProductForm({ ...productForm, modle: event.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor="p-tags">Tags (comma separated)</label>
                    <input id="p-tags" className="input" value={productForm.tag} onChange={(event) => setProductForm({ ...productForm, tag: event.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm text-slate-600">
                    <input type="checkbox" checked={productForm.out_of_stoc} onChange={(event) => setProductForm({ ...productForm, out_of_stoc: event.target.checked })} />
                    Mark as out of stock
                  </label>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="label" htmlFor="p-description">Short description</label>
                    <textarea id="p-description" rows={3} className="input" required value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="label" htmlFor="p-details">Full details</label>
                    <textarea id="p-details" rows={4} className="input" required value={productForm.details_description} onChange={(event) => setProductForm({ ...productForm, details_description: event.target.value })} />
                  </div>
                </div>

                {productError && <Alert className="mt-3">{productError}</Alert>}
                <div className="mt-4 flex gap-2">
                  <button type="submit" className="btn-primary" disabled={productBusy}>
                    {productBusy ? 'Saving…' : editingSlug ? 'Save product' : 'Create product'}
                  </button>
                  <button type="button" className="btn-outline" onClick={() => setProductOpen(false)}>Cancel</button>
                </div>

                {editingSlug && (
                  <div className="mt-5 border-t border-line pt-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-navy">
                      <ImagePlus className="h-4 w-4 text-brand" /> Product images
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Images are stored as URLs in this project's catalogue.
                    </p>
                    {editingImages.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {editingImages.map((image) => (
                          <div key={image.id} className="relative">
                            <img src={image.url} alt="" className="h-20 w-20 rounded border border-line object-contain p-1" />
                            <button
                              type="button"
                              onClick={() => removeImage(image.id)}
                              className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-1 text-white"
                              aria-label="Delete image"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <input
                        className="input"
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="https://example.com/product.jpg"
                        aria-label="Product image URL"
                      />
                      <button type="button" onClick={addImage} className="btn-dark shrink-0" disabled={imageBusy || !imageUrl.trim()}>
                        {imageBusy ? 'Adding…' : 'Add image'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}

            {products.length ? (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {product.primary_image ? (
                              <img src={product.primary_image} alt="" className="h-10 w-10 rounded border border-line object-contain p-0.5" />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded border border-line bg-slate-50">
                                <Boxes className="h-4 w-4 text-slate-300" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <Link to={`/product/${product.slug}`} className="line-clamp-1 font-medium text-navy hover:text-brand">
                                {product.title}
                              </Link>
                              <p className="text-xs text-slate-400">{product.category?.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{formatPrice(product.discounted_price)}</td>
                        <td className="px-4 py-3">{product.stoc}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${product.in_stock ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {product.in_stock ? 'In stock' : 'Out of stock'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => openEdit(product)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" aria-label="Edit product">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => deleteProduct(product)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Delete product">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="No products yet"
                message={stores.length ? 'Add your first product to start selling.' : 'Create a store before adding products.'}
                action={stores.length ? <button type="button" className="btn-primary" onClick={openCreate}>Add product</button> : null}
              />
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-4">
            <form onSubmit={searchOrders} className="flex gap-2">
              <input
                className="input max-w-sm"
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="Search order, product, customer email…"
                aria-label="Search order items"
              />
              <button type="submit" className="btn-dark shrink-0">Search</button>
            </form>

            {orderItems.length ? (
              <>
                <div className="card overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {orderItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-navy">{item.order_number}</td>
                          <td className="px-4 py-3">
                            <Link to={`/product/${item.product.slug}`} className="line-clamp-1 hover:text-brand">
                              {item.product.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{item.customer_email}</td>
                          <td className="px-4 py-3">{item.quantity}</td>
                          <td className="px-4 py-3">{formatPrice(item.total_price)}</td>
                          <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                          <td className="px-4 py-3 text-xs text-slate-500">{formatDate(item.placed_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={orderPage} numPages={orderMeta.num_pages} onChange={changeOrderPage} />
              </>
            ) : (
              <EmptyState icon={ShoppingBag} title="No order items" message="Order items for your products will appear here." />
            )}
          </div>
        )}

        {tab === 'ai' && (
          <VendorListingGenerator
            store={stores[0]}
            categories={categories}
            onPublished={() => load(true)}
          />
        )}

        {tab === 'bulk' && (
          <BulkUpload store={stores[0]} onPublished={() => load(true)} />
        )}

        {tab === 'finance' && <VendorFinance />}

        {tab === 'analytics' && <VendorAnalytics />}

        {tab === 'store' && (
          <div className="space-y-5">
            {stores.length ? (
              stores.map((store) => (
                <StoreSettings key={store.id} store={store} onSaved={() => load(true)} />
              ))
            ) : (
              <CreateStoreForm onCreated={() => load(true)} />
            )}
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Vendor scope is enforced by the API: you only see products and order items that
        belong to your store.
      </p>
    </div>
  );
}
