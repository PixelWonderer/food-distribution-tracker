import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useOpsStore } from '@/services/opsState';

/**
 * Dropdown to select current volunteer identity
 * Saves selection to cookie for persistence
 */
export const VolunteerPicker: React.FC = () => {
  const navigate = useNavigate();
  const { currentVolunteer, volunteers, setCurrentVolunteer, clearCurrentVolunteer } = useOpsStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (slug: string) => {
    setCurrentVolunteer(slug);
    setIsOpen(false);
  };

  const handleViewMySchedule = () => {
    if (currentVolunteer) {
      navigate(`/ops/volunteer/${currentVolunteer.slug}`);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    clearCurrentVolunteer();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
          currentVolunteer
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        )}
      >
        {currentVolunteer ? (
          <>
            <span className="w-6 h-6 rounded-full bg-emerald-200 flex items-center justify-center text-xs font-bold text-emerald-800">
              {currentVolunteer.display_name.charAt(0)}
            </span>
            <span>{currentVolunteer.display_name}</span>
          </>
        ) : (
          <>
            <span className="text-slate-400">👤</span>
            <span>I am...</span>
          </>
        )}
        <svg
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Select Your Identity
            </p>
          </div>

          {/* Volunteer list */}
          <div className="max-h-64 overflow-y-auto">
            {volunteers.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                No volunteers found.
                <br />
                <span className="text-xs">Check database connection.</span>
              </div>
            ) : (
              volunteers.map(vol => (
                <button
                  key={vol.id}
                  onClick={() => handleSelect(vol.slug)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors',
                    currentVolunteer?.slug === vol.slug && 'bg-emerald-50'
                  )}
                >
                  <span
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                      currentVolunteer?.slug === vol.slug
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    )}
                  >
                    {vol.display_name.charAt(0)}
                  </span>
                  <div className="flex-1">
                    <p
                      className={cn(
                        'font-medium',
                        currentVolunteer?.slug === vol.slug ? 'text-emerald-700' : 'text-slate-900'
                      )}
                    >
                      {vol.display_name}
                    </p>
                  </div>
                  {currentVolunteer?.slug === vol.slug && (
                    <span className="text-emerald-600">✓</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Actions */}
          {currentVolunteer && (
            <div className="border-t border-slate-100 p-2 space-y-1">
              <button
                onClick={handleViewMySchedule}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <span>📅</span>
                View My Schedule
              </button>
              <button
                onClick={handleClear}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <span>✕</span>
                Clear Selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
