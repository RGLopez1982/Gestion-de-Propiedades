import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import Dashboard from './screens/Dashboard';
import Calendar from './screens/Calendar';
import Properties from './screens/Properties';
import Finance from './screens/Finance';
import Tenants from './screens/Tenants';
import TenantDetails from './screens/TenantDetails';
import Events from './screens/Events';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-surface flex flex-col">
        <Navbar />
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
    </Router>
  );
}

