import api from './client'

export const submitPrediction = (data) => api.post('/predictions', data).then(r => r.data)
export const myPredictions = () => api.get('/predictions/me').then(r => r.data)
export const myPredictionForMatch = (matchId) =>
  api.get(`/predictions/me/match/${matchId}`).then(r => r.data)
