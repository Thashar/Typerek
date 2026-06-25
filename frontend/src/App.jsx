import { lazy, Suspense, Component } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/AuthContext'
import UpdateBanner from './components/UpdateBanner'
import Layout from './components/Layout'
import PageLoader from './components/PageLoader'

function lazyWithRetry(factory) {
  return lazy(() =>
    factory().catch(() => {
      if (!sessionStorage.getItem('chunk-reloaded')) {
        sessionStorage.setItem('chunk-reloaded', '1')
        window.location.reload()
        return new Promise(() => {})
      }
      return Promise.reject(new Error('Chunk load failed'))
    })
  )
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch() {
    if (!sessionStorage.getItem('error-reloaded')) {
      sessionStorage.setItem('error-reloaded', '1')
      window.location.reload()
    }
  }
  render() {
    if (this.state.hasError) return <PageLoader />
    return this.props.children
  }
}

const Login = lazyWithRetry(() => import('./pages/Login'))
const Register = lazyWithRetry(() => import('./pages/Register'))
const Matches = lazyWithRetry(() => import('./pages/Matches'))
const WorldCup = lazyWithRetry(() => import('./pages/WorldCup'))
const Ranking = lazyWithRetry(() => import('./pages/Ranking'))
const Profile = lazyWithRetry(() => import('./pages/Profile'))
const Admin = lazyWithRetry(() => import('./pages/Admin'))
const AdminUserProfile = lazyWithRetry(() => import('./pages/AdminUserProfile'))
const Chat = lazyWithRetry(() => import('./pages/Chat'))
const UserProfile = lazyWithRetry(() => import('./pages/UserProfile'))
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'))
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'))
const VerifyEmail = lazyWithRetry(() => import('./pages/VerifyEmail'))
const ResendVerification = lazyWithRetry(() => import('./pages/ResendVerification'))
const GoogleCallback = lazyWithRetry(() => import('./pages/GoogleCallback'))
const NotFound = lazyWithRetry(() => import('./pages/NotFound'))
const Privacy = lazyWithRetry(() => import('./pages/Privacy'))
const Terms = lazyWithRetry(() => import('./pages/Terms'))

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
      <ErrorBoundary>
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
          <Route path="/regulamin" element={<Terms />} />
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
      </ErrorBoundary>
    </AuthProvider>
  )
}
