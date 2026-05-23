import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import UpdateBanner from './components/UpdateBanner'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Matches from './pages/Matches'
import WorldCup from './pages/WorldCup'
import Ranking from './pages/Ranking'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import AdminUserProfile from './pages/AdminUserProfile'
import Chat from './pages/Chat'
import UserProfile from './pages/UserProfile'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import ResendVerification from './pages/ResendVerification'
import GoogleCallback from './pages/GoogleCallback'

export default function App() {
  return (
    <AuthProvider>
      <UpdateBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/resend-verification" element={<ResendVerification />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Matches />} />
          <Route path="/worldcup" element={<WorldCup />} />
          <Route path="/ranking" element={<Ranking />} />
<Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/user/:userId" element={<UserProfile />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/users/:userId" element={<AdminUserProfile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
