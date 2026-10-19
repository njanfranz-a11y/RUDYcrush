import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  captureReturnRoute,
  resolveReportReturnRoute,
} from './reportReturnRoute.js';

// Helper that mirrors what App.jsx does: capture the origin on open, then
// resolve the target on Back.
const backTarget = (originRoute, isAdmin = false, isOfficer = false) => {
  const captured = captureReturnRoute(originRoute, null);
  return resolveReportReturnRoute(captured, isAdmin, isOfficer);
};

test('admin Back from a report opened in the Verification Queue returns to the queue', () => {
  assert.equal(backTarget('admin-verification', true, false), 'admin-verification');
});

test('admin Back from a report opened in Reports returns to Reports', () => {
  assert.equal(backTarget('admin-reports', true, false), 'admin-reports');
});

test('admin Back from a report opened on the dashboard returns to the dashboard', () => {
  assert.equal(backTarget('admin-dashboard', true, false), 'admin-dashboard');
});

test('officer origins are preserved', () => {
  assert.equal(backTarget('officer-reports', false, true), 'officer-reports');
  assert.equal(backTarget('officer-dashboard', false, true), 'officer-dashboard');
});

test('reporter origins are preserved', () => {
  assert.equal(backTarget('my-reports', false, false), 'my-reports');
  assert.equal(backTarget('map', false, false), 'map');
});

test('missing origin falls back to the role default', () => {
  assert.equal(resolveReportReturnRoute(null, true, false), 'admin-reports');
  assert.equal(resolveReportReturnRoute(null, false, true), 'officer-dashboard');
  assert.equal(resolveReportReturnRoute(null, false, false), 'my-reports');
});

test('opening another report while already on details keeps the original origin', () => {
  const first = captureReturnRoute('admin-verification', null);
  const second = captureReturnRoute('report-details', first);
  assert.equal(second, 'admin-verification');
  assert.equal(resolveReportReturnRoute(second, true, false), 'admin-verification');
});
