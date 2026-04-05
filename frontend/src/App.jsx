import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CompanionProfilePage from './pages/CompanionProfilePage.jsx';
import WalletBookingPage from './pages/WalletBookingPage.jsx';
import ChatRoomPage from './pages/ChatRoomPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import MePanel from './pages/MePanel.jsx';

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 px-4 py-12">
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/companion" element={<CompanionProfilePage />} />
          <Route path="/wallet-bookings" element={<WalletBookingPage />} />
          <Route path="/chat" element={<ChatRoomPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        <MePanel />
        <p className="mt-8 flex flex-wrap justify-center gap-4 text-center text-xs text-slate-500">
          <a href="/index.html" className="underline hover:text-slate-400">
            Về trang chủ
          </a>
          <Link to="/companion" className="underline hover:text-slate-400">
            Hồ sơ companion (eKYC &amp; bảng giá)
          </Link>
          <Link to="/wallet-bookings" className="underline hover:text-slate-400">
            Ví &amp; đặt lịch
          </Link>
          <Link to="/chat" className="underline hover:text-slate-400">
            Chat (Socket.IO)
          </Link>
          <Link to="/admin" className="underline hover:text-slate-400">
            Admin dashboard
          </Link>
        </p>
      </div>
    </HashRouter>
  );
}
