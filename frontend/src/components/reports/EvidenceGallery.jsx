import React, { useState } from 'react';
import { Image, X, ZoomIn, AlertCircle } from 'lucide-react';
import { getPhotoUrl, getPhotoFallbackUrl } from '../../services/api';

export default function EvidenceGallery({ photos = [] }) {
  const [activePhoto, setActivePhoto] = useState(null);
  const [triedFallback, setTriedFallback] = useState({});
  const [failedPhotos, setFailedPhotos] = useState({});

  if (!photos || photos.length === 0) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#f8fafc',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center',
        border: '1px dashed var(--border-color)',
        color: 'var(--text-muted)',
        fontSize: '13px'
      }}>
        <Image size={24} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
        No photographic evidence was submitted for this report.
      </div>
    );
  }

  const handleImageError = (p, isLightbox = false) => {
    // If we haven't tried the backend direct file API fallback yet, try it
    if (!triedFallback[p.id]) {
      setTriedFallback(prev => ({ ...prev, [p.id]: true }));
    } else {
      // Both storage link and API fallback failed - mark photo as failed
      setFailedPhotos(prev => ({ ...prev, [p.id]: true }));
    }
  };

  const getActiveSrc = (p) => {
    if (triedFallback[p.id]) {
      return getPhotoFallbackUrl(p);
    }
    return getPhotoUrl(p);
  };

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: '12px',
      }}>
        {photos.map((p) => {
          const isFailed = failedPhotos[p.id];
          const imgSrc = getActiveSrc(p);

          return (
            <div
              key={p.id}
              onClick={() => setActivePhoto(p)}
              style={{
                position: 'relative',
                height: '110px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                backgroundColor: isFailed ? '#f1f5f9' : '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={p.original_name || 'Evidence photo'}
            >
              {isFailed ? (
                <div style={{
                  padding: '12px 8px',
                  textAlign: 'center',
                  color: 'var(--ink-mute)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <AlertCircle size={22} style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: '11px', fontWeight: 500, lineHeight: 1.2, wordBreak: 'break-all' }}>
                    {p.original_name || 'Photo'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Unavailable</span>
                </div>
              ) : (
                <>
                  <img
                    src={imgSrc}
                    alt={p.original_name || 'Evidence Photo'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.95 }}
                    onError={() => handleImageError(p, false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'var(--transition)',
                      color: '#fff',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                  >
                    <ZoomIn size={20} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div className="modal-overlay" onClick={() => setActivePhoto(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '800px', padding: '16px', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                {activePhoto.original_name || 'Accident Evidence Photo'}{' '}
                {activePhoto.file_size ? `(${(activePhoto.file_size / 1024).toFixed(1)} KB)` : ''}
              </span>
              <button className="modal-close" onClick={() => setActivePhoto(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div style={{ maxHeight: '70vh', overflow: 'hidden', borderRadius: 'var(--radius-md)', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px' }}>
              {failedPhotos[activePhoto.id] ? (
                <div style={{ padding: '40px 20px', color: '#cbd5e1', textAlign: 'center' }}>
                  <AlertCircle size={36} color="#f59e0b" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: 600, fontSize: '15px' }}>Evidence Image Unavailable</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                    The uploaded image file ({activePhoto.original_name || 'unnamed'}) could not be located in server storage.
                  </div>
                </div>
              ) : (
                <img
                  src={getActiveSrc(activePhoto)}
                  alt={activePhoto.original_name || 'Enlarged evidence'}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                  onError={() => handleImageError(activePhoto, true)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
