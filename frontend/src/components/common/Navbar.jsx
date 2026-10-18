import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  AlertTriangle,
  FileText,
  MapPin,
  Bell,
  User,
  LogOut,
  Shield,
  Layers,
  BarChart3,
  Users,
  Menu,
  X,
  PlusCircle,
} from 'lucide-react';

export default function Navbar({ currentRoute, onNavigate }) {
  const { user, logout, unreadCount, isAdmin, isOfficer, isReporter } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (route) => {
    onNavigate(route);
    setMobileOpen(false);
  };

  return (
    <header className="navbar">
      <div className="container nav-container">
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => handleNav('home')}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #e11d48, #be123c)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(225, 29, 72, 0.3)'
          }}>
            <AlertTriangle size={20} />
          </div>
          <span className="brand">
            RoadWatch <span className="brand-badge">BulSU</span>
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="nav-links">
          <button
            className={`nav-link ${currentRoute === 'home' ? 'active' : ''}`}
            onClick={() => handleNav('home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Home
          </button>

          <button
            className={`nav-link ${currentRoute === 'map' ? 'active' : ''}`}
            onClick={() => handleNav('map')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <MapPin size={15} /> Incident Map
          </button>

          {!user && (
            <button
              className={`nav-link ${currentRoute === 'about' ? 'active' : ''}`}
              onClick={() => handleNav('about')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              About
            </button>
          )}

          {/* Role-Specific Portal Links */}
          {user && isReporter && (
            <button
              className={`nav-link ${currentRoute === 'my-reports' ? 'active' : ''}`}
              onClick={() => handleNav('my-reports')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <FileText size={15} /> My Reports
            </button>
          )}

          {user && isOfficer && (
            <>
              <button
                className={`nav-link ${currentRoute === 'officer-dashboard' ? 'active' : ''}`}
                onClick={() => handleNav('officer-dashboard')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Shield size={15} /> Officer Portal
              </button>
              <button
                className={`nav-link ${currentRoute === 'officer-reports' ? 'active' : ''}`}
                onClick={() => handleNav('officer-reports')}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Assigned Cases
              </button>
            </>
          )}

          {user && isAdmin && (
            <>
              <button
                className={`nav-link ${currentRoute === 'admin-dashboard' ? 'active' : ''}`}
                onClick={() => handleNav('admin-dashboard')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <BarChart3 size={15} /> Admin Dashboard
              </button>
              <button
                className={`nav-link ${currentRoute === 'admin-reports' ? 'active' : ''}`}
                onClick={() => handleNav('admin-reports')}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Manage Reports
              </button>
              <button
                className={`nav-link ${currentRoute === 'admin-users' ? 'active' : ''}`}
                onClick={() => handleNav('admin-users')}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Users & Roles
              </button>
            </>
          )}
        </nav>

        {/* Action Buttons & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn btn-accent btn-sm"
            onClick={() => handleNav('report-incident')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <PlusCircle size={15} /> Report Incident
          </button>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Notification Bell */}
              <button
                onClick={() => handleNav('notifications')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '6px',
                  borderRadius: 'var(--radius-sm)',
                  color: currentRoute === 'notifications' ? 'var(--primary)' : 'var(--text-muted)'
                }}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '16px',
                    height: '16px',
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: '50%',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Profile button */}
              <button
                onClick={() => handleNav('profile')}
                className="btn btn-outline btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <User size={14} />
                <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name.split(' ')[0]}
                </span>
                <span className={`badge badge-role-${user.role}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                  {user.role}
                </span>
              </button>

              {/* Logout button */}
              <button
                onClick={logout}
                className="btn btn-outline btn-sm"
                title="Log Out"
                style={{ padding: '6px 8px' }}
              >
                <LogOut size={15} color="#ef4444" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleNav('login')}
              >
                Log In
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleNav('register')}
              >
                Register
              </button>
            </div>
          )}

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
            }}
            className="mobile-toggle"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid var(--border-color)',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <button className="nav-link" onClick={() => handleNav('home')}>Home</button>
          <button className="nav-link" onClick={() => handleNav('map')}>Incident Map</button>
          {!user && <button className="nav-link" onClick={() => handleNav('about')}>About System</button>}
          {user && isReporter && <button className="nav-link" onClick={() => handleNav('my-reports')}>My Reports</button>}
          {user && isOfficer && <button className="nav-link" onClick={() => handleNav('officer-dashboard')}>Officer Portal</button>}
          {user && isAdmin && (
            <>
              <button className="nav-link" onClick={() => handleNav('admin-dashboard')}>Admin Dashboard</button>
              <button className="nav-link" onClick={() => handleNav('admin-reports')}>Manage Reports</button>
              <button className="nav-link" onClick={() => handleNav('admin-users')}>User Management</button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
