import api from './api';

export const ordersApi = {
  list: (params = {}) => api.get('/orders/', { params }).then((res) => res.data),
  detail: (id) => api.get(`/orders/${id}/`).then((res) => res.data),
  place: (shippingAddressId) =>
    api
      .post('/orders/place/', { shipping_address_id: shippingAddressId })
      .then((res) => res.data),

  completed: (params = {}) =>
    api.get('/completed-orders/', { params }).then((res) => res.data),

  vendorItems: (params = {}) =>
    api.get('/vendor/order-items/', { params }).then((res) => res.data),

  adminList: (params = {}) =>
    api.get('/admin/orders/', { params }).then((res) => res.data),
  adminUpdate: (id, payload) =>
    api.patch(`/admin/orders/${id}/`, payload).then((res) => res.data),
  adminComplete: (id) =>
    api.post(`/admin/orders/${id}/complete/`).then((res) => res.data),

  adminDashboard: () => api.get('/dashboard/admin/').then((res) => res.data),
  vendorDashboard: () => api.get('/dashboard/vendor/').then((res) => res.data),
};

export const paymentsApi = {
  createIntent: () =>
    api.post('/payments/create-intent/').then((res) => res.data),
  confirm: (paymentIntentId, shippingAddressId) =>
    api
      .post('/payments/confirm/', {
        payment_intent_id: paymentIntentId,
        shipping_address_id: shippingAddressId,
      })
      .then((res) => res.data),
};
