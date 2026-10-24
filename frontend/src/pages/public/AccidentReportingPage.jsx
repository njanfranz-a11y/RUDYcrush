import React from 'react';
import IncidentReportForm from '../../components/reports/IncidentReportForm';

/**
 * Full-page reporting route. The dashboard opens the same form inside a modal
 * so submission, validation, GPS and photo handling are implemented once.
 */
export default function AccidentReportingPage({ onNavigate }) {
  return <IncidentReportForm onNavigate={onNavigate} />;
}
