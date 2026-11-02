import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useOpsStore } from '@/services/opsState';

/**
 * Fixed bottom navigation bar for mobile devices
 * Provides thumb-friendly access to main sections
 */
export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { currentVolunteer } = useOpsStore();

  const isActive = (path: string) => {
    if (path === '/ops/volunteer') {
      return location.pathname.includes('/ops/volunteer/');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    {
      path: '/ops/dashboard',
      label: 'Home',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      path: '/ops/overview',
      label: 'Schedule',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      path: currentVolunteer ? `/ops/volunteer/${currentVolunteer.slug}` : '/ops/dashboard',
      label: 'My Shifts',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      highlight: !currentVolunteer, // Highlight if no identity set
    },
    {
      path: '/ops/guide',
      label: 'Guide',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 lg:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map(item => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 px-2 transition-colors relative',
                active
                  ? 'text-emerald-600'
                  : item.highlight
                    ? 'text-amber-600'
                    : 'text-slate-500'
              )}
            >
              {/* Notification dot for "My Shifts" when no identity */}
              {item.highlight && (
                <span className="absolute top-2 right-1/4 w-2 h-2 bg-amber-500 rounded-full" />
              )}
              <span className={cn(
                'transition-transform',
                active && 'scale-110'
              )}>
                {item.icon}
              </span>
              <span className={cn(
                'text-xs mt-0.5 font-medium',
                active && 'font-semibold'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
