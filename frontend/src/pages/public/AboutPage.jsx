import React from 'react';
import { Shield, Database, MapPin, CheckCircle2, Lock, Cpu, FileCheck } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-block', padding: '4px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>
            IT 305 &bull; ADVANCED WEB DEVELOPMENT
          </div>
          <h1 style={{ fontSize: '36px', marginBottom: '12px' }}>About RoadWatch Bulacan</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1.6 }}>
            A complete, secure, responsive, and validated web platform engineered for public road accident reporting and official traffic incident verification.
          </p>
        </div>

        {/* Technology Highlights */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} color="var(--accent)" /> System Architecture & Technology Stack
          </h3>
          <p className="card-subtitle">Engineered to strict university and production-grade standards.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <strong>Frontend SPA</strong>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                React 19 + Vite, custom reusable design system tokens, responsive CSS flex/grid, zero external UI lock-in.
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <strong>Backend REST API</strong>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Laravel 12, PHP 8.2, versioned <code>/api/v1</code> endpoints, designed for both this website and future Flutter mobile client.
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <strong>Database (MySQL)</strong>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Relational MySQL on local XAMPP with foreign key cascades, migrations, seeders, and soft deletion protection.
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <strong>Geospatial Engine</strong>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                OpenStreetMap with Leaflet JS, supporting GPS location capture, manual pin adjustment, and multi-marker filtering.
              </div>
            </div>
          </div>
        </div>

        {/* User Roles & Permissions Matrix */}
        <div className="card" style={{ marginBottom: '32px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} color="#0284c7" /> Role-Based Access Control (RBAC)
          </h3>
          <p className="card-subtitle">Permissions are enforced on the backend via Laravel Sanctum & RoleMiddleware, not just UI visibility.</p>

          <div className="table-container" style={{ marginTop: '16px' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Public / Reporter</th>
                  <th>Traffic Officer</th>
                  <th>Administrator</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Submit Accident Report</td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                </tr>
                <tr>
                  <td>Upload Photo Evidence</td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                </tr>
                <tr>
                  <td>Track Personal Reports</td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                  <td>&mdash;</td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                </tr>
                <tr>
                  <td>Verify / Reject Assigned Reports</td>
                  <td>&mdash;</td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                  <td>&mdash;</td>
                </tr>
                <tr>
                  <td>Assign Reports to Officers</td>
                  <td>&mdash;</td>
                  <td>&mdash;</td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                </tr>
                <tr>
                  <td>Investigate, Update &amp; Close Cases</td>
                  <td>&mdash;</td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                  <td>&mdash;</td>
                </tr>
                <tr>
                  <td>Export PDF & CSV Summaries</td>
                  <td>&mdash;</td>
                  <td>&mdash;</td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                </tr>
                <tr>
                  <td>User & Role Administration</td>
                  <td>&mdash;</td>
                  <td>&mdash;</td>
                  <td><CheckCircle2 size={16} color="#16a34a" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 8-Stage Controlled Workflow */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCheck size={20} color="#16a34a" /> Controlled 8-Stage Status Pipeline
          </h3>
          <p className="card-subtitle">Every state transition is checked against an authorization matrix and logged in an immutable audit trail.</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
            <span className="badge badge-submitted">1. Submitted</span>
            <span className="badge badge-under_review">2. Under Review</span>
            <span className="badge badge-additional_info_required">3. Info Required</span>
            <span className="badge badge-verified">4. Verified</span>
            <span className="badge badge-assigned">5. Assigned</span>
            <span className="badge badge-in_progress">6. In Progress</span>
            <span className="badge badge-closed">7. Resolved / Closed</span>
            <span className="badge badge-rejected">8. Rejected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
