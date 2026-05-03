import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Building2, 
  Wallet, 
  Users, 
  Bell,
  TicketPercent
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function Navbar() {
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Calendario', icon: CalendarDays, path: '/calendar' },
    { name: 'Propiedades', icon: Building2, path: '/properties' },
    { name: 'Finanzas', icon: Wallet, path: '/finance' },
    { name: 'Inquilinos', icon: Users, path: '/tenants' },
    { name: 'Eventos', icon: TicketPercent, path: '/events' },
  ];

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b border-outline-variant/30 flex justify-between items-center w-full px-6 h-16 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant">
            <img 
              alt="Manager profile" 
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=100&h=100" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="font-display text-lg font-bold text-primary">Gestión de Propiedades</span>
        </div>
        
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "text-primary bg-surface-container" 
                    : "text-on-surface-variant hover:bg-surface-container-low"
                )}
              >
                {item.name}
              </NavLink>
            ))}
          </nav>
          
          <button className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center bg-white border-t border-outline-variant/30 h-16 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all",
              isActive 
                ? "text-primary border-t-2 border-primary pt-0" 
                : "text-on-surface-variant pt-0.5"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
