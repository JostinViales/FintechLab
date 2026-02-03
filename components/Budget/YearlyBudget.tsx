import React, { useState, useMemo } from 'react';
import { Category, Transaction, TransactionType } from '../../types';
import { Card } from '../ui/Card';
import { Plus, Pencil, Check, X, AlertCircle, Trash2 } from 'lucide-react';

interface YearlyBudgetProps {
  categories: Category[];
  transactions: Transaction[];
  onUpdateCategory: (category: Category) => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (id: string) => void;
}

export const YearlyBudget: React.FC<YearlyBudgetProps> = ({ 
  categories, 
  transactions, 
  onUpdateCategory, 
  onAddCategory,
  onDeleteCategory
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const currentYear = new Date().getFullYear();

  const stats = useMemo(() => {
    return categories.map(cat => {
      // Calculate spent for this category in the current year
      const spent = transactions
        .filter(t => 
          t.category === cat.name && 
          t.type === TransactionType.EXPENSE && 
          new Date(t.date).getFullYear() === currentYear
        )
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        ...cat,
        spent,
        remaining: cat.yearlyBudget - spent,
        percent: cat.yearlyBudget > 0 ? (spent / cat.yearlyBudget) * 100 : 0
      };
    });
  }, [categories, transactions, currentYear]);

  const totalBudget = stats.reduce((acc, c) => acc + c.yearlyBudget, 0);
  const totalSpent = stats.reduce((acc, c) => acc + c.spent, 0);

  const startEditing = (cat: Category) => {
    setEditingId(cat.id);
    setEditValue(cat.yearlyBudget.toString());
  };

  const saveEdit = (cat: Category) => {
    onUpdateCategory({ ...cat, yearlyBudget: parseFloat(editValue) || 0 });
    setEditingId(null);
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName);
      setNewCategoryName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-t-4 border-indigo-500">
          <p className="text-sm font-medium text-slate-500">Total Yearly Budget</p>
          <h3 className="text-2xl font-bold text-slate-900">${totalBudget.toLocaleString()}</h3>
        </Card>
        <Card className="border-t-4 border-red-500">
          <p className="text-sm font-medium text-slate-500">YTD Spent</p>
          <h3 className="text-2xl font-bold text-slate-900">${totalSpent.toLocaleString()}</h3>
        </Card>
        <Card className="border-t-4 border-emerald-500">
          <p className="text-sm font-medium text-slate-500">Remaining</p>
          <h3 className="text-2xl font-bold text-slate-900">${(totalBudget - totalSpent).toLocaleString()}</h3>
        </Card>
      </div>

      <Card title={`Budget Allocation ${currentYear}`}>
        <div className="space-y-6">
          <div className="flex justify-end">
            {isAdding ? (
              <div className="flex gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category Name"
                  className="px-3 py-1 text-sm border border-slate-300 rounded focus:border-indigo-500 outline-none"
                  autoFocus
                />
                <button onClick={handleAddCategory} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                  <Check size={18} />
                </button>
                <button onClick={() => setIsAdding(false)} className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAdding(true)} 
                className="text-sm text-indigo-600 font-medium flex items-center gap-1 hover:underline"
              >
                <Plus size={16} /> Add Category
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6">
            {stats.map(cat => (
              <div key={cat.id} className="relative p-4 rounded-lg bg-slate-50 border border-slate-100 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-slate-800">{cat.name}</span>
                    {cat.percent > 100 && <AlertCircle size={16} className="text-red-500" />}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    {/* Delete Button */}
                    <button 
                      onClick={() => onDeleteCategory(cat.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Delete Category"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-end mb-2">
                  <div className="text-sm text-slate-600">
                     Spent: <span className="font-semibold text-slate-900">${cat.spent.toLocaleString()}</span>
                  </div>
                  <div className="text-sm flex flex-col items-end">
                    <span className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Budget Limit</span>
                    {editingId === cat.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-28 px-2 py-1 border border-indigo-300 rounded text-right outline-none bg-white font-semibold"
                            autoFocus
                          />
                          <button onClick={() => saveEdit(cat)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><Check size={16} /></button>
                          <button onClick={() => setEditingId(null)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={16} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => startEditing(cat)}>
                          <span className="font-bold text-lg text-slate-900 border-b border-transparent group-hover:border-slate-300 transition-colors">
                            ${cat.yearlyBudget.toLocaleString()}
                          </span>
                          <Pencil size={14} className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      cat.percent > 100 ? 'bg-red-500' : 
                      cat.percent > 80 ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(cat.percent, 100)}%` }}
                  />
                </div>
                
                <div className="flex justify-between mt-2 text-xs font-medium">
                  <span className={`${cat.percent > 100 ? 'text-red-600' : 'text-slate-500'}`}>
                    {cat.percent.toFixed(1)}% Used
                  </span>
                  <span className="text-slate-500">
                    Remaining: ${cat.remaining.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
            
            {stats.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                    No categories defined. Add one to start budgeting.
                </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};