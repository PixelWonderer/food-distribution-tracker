import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * Overlay that blocks mobile users from accessing admin tools.
 * Admin is designed for desktop with keyboard/mouse optimization.
 */
export const MobileBlocker: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <span className="text-6xl block mb-4">💻</span>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Desktop Required</h1>
        <p className="text-slate-600 mb-6">
          The Admin tools are optimized for desktop browsers with mouse and keyboard.
          Please access this page from a laptop or desktop computer for the best experience.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <span>←</span> Back to Tracker
        </Link>
      </div>
    </div>
  );
};

export default MobileBlocker;
