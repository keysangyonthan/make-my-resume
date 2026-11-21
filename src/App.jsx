import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Changelog from './pages/Changelog';
import UpdateBanner from './components/UpdateBanner';
import { VersionProvider } from './lib/version';

// The single-file demo build can't rely on server rewrites, so it uses hash URLs.
const Router = import.meta.env.MODE === 'demo' ? HashRouter : BrowserRouter;

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <VersionProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UpdateBanner />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/app" element={<Protected><Dashboard /></Protected>} />
          <Route path="/app/edit/:id" element={<Protected><Editor /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </VersionProvider>
    </AuthProvider>
  );
}
