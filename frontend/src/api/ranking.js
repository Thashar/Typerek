import api from './client'

export const globalRanking = () => api.get('/ranking').then(r => r.data)
export const leagueRanking = (id) => api.get(`/ranking/league/${id}`).then(r => r.data)
