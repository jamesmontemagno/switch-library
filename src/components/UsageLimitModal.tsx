import './AddGameModal.css';

interface UsageLimitModalProps {
  onClose: () => void;
  usage: {
    count: number;
    limit: number;
    month: string; // Format: "YYYY-MM"
  };
}

export function UsageLimitModal({ onClose, usage }: UsageLimitModalProps) {
  const monthName = new Date(usage.month + '-01').toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="usage-modal-title">
      <div className="modal add-game-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="usage-modal-title">Monthly Search Limit Reached</h2>
          <button onClick={onClose} className="modal-close" aria-label="Close">
            ✕
          </button>
        </header>
        
        <div className="modal-form" style={{ padding: '1.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
            <p style={{ fontSize: '1.1rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              You've used {usage.count} out of {usage.limit} searches for {monthName}
            </p>
          </div>

          <div style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#333' }}>
              What you can still do:
            </h3>
            <ul style={{ marginLeft: '1.25rem', lineHeight: '1.8' }}>
              <li>Browse your game library</li>
              <li>View previously searched games (cached results)</li>
              <li>Add games manually to your library</li>
              <li>Edit and manage existing games</li>
            </ul>
          </div>

          <div style={{ backgroundColor: '#e8f4ff', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: '#0066cc' }}>
              💡 Pro tip: Use your cache!
            </h3>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#333' }}>
              Search results are cached for 7 days, and game details for 30 days. 
              Viewing cached results doesn't count toward your limit.
            </p>
          </div>

          <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Your search limit will reset on the 1st of next month.
          </p>

          <div className="modal-actions">
            <button onClick={onClose} className="btn-submit" style={{ width: '100%' }}>
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
