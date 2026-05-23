import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import UpdateBanner from './components/UpdateBanner'
import Layout from './components/Layout'
import PageLoader from './components/PageLoader'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Matches = lazy(() => import('./pages/Matches'))
const WorldCup = lazy(() => import('./pages/WorldCup'))
const Ranking = lazy(() => import('./pages/Ranking'))
const Profile = lazy(() => import('./pages/Profile'))
const Admin = lazy(() => import('./pages/Admin'))
const AdminUserProfile = lazy(() => import('./pages/AdminUserProfile'))
const Chat = lazy(() => import('./pages/Chat'))
const UserProfile = lazy(() => import('./pages/UserProfile'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'))
const ResendVerification = lazy(() => import('./pages/ResendVerification'))
const GoogleCallback = lazy(() => import('./pages/GoogleCallback'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Privacy = lazy(() => import('./pages/Privacy'))

function AdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <UpdateBanner />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/resend-verification" element={<ResendVerification />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Matches />} />
            <Route path="/worldcup" element={<WorldCup />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/user/:userId" element={<UserProfile />} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin/users/:userId" element={<AdminRoute><AdminUserProfile /></AdminRoute>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
