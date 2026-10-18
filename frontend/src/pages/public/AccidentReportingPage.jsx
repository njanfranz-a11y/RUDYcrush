import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import LeafletMapPicker from '../../components/map/LeafletMapPicker';
import {
  AlertTriangle,
  Upload,
  X,
  CheckCircle,
  FileText,
  MapPin,
  Calendar,
  Clock,
  Car,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

export default function AccidentReportingPage({ onNavigate }) {
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    reporter_name: user?.name || '',
    reporter_contact: user?.phone || '',
    category_id: '',
    accident_date: new Date().toISOString().split('T')[0],
    accident_time: new Date().toTimeString().slice(0, 5),
    location_address: '',
    latitude: 14.8527,
    longitude: 120.8160,
    accident_type: 'Rear-end Collision',
    vehicles_involved: 2,
    injury_severity: 'none',
    description: '',
  });

  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);

  useEffect(() => {
    // Fetch categories
    api.getCategories()
      .then((res) => {
        if (res.data?.success) {
          setCategories(res.data.data);
          if (res.data.data.length > 0 && !formData.category_id) {
            setFormData(prev => ({
              ...prev,
              category_id: res.data.data[0].id,
              accident_type: res.data.data[0].name
            }));
          }
        }
      })
      .catch((err) => console.log('Categories load:', err.message));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // If category changed, sync default accident_type
    if (name === 'category_id') {
      const selected = categories.find(c => c.id.toString() === value);
      if (selected) {
        setFormData(prev => ({ ...prev, accident_type: selected.name }));
      }
    }
  };

  const handleLocationSelect = (lat, lng) => {
    setFormData(prev => ({
      ...prev,
      latitude: Number(lat).toFixed(6),
      longitude: Number(lng).toFixed(6),
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Validate maximum 5 files and 5MB per file
    if (photoFiles.length + files.length > 5) {
      setError('You can upload a maximum of 5 evidence photos.');
      return;
    }

    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        setError(`File "${f.name}" exceeds the maximum 5MB size limit.`);
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(f.type)) {
        setError(`File "${f.name}" is not a supported image format (JPEG, PNG, WEBP).`);
        return;
      }
    }

    const updatedFiles = [...photoFiles, ...files];
    setPhotoFiles(updatedFiles);

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
    setError('');
  };

  const removePhoto = (index) => {
    const newFiles = [...photoFiles];
    newFiles.splice(index, 1);
    setPhotoFiles(newFiles);

    const newPreviews = [...photoPreviews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPhotoPreviews(newPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Pre-flight validation
    if (!formData.location_address.trim()) {
      setError('Accident location description is required.');
      return;
    }

    if (formData.description.trim().length < 10) {
      setError('Please provide a detailed accident description (at least 10 characters).');
      return;
    }

    setLoading(true);

    try {
      const submission = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined) {
          submission.append(key, formData[key]);
        }
      });

      photoFiles.forEach((file) => {
        submission.append('photos[]', file);
      });

      const res = await api.submitReport(submission);
      if (res.data?.success) {
        setSubmittedReport(res.data.data);
      }
    } catch (err) {
      setError(err.friendlyMessage || err.message || 'Failed to submit report. Please check entered fields.');
    } finally {
      setLoading(false);
    }
  };

  // Success Confirmation State
  if (submittedReport) {
    return (
      <div className="container-narrow" style={{ padding: '60px 20px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#dcfce7',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto'
          }}>
            <CheckCircle size={36} />
          </div>

          <h2 style={{ fontSize: '26px', marginBottom: '8px' }}>Report Successfully Submitted!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '15px' }}>
            Your accident report has been logged and queued for administrative review and official verification.
          </p>

          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '32px',
            maxWidth: '460px',
            margin: '0 auto 32px auto',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Reference Number:</span>
              <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{submittedReport.report_number}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Current Status:</span>
              <span className="badge badge-submitted">Pending Verification</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Date & Time:</span>
              <span style={{ fontSize: '13px' }}>{submittedReport.accident_date} at {submittedReport.accident_time}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Location:</span>
              <span style={{ fontSize: '13px', maxWidth: '240px', textAlign: 'right' }}>{submittedReport.location_address}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => onNavigate('my-reports')}
            >
              <FileText size={16} /> View My Submitted Reports
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                setSubmittedReport(null);
                setPhotoFiles([]);
                setPhotoPreviews([]);
                setFormData(prev => ({ ...prev, description: '', location_address: '' }));
              }}
            >
              Submit Another Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '920px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 className="dashboard-heading">Submit Road Accident Report</h1>
          <p className="dashboard-subheading">
            Official incident filing for the Province of Bulacan. Information submitted is directly dispatched to municipal traffic command centers and field officers.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Reporter Contact Info */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 className="card-title">1. Reporter Details</h3>
            <p className="card-subtitle">Your personal contact details remain confidential and are only accessed by investigating officers.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Reporter Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="reporter_name"
                  className="form-control"
                  placeholder="e.g. Maria Dela Cruz"
                  value={formData.reporter_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Contact / Mobile Phone</label>
                <input
                  type="tel"
                  name="reporter_contact"
                  className="form-control"
                  placeholder="e.g. +63 917 123 4567"
                  value={formData.reporter_contact}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Date, Time & Classification */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 className="card-title">2. Incident Timing & Type</h3>
            <p className="card-subtitle">Specify when the accident occurred and the nature of the collision.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Accident Date <span className="required">*</span></label>
                <input
                  type="date"
                  name="accident_date"
                  max={new Date().toISOString().split('T')[0]} // Prevents future accident dates
                  className="form-control"
                  value={formData.accident_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Accident Time <span className="required">*</span></label>
                <input
                  type="time"
                  name="accident_time"
                  className="form-control"
                  value={formData.accident_time}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Accident Category <span className="required">*</span></label>
                <select
                  name="category_id"
                  className="form-control"
                  value={formData.category_id}
                  onChange={handleChange}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Vehicles Involved <span className="required">*</span></label>
                <input
                  type="number"
                  name="vehicles_involved"
                  min="1"
                  max="99"
                  className="form-control"
                  value={formData.vehicles_involved}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Injury Severity <span className="required">*</span></label>
                <div className="radio-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                  {[
                    { val: 'none', lbl: 'None', sub: 'Property Only' },
                    { val: 'minor', lbl: 'Minor', sub: 'First Aid' },
                    { val: 'severe', lbl: 'Severe', sub: 'Hospitalization' },
                    { val: 'fatal', lbl: 'Fatal', sub: 'Critical Loss' },
                  ].map((s) => (
                    <div
                      key={s.val}
                      className={`rcard ${formData.injury_severity === s.val ? 'on' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, injury_severity: s.val }))}
                    >
                      <b>{s.lbl}</b>
                      <small style={{ fontSize: '10.5px', color: 'var(--ink-mute)', marginTop: '2px' }}>{s.sub}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Map Location Picker */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 className="card-title">3. Accident Location & GPS Pin</h3>
            <p className="card-subtitle">Click anywhere on the map or use your device GPS to drop a precise pin on the collision spot.</p>

            <div className="form-group">
              <label className="form-label">Street Address & Landmark <span className="required">*</span></label>
              <input
                type="text"
                name="location_address"
                className="form-control"
                placeholder="e.g. MacArthur Highway corner Capitolio, Barangay Guinhawa, Malolos City"
                value={formData.location_address}
                onChange={handleChange}
                required
              />
              <div className="form-hint">Include road name, barangay, municipality, and nearby prominent landmarks.</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <LeafletMapPicker
                latitude={formData.latitude}
                longitude={formData.longitude}
                onLocationSelect={handleLocationSelect}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">GPS Latitude</label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  className="form-control"
                  value={formData.latitude}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">GPS Longitude</label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  className="form-control"
                  value={formData.longitude}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Description & Photos */}
          <div className="card" style={{ marginBottom: '28px' }}>
            <h3 className="card-title">4. Incident Description & Evidence</h3>
            <p className="card-subtitle">Describe what occurred and optionally attach photo evidence from the site.</p>

            <div className="form-group">
              <label className="form-label">Accident Description <span className="required">*</span></label>
              <textarea
                name="description"
                rows="4"
                className="form-control"
                placeholder="Describe sequence of events, vehicle models/plates if known, road weather conditions, and visible obstructions..."
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Photo Evidence (Up to 5 images, max 5MB each)</label>
              
              <div className="drop" style={{ position: 'relative' }}>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%'
                  }}
                />
                <Upload size={28} color="var(--amber-deep)" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>
                  Click or drag accident photos here
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-mute)', marginTop: '4px' }}>
                  Supports JPG, PNG, WEBP &bull; Max 5MB per image
                </div>
              </div>

              {/* Photo Previews */}
              {photoPreviews.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                  {photoPreviews.map((src, index) => (
                    <div key={index} style={{
                      position: 'relative',
                      width: '90px',
                      height: '90px',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      border: '1px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      <img src={src} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          background: 'rgba(239, 68, 68, 0.85)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('home')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-accent btn-lg"
              disabled={loading}
              style={{ minWidth: '220px' }}
            >
              {loading ? 'Submitting Report...' : 'Submit Incident Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
