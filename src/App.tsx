import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { getSession, logout } from './services/api';
import Dashboard from './screens/Dashboard';
import Calendar from './screens/Calendar';
import Properties from './screens/Properties';
import Finance from './screens/Finance';
import Tenants from './screens/Tenants';
import TenantDetails from './screens/TenantDetails';
import Events from './screens/Events';
import Login from './screens/Login';

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

function AppShell() {
  const [authenticated, setAuthenticated] = React.useState(false);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const navigate = useNavigate();

  React.useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getSession();
        setAuthenticated(session.authenticated);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleLogout = async () => {
    await logout();
    setAuthenticated(false);
  };

  const handleLogin = () => {
    setAuthenticated(true);
    navigate('/', { replace: true });
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar onLogout={handleLogout} />
      <main className="flex-1 pb-20 md:pb-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/tenants/:id" element={<TenantDetails />} />
          <Route path="/events" element={<Events />} />
        </Routes>
      </main>
    </div>
  );
}

