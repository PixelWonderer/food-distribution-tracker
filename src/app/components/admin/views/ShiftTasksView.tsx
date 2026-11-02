import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getSupabaseService } from '@/services/supabaseService';
import { toast } from '@/lib/toast';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Trash2, Plus, Pencil, X, Check } from 'lucide-react';

type ShiftTask = {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  timing: string;
  displayOrder: number;
  isActive: boolean;
};

const TIMING_OPTIONS = [
  { value: 'Friday AM', label: 'Fri. AM' },
  { value: 'Friday PM', label: 'Fri. PM' },
  { value: 'Saturday AM', label: 'Sat. AM' },
  { value: 'Saturday noon', label: 'Sat. Noon' },
  { value: 'Saturday PM', label: 'Sat. PM' },
  { value: 'Sunday', label: 'Sunday' },
];

const TIMING_COLORS: Record<string, string> = {
  'friday am': 'bg-blue-100 text-blue-700 border-blue-200',
  'friday pm': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'saturday am': 'bg-teal-100 text-teal-700 border-teal-200',
  'saturday noon': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'saturday pm': 'bg-amber-100 text-amber-700 border-amber-200',
  'sunday': 'bg-rose-100 text-rose-700 border-rose-200',
};

const COMMON_EMOJIS = ['📋', '🧤', '🪑', '🎂', '📦', '🚗', '🔑', '🧹', '📞', '✅'];

