import api from './api';

export const cartApi = {
  get: () => api.get('/cart/').then((res) => res.data),
  addItem: (productId, quantity = 1) =>
    api.post('/cart/', { product: productId, quantity }).then((res) => res.data),
  updateItem: (itemId, quantity) =>
    api.patch(`/cart/${itemId}/`, { quantity }).then((res) => res.data),
  removeItem: (itemId) =>
    api.delete(`/cart/${itemId}/`).then((res) => res.data),
  applyCoupon: (code) =>
    api.post('/cart/apply-coupon/', { code }).then((res) => res.data),
  removeCoupon: () =>
    api.post('/cart/remove-coupon/', {}).then((res) => res.data),
  setAddress: (addressId) =>
    api.post('/cart/set-address/', { address_id: addressId }).then((res) => res.data),

  getAddresses: () => api.get('/addresses/').then((res) => res.data),
  createAddress: (payload) =>
    api.post('/addresses/', payload).then((res) => res.data),
  updateAddress: (id, payload) =>
    api.patch(`/addresses/${id}/`, payload).then((res) => res.data),
  deleteAddress: (id) => api.delete(`/addresses/${id}/`),
};
