import api from './client'

export const createLeague = (data) => api.post('/leagues', data).then(r => r.data)
export const joinLeague = (data) => api.post('/leagues/join', data).then(r => r.data)
export const myLeagues = () => api.get('/leagues/me').then(r => r.data)
export const getLeague = (id) => api.get(`/leagues/${id}`).then(r => r.data)
export const getLeagueRanking = (id) => api.get(`/leagues/${id}/ranking`).then(r => r.data)
export const leaveLeague = (id) => api.delete(`/leagues/${id}/leave`)
