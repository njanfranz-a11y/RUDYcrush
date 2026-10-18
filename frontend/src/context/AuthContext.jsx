import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('roadwatch_token'));
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!localStorage.getItem('roadwatch_token')) return;
    setNotificationsLoading(true);
    try {
      const res = await api.getNotifications();
      if (res.data?.success) {
        const notifData = res.data.data.notifications?.data || res.data.data.notifications || [];
        setNotifications(Array.isArray(notifData) ? notifData : []);
        setUnreadCount(res.data.data.unread_count ?? (Array.isArray(notifData) ? notifData.filter(n => !n.is_read).length : 0));
      }
    } catch (err) {
      console.warn('Notifications fetch error:', err.message);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Mark notification read error:', err.message);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Mark all notifications read error:', err.message);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      if (!localStorage.getItem('roadwatch_token')) {
        setUser(null);
        setNotifications([]);
        setLoading(false);
        return;
      }
      const response = await api.getMe();
      if (response.data?.success) {
        setUser(response.data.data.user);
        setUnreadCount(response.data.data.unread_notifications || 0);
        fetchNotifications();
      }
    } catch (err) {
      console.warn('Session expired or invalid token:', err.message);
      localStorage.removeItem('roadwatch_token');
      setToken(null);
      setUser(null);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, [token]);

  // Poll notifications every 15 seconds so status changes appear without manual refresh
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchNotifications();
    }, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    if (res.data?.success) {
      const newToken = res.data.data.token;
      const newUser = res.data.data.user;
      localStorage.setItem('roadwatch_token', newToken);
      setToken(newToken);
      setUser(newUser);
      fetchNotifications();
      return newUser;
    }
    throw new Error(res.data?.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    if (res.data?.success) {
      const newToken = res.data.data.token;
      const newUser = res.data.data.user;
      localStorage.setItem('roadwatch_token', newToken);
      setToken(newToken);
      setUser(newUser);
      fetchNotifications();
      return newUser;
    }
    throw new Error(res.data?.message || 'Registration failed');
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('roadwatch_token');
      setToken(null);
      setUser(null);
      setUnreadCount(0);
      setNotifications([]);
    }
  };

  const updateCurrentUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const value = {
    user,
    token,
    loading,
    unreadCount,
    setUnreadCount,
    notifications,
    notificationsLoading,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    login,
    register,
    logout,
    refreshUser: fetchCurrentUser,
    updateCurrentUser,
    isAdmin: user?.role === 'admin',
    isOfficer: user?.role === 'officer',
    isReporter: user?.role === 'reporter',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
