import api from './api';

function toFormData(payload) {
  const hasFile = Object.values(payload).some((value) => value instanceof File);
  if (!hasFile) return payload;
  const body = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      body.append(key, value);
    }
  });
  return body;
}

export const catalogApi = {
  home: () => api.get('/home/').then((res) => res.data),

  products: (params = {}) =>
    api.get('/products/', { params }).then((res) => res.data),

  product: (slug) =>
    api.get(`/products/${slug}/`).then((res) => res.data),

  reviews: (slug, params = {}) =>
    api.get(`/products/${slug}/reviews/`, { params }).then((res) => res.data),

  addReview: (slug, payload) => {
    const hasFile = payload.review_images instanceof File;
    const body = hasFile ? new FormData() : payload;
    if (hasFile) {
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          body.append(key, value);
        }
      });
    }
    return api
      .post(`/products/${slug}/reviews/`, body)
      .then((res) => res.data);
  },

  industries: () => api.get('/industries/').then((res) => res.data),
  categories: (params = {}) =>
    api.get('/categories/', { params }).then((res) => res.data),

  vendors: (params = {}) =>
    api.get('/vendors/', { params }).then((res) => res.data),
  vendor: (slug) => api.get(`/vendors/${slug}/`).then((res) => res.data),
  myStores: () => api.get('/vendors/mine/').then((res) => res.data),

  createStore: (payload) =>
    api.post('/vendors/', toFormData(payload)).then((res) => res.data),
  updateStore: (slug, payload) =>
    api.patch(`/vendors/${slug}/`, toFormData(payload)).then((res) => res.data),

  myProducts: (params = {}) =>
    api.get('/products/my-products/', { params }).then((res) => res.data),

  createProduct: (payload) =>
    api.post('/products/', payload).then((res) => res.data),

  updateProduct: (slug, payload) =>
    api.patch(`/products/${slug}/`, payload).then((res) => res.data),

  deleteProduct: (slug) => api.delete(`/products/${slug}/`),

  addProductImage: (slug, payload) =>
    api.post(`/products/${slug}/images/`, payload).then((res) => res.data),

  deleteProductImage: (slug, imageId) =>
    api.delete(`/products/${slug}/images/${imageId}/`),

  addAdditionalInfo: (slug, payload) =>
    api
      .post(`/products/${slug}/additional-information/`, payload)
      .then((res) => res.data),
};
