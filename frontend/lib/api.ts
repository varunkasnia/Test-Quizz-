import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Quiz endpoints
export const quizAPI = {
  create: (data: any) => api.post('/api/quiz/create', data),
  list: (createdBy?: string) => api.get('/api/quiz/list', { params: { created_by: createdBy } }),
  get: (id: number) => api.get(`/api/quiz/${id}`),
  generateFromTopic: (data: any) => api.post('/api/quiz/generate/topic', data),
  generateFromFile: (formData: FormData) => 
    api.post('/api/quiz/generate/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  updateQuestion: (quizId: number, questionId: number, data: any) =>
    api.put(`/api/quiz/${quizId}/questions/${questionId}`, data),
  deleteQuestion: (quizId: number, questionId: number) =>
    api.delete(`/api/quiz/${quizId}/questions/${questionId}`),
  deleteQuiz: (quizId: number) => api.delete(`/api/quiz/${quizId}`),
};

// Game endpoints
export const gameAPI = {
  create: (data: any) => api.post('/api/game/create', data),
  join: (data: any) => api.post('/api/game/join', data),
  getStatus: (pin: string) => api.get(`/api/game/${pin}/status`),
  getJoinInfo: (pin: string) => api.get(`/api/game/${pin}/join-info`),
  start: (pin: string) => api.post(`/api/game/${pin}/start`),
  submitAnswer: (data: any) => api.post('/api/game/answer/submit', data),
  getQuestionResults: (pin: string, questionId: number) =>
    api.get(`/api/game/${pin}/question/${questionId}/results`),
  getLeaderboard: (pin: string) => api.get(`/api/game/${pin}/leaderboard`),
  end: (pin: string) => api.post(`/api/game/${pin}/end`),
  getResults: (pin: string) => api.get(`/api/game/${pin}/results`),
  history: (hostName: string) => api.get('/api/game/history', { params: { host_name: hostName } }),
  deleteHistory: (sessionId: number, hostName: string) =>
    api.delete(`/api/game/history/${sessionId}`, { params: { host_name: hostName } }),
  getCertificateSettings: (pin: string) => api.get(`/api/game/${pin}/certificate/settings`),
  updateCertificateSettings: (pin: string, formData: FormData) =>
    api.post(`/api/game/${pin}/certificate/settings`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getCertificateStatus: (pin: string, playerId: number) =>
    api.get(`/api/game/${pin}/certificate/status/${playerId}`),
  downloadCertificateUrl: (pin: string, playerId: number) =>
    `${API_URL}/api/game/${pin}/certificate/download/${playerId}`,
};

// Auth endpoints
export const authAPI = {
  signup: (data: { full_name: string; email: string; password: string; role: 'host' | 'joiner' }) =>
    api.post('/api/auth/signup', data),
    
  // Reverted back to simple JSON! 
  login: (data: { email: string; password: string }) => 
    api.post('/api/auth/login', data),
    
  me: () => api.get('/api/auth/me'),
};

// Export endpoints
export const exportAPI = {
  csv: (pin: string) => `${API_URL}/api/export/${pin}/csv`,
  excel: (pin: string) => `${API_URL}/api/export/${pin}/excel`,
  pdf: (pin: string) => `${API_URL}/api/export/${pin}/pdf`,
};
