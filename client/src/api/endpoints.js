import api from './client.js';

export const dashboardApi = {
  get: (params = {}) => api.get('/dashboard', { params }).then((r) => r.data),
};

export const candidatesApi = {
  list: (params = {}) => api.get('/candidates', { params }).then((r) => r.data),
  get: (id) => api.get(`/candidates/${id}`).then((r) => r.data),
  create: (payload) => api.post('/candidates', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/candidates/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/candidates/${id}`).then((r) => r.data),
  setEstado: (id, payload) =>
    api.post(`/candidates/${id}/estado`, payload).then((r) => r.data),
  meta: () => api.get('/candidates/meta').then((r) => r.data),
};

export const sedesApi = {
  list: (params = {}) => api.get('/sedes', { params }).then((r) => r.data),
  get: (id, params = {}) =>
    api.get(`/sedes/${id}`, { params }).then((r) => r.data),
  update: (id, payload) => api.put(`/sedes/${id}`, payload).then((r) => r.data),
};

export const entrevistasApi = {
  week: (params = {}) =>
    api.get('/entrevistas/week', { params }).then((r) => r.data),
};

export const statesApi = {
  all: () => api.get('/states').then((r) => r.data),
};
