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

export const aiApi = {
  sourceAndBuildCart: (payload) =>
    api
      .post('/ai/buyer/source-and-build-cart/', payload)
      .then((res) => res.data),

  prepareCheckout: (payload = {}) =>
    api.post('/ai/buyer/prepare-checkout/', payload).then((res) => res.data),

  generateListing: (payload) =>
    api.post('/ai/seller/generate-listing/', payload).then((res) => res.data),

  drafts: () => api.get('/ai/seller/drafts/').then((res) => res.data),

  draft: (id) => api.get(`/ai/seller/drafts/${id}/`).then((res) => res.data),

  updateDraft: (id, payload) =>
    api
      .patch(`/ai/seller/drafts/${id}/`, toFormData(payload))
      .then((res) => res.data),

  rejectDraft: (id, reason = '') =>
    api
      .post(`/ai/seller/drafts/${id}/reject/`, { reason })
      .then((res) => res.data),

  approveDraft: (id) =>
    api.post(`/ai/seller/approve-listing/${id}/`, {}).then((res) => res.data),

  bulkTemplate: () =>
    api
      .get('/ai/seller/bulk-upload/template/', { responseType: 'blob' })
      .then((res) => res.data),

  bulkUpload: (payload) =>
    api.post('/ai/seller/bulk-upload/', toFormData(payload)).then((res) => res.data),

  bulkBatch: (id) => api.get(`/ai/seller/bulk-upload/${id}/`).then((res) => res.data),

  approveBulkBatch: (id, draftIds) =>
    api
      .post(`/ai/seller/bulk-upload/${id}/approve-all/`, {
        draft_ids: draftIds,
      })
      .then((res) => res.data),
};
