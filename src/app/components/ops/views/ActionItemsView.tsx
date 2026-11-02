import React, { useEffect, useState } from 'react';
import { useOpsStore } from '@/services/opsState';
import { formatWeekDate, getMonday, type ActionItem } from '@/types/ops';
import { cn } from '@/lib/utils';

/**
 * Action items view - coordinator checklist for weekly tasks
 */
const ActionItemsView: React.FC = () => {
  const {
    actionItems,
    volunteers,
    selectedWeek,
    setSelectedWeek,
    fetchActionItems,
    createActionItem,
    updateActionItem,
    deleteActionItem,
    isLoading,
  } = useOpsStore();

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 0,
    due_date: '',
  });

  // Fetch action items when component mounts or week changes
  useEffect(() => {
    fetchActionItems(selectedWeek);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  // Week navigation
  const handlePrevWeek = () => {
    const current = new Date(selectedWeek);
    current.setDate(current.getDate() - 7);
    setSelectedWeek(getMonday(current).toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const current = new Date(selectedWeek);
    current.setDate(current.getDate() + 7);
    setSelectedWeek(getMonday(current).toISOString().split('T')[0]);
  };

  const handleThisWeek = () => {
    setSelectedWeek(getMonday(new Date()).toISOString().split('T')[0]);
  };

  // Open add item form
  const handleAddItem = () => {
    setFormData({
      title: '',
      description: '',
      assigned_to: '',
      priority: 0,
      due_date: '',
    });
    setEditingItem(null);
    setIsAddingItem(true);
    setMessage(null);
  };

  // Open edit item form
  const handleEditItem = (item: ActionItem) => {
    setFormData({
      title: item.title,
      description: item.description || '',
      assigned_to: item.assigned_to || '',
      priority: item.priority,
      due_date: item.due_date || '',
    });
    setEditingItem(item);
    setIsAddingItem(true);
    setMessage(null);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setMessage({ type: 'error', text: 'Please enter a title' });
      return;
    }

    try {
      if (editingItem) {
        await updateActionItem(editingItem.id, {
          title: formData.title,
          description: formData.description || undefined,
          assigned_to: formData.assigned_to || undefined,
          priority: formData.priority,
          due_date: formData.due_date || undefined,
        });
        setMessage({ type: 'success', text: 'Action item updated!' });
      } else {
        await createActionItem({
          title: formData.title,
          description: formData.description || undefined,
          week_date: selectedWeek,
          assigned_to: formData.assigned_to || undefined,
          priority: formData.priority,
          due_date: formData.due_date || undefined,
          is_completed: false,
        });
        setMessage({ type: 'success', text: 'Action item created!' });
      }

      setIsAddingItem(false);
      setEditingItem(null);
    } catch {
      setMessage({ type: 'error', text: 'Failed to save action item' });
    }
  };

  // Toggle completion
  const handleToggleComplete = async (item: ActionItem) => {
    try {
      await updateActionItem(item.id, { is_completed: !item.is_completed });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update item' });
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this action item?')) return;

    try {
      await deleteActionItem(itemId);
      setMessage({ type: 'success', text: 'Action item deleted!' });
      setIsAddingItem(false);
      setEditingItem(null);
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete item' });
    }
  };

  // Sort items: incomplete first, then by priority (high to low)
  const sortedItems = [...actionItems].sort((a, b) => {
    if (a.is_completed !== b.is_completed) {
      return a.is_completed ? 1 : -1;
    }
    return b.priority - a.priority;
  });

  const completedCount = actionItems.filter(i => i.is_completed).length;
  const totalCount = actionItems.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Action Items</h1>
          <p className="text-slate-500 mt-1">
            Coordinator checklist for weekly tasks
          </p>
        </div>

        <button
          onClick={handleAddItem}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          + Add Item
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <button
          onClick={handlePrevWeek}
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          ← Previous
        </button>

        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">
            Week of {formatWeekDate(selectedWeek)}
          </p>
          <button
            onClick={handleThisWeek}
            className="text-sm text-emerald-600 hover:text-emerald-700"
          >
            Go to current week
          </button>
        </div>

        <button
          onClick={handleNextWeek}
          className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Progress</span>
            <span className="text-sm text-slate-500">
              {completedCount} of {totalCount} completed
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={cn(
            'px-4 py-3 rounded-lg text-sm',
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          )}
        >
          {message.text}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading action items...</p>
        </div>
      )}

      {/* Action items list */}
      {!isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {sortedItems.length === 0 ? (
            <div className="p-8 text-center">
              <span className="text-4xl mb-4 block">✅</span>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No action items</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-4">
                Create action items to track tasks for this week.
              </p>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Create First Item
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedItems.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    'px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors',
                    item.is_completed && 'bg-slate-50'
                  )}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggleComplete(item)}
                    className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                      item.is_completed
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 hover:border-emerald-400'
                    )}
                  >
                    {item.is_completed && '✓'}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={cn(
                            'font-medium',
                            item.is_completed
                              ? 'text-slate-500 line-through'
                              : 'text-slate-900'
                          )}
                        >
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          {item.assignee && (
                            <span>Assigned to {item.assignee.display_name}</span>
                          )}
                          {item.due_date && (
                            <span>Due: {new Date(item.due_date).toLocaleDateString()}</span>
                          )}
                          {item.priority > 0 && (
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-xs font-medium',
                                item.priority >= 2
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                              )}
                            >
                              {item.priority >= 2 ? 'High' : 'Medium'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {isAddingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsAddingItem(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingItem ? 'Edit Action Item' : 'Add Action Item'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="What needs to be done?"
                  className="w-full p-2 border border-slate-200 rounded-lg"
                  required
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional details..."
                  rows={3}
                  className="w-full p-2 border border-slate-200 rounded-lg resize-none"
                />
              </div>

              {/* Assigned to */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assigned To
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                >
                  <option value="">Unassigned</option>
                  {volunteers.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                >
                  <option value={0}>Normal</option>
                  <option value={1}>Medium</option>
                  <option value={2}>High</option>
                </select>
              </div>

              {/* Due date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingItem(false)}
                  className="flex-1 px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                >
                  {editingItem ? 'Save Changes' : 'Create Item'}
                </button>
              </div>

              {/* Delete button for editing */}
              {editingItem && (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(editingItem.id)}
                  className="w-full px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Delete This Item
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionItemsView;
