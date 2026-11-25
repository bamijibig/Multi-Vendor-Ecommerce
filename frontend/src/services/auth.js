import api from './api';

export const authApi = {
  login: (email, password) =>
    api.post('/auth/login/', { email, password }).then((res) => res.data),

  register: (payload) =>
    api.post('/auth/register/', payload).then((res) => res.data),

  vendorRegister: (payload) =>
    api.post('/auth/vendor/register/', payload).then((res) => res.data),

  me: () => api.get('/auth/me/').then((res) => res.data),

  updateProfile: (payload) =>
    api.patch('/auth/me/', payload).then((res) => res.data),
};
