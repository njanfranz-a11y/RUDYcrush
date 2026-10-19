// Pure navigation helpers for the report details screen.
//
// Keeping the "where does Back go?" decision out of the component guarantees
// every role gets the same "return to where you came from" behaviour and lets
// it be tested without a browser.
//
// The bug this fixes: the admin Back button was hardcoded to Admin Reports, so
// opening a report from the Admin Verification Queue sent the admin to the
// wrong page.

export const REPORT_DETAILS_ROUTE = 'report-details';

const ROLE_DEFAULT_ROUTE = {
  admin: 'admin-reports',
  officer: 'officer-dashboard',
  reporter: 'my-reports',
};

// Fallback used only when there is no recorded origin (e.g. a deep link).
export function roleDefaultReportRoute(isAdmin, isOfficer) {
  if (isAdmin) return ROLE_DEFAULT_ROUTE.admin;
  if (isOfficer) return ROLE_DEFAULT_ROUTE.officer;
  return ROLE_DEFAULT_ROUTE.reporter;
}

// Remember the screen we are drilling in from. Re-opening a report while
// already on the details screen must keep the original origin, not replace it
// with 'report-details'.
export function captureReturnRoute(currentRoute, previousReturnRoute) {
  return currentRoute === REPORT_DETAILS_ROUTE ? previousReturnRoute : currentRoute;
}

// Back-button target: the recorded origin, or the role's list as a fallback.
export function resolveReportReturnRoute(returnRoute, isAdmin, isOfficer) {
  return returnRoute || roleDefaultReportRoute(isAdmin, isOfficer);
}
