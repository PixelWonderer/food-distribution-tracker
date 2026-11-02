import React, { useState, useEffect } from 'react';
import { useOpsStore } from '@/services/opsState';
import { type CoverageScenario } from '@/types/ops';
import { cn } from '@/lib/utils';

interface CoverageScenarioManagerProps {
  onClose: () => void;
}

/**
 * Manager for coverage scenarios - allows coordinators to create
 * emergency coverage plans (e.g., "Sam & Alex out of town")
 */
export const CoverageScenarioManager: React.FC<CoverageScenarioManagerProps> = ({
  onClose,
}) => {
  const {
    volunteers,
    coverageScenarios,
    activeCoverageScenario,
    fetchCoverageScenarios,
    createCoverageScenario,
    activateCoverageScenario,
    deleteCoverageScenario,
  } = useOpsStore();

  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for new scenario
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unavailableVolunteers, setUnavailableVolunteers] = useState<string[]>([]);
  const [backupDecisionMaker, setBackupDecisionMaker] = useState('');

  // Fetch scenarios on mount
  useEffect(() => {
    fetchCoverageScenarios();
  }, [fetchCoverageScenarios]);

  // Reset form
  const resetForm = () => {
    setName('');
    setDescription('');
    setUnavailableVolunteers([]);
    setBackupDecisionMaker('');
    setError(null);
  };

  // Toggle volunteer unavailability
  const toggleVolunteerUnavailable = (volunteerId: string) => {
    if (unavailableVolunteers.includes(volunteerId)) {
      setUnavailableVolunteers(unavailableVolunteers.filter(id => id !== volunteerId));
      // Clear backup if they were selected
      if (backupDecisionMaker === volunteerId) {
        setBackupDecisionMaker('');
      }
    } else {
      setUnavailableVolunteers([...unavailableVolunteers, volunteerId]);
    }
  };

  // Available volunteers (not marked as unavailable)
  const availableVolunteers = volunteers.filter(
    v => !unavailableVolunteers.includes(v.id)
  );

  // Submit handler
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Scenario name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await createCoverageScenario({
        name: name.trim(),
        description: description.trim() || undefined,
        unavailable_volunteers: unavailableVolunteers,
        backup_decision_maker: backupDecisionMaker || undefined,
        active: false,
      });
      resetForm();
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to create scenario:', err);
      setError('Failed to create scenario. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Activate/deactivate handler
  const handleToggleActive = async (scenario: CoverageScenario) => {
    try {
      if (scenario.active) {
        await activateCoverageScenario(null); // Deactivate
      } else {
        await activateCoverageScenario(scenario.id); // Activate
      }
    } catch (err) {
      console.error('Failed to toggle scenario:', err);
    }
  };

  // Delete handler
  const handleDelete = async (scenarioId: string) => {
    if (!confirm('Are you sure you want to delete this coverage scenario?')) return;
    try {
      await deleteCoverageScenario(scenarioId);
    } catch (err) {
      console.error('Failed to delete scenario:', err);
    }
  };

  // Get volunteer name by ID
  const getVolunteerName = (id: string) => {
    return volunteers.find(v => v.id === id)?.display_name || 'Unknown';
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 bg-orange-500 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold">Coverage Scenarios</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-orange-100 text-sm mt-1">
          Create backup plans for when coordinators are unavailable
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Active Scenario Banner */}
        {activeCoverageScenario && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-xl">🚨</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  Active: {activeCoverageScenario.name}
                </p>
                {activeCoverageScenario.description && (
                  <p className="text-sm text-amber-700 mt-1">
                    {activeCoverageScenario.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleToggleActive(activeCoverageScenario)}
                className="px-3 py-1 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Deactivate
              </button>
            </div>
          </div>
        )}

        {/* Existing Scenarios */}
        {coverageScenarios.length > 0 && !isCreating && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Saved Scenarios</h3>
            {coverageScenarios.map(scenario => (
              <div
                key={scenario.id}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  scenario.active
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 flex items-center gap-2">
                      {scenario.name}
                      {scenario.active && (
                        <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                          ACTIVE
                        </span>
                      )}
                    </p>
                    {scenario.description && (
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                        {scenario.description}
                      </p>
                    )}
                    {scenario.unavailable_volunteers.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Unavailable: {scenario.unavailable_volunteers.map(getVolunteerName).join(', ')}
                      </p>
                    )}
                    {scenario.backup_decision_maker && (
                      <p className="text-xs text-slate-400">
                        Backup lead: {getVolunteerName(scenario.backup_decision_maker)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!scenario.active && (
                      <button
                        onClick={() => handleToggleActive(scenario)}
                        className="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        title="Activate this scenario"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(scenario.id)}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete scenario"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create New Scenario Form */}
        {isCreating ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700">New Coverage Scenario</h3>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Scenario Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Sam & Alex out of town"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the coverage plan..."
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Unavailable Volunteers */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Who's Unavailable?
              </label>
              <div className="flex flex-wrap gap-2">
                {volunteers.map(vol => (
                  <button
                    key={vol.id}
                    type="button"
                    onClick={() => toggleVolunteerUnavailable(vol.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                      unavailableVolunteers.includes(vol.id)
                        ? 'bg-red-100 text-red-700 ring-2 ring-red-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    {vol.display_name}
                    {unavailableVolunteers.includes(vol.id) && ' ✕'}
                  </button>
                ))}
              </div>
            </div>

            {/* Backup Decision Maker */}
            {unavailableVolunteers.length > 0 && availableVolunteers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Backup Decision Maker
                </label>
                <select
                  value={backupDecisionMaker}
                  onChange={e => setBackupDecisionMaker(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select backup coordinator...</option>
                  {availableVolunteers.map(vol => (
                    <option key={vol.id} value={vol.id}>
                      {vol.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  resetForm();
                }}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name.trim()}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
                  isSubmitting || !name.trim()
                    ? 'bg-orange-400 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600'
                )}
              >
                {isSubmitting ? 'Creating...' : 'Create Scenario'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full py-3 border-2 border-dashed border-orange-300 text-orange-600 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors font-medium"
          >
            + Create New Scenario
          </button>
        )}

        {/* Empty State */}
        {coverageScenarios.length === 0 && !isCreating && (
          <div className="text-center py-6">
            <span className="text-3xl">🛡️</span>
            <p className="text-slate-600 mt-2">No coverage scenarios yet</p>
            <p className="text-sm text-slate-500">
              Create a backup plan for when coordinators are unavailable
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-slate-50">
        <button
          onClick={onClose}
          className="w-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default CoverageScenarioManager;
