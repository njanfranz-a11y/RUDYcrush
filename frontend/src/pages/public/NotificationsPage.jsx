import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Bell, CheckCheck, Clock, ArrowRight, Shield, AlertTriangle } from 'lucide-react';

export default function NotificationsPage({ onNavigate, onSelectReport }) {
  const {
    notifications,
    notificationsLoading,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead
  } = useAuth();

  // Fetch fresh notifications once per page visit (every mount)
  const hasFetched = React.useRef(false);
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id);
    }

    if (notif.link) {
      const match = notif.link.match(/\/reports\/(\d+)/);
      if (match && match[1]) {
        onSelectReport(parseInt(match[1], 10));
      }
    }
  };

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className="dashboard-heading">System Notifications</h1>
            <p className="dashboard-subheading">
              Updates regarding your submitted incident reports, assignments, and review milestones
            </p>
          </div>

          {notifications.some(n => !n.is_read) && (
            <button
              className="btn-dash-outline"
              onClick={handleMarkAllRead}
            >
              <CheckCheck size={14} color="#10b981" /> Mark All as Read
            </button>
          )}
        </div>

      {notificationsLoading && notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
          <Bell size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>No Notifications Yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            You will be alerted here when an administrator verifies or updates your incident report.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="card"
              style={{
                cursor: notif.link ? 'pointer' : 'default',
                padding: '16px 20px',
                backgroundColor: notif.is_read ? '#ffffff' : '#f0f9ff',
                borderColor: notif.is_read ? 'var(--border-color)' : '#bae6fd',
                transition: 'var(--transition)'
              }}
              onClick={() => handleNotificationClick(notif)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: notif.is_read ? '#f1f5f9' : '#e0f2fe',
                    color: notif.is_read ? '#64748b' : '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Bell size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--primary)', marginBottom: '3px' }}>
                      {notif.title}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                      {notif.message}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {new Date(notif.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {!notif.is_read && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)', flexShrink: 0, marginTop: '6px' }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
