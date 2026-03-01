import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Database, Clock, Trash2, ChevronRight, Download, ChevronDown, FileText, Plus, FolderOpen, Folder, Edit3, X, Check, GripVertical, ChevronUp, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface QuestionItemProps {
  question: any;
  index: number;
  key?: React.Key;
}

interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
}

interface Assignment {
  batch_id: number;
  category_id: number;
  sort_order: number;
}

async function parseJsonResponse(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();

  if (!contentType.includes('application/json')) {
    throw new Error(
      `Expected JSON but got ${contentType || 'unknown'} (status ${res.status}). Response starts with: ${rawText.slice(0, 80)}`
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`Invalid JSON response (status ${res.status}).`);
  }
}

export default function HistoryPage({ onBack, onReuseBatch }: { onBack: () => void; onReuseBatch?: (batch: any) => void }) {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  // Category state
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingSubcategoryFor, setAddingSubcategoryFor] = useState<number | null>(null);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [dragOverCategoryId, setDragOverCategoryId] = useState<number | null>(null);
  const [dragOverMoveCategoryId, setDragOverMoveCategoryId] = useState<number | null>(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  // Batch rename state
  const [editingBatchId, setEditingBatchId] = useState<number | string | null>(null);
  const [editingBatchTitle, setEditingBatchTitle] = useState('');

  // Track dragging origin for better UX and unassigning
  const [draggingBatchId, setDraggingBatchId] = useState<number | string | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState<number | null>(null);
  const [dragSourceCategoryId, setDragSourceCategoryId] = useState<number | null>(null);
  const [isDragOverLeftColumn, setIsDragOverLeftColumn] = useState(false);
  const [isDragOverRightColumnRoot, setIsDragOverRightColumnRoot] = useState(false);

  const fetchHistory = () => {
    setIsLoading(true);
    setHistoryError(null);
    fetch('/api/questions/history', { credentials: 'omit' })
      .then(parseJsonResponse)
      .then(data => {
        setBatches(data.batches || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setHistoryError(err?.message || 'Failed to load history');
        setIsLoading(false);
      });
  };

  const fetchCategories = useCallback(() => {
    fetch('/api/categories', { credentials: 'omit' })
      .then(parseJsonResponse)
      .then(data => {
        setCategories(data.categories || []);
        setAssignments(data.assignments || []);
      })
      .catch(err => console.error('Failed to load categories', err));
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchCategories();
  }, [fetchCategories]);

  const confirmDelete = async () => {
    if (deletingId === null || deletingId === undefined) {
      alert("Error: No batch ID selected for deletion.");
      return;
    }

    try {
      const res = await fetch(`/api/questions/batch/${deletingId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
        fetchCategories();
        setDeletingId(null);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown server error' }));
        alert(`Failed to delete: ${errorData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Failed to delete batch', err);
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportMd = (batch: any) => {
    const mdContent = `# Interview Question Set - ${batch.title || batch.module_id}\n` +
      `Generated at: ${new Date(batch.created_at).toLocaleString()}\n\n` +
      batch.questions.map((q: any, i: number) =>
        `### ${i + 1}. [${q.difficulty}] ${q.content}\n\n**Answer:**\n${q.answer || 'No answer provided.'}\n`
      ).join('\n---\n');

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-set-${batch.title || batch.module_id}-${new Date(batch.created_at).getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Category management
  const createCategory = async (name: string, parentId?: number) => {
    if (!name.trim()) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parentId: parentId || null }),
      });
      if (res.ok) {
        const data = await res.json();
        fetchCategories();
        if (parentId) {
          setExpandedCategories(prev => new Set([...prev, parentId]));
        }
        return data.id;
      }
    } catch (err) {
      console.error('Failed to create category', err);
    }
  };

  const renameCategory = async (id: number, name: string) => {
    if (!name.trim()) return;
    try {
      await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      fetchCategories();
    } catch (err) {
      console.error('Failed to rename category', err);
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category', err);
    }
  };

  const assignBatchToCategory = async (batchId: number | string, categoryId: number) => {
    if (typeof batchId === 'string' && batchId.startsWith('legacy-')) return;
    try {
      await fetch(`/api/categories/${categoryId}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      fetchCategories();
    } catch (err) {
      console.error('Failed to assign batch', err);
    }
  };

  const removeBatchFromCategory = async (batchId: number | string, categoryId: number) => {
    try {
      await fetch(`/api/categories/${categoryId}/batches/${batchId}`, { method: 'DELETE' });
      fetchCategories();
    } catch (err) {
      console.error('Failed to remove batch from category', err);
    }
  };

  const moveCategory = async (categoryId: number, parentId: number | null) => {
    try {
      const res = await fetch(`/api/categories/${categoryId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to move category');
      }
      fetchCategories();
    } catch (err: any) {
      console.error('Failed to move category', err);
      alert(err?.message || 'Failed to move category');
    }
  };

  const toggleCategory = (id: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getDragPayload = (e: React.DragEvent): any | null => {
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const isDescendantCategory = (categoryId: number, potentialAncestorId: number): boolean => {
    let current = categories.find(c => c.id === categoryId) || null;
    while (current?.parent_id !== null) {
      if (current.parent_id === potentialAncestorId) return true;
      current = categories.find(c => c.id === current?.parent_id) || null;
    }
    return false;
  };

  // Batch renaming
  const renameBatch = async (id: number | string, newTitle: string) => {
    if (!newTitle.trim() || String(id).startsWith('legacy-')) return;
    try {
      const res = await fetch(`/api/questions/batch/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        fetchHistory();
      } else {
        alert('Failed to rename batch');
      }
    } catch (err) {
      console.error('Failed to rename batch', err);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, batch: any, sourceCategoryId: number | null = null) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ batchId: batch.id, type: 'batch', sourceCategoryId }));
    e.dataTransfer.effectAllowed = 'copyMove';
    setDraggingBatchId(batch.id);
    setDraggingCategoryId(null);
    setDragSourceCategoryId(sourceCategoryId);

    // Slight delay to allow the native drag image to capture the full element before changing styling
    setTimeout(() => {
      const el = e.target as HTMLElement;
      if (el) el.style.opacity = '0.4';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggingBatchId(null);
    setDraggingCategoryId(null);
    setDragSourceCategoryId(null);
    setIsDragOverLeftColumn(false);
    setIsDragOverRightColumnRoot(false);
    setDragOverCategoryId(null);
    setDragOverMoveCategoryId(null);
    const el = e.target as HTMLElement;
    if (el) el.style.opacity = '1';
  };

  const handleCategoryDragStart = (e: React.DragEvent, category: Category) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ type: 'category', categoryId: category.id, sourceParentId: category.parent_id ?? null })
    );
    e.dataTransfer.effectAllowed = 'move';
    setDraggingCategoryId(category.id);
    setDraggingBatchId(null);
    setDragSourceCategoryId(null);
  };

  const handleDragOver = (e: React.DragEvent, categoryId: number | 'left' | 'right-root') => {
    e.preventDefault();
    const payload = getDragPayload(e);

    if (categoryId === 'left') {
      if (payload?.type !== 'batch') {
        setIsDragOverLeftColumn(false);
        return;
      }
      e.dataTransfer.dropEffect = 'move';
      setIsDragOverLeftColumn(true);
      setDragOverCategoryId(null);
      setDragOverMoveCategoryId(null);
      setIsDragOverRightColumnRoot(false);
      return;
    }

    if (categoryId === 'right-root') {
      if (payload?.type !== 'category') {
        setIsDragOverRightColumnRoot(false);
        return;
      }
      e.dataTransfer.dropEffect = 'move';
      setIsDragOverRightColumnRoot(true);
      setDragOverCategoryId(null);
      setDragOverMoveCategoryId(null);
      setIsDragOverLeftColumn(false);
      return;
    }

    if (payload?.type === 'category') {
      const draggedCategoryId = Number(payload.categoryId);
      if (
        Number.isInteger(draggedCategoryId) &&
        draggedCategoryId !== categoryId &&
        !isDescendantCategory(categoryId, draggedCategoryId)
      ) {
        e.dataTransfer.dropEffect = 'move';
        setDragOverMoveCategoryId(categoryId);
      } else {
        e.dataTransfer.dropEffect = 'none';
        setDragOverMoveCategoryId(null);
      }
      setDragOverCategoryId(null);
      setIsDragOverLeftColumn(false);
      setIsDragOverRightColumnRoot(false);
    } else {
      e.dataTransfer.dropEffect = 'copy';
      setDragOverCategoryId(categoryId);
      setDragOverMoveCategoryId(null);
      setIsDragOverLeftColumn(false);
      setIsDragOverRightColumnRoot(false);
    }
  };

  const handleDragLeave = (e: React.DragEvent, target: 'left' | 'cat' | 'right-root') => {
    if (target === 'left') {
      setIsDragOverLeftColumn(false);
    } else if (target === 'right-root') {
      setIsDragOverRightColumnRoot(false);
    } else {
      setDragOverCategoryId(null);
      setDragOverMoveCategoryId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: number | 'left' | 'right-root') => {
    e.preventDefault();
    setDragOverCategoryId(null);
    setDragOverMoveCategoryId(null);
    setIsDragOverLeftColumn(false);
    setIsDragOverRightColumnRoot(false);
    try {
      const data = getDragPayload(e);
      if (!data) return;

      if (data.type === 'batch' && data.batchId) {
        if (targetId === 'left') {
          // Unassign from its category
          if (data.sourceCategoryId) {
            await removeBatchFromCategory(data.batchId, data.sourceCategoryId);
          }
        } else if (typeof targetId === 'number') {
          // Assign to new category
          if (data.sourceCategoryId && data.sourceCategoryId !== targetId) {
            // Optional: if moving within categories, we don't have a 1-to-1 strict tree (it's many-to-many in DB),
            // but UX-wise we might remove from old and add to new to feel like a strict folder move.
            await removeBatchFromCategory(data.batchId, data.sourceCategoryId);
          }
          await assignBatchToCategory(data.batchId, targetId);
        }
      } else if (data.type === 'category' && data.categoryId) {
        const draggedCategoryId = Number(data.categoryId);
        if (!Number.isInteger(draggedCategoryId)) return;

        if (targetId === 'right-root') {
          await moveCategory(draggedCategoryId, null);
        } else if (typeof targetId === 'number') {
          if (draggedCategoryId === targetId) return;
          if (isDescendantCategory(targetId, draggedCategoryId)) return;
          await moveCategory(draggedCategoryId, targetId);
          setExpandedCategories(prev => new Set([...prev, targetId]));
        }
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // Helper: get child categories
  const getChildCategories = (parentId: number | null) =>
    categories.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);

  // Helper: get batches assigned to a category
  const getBatchesForCategory = (categoryId: number) => {
    const batchIds = assignments.filter(a => a.category_id === categoryId).map(a => a.batch_id);
    return batches.filter(b => batchIds.includes(b.id));
  };

  if (selectedBatch) {
    return (
      <BatchDetail
        batch={selectedBatch}
        onBack={() => setSelectedBatch(null)}
        onExport={() => handleExportMd(selectedBatch)}
        onReuseBatch={onReuseBatch}
      />
    );
  }

  // Render a category node (recursive for tree structure)
  const renderCategory = (cat: Category, depth: number = 0) => {
    const isExpanded = expandedCategories.has(cat.id);
    const children = getChildCategories(cat.id);
    const categoryBatches = getBatchesForCategory(cat.id);
    const isEditing = editingCategoryId === cat.id;
    const isBatchDragOver = dragOverCategoryId === cat.id;
    const isCategoryMoveTarget = dragOverMoveCategoryId === cat.id;
    const isCategoryBeingDragged = draggingCategoryId === cat.id;
    const isAddingSub = addingSubcategoryFor === cat.id;

    return (
      <div key={cat.id} className="select-none">
        <div
          draggable={!isEditing}
          onDragStart={(e) => !isEditing && handleCategoryDragStart(e, cat)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all group/cat ${isCategoryBeingDragged ? 'opacity-40' : ''
            } ${isCategoryMoveTarget
              ? 'bg-blue-50 border-2 border-dashed border-blue-400 shadow-inner'
              : isBatchDragOver
                ? 'bg-orange-100 border-2 border-dashed border-orange-400 shadow-inner'
                : 'hover:bg-zinc-100 border-2 border-transparent'
            } ${isEditing ? 'cursor-text' : 'cursor-grab active:cursor-grabbing'
            }`}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onDragOver={(e) => {
            e.stopPropagation();
            handleDragOver(e, cat.id);
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            handleDragLeave(e, 'cat');
          }}
          onDrop={(e) => {
            e.stopPropagation();
            handleDrop(e, cat.id);
          }}
          onClick={() => !isEditing && toggleCategory(cat.id)}
        >
          {!isEditing && <GripVertical className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />}
          <button
            className="p-0.5 text-zinc-400 hover:text-zinc-600 transition-colors"
            onClick={(e) => { e.stopPropagation(); toggleCategory(cat.id); }}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-orange-500 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-orange-400 flex-shrink-0" />
          )}

          {isEditing ? (
            <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editingCategoryName}
                onChange={(e) => setEditingCategoryName(e.target.value)}
                className="flex-1 text-sm px-2 py-1 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-200 bg-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renameCategory(cat.id, editingCategoryName);
                    setEditingCategoryId(null);
                  } else if (e.key === 'Escape') {
                    setEditingCategoryId(null);
                  }
                }}
              />
              <button
                onClick={() => { renameCategory(cat.id, editingCategoryName); setEditingCategoryId(null); }}
                className="p-1 text-green-600 hover:bg-green-50 rounded-lg"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingCategoryId(null)}
                className="p-1 text-zinc-400 hover:bg-zinc-100 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <span className="flex-1 text-sm font-medium text-zinc-700 truncate">{cat.name}</span>
              <span className="text-[10px] text-zinc-400 mr-1">
                {categoryBatches.length > 0 && `${categoryBatches.length}`}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddingSubcategoryFor(isAddingSub ? null : cat.id);
                    setSubcategoryName('');
                  }}
                  className="p-1 text-zinc-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                  title="添加子分类"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCategoryId(cat.id);
                    setEditingCategoryName(cat.name);
                  }}
                  className="p-1 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="重命名"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`确认删除分类 "${cat.name}" 吗？`)) deleteCategory(cat.id);
                  }}
                  className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除分类"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Subcategory creation input */}
        <AnimatePresence>
          {isAddingSub && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 py-2" style={{ paddingLeft: `${32 + depth * 20}px` }}>
                <input
                  type="text"
                  value={subcategoryName}
                  onChange={(e) => setSubcategoryName(e.target.value)}
                  placeholder="子分类名称..."
                  className="flex-1 text-sm px-3 py-1.5 border border-zinc-200 rounded-lg outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 bg-white"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && subcategoryName.trim()) {
                      await createCategory(subcategoryName, cat.id);
                      setSubcategoryName('');
                      setAddingSubcategoryFor(null);
                    } else if (e.key === 'Escape') {
                      setAddingSubcategoryFor(null);
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (subcategoryName.trim()) {
                      await createCategory(subcategoryName, cat.id);
                      setSubcategoryName('');
                      setAddingSubcategoryFor(null);
                    }
                  }}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setAddingSubcategoryFor(null)}
                  className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded content: assigned batches + children */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Batches in this category */}
              {categoryBatches.map(batch => {
                const isBatchEditing = editingBatchId === batch.id;
                return (
                  <div
                    key={`cat-batch-${cat.id}-${batch.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, batch, cat.id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors group/item cursor-grab active:cursor-grabbing select-none ${draggingBatchId === batch.id ? 'opacity-40' : 'hover:bg-orange-50/50'
                      }`}
                    style={{ paddingLeft: `${32 + depth * 20}px` }}
                    onClick={(e) => {
                      if (!isBatchEditing) {
                        setSelectedBatch(batch);
                      }
                    }}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-zinc-300 opacity-0 group-hover/item:opacity-100 flex-shrink-0 transition-opacity" />
                    <Database className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />

                    {isBatchEditing ? (
                      <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingBatchTitle}
                          onChange={(e) => setEditingBatchTitle(e.target.value)}
                          className="flex-1 text-xs px-2 py-1 border border-orange-300 rounded outline-none focus:ring-1 focus:ring-orange-200"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              renameBatch(batch.id, editingBatchTitle);
                              setEditingBatchId(null);
                            } else if (e.key === 'Escape') setEditingBatchId(null);
                          }}
                        />
                        <button onClick={() => { renameBatch(batch.id, editingBatchTitle); setEditingBatchId(null); }} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
                          <Check className="w-3 h-3" />
                        </button>
                        <button onClick={() => setEditingBatchId(null)} className="p-0.5 text-zinc-400 hover:bg-zinc-100 rounded">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-600 truncate flex-1 group-hover/item:text-orange-600 transition-colors">
                        {batch.title}
                      </span>
                    )}

                    {!isBatchEditing && (
                      <span className="text-[10px] text-zinc-400 flex-shrink-0">
                        {batch.questions?.length || 0}题
                      </span>
                    )}

                    {!isBatchEditing && !String(batch.id).startsWith('legacy-') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBatchId(batch.id);
                          setEditingBatchTitle(batch.title);
                        }}
                        className="p-1 min-w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-blue-500 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all ml-1 bg-white hover:bg-blue-50/50 shadow-sm border border-transparent hover:border-blue-100"
                        title="重命名题单"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                    {!isBatchEditing && onReuseBatch && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReuseBatch(batch);
                        }}
                        className="p-1 min-w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-orange-500 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all ml-1 bg-white hover:bg-orange-50/50 shadow-sm border border-transparent hover:border-orange-100"
                        title="重新面试此题单"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                    {!isBatchEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBatchFromCategory(batch.id, cat.id);
                        }}
                        className="p-1 min-w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-red-500 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all ml-1 bg-white hover:bg-red-50/50 shadow-sm border border-transparent hover:border-red-100"
                        title="从分类移除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Child categories */}
              {children.map(child => renderCategory(child, depth + 1))}

              {/* Empty state */}
              {categoryBatches.length === 0 && children.length === 0 && (
                <div
                  className={`text-xs text-zinc-400 py-3 text-center italic ${isBatchDragOver ? 'text-orange-500' : ''
                    }`}
                  style={{ paddingLeft: `${32 + depth * 20}px` }}
                >
                  拖拽题单到此分类
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const topLevelCategories = getChildCategories(null);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-zinc-900 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Setup</span>
        </button>

        <div className="mb-10">
          <h1 className="text-4xl font-light tracking-tight mb-2 flex items-center gap-3">
            <Database className="w-8 h-8 text-orange-600" />
            Interview <span className="font-serif italic text-orange-600">Sets</span>
          </h1>
          <p className="text-zinc-500 text-sm">
            Review and manage your previously generated question batches.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-zinc-400">Loading history...</div>
        ) : historyError ? (
          <div className="text-center py-12 text-red-500 border border-dashed border-red-200 rounded-3xl bg-white">
            {historyError}
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 border border-dashed border-zinc-200 rounded-3xl bg-white">
            No question sets generated yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: All Question Sets */}
            <div
              className={`rounded-3xl border-2 transition-all p-2 -mx-2 -mt-2 ${isDragOverLeftColumn ? 'border-dashed border-orange-400 bg-orange-50/50' : 'border-transparent'
                }`}
              onDragOver={(e) => handleDragOver(e, 'left')}
              onDragLeave={(e) => handleDragLeave(e, 'left')}
              onDrop={(e) => handleDrop(e, 'left')}
            >
              <div className="flex items-center gap-2 mb-4 px-3 mt-2">
                <Database className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">未分配题单</h2>
                <span className="text-xs text-zinc-400 ml-auto">
                  {batches.filter(b => !assignments.some(a => a.batch_id === b.id)).length} 个题单 · 拖拽到右侧分类
                </span>
              </div>
              <div className="grid gap-3 px-2">
                {batches
                  .filter(b => !assignments.some(a => a.batch_id === b.id))
                  .map((batch, i) => {
                    const isBatchEditing = editingBatchId === batch.id;
                    return (
                      <motion.div
                        key={batch.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        draggable
                        onDragStart={(e: any) => handleDragStart(e, batch, null)}
                        onDragEnd={handleDragEnd as any}
                        className={`group bg-white rounded-2xl shadow-sm border border-zinc-100 hover:border-orange-200 hover:shadow-md transition-all flex items-stretch overflow-hidden cursor-grab active:cursor-grabbing ${draggingBatchId === batch.id ? 'opacity-40 scale-[0.98]' : ''
                          }`}
                      >
                        <div className="flex items-center px-2 text-zinc-300 group-hover:text-zinc-400 transition-colors">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <div
                          onClick={() => {
                            if (!isBatchEditing) setSelectedBatch(batch);
                          }}
                          className="flex-1 p-5 cursor-pointer flex items-center justify-between"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 flex-shrink-0">
                              <Database className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600">
                                  {batch.module_id}
                                </span>
                                <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(batch.created_at).toLocaleDateString()}
                                </span>
                              </div>

                              {isBatchEditing ? (
                                <div className="flex items-center gap-2 mb-1" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={editingBatchTitle}
                                    onChange={(e) => setEditingBatchTitle(e.target.value)}
                                    className="flex-1 text-base font-medium px-2 py-1 border border-orange-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-200"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        renameBatch(batch.id, editingBatchTitle);
                                        setEditingBatchId(null);
                                      } else if (e.key === 'Escape') setEditingBatchId(null);
                                    }}
                                  />
                                  <button onClick={() => { renameBatch(batch.id, editingBatchTitle); setEditingBatchId(null); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg shrink-0">
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setEditingBatchId(null)} className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded-lg shrink-0">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <h2 className="text-base font-medium text-zinc-800 group-hover:text-orange-600 transition-colors truncate">
                                  {batch.title}
                                </h2>
                              )}

                              {!isBatchEditing && (
                                <p className="text-zinc-400 text-xs mt-1">
                                  {batch.questions.length} questions · {(batch.practice_count || 0)} practices
                                </p>
                              )}
                            </div>
                          </div>

                          {!isBatchEditing && (
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-2 gap-1.5 shrink-0">
                              {onReuseBatch && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onReuseBatch(batch);
                                  }}
                                  className="p-1.5 min-w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-orange-500 rounded-full hover:bg-orange-50 transition-colors bg-zinc-50/50 shadow-sm"
                                  title="重新面试此题单"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              {!String(batch.id).startsWith('legacy-') && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBatchId(batch.id);
                                    setEditingBatchTitle(batch.title);
                                  }}
                                  className="p-1.5 min-w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-blue-500 rounded-full hover:bg-blue-50 transition-colors bg-zinc-50/50 shadow-sm"
                                  title="重命名题单"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                              <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-orange-400 transition-colors ml-1" />
                            </div>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const id = batch.id;
                            if (id === undefined || id === null) {
                              alert('Cannot delete: batch has no ID.');
                              return;
                            }
                            setDeletingId(id);
                          }}
                          className="px-4 border-l border-zinc-50 hover:bg-red-50 text-zinc-300 hover:text-red-500 transition-colors group/del shrink-0"
                          title="永久删除"
                        >
                          <Trash2 className="w-4 h-4 group-hover/del:scale-110 transition-transform" />
                        </button>
                      </motion.div>
                    )
                  })}
              </div>
            </div>

            {/* Right Column: Categories */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-4 px-1">
                <FolderOpen className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">我的分类</h2>
              </div>
              <div
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-colors ${isDragOverRightColumnRoot
                  ? 'border-2 border-dashed border-blue-400 bg-blue-50/40'
                  : 'border-zinc-100'
                  }`}
                onDragOver={(e) => handleDragOver(e, 'right-root')}
                onDragLeave={(e) => handleDragLeave(e, 'right-root')}
                onDrop={(e) => handleDrop(e, 'right-root')}
              >
                <div className="p-4">
                  {isDragOverRightColumnRoot && (
                    <div className="mb-3 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-600">
                      释放到这里可移动到根目录
                    </div>
                  )}
                  {/* Category tree */}
                  {topLevelCategories.length > 0 ? (
                    <div className="space-y-0.5">
                      {topLevelCategories.map(cat => renderCategory(cat))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-zinc-400">
                      <Folder className="w-10 h-10 mx-auto mb-3 text-zinc-300" />
                      <p className="text-sm mb-1">还没有分类</p>
                      <p className="text-xs text-zinc-400">创建分类并拖拽题单进行整理</p>
                    </div>
                  )}
                </div>

                {/* New category input */}
                <div className="border-t border-zinc-100 p-3">
                  {showNewCategoryInput ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="分类名称, 如: C++、音视频..."
                        className="flex-1 text-sm px-3 py-2 border border-zinc-200 rounded-xl outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 bg-zinc-50"
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && newCategoryName.trim()) {
                            await createCategory(newCategoryName);
                            setNewCategoryName('');
                            setShowNewCategoryInput(false);
                          } else if (e.key === 'Escape') {
                            setShowNewCategoryInput(false);
                            setNewCategoryName('');
                          }
                        }}
                      />
                      <button
                        onClick={async () => {
                          if (newCategoryName.trim()) {
                            await createCategory(newCategoryName);
                            setNewCategoryName('');
                            setShowNewCategoryInput(false);
                          }
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(''); }}
                        className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-xl transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewCategoryInput(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 text-sm text-zinc-500 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      新建分类
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {deletingId !== null && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-zinc-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-zinc-100 relative pointer-events-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-6">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Delete this question set?</h3>
              <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                This will permanently remove the set and all included questions. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-3 rounded-xl border border-zinc-200 font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BatchDetail({ batch, onBack, onExport, onReuseBatch }: { batch: any, onBack: () => void, onExport: () => void, onReuseBatch?: (batch: any) => void }) {
  const [practices, setPractices] = useState<any[]>([]);
  const [isPracticesLoading, setIsPracticesLoading] = useState(false);
  const [practicesError, setPracticesError] = useState<string | null>(null);
  const [selectedPracticeId, setSelectedPracticeId] = useState<number | null>(null);
  const [practiceView, setPracticeView] = useState<'list' | 'detail'>('list');
  const [deletingPracticeId, setDeletingPracticeId] = useState<number | null>(null);

  const loadPractices = () => {
    if (!batch?.id || String(batch.id).startsWith('legacy-')) {
      setPractices([]);
      setPracticesError(null);
      setSelectedPracticeId(null);
      return;
    }

    setIsPracticesLoading(true);
    setPracticesError(null);
    fetch(`/api/questions/batch/${batch.id}/practices`, { credentials: 'omit' })
      .then(parseJsonResponse)
      .then(data => {
        const list = data.practices || [];
        setPractices(list);
        setSelectedPracticeId(list.length > 0 ? list[0].id : null);
      })
      .catch(err => {
        console.error(err);
        setPractices([]);
        setPracticesError(err?.message || 'Failed to load practice records');
        setSelectedPracticeId(null);
      })
      .finally(() => setIsPracticesLoading(false));
  };

  useEffect(() => {
    setPracticeView('list');
    loadPractices();
  }, [batch?.id]);

  const selectedPractice = practices.find(p => p.id === selectedPracticeId) || null;

  const openPracticeDetail = (practiceId: number) => {
    setSelectedPracticeId(practiceId);
    setPracticeView('detail');
  };

  // Step 1: show confirmation dialog by setting deletingPracticeId
  const requestDeletePractice = (practiceId: number) => {
    setDeletingPracticeId(practiceId);
  };

  // Step 2: actually delete after user confirms in the dialog
  const confirmDeletePractice = async () => {
    const practiceId = deletingPracticeId;
    if (practiceId === null) return;

    try {
      const res = await fetch(`/api/interviews/${practiceId}`, {
        method: 'DELETE',
        credentials: 'omit',
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete practice');
      }

      const next = practices.filter(p => p.id !== practiceId);
      setPractices(next);
      if (selectedPracticeId === practiceId) {
        setSelectedPracticeId(next.length > 0 ? next[0].id : null);
        setPracticeView('list');
      }
    } catch (error: any) {
      alert(error?.message || 'Failed to delete practice');
    } finally {
      setDeletingPracticeId(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to History</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onReuseBatch && (
              <button
                onClick={() => onReuseBatch(batch)}
                className="px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-400 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重新面试
              </button>
            )}
            <button
              onClick={onExport}
              className="px-6 py-2.5 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export MD
            </button>
          </div>
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-orange-50 text-orange-600">
              {batch.module_id}
            </span>
            <span className="text-zinc-400 text-sm">{new Date(batch.created_at).toLocaleString()}</span>
          </div>
          <h1 className="text-5xl font-light tracking-tight">{batch.title}</h1>
        </div>

        <div className="mb-10 rounded-3xl border border-zinc-200 bg-zinc-50/40 p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-orange-600" />
              <h2 className="text-2xl font-light tracking-tight">Practice Records</h2>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-white border border-zinc-200 text-zinc-600">
              {practices.length} attempts
            </span>
          </div>

          {String(batch.id).startsWith('legacy-') ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
              Legacy question sets do not support attached practice transcripts.
            </div>
          ) : isPracticesLoading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
              Loading practice records...
            </div>
          ) : practicesError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
              {practicesError}
            </div>
          ) : practices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-5 text-sm text-zinc-500">
              No practice record yet for this question set.
            </div>
          ) : practiceView === 'list' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {practices.map((practice: any, index: number) => (
                <div
                  key={practice.id}
                  onClick={() => openPracticeDetail(practice.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openPracticeDetail(practice.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="text-left rounded-2xl border border-zinc-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-orange-600">第 {practices.length - index} 次尝试</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDeletePractice(practice.id);
                      }}
                      disabled={deletingPracticeId === practice.id}
                      className="p-1 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="删除本次尝试"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-[11px] text-zinc-500 mb-2">{new Date(practice.created_at).toLocaleString()}</div>
                  <div className="text-xs text-zinc-600 line-clamp-3">
                    {(practice.transcript_text || '').slice(0, 120) || 'No transcript content.'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setPracticeView('list')}
                  className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回尝试列表
                </button>
                {selectedPractice && (
                  <button
                    onClick={() => requestDeletePractice(selectedPractice.id)}
                    disabled={deletingPracticeId === selectedPractice.id}
                    className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    删除本次尝试
                  </button>
                )}
              </div>
              <div className="p-5">
                <div className="text-xs text-zinc-500 mb-3">
                  {selectedPractice ? `转录时间：${new Date(selectedPractice.created_at).toLocaleString()}` : 'No practice selected'}
                </div>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-zinc-50 border border-zinc-100 rounded-2xl p-5 text-zinc-700 max-h-[480px] overflow-y-auto">
                  {selectedPractice?.transcript_text || 'No transcript content.'}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {batch.questions.map((q: any, idx: number) => (
            <QuestionItem key={q.id} question={q} index={idx} />
          ))}
        </div>
      </div>

      {/* Practice delete confirmation dialog */}
      <AnimatePresence>
        {deletingPracticeId !== null && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-zinc-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-zinc-100 relative pointer-events-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-6">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">删除这次练习记录？</h3>
              <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                删除后不可恢复，确认要继续吗？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingPracticeId(null)}
                  className="flex-1 py-3 rounded-xl border border-zinc-200 font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeletePractice}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
function QuestionItem({ question, index }: QuestionItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-8 rounded-3xl border border-zinc-100 bg-[#fafafa] hover:bg-[#f5f5f5] transition-colors group">
      <div className="flex gap-6">
        <div className="text-3xl font-serif italic text-zinc-200 group-hover:text-orange-200 transition-colors">
          {(index + 1).toString().padStart(2, '0')}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${question.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
              question.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
              {question.difficulty}
            </span>
          </div>
          <p className="text-lg text-zinc-800 leading-relaxed mb-6">
            {question.content}
          </p>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
          >
            {isOpen ? '隐藏参考答案' : '查看参考答案'}
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-4 pt-4 border-t border-zinc-200"
            >
              <div className="prose prose-sm prose-zinc max-w-none bg-white p-6 rounded-2xl border border-zinc-100 [&_pre]:bg-zinc-50 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:text-orange-600 [&_code]:text-xs [&_pre_code]:text-zinc-700 [&_pre_code]:text-xs [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_p]:my-2 [&_table]:text-xs [&_th]:px-3 [&_th]:py-1.5 [&_td]:px-3 [&_td]:py-1.5 [&_blockquote]:border-orange-300 [&_blockquote]:text-zinc-500 [&_a]:text-orange-600">
                {question.answer ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.answer}</ReactMarkdown>
                ) : (
                  <p className="text-zinc-400 italic">暂无答案解析。</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
