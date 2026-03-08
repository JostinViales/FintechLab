import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { StrategyTag } from '@/types';
import { Card } from '@/components/ui/Card';

interface StrategyTagManagerProps {
  tags: StrategyTag[];
  onSave: (tag: Omit<StrategyTag, 'id'>) => void;
  onDelete: (id: string) => void;
}

const PRESET_COLORS = ['#10b981', '#6366f1', '#3b82f6', '#f59e0b', '#ec4899', '#ef4444'];

export const StrategyTagManager: React.FC<StrategyTagManagerProps> = ({
  tags,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0] ?? '#6366f1');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, description: description.trim() || undefined });
    setName('');
    setDescription('');
    setColor(PRESET_COLORS[0] ?? '#6366f1');
  };

  return (
    <Card title="Strategy Tags">
      {/* Existing Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tags.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No strategy tags yet.</p>
        )}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
            }}
          >
            {tag.name}
            {tag.description && (
              <span className="text-xs opacity-70" title={tag.description}>
                ?
              </span>
            )}
            <button
              onClick={() => onDelete(tag.id)}
              className="ml-0.5 hover:opacity-70 transition-opacity"
              title="Delete strategy"
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>

      {/* Add Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            placeholder="Strategy name"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
            Color
          </label>
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 transition-all ${
                  color === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            placeholder="Optional description"
          />
        </div>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Plus size={16} />
          Add
        </button>
      </form>
    </Card>
  );
};
