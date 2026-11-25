import api from './api';

export const financeApi = {
  statement: (params = {}) =>
    api.get('/finance/vendor/statement/', { params }).then((res) => res.data),
  exportStatement: (params = {}) =>
    api
      .get('/finance/vendor/statement/export/', {
        params,
        responseType: 'blob',
      })
      .then((res) => res.data),
  taxConfig: () => api.get('/finance/admin/tax-config/').then((res) => res.data),
  updateTaxConfig: (payload) =>
    api.patch('/finance/admin/tax-config/', payload).then((res) => res.data),
  commissionRules: () =>
    api.get('/finance/admin/commission-rules/').then((res) => res.data),
  createCommissionRule: (payload) =>
    api.post('/finance/admin/commission-rules/', payload).then((res) => res.data),
  updateCommissionRule: (id, payload) =>
    api.patch(`/finance/admin/commission-rules/${id}/`, payload).then((res) => res.data),
  deleteCommissionRule: (id) =>
    api.delete(`/finance/admin/commission-rules/${id}/`).then((res) => res.data),
  summary: (params = {}) =>
    api.get('/finance/admin/summary/', { params }).then((res) => res.data),
};