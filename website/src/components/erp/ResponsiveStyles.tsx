'use client';

export function ResponsiveStyles() {
  return (
    <style>{`
      @media (max-width: 768px) {
        .erp-form-grid {
          grid-template-columns: 1fr !important;
        }
        .erp-two-col {
          grid-template-columns: 1fr !important;
        }
        .erp-modal-content {
          max-width: 100% !important;
          border-radius: 0 !important;
          max-height: 100vh !important;
        }
        .erp-filter-bar {
          flex-wrap: wrap !important;
        }
        .erp-modal-footer {
          flex-direction: column !important;
        }
        .erp-modal-footer > * {
          width: 100% !important;
        }
      }
    `}</style>
  );
}
