import api from './api';

export const adminCenterApi = {
  overview: () => api.get('/admin/dashboard/overview/').then((res) => res.data),
  vendors: (params = {}) =>
    api.get('/admin/vendors/', { params }).then((res) => res.data),
  setVendorStatus: (vendorId, payload) =>
    api
      .patch(`/admin/vendors/${vendorId}/status/`, payload)
      .then((res) => res.data),
  orders: (params = {}) =>
    api.get('/admin/orders/', { params }).then((res) => res.data),
  resolveReturn: (orderItemId, payload) =>
    api
      .post(`/admin/orders/${orderItemId}/resolve-return/`, payload)
      .then((res) => res.data),
  financeRules: () => api.get('/admin/finance/rules/').then((res) => res.data),
  createCommissionRule: (payload) =>
    api.post('/admin/finance/rules/', payload).then((res) => res.data),
  updateFinanceRules: (payload) =>
    api.patch('/admin/finance/rules/', payload).then((res) => res.data),
  payouts: (params = {}) =>
    api.get('/admin/payouts/', { params }).then((res) => res.data),
  createPayout: (payload) =>
    api.post('/admin/payouts/', payload).then((res) => res.data),
  processPayout: (payoutId, payload) =>
    api
      .post(`/admin/payouts/${payoutId}/process/`, payload)
      .then((res) => res.data),
  products: (params = {}) =>
    api.get('/admin/products/', { params }).then((res) => res.data),
  moderateProduct: (productId, payload) =>
    api
      .patch(`/admin/products/${productId}/moderate/`, payload)
      .then((res) => res.data),
};
