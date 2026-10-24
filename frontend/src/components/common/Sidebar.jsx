import React from 'react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from './BrandLogo';
import {
  LayoutDashboard,
  FileText,
  MapPin,
  Shield,
  Users,
  Bell,
  Settings,
  LogOut,
  X,
  FileCheck2
} from 'lucide-react';

export default function Sidebar({ currentRoute, onNavigate, mobileOpen, onCloseMobile }) {
  const { user, logout, unreadCount, isAdmin, isOfficer, isReporter } = useAuth();

  const handleNav = (route) => {
    onNavigate(route);
    if (onCloseMobile) onCloseMobile();
  };

  const getInitials = (name) => {
    if (!name) return 'RW';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const roleSubtitle = isAdmin
    ? 'Admin Console'
    : isOfficer
    ? 'Officer Console'
    : 'Citizen Portal';

  const userDashboardRoute = isAdmin
    ? 'admin-dashboard'
    : isOfficer
    ? 'officer-dashboard'
    : 'user-dashboard';

  const userReportsRoute = isAdmin
    ? 'admin-reports'
    : isOfficer
    ? 'officer-reports'
    : 'my-reports';

  // Verification Queue is role-specific: admins assign cases from the intake
  // queue; traffic officers verify or reject the cases assigned to them.
  const userVerificationRoute = isAdmin
    ? 'admin-verification'
    : isOfficer
    ? 'officer-verification'
    : 'admin-verification';

  return (
    <>
      {/* Mobile Drawer Overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      {/* Main Reference Sidebar (.sb) */}
      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div>
          {/* Brand Row matching Reference */}
          <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div 
              className="sidebar-brand" 
              onClick={() => handleNav(userDashboardRoute)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <BrandLogo variant="mark" height={40} className="sidebar-brand-logo" />
              <div>
                <div className="sidebar-brand-name" style={{ fontSize: '15.5px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.2px' }}>
                  RoadWatch
                </div>
                <div className="sidebar-brand-sub" style={{ fontSize: '11px', color: '#ffb020', fontWeight: 600, letterSpacing: '0.04em' }}>
                  {roleSubtitle}
                </div>
              </div>
            </div>
            {mobileOpen && (
              <button 
                onClick={onCloseMobile} 
                style={{ background: 'none', border: 'none', color: '#9db0cf', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Navigation Items (.sb__nav) */}
          <nav className="sidebar-nav" style={{ marginTop: '16px' }}>
            <button
              className={`sidebar-nav-item ${['admin-dashboard', 'officer-dashboard', 'user-dashboard', 'dashboard'].includes(currentRoute) ? 'active' : ''}`}
              onClick={() => handleNav(userDashboardRoute)}
            >
              <LayoutDashboard size={17} /> Dashboard
            </button>

            <button
              className={`sidebar-nav-item ${['admin-reports', 'officer-reports', 'my-reports'].includes(currentRoute) ? 'active' : ''}`}
              onClick={() => handleNav(userReportsRoute)}
            >
              <FileText size={17} /> Reports
            </button>

            <button
              className={`sidebar-nav-item ${currentRoute === 'notifications' ? 'active' : ''}`}
              onClick={() => handleNav('notifications')}
            >
              <Bell size={17} /> Notifications
              {unreadCount > 0 && (
                <span className="cnt" style={{ marginLeft: 'auto', background: 'var(--amber)', color: '#0a1428', fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px' }}>
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              className={`sidebar-nav-item ${currentRoute === 'map' ? 'active' : ''}`}
              onClick={() => handleNav('map')}
            >
              <MapPin size={17} /> Live Map
            </button>

            {(isAdmin || isOfficer) && (
              <button
                className={`sidebar-nav-item ${currentRoute === userVerificationRoute ? 'active' : ''}`}
                onClick={() => handleNav(userVerificationRoute)}
              >
                <FileCheck2 size={17} /> Verification Queue
              </button>
            )}

            {/* Management Section (Admin Only) */}
            {isAdmin && (
              <div className="sidebar-section" style={{ marginTop: '18px' }}>
                <div className="sidebar-section-title" style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#566e94', textTransform: 'uppercase', padding: '0 12px 8px', fontWeight: 700 }}>
                  Management
                </div>
                <button
                  className={`sidebar-nav-item ${currentRoute === 'admin-users' ? 'active' : ''}`}
                  onClick={() => handleNav('admin-users')}
                >
                  <Users size={17} /> Users &amp; Roles
                </button>
                <button
                  className={`sidebar-nav-item ${currentRoute === 'admin-audit-logs' ? 'active' : ''}`}
                  onClick={() => handleNav('admin-audit-logs')}
                >
                  <Shield size={17} /> Security audit trail
                </button>
              </div>
            )}

            <button
              className={`sidebar-nav-item ${currentRoute === 'profile' ? 'active' : ''}`}
              onClick={() => handleNav('profile')}
              style={{ marginTop: '8px' }}
            >
              <Settings size={17} /> Settings &amp; Profile
            </button>
          </nav>
        </div>

        {/* User Footer (.sb__foot) */}
        <div className="sidebar-footer">
          <div
            className="sidebar-user-card"
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
            onClick={() => handleNav('profile')}
          >
            <div className="sidebar-user-avatar" style={{ width: 34, height: 34, borderRadius: '50%', background: '#1e3a6b', color: '#ffb020', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '12px' }}>
              {getInitials(user?.name)}
            </div>
            <div className="sidebar-user-info" style={{ minWidth: 0, flex: 1 }}>
              <div className="sidebar-user-name" style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name || 'Authorized Staff'}
              </div>
              <div className="sidebar-user-role" style={{ fontSize: '11px', color: '#9db0cf' }}>
                {user?.role === 'admin' ? 'Provincial Admin' : user?.role === 'officer' ? `Traffic Officer (${user?.badge_number || 'PO'})` : 'Bulacan Resident'}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                logout();
                onNavigate('home');
              }}
              title="Sign Out"
              style={{ background: 'none', border: 'none', color: '#9db0cf', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