const getTimingColorClass = (timing: string): string => {
  return TIMING_COLORS[timing.toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200';
};

export const ShiftTasksView: React.FC = () => {
  const [tasks, setTasks] = useState<ShiftTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Form state for new/editing task
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    emoji: '📋',
    timing: 'Friday PM',
  });

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseService();
      const data = await Promise.race([
        supabase.getAllShiftTasks(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), 10_000)
        ),
      ]);
      setTasks(data);
    } catch (error) {
      console.error('Error fetching shift tasks:', error);
      toast.error('Failed to load shift tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      emoji: '📋',
      timing: 'Friday PM',
    });
  };

  const handleEdit = (task: ShiftTask) => {
    setEditingId(task.id);
    setIsAddingNew(false);
    setFormData({
      title: task.title,
      description: task.description || '',
      emoji: task.emoji,
      timing: task.timing,
    });
  };

  const handleCancel = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormData({
      title: '',
      description: '',
      emoji: '📋',
      timing: 'Friday PM',
    });
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    setSavingId(editingId || 'new');

    try {
      const supabase = getSupabaseService();

      if (editingId) {
        // Update existing task
        await supabase.updateShiftTask(editingId, {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          emoji: formData.emoji,
          timing: formData.timing,
        });
        toast.success('Task updated');
      } else {
        // Create new task
        const maxOrder = tasks
          .filter((t) => t.timing === formData.timing)
          .reduce((max, t) => Math.max(max, t.displayOrder), 0);

        await supabase.createShiftTask({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          emoji: formData.emoji,
          timing: formData.timing,
          displayOrder: maxOrder + 1,
        });
        toast.success('Task created');
      }

      handleCancel();
      await fetchTasks();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Failed to save task');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task? This cannot be undone.')) {
      return;
    }

    setSavingId(taskId);

    try {
      const supabase = getSupabaseService();
      await supabase.deleteShiftTask(taskId);
      toast.success('Task deleted');
      await fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (task: ShiftTask) => {
    setSavingId(task.id);

    try {
      const supabase = getSupabaseService();
      await supabase.updateShiftTask(task.id, { isActive: !task.isActive });
      toast.success(task.isActive ? 'Task disabled' : 'Task enabled');
      await fetchTasks();
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Failed to update task');
    } finally {
      setSavingId(null);
    }
  };

  // Group tasks by timing
  const tasksByTiming = React.useMemo(() => {
    const map = new Map<string, ShiftTask[]>();
    tasks.forEach((task) => {
      const key = task.timing;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(task);
    });

    // Sort each group by displayOrder
    map.forEach((taskList) => {
      taskList.sort((a, b) => a.displayOrder - b.displayOrder);
    });

    return map;
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-2xl">⏳</div>
          <p className="text-sm text-slate-500">Loading shift tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Shift Tasks</h2>
          <p className="text-sm text-slate-500">
            Recurring reminders that appear in the Pickup tab for each shift
          </p>
        </div>
        <Button
          onClick={handleAddNew}
          disabled={isAddingNew}
          className="gap-2 bg-emerald-500 hover:bg-emerald-600"
        >
          <Plus className="size-4" />
          Add Task
        </Button>
      </div>

      {/* Add New Form */}
      {isAddingNew && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Get the 3rd table from Hub"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Timing</label>
                <select
                  value={formData.timing}
                  onChange={(e) => setFormData({ ...formData, timing: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {TIMING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Description (optional)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Check if he needs cake boxes or forks"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Emoji</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormData({ ...formData, emoji })}
                    className={cn(
                      'rounded-lg border-2 p-2 text-xl transition-colors',
                      formData.emoji === emoji
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={savingId === 'new'}
                className="gap-2 bg-emerald-500 hover:bg-emerald-600"
              >
                <Check className="size-4" />
                Save Task
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks grouped by timing */}
      {TIMING_OPTIONS.map((timingOpt) => {
        const timingTasks = tasksByTiming.get(timingOpt.value) || [];
        if (timingTasks.length === 0 && !isAddingNew) return null;

        return (
          <div key={timingOpt.value} className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold',
                  getTimingColorClass(timingOpt.value)
                )}
              >
                {timingOpt.label}
              </span>
              <span className="text-sm text-slate-400">
                {timingTasks.length} {timingTasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>

            {timingTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                No tasks for this shift
              </div>
            ) : (
              <div className="space-y-2">
                {timingTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors',
                      !task.isActive && 'opacity-50',
                      editingId === task.id && 'ring-2 ring-emerald-500'
                    )}
                  >
                    <span className="mt-0.5 text-2xl">{task.emoji}</span>

                    {editingId === task.id ? (
                      // Edit mode
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Description (optional)"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={formData.timing}
                            onChange={(e) => setFormData({ ...formData, timing: e.target.value })}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            {TIMING_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-1">
                            {COMMON_EMOJIS.slice(0, 5).map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => setFormData({ ...formData, emoji })}
                                className={cn(
                                  'rounded border p-1.5 text-lg transition-colors',
                                  formData.emoji === emoji
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-slate-200 hover:border-slate-300'
                                )}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={handleCancel}>
                            <X className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={savingId === task.id}
                            className="gap-1 bg-emerald-500 hover:bg-emerald-600"
                          >
                            <Check className="size-4" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Display mode
                      <>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{task.title}</div>
                          {task.description && (
                            <div className="mt-0.5 text-sm text-slate-500 italic">
                              {task.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(task)}
                            disabled={savingId === task.id}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(task)}
                            disabled={savingId === task.id}
                            className={cn(
                              'h-8 w-8 p-0',
                              task.isActive
                                ? 'text-slate-400 hover:text-amber-600'
                                : 'text-emerald-500 hover:text-emerald-600'
                            )}
                            title={task.isActive ? 'Disable task' : 'Enable task'}
                          >
                            {task.isActive ? '🔇' : '🔊'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(task.id)}
                            disabled={savingId === task.id}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {tasks.length === 0 && !isAddingNew && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-3 text-4xl">📋</div>
            <CardTitle className="mb-1 text-lg">No Shift Tasks</CardTitle>
            <CardDescription className="mb-4 text-center">
              Add recurring tasks that volunteers need to complete each shift
            </CardDescription>
            <Button onClick={handleAddNew} className="gap-2 bg-emerald-500 hover:bg-emerald-600">
              <Plus className="size-4" />
              Add First Task
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShiftTasksView;
