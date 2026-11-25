import { Suspense, lazy, useState } from 'react';
import { Navigate, Outlet, RouterProvider, createBrowserRouter, createHashRouter, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
// The editor (and its text-formatting library) loads when a resume is opened.
const Editor = lazy(() => import('./pages/Editor'));
// The document editor (and its text-editing library) loads only when someone opens an uploaded resume.
const DocEditor = lazy(() => import('./pages/DocEditor'));
import Changelog from './pages/Changelog';
import UpdateBanner from './components/UpdateBanner';
import { isUploadUnlocked } from './lib/wip';
import { WipPage } from './components/WipGate';
import { VersionProvider } from './lib/version';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

// Uploaded-resume editor stays behind the work-in-progress password until it's ready.
function DocRoute() {
  const [ok, setOk] = useState(isUploadUnlocked);
  const navigate = useNavigate();
  if (!ok) return <WipPage onUnlock={() => setOk(true)} onBack={() => navigate('/app')} />;
  return <Suspense fallback={<div className="center-screen"><div className="spinner" /></div>}><DocEditor /></Suspense>;
}

function Layout() {
  return (
    <>
      <UpdateBanner />
      <Outlet />
    </>
  );
}

const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/changelog', element: <Changelog /> },
      { path: '/app', element: <Protected><Dashboard /></Protected> },
      { path: '/app/edit/:id', element: <Protected><Suspense fallback={<div className="center-screen"><div className="spinner" /></div>}><Editor /></Suspense></Protected> },
      { path: '/app/doc/:id', element: <Protected><DocRoute /></Protected> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

// The single-file demo build can't rely on server rewrites, so it uses hash URLs.
// (A "data router" is needed so the editor can save before you navigate away.)
const future = { v7_relativeSplatPath: true, v7_fetcherPersist: true, v7_normalizeFormMethod: true, v7_partialHydration: true, v7_skipActionErrorRevalidation: true };
const router = import.meta.env.MODE === 'demo' ? createHashRouter(routes, { future }) : createBrowserRouter(routes, { future });

export default function App() {
  return (
    <AuthProvider>
      <VersionProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </VersionProvider>
    </AuthProvider>
  );
}
