'use client';

import { useEffect, useState } from 'react';

export default function WettBoiVSTPage() {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('hardwave_vst_token') || localStorage.getItem('token');
    if (t) {
      setToken(t);
      verifyAccess(t);
    }
  }, []);

  async function verifyAccess(t: string) {
    try {
      const res = await fetch('/api/subscription', {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsAuthorized(data.hasSubscription);
      }
    } catch {}
  }

  if (!isAuthorized) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0a0f',
        color: '#fff',
        fontFamily: 'monospace',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>WettBoi</div>
        <div style={{ color: '#888', fontSize: '0.875rem' }}>
          {token ? 'Verifying subscription...' : 'Please log in at hardwarestudios.com'}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0a0a0f',
      color: '#fff',
      fontFamily: 'monospace',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>WettBoi</div>
      <div style={{ color: '#888', fontSize: '0.875rem' }}>VST Editor — coming soon</div>
    </div>
  );
}
