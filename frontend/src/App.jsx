import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/common/Sidebar';
import MobileTopNav from './components/common/MobileTopNav';
import AppFooter from './components/common/AppFooter';
import {
  REPORT_DETAILS_ROUTE,
} from './navigation/reportReturnRoute';

// Pages
import LandingPage from './pages/public/LandingPage';
import AboutPage from './pages/public/AboutPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import AccidentReportingPage from './pages/public/AccidentReportingPage';
import IncidentMapPage from './pages/public/IncidentMapPage';
import MyReportsPage from './pages/public/MyReportsPage';
import ReportDetailsPage from './pages/public/ReportDetailsPage';
import ReportDetailsModal from './components/reports/ReportDetailsModal';
import NotificationsPage from './pages/public/NotificationsPage';
import UserProfilePage from './pages/public/UserProfilePage';
import UserDashboardPage from './pages/public/UserDashboardPage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminVerificationQueuePage from './pages/admin/AdminVerificationQueuePage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';

import OfficerDashboardPage from './pages/officer/OfficerDashboardPage';
import OfficerReportsPage from './pages/officer/OfficerReportsPage';
import OfficerVerificationQueuePage from './pages/officer/OfficerVerificationQueuePage';

function AppContent() {
  const { user, loading, isAdmin, isOfficer } = useAuth();
  const [currentRoute, setCurrentRoute] = useState('home');
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigateTo = (route, param = null) => {
    setCurrentRoute(route);
    if (param) setSelectedReportId(param);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // View/Details actions open the shared modal over the current screen for
  // every role, so filters, search, pagination and scroll stay intact.
  const handleSelectReport = (reportId) => {
    setSelectedReportId(reportId);
    setMobileOpen(false);
  };

  const closeReportModal = () => setSelectedReportId(null);

  // Render current view
  const renderView = () => {
    if (loading) {
      return (
        <div style={{ padding: '100px 0', textAlign: 'center', color: 'var(--ink-mute)' }}>
          Loading RoadWatch Bulacan application...
        </div>
      );
    }

    switch (currentRoute) {
      case 'home':
        return <LandingPage onNavigate={navigateTo} />;

      case 'about':
        if (isAdmin) return <AdminDashboardPage onNavigate={navigateTo} onSelectReport={handleSelectReport} />;
        if (isOfficer) return <OfficerDashboardPage onSelectReport={handleSelectReport} onNavigate={navigateTo} />;
        if (user) return <UserDashboardPage onNavigate={navigateTo} onSelectReport={handleSelectReport} />;
        return <AboutPage onNavigate={navigateTo} />;

      case 'login':
        return <LoginPage onNavigate={navigateTo} />;

      case 'register':
        return <RegisterPage onNavigate={navigateTo} />;

      case 'report-incident':
        if (isAdmin) return <AdminDashboardPage onNavigate={navigateTo} onSelectReport={handleSelectReport} />;
        if (isOfficer) return <OfficerDashboardPage onSelectReport={handleSelectReport} onNavigate={navigateTo} />;
        return <AccidentReportingPage onNavigate={navigateTo} />;

      case 'map':
        return <IncidentMapPage onSelectReport={handleSelectReport} onNavigate={navigateTo} />;

      case 'my-reports':
        return <MyReportsPage onNavigate={navigateTo} onSelectReport={handleSelectReport} />;

      case REPORT_DETAILS_ROUTE:
        return (
          <ReportDetailsPage
            reportId={selectedReportId}
            onBack={() =>
              navigateTo(isAdmin ? 'admin-reports' : isOfficer ? 'officer-reports' : 'my-reports')
            }
          />
        );

      case 'notifications':
        return <NotificationsPage onNavigate={navigateTo} onSelectReport={handleSelectReport} />;

      case 'profile':
        return <UserProfilePage />;

      // Admin Routes
      case 'admin-dashboard':
        return isAdmin ? (
          <AdminDashboardPage onNavigate={navigateTo} onSelectReport={handleSelectReport} />
        ) : (
          <LandingPage onNavigate={navigateTo} />
        );

      case 'admin-reports':
        return isAdmin ? (
          <AdminReportsPage onSelectReport={handleSelectReport} />
        ) : (
          <LandingPage onNavigate={navigateTo} />
        );

      case 'admin-verification':
        return isAdmin ? (
          <AdminVerificationQueuePage onSelectReport={handleSelectReport} onNavigate={navigateTo} />
        ) : (
          <LandingPage onNavigate={navigateTo} />
        );

      case 'admin-users':
        return isAdmin ? (
          <AdminUsersPage />
        ) : (
          <LandingPage onNavigate={navigateTo} />
        );

      case 'admin-audit-logs':
        return isAdmin ? (
          <AdminAuditLogsPage />
        ) : (
          <LandingPage onNavigate={navigateTo} />
        );

      // User (Reporter) Routes
      case 'user-dashboard':
        return user && !isAdmin && !isOfficer ? (
          <UserDashboardPage onNavigate={navigateTo} onSelectReport={handleSelectReport} />
        ) : isAdmin ? (
          <AdminDashboardPage onNavigate={navigateTo} onSelectReport={handleSelectReport} />
        ) : isOfficer ? (
          <OfficerDashboardPage onSelectReport={handleSelectReport} onNavigate={navigateTo} />
        ) : (
          <LandingPage onNavigate={navigateTo} />
        );

      // Officer Routes
      case 'officer-dashboard':
        return isOfficer ? (
          <OfficerDashboardPage onSelectReport={handleSelectReport} onNavigate={navigateTo} />
        ) : (
          <LandingPage onNavigate={navigateTo} />
        );

      case 'officer-reports':
        return isOfficer ? (
          <OfficerReportsPage onSelectReport={handleSelectReport} onNavigate={navigateTo} />
        ) : (
          <LandingPage onNavigate={navigateTo} />
        );

      case 'officer-verification':
        return isOfficer ? (
          <OfficerVerificationQueuePage onSelectReport={handleSelectReport} onNavigate={navigateTo} />
        ) : (
          <LandingPage onNavigate={navigateTo} />
        );

      default:
        return (
          <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '40px', color: 'var(--primary)', marginBottom: '12px' }}>404</h1>
            <p style={{ color: 'var(--ink-mute)', marginBottom: '24px' }}>Page Not Found</p>
            <button className="btn btn--primary" onClick={() => navigateTo('home')}>Return to Home</button>
          </div>
        );
    }
  };

  // Determine if the authenticated App Shell (sidebar + app topnav) should be shown
  // The sidebar is strictly ONLY shown when logged in AND not viewing the public landing page!
  const showAppShell = user && currentRoute !== 'home';

  if (!showAppShell) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', background: 'var(--paper)' }}>
        {renderView()}
        {selectedReportId && (
          <ReportDetailsModal reportId={selectedReportId} onClose={closeReportModal} />
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={navigateTo}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <MobileTopNav
          currentRoute={currentRoute}
          onToggleSidebar={() => setMobileOpen(!mobileOpen)}
          onNavigate={navigateTo}
          onSelectReport={handleSelectReport}
        />
        <main className="app-content">
          {renderView()}
        </main>
      </div>
      {selectedReportId && (
        <ReportDetailsModal reportId={selectedReportId} onClose={closeReportModal} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
