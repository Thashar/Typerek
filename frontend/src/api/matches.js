import api from './client'

export const getMatches = (params) => api.get('/matches', { params }).then(r => r.data)
export const getMatchDates = (params) => api.get('/matches/dates', { params }).then(r => r.data)
export const getToday = () => api.get('/matches/today').then(r => r.data)
export const getLive = () => api.get('/matches/live').then(r => r.data)
export const getMatch = (id) => api.get(`/matches/${id}`).then(r => r.data)
