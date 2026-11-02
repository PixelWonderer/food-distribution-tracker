import React, { useState } from 'react';
import { useOpsStore } from '@/services/opsState';
import {
  formatWeekDate,
  getShiftDate,
  type ShiftAssignment,
  type TimeSlot,
  type ShiftType,
  TIME_SLOT_NAMES,
  SHIFT_TYPE_NAMES,
  HANDOFF_TYPE_INFO,
} from '@/types/ops';
import { cn } from '@/lib/utils';

interface CoverageExportProps {
  onClose?: () => void;
}

// Expected coverage for gap detection
const EXPECTED_COVERAGE: Partial<Record<TimeSlot, ShiftType[]>> = {
  thursday_evening: ['produce_market', 'truck_loading'],
  friday_noon: ['grocery_distribution'],
  saturday_noon: ['saturday_distribution'],
  saturday_evening: ['saturday_evening_run'],
  sunday_afternoon: ['sunday_distribution'],
};

/**
 * Component to generate and export coverage documents
 * Creates standalone HTML that can be shared via Slack/Signal
 */
export const CoverageExport: React.FC<CoverageExportProps> = ({ onClose }) => {
  const {
    volunteers,
    shiftAssignments,
    shiftDetails,
    handoffs,
    activeCoverageScenario,
    selectedWeek,
  } = useOpsStore();

  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Calculate week dates
  const monday = new Date(selectedWeek);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Group shifts by volunteer
  const shiftsByVolunteer = volunteers.reduce((acc, vol) => {
    acc[vol.id] = shiftAssignments
      .filter(s => s.volunteer_id === vol.id)
      .sort((a, b) => {
        const dateA = getShiftDate(a.time_slot, selectedWeek);
        const dateB = getShiftDate(b.time_slot, selectedWeek);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      });
    return acc;
  }, {} as Record<string, ShiftAssignment[]>);

  // Calculate coverage gaps
  const coverageGaps: { timeSlot: TimeSlot; shiftType: ShiftType }[] = [];
  for (const [timeSlot, requiredTypes] of Object.entries(EXPECTED_COVERAGE)) {
    for (const shiftType of requiredTypes || []) {
      const hasVolunteer = shiftAssignments.some(
        s => s.time_slot === timeSlot && s.shift_type === shiftType
      );
      if (!hasVolunteer) {
        coverageGaps.push({ timeSlot: timeSlot as TimeSlot, shiftType });
      }
    }
  }

  // Generate HTML document
  const generateHTML = (): string => {
    const weekRange = `${formatDate(monday)} - ${formatDate(sunday)}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coverage - ${weekRange}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.5;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }

    /* Header */
    .header {
      background: linear-gradient(135deg, #059669, #10b981);
      color: white;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 24px; font-weight: bold; }
    .header p { opacity: 0.9; margin-top: 4px; }

    /* Alert Banner */
    .alert {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .alert h2 { color: #92400e; font-size: 18px; margin-bottom: 8px; }
    .alert p { color: #b45309; }

    /* Section */
    .section {
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .section-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      font-weight: 600;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-content { padding: 20px; }

    /* Volunteer Card */
    .volunteer-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .volunteer-card:last-child { margin-bottom: 0; }
    .volunteer-name {
      font-weight: 600;
      font-size: 18px;
      color: #059669;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .volunteer-name .badge {
      background: #d1fae5;
      color: #047857;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 12px;
    }

    /* Shift */
    .shift {
      background: white;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 8px;
      border-left: 4px solid #10b981;
    }
    .shift:last-child { margin-bottom: 0; }
    .shift-header { font-weight: 600; margin-bottom: 8px; }
    .shift-time { color: #64748b; font-size: 14px; }

    /* Timeline */
    .timeline { margin-top: 12px; padding-left: 20px; border-left: 2px solid #e2e8f0; }
    .timeline-item {
      margin-bottom: 8px;
      display: flex;
      gap: 12px;
    }
    .timeline-time {
      font-family: monospace;
      font-size: 13px;
      color: #64748b;
      min-width: 60px;
    }
    .timeline-task { color: #475569; font-size: 14px; }

    /* Handoff */
    .handoff {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
    }
    .handoff-title { font-weight: 600; color: #92400e; margin-bottom: 4px; }
    .handoff-detail { color: #b45309; font-size: 14px; }

    /* Chain */
    .chain {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 12px;
      background: #fef3c7;
      border-radius: 8px;
    }
    .chain-person {
      background: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
    }
    .chain-arrow { color: #f59e0b; font-weight: bold; }

    /* Gap Warning */
    .gap-warning {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      padding: 12px;
    }
    .gap-item {
      display: inline-block;
      background: #fee2e2;
      color: #991b1b;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 13px;
      margin: 4px;
    }

    /* Footer */
    .footer {
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
      padding: 20px;
    }

    @media print {
      body { background: white; padding: 10px; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>🥕 Coverage Plan</h1>
      <p>Week of ${weekRange}</p>
    </div>

    ${activeCoverageScenario ? `
    <!-- Emergency Alert -->
    <div class="alert">
      <h2>⚠️ ${activeCoverageScenario.name}</h2>
      ${activeCoverageScenario.description ? `<p>${activeCoverageScenario.description}</p>` : ''}
    </div>
    ` : ''}

    ${coverageGaps.length > 0 ? `
    <!-- Coverage Gaps -->
    <div class="section">
      <div class="section-header">⚠️ Coverage Needed</div>
      <div class="section-content">
        <div class="gap-warning">
          <p style="margin-bottom: 8px; color: #991b1b; font-weight: 500;">
            The following shifts need volunteers:
          </p>
          ${coverageGaps.map(gap => `
            <span class="gap-item">${SHIFT_TYPE_NAMES[gap.shiftType]} • ${TIME_SLOT_NAMES[gap.timeSlot]}</span>
          `).join('')}
        </div>
      </div>
    </div>
    ` : ''}

    ${handoffs.length > 0 ? `
    <!-- Key Handoffs -->
    <div class="section">
      <div class="section-header">🔑 Key Handoffs</div>
      <div class="section-content">
        ${[...new Set(handoffs.map(h => h.item_name))].map(itemName => {
          const itemHandoffs = handoffs.filter(h => h.item_name === itemName);
          const typeInfo = HANDOFF_TYPE_INFO[itemHandoffs[0].item_type];
          return `
            <div style="margin-bottom: 16px;">
              <p style="font-weight: 600; margin-bottom: 8px;">${typeInfo.icon} ${itemName}</p>
              <div class="chain">
                ${itemHandoffs.map((h, i) => `
                  ${i === 0 && h.from_volunteer ? `<span class="chain-person">${h.from_volunteer.display_name}</span><span class="chain-arrow">→</span>` : ''}
                  <span class="chain-person">${h.to_volunteer?.display_name || '?'}</span>
                  ${i < itemHandoffs.length - 1 ? '<span class="chain-arrow">→</span>' : ''}
                `).join('')}
              </div>
              ${itemHandoffs.some(h => h.notes) ? `
                <p style="margin-top: 8px; color: #b45309; font-size: 13px;">
                  💡 ${itemHandoffs.find(h => h.notes)?.notes}
                </p>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Volunteer Schedules -->
    <div class="section">
      <div class="section-header">📅 Volunteer Schedules</div>
      <div class="section-content">
        ${volunteers.filter(v => shiftsByVolunteer[v.id]?.length > 0).map(vol => {
          const volShifts = shiftsByVolunteer[vol.id];
          const volHandoffs = handoffs.filter(
            h => h.from_volunteer_id === vol.id || h.to_volunteer_id === vol.id
          );

          return `
            <div class="volunteer-card">
              <div class="volunteer-name">
                ${vol.display_name}
                <span class="badge">${volShifts.length} shift${volShifts.length !== 1 ? 's' : ''}</span>
              </div>

              ${volShifts.map(shift => {
                const details = shiftDetails.find(sd => sd.shift_type === shift.shift_type);
                const shiftDate = getShiftDate(shift.time_slot, selectedWeek);
                const formattedDate = shiftDate
                  ? shiftDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  : '';

                return `
                  <div class="shift">
                    <div class="shift-header">
                      ${details?.icon || '📋'} ${SHIFT_TYPE_NAMES[shift.shift_type] || shift.shift_type}
                      ${shift.is_confirmed ? '✓' : ''}
                    </div>
                    <div class="shift-time">${formattedDate} • ${shift.time_slot ? TIME_SLOT_NAMES[shift.time_slot as TimeSlot] : ''}</div>

                    ${details?.timeline && details.timeline.length > 0 ? `
                      <div class="timeline">
                        ${details.timeline.map(item => `
                          <div class="timeline-item">
                            <span class="timeline-time">${item.time || '•'}</span>
                            <span class="timeline-task">${item.task}</span>
                          </div>
                        `).join('')}
                      </div>
                    ` : ''}

                    ${details?.location ? `
                      <p style="margin-top: 8px; color: #64748b; font-size: 14px;">
                        📍 ${details.location}
                      </p>
                    ` : ''}
                  </div>
                `;
              }).join('')}

              ${volHandoffs.length > 0 ? `
                <div class="handoff">
                  <div class="handoff-title">🔑 Your Handoffs</div>
                  ${volHandoffs.map(h => {
                    const isReceiving = h.to_volunteer_id === vol.id;
                    const otherPerson = isReceiving ? h.from_volunteer : h.to_volunteer;
                    return `
                      <div class="handoff-detail">
                        ${isReceiving ? 'Receive' : 'Pass'}: ${h.item_name}
                        ${otherPerson ? ` ${isReceiving ? 'from' : 'to'} ${otherPerson.display_name}` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      Generated by Ops Hub • ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })}
    </div>
  </div>
</body>
</html>`;
  };

  const handleCopy = async () => {
    const html = generateHTML();
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    const html = generateHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Coverage_${selectedWeek}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTimeout(() => setDownloading(false), 500);
  };

  const handleOpenPreview = () => {
    const html = generateHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-md w-full">
      {/* Header */}
      <div className="bg-emerald-600 px-6 py-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Export Coverage</h2>
            <p className="text-emerald-100 text-sm mt-0.5">
              Week of {formatWeekDate(selectedWeek)}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <p className="text-slate-600 text-sm">
          Generate a shareable coverage document with volunteer schedules, handoffs, and timeline details.
        </p>

        {/* Summary */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Volunteers with shifts</span>
            <span className="font-medium">{volunteers.filter(v => shiftsByVolunteer[v.id]?.length > 0).length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total shifts</span>
            <span className="font-medium">{shiftAssignments.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Key handoffs</span>
            <span className="font-medium">{handoffs.length}</span>
          </div>
          {coverageGaps.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-red-500">Coverage gaps</span>
              <span className="font-medium text-red-600">{coverageGaps.length}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleOpenPreview}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            <span>👁️</span>
            Preview in New Tab
          </button>

          <button
            onClick={handleDownload}
            disabled={downloading}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg font-medium transition-colors',
              downloading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'
            )}
          >
            <span>📥</span>
            {downloading ? 'Downloading...' : 'Download HTML File'}
          </button>

          <button
            onClick={handleCopy}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 rounded-lg font-medium transition-colors',
              copied
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'hover:bg-slate-50 text-slate-700'
            )}
          >
            <span>{copied ? '✓' : '📋'}</span>
            {copied ? 'Copied to Clipboard!' : 'Copy HTML to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverageExport;
