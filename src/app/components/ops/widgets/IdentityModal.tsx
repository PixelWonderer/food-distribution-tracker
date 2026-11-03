import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useOpsStore } from '@/services/opsState';

/**
 * Modal shown on first visit to prompt user to select their identity
 * Helps ensure volunteers know whose schedule they're viewing
 */
export const IdentityModal: React.FC = () => {
  const navigate = useNavigate();
  const { currentVolunteer, volunteers, setCurrentVolunteer, isLoading } = useOpsStore();
  const [isOpen, setIsOpen] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Check if user needs to select identity after volunteers load
  useEffect(() => {
    // Wait for loading to finish before showing modal
    if (isLoading || hasChecked) return;

    // Wait for volunteers to actually load before making a decision
    if (volunteers.length === 0) return;

    // Volunteers loaded - check if we need to show the modal
    if (!currentVolunteer) {
      // No identity set, show modal after brief delay
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }

    // Identity already set, mark as checked
    setHasChecked(true);
  }, [volunteers, currentVolunteer, isLoading, hasChecked]);

  // Close when volunteer is selected
  useEffect(() => {
    if (currentVolunteer) {
      setIsOpen(false);
      setHasChecked(true);
    }
  }, [currentVolunteer]);

  const handleSelect = (slug: string) => {
    setCurrentVolunteer(slug);
    // Navigate to their schedule page
    navigate(`/ops/volunteer/${slug}`);
  };

  const handleDismiss = () => {
    setIsOpen(false);
    setHasChecked(true);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleDismiss}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 text-white">
          <h2 className="text-xl font-bold">Welcome to Ops Hub</h2>
          <p className="text-emerald-100 mt-1 text-sm">
            Let us know who you are to see your schedule
          </p>
        </div>

        {/* Volunteer list */}
        <div className="p-4">
          <p className="text-sm font-medium text-slate-500 mb-3 px-2">
            I am...
          </p>

          <div className="max-h-72 overflow-y-auto space-y-1">
            {volunteers.map(vol => (
              <button
                key={vol.id}
                onClick={() => handleSelect(vol.slug)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                  'hover:bg-emerald-50 hover:shadow-sm',
                  'active:scale-[0.98]'
                )}
              >
                <span className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg font-semibold text-emerald-700">
                  {vol.display_name.charAt(0)}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{vol.display_name}</p>
                </div>
                <span className="text-slate-300 group-hover:text-emerald-500">
                  →
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-center text-slate-400">
            Select your name to see personalized schedules, handoffs, and tasks
          </p>
        </div>
      </div>
    </div>
  );
};

export default IdentityModal;
