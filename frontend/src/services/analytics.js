import api from './api';

export const analyticsApi = {
  vendorDashboard: (params = {}) =>
    api.get('/analytics/vendor/dashboard/', { params }).then((res) => res.data),
  trackProductView: (productId, sessionKey) =>
    api
      .post('/analytics/events/product-view/', {
        product_id: productId,
        session_key: sessionKey,
      })
      .then((res) => res.data),
};