import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { supabase } from './lib/supabase';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Profile from './pages/Profile';

type ProtectedRouteProps = {
  isAuthed: boolean;
  isChecking: boolean;
  children: ReactNode;
};

function ProtectedRoute({ isAuthed, isChecking, children }: ProtectedRouteProps) {
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-600">Checking session...</p>
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AuthRoutes() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }

      const session = data.session ?? null;
      const authed = Boolean(session);
      setIsAuthed(authed);
      setIsChecking(false);

      // Initial load: only route "/" to dashboard for authenticated users.
      if (authed && pathnameRef.current === '/') {
        navigate('/dashboard', { replace: true });
      }
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      const authed = Boolean(session);
      setIsAuthed(authed);
      setIsChecking(false);

      if (event === 'SIGNED_IN' && pathnameRef.current === '/') {
        navigate('/dashboard', { replace: true });
      }

      if (event === 'SIGNED_OUT' && pathnameRef.current !== '/') {
        navigate('/', { replace: true });
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute isAuthed={isAuthed} isChecking={isChecking}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute isAuthed={isAuthed} isChecking={isChecking}>
            <Profile />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthRoutes />
    </BrowserRouter>
  );
}
