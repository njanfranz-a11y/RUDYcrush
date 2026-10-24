import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu, Plus, Bell, Search, HelpCircle, CheckCheck, ArrowRight } from 'lucide-react';

export default function MobileTopNav({ currentRoute = 'home', onToggleSidebar, onNavigate, onSelectReport }) {
  const {
    user,
    unreadCount,
    isAdmin,
    isOfficer,
    notifications,
    notificationsLoading,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead
  } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const routeTitles = {
    home: 'Road Accident Reporting System',
    about: 'About RoadWatch',
    login: 'Sign In to RoadWatch',
    register: 'Create an Account',
    'report-incident': 'Submit Incident Report',
    map: 'Live Incident Map',
    'my-reports': 'My Incident Reports',
    'user-dashboard': 'My Dashboard',
    'report-details': 'Incident Details',
    notifications: 'Alerts & Notifications',
    profile: 'Officer & User Profile',
    'admin-dashboard': 'Administrator Dashboard',
    'admin-reports': 'Manage Incident Reports',
    'admin-verification': 'Verification Queue',
    'admin-users': 'Users & Role Management',
    'admin-audit-logs': 'Security Audit Trail',
    'officer-dashboard': 'Officer Command Desk',
    'officer-reports': 'Assigned Incident Cases',
    'officer-verification': 'Verification Queue',
  };

  const pageTitle = routeTitles[currentRoute] || 'RoadWatch Bulacan';

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter') {
      if (isAdmin) onNavigate('admin-reports');
      else if (isOfficer) onNavigate('officer-reports');
      else onNavigate('map');
    }
  };

  const handleToggleDropdown = () => {
    if (!dropdownOpen) {
      fetchNotifications();
    }
    setDropdownOpen(!dropdownOpen);
  };

  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
    }
    setDropdownOpen(false);
    if (notif.link) {
      const match = notif.link.match(/\/reports\/(\d+)/);
      if (match && match[1] && onSelectReport) {
        onSelectReport(parseInt(match[1], 10));
        return;
      }
    }
    onNavigate('notifications');
  };

  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    await markAllNotificationsRead();
  };

  const handleViewAll = () => {
    setDropdownOpen(false);
    onNavigate('notifications');
  };

  return (
    <header className="app-top-bar">
      <div className="tb-left">
        <button
          className="tb-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation drawer"
          title="Toggle Navigation Menu"
        >
          <Menu size={20} />
        </button>

        <div className="tb-title-box">
          <div className="tb-title">{pageTitle}</div>
          <div className="tb-crumb">RoadWatch &middot; Province of Bulacan</div>
        </div>
      </div>

      <div className="tb-search-wrap">
        <Search size={16} className="tb-search-icon" />
        <input
          type="text"
          className="tb-search-input"
          placeholder="Search records, locations, officers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchSubmit}
        />
      </div>

      <div className="tb-actions">
        {!isAdmin && !isOfficer && (
          <button
            className="tb-btn-cta"
            onClick={() => onNavigate('report-incident')}
            title="Report a Road Incident"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>New report</span>
          </button>
        )}

        {user && (
          <div className="tb-notif-wrap" ref={dropdownRef}>
            <button
              className="tb-icon-btn"
              onClick={handleToggleDropdown}
              title="Notifications & Alerts"
              aria-label="Notifications"
              aria-expanded={dropdownOpen}
            >
              <Bell size={17} />
              {unreadCount > 0 && <span className="tb-badge-dot" />}
            </button>

            {dropdownOpen && (
              <div className="tb-notif-dropdown">
                <div className="tb-notif-head">
                  <div className="tb-notif-head-title">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="tb-notif-pill">{unreadCount}</span>
                    )}
                  </div>
                  {notifications.some(n => !n.is_read) && (
                    <button
                      type="button"
                      className="tb-notif-btn-readall"
                      onClick={handleMarkAllRead}
                    >
                      <CheckCheck size={13} color="#10b981" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="tb-notif-body">
                  {notificationsLoading && notifications.length === 0 ? (
                    <div className="tb-notif-empty">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="tb-notif-empty">
                      <Bell size={24} color="#94a3b8" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`tb-notif-row ${notif.is_read ? 'read' : 'unread'}`}
                        onClick={() => handleItemClick(notif)}
                      >
                        <div className={`tb-notif-ico ${notif.is_read ? 'read' : ''}`}>
                          <Bell size={14} />
                        </div>
                        <div className="tb-notif-main">
                          <div className="tb-notif-row-title">{notif.title}</div>
                          <div className="tb-notif-row-msg">{notif.message}</div>
                          <div className="tb-notif-row-time">
                            {new Date(notif.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </div>
                        {!notif.is_read && <span className="tb-notif-unread-dot" />}
                      </div>
                    ))
                  )}
                </div>

                <div className="tb-notif-foot" onClick={handleViewAll}>
                  <span>View all in Notifications page</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </header>
  );
}
