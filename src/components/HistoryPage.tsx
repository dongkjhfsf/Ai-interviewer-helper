import React, { useEffect, useState } from 'react';
import { ArrowLeft, Database, Clock, Trash2, ChevronRight, Download, ChevronDown, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuestionItemProps {
  question: any;
  index: number;
  key?: React.Key;
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

export default function HistoryPage({ onBack }: { onBack: () => void }) {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

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

  useEffect(() => {
    fetchHistory();
  }, []);

  const confirmDelete = async () => {
    if (deletingId === null || deletingId === undefined) {
      alert("Error: No batch ID selected for deletion.");
      return;
    }

    try {
      const res = await fetch(`/api/questions/batch/${deletingId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
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

  if (selectedBatch) {
    return (
      <BatchDetail
        batch={selectedBatch}
        onBack={() => setSelectedBatch(null)}
        onExport={() => handleExportMd(selectedBatch)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-zinc-900 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back to Setup</span>
        </button>

        <div className="mb-12">
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
          <div className="grid gap-4">
            {batches.map((batch, i) => (
              <motion.div
                key={batch.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group bg-white rounded-2xl shadow-sm border border-zinc-100 hover:border-orange-200 hover:shadow-md transition-all flex items-stretch overflow-hidden"
              >
                <div
                  onClick={() => setSelectedBatch(batch)}
                  className="flex-1 p-6 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600">
                          {batch.module_id}
                        </span>
                        <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(batch.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h2 className="text-lg font-medium text-zinc-800 group-hover:text-orange-600 transition-colors">
                        {batch.title}
                      </h2>
                      <p className="text-zinc-400 text-xs">
                        {batch.questions.length} questions included · {(batch.practice_count || 0)} practice records
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-orange-500 transition-colors" />
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const id = batch.id;
                    console.log('Delete clicked, batch.id =', id, ', batch =', batch);
                    if (id === undefined || id === null) {
                      alert('Cannot delete: batch has no ID. Raw batch: ' + JSON.stringify(batch));
                      return;
                    }
                    setDeletingId(id);
                  }}
                  className="px-6 border-l border-zinc-50 hover:bg-red-50 text-zinc-300 hover:text-red-500 transition-colors group/del"
                >
                  <Trash2 className="w-5 h-5 group-hover/del:scale-110 transition-transform" />
                </button>
              </motion.div>
            ))}
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

function BatchDetail({ batch, onBack, onExport }: { batch: any, onBack: () => void, onExport: () => void }) {
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

  const deletePractice = async (practiceId: number) => {
    const ok = window.confirm('确认删除这次练习记录吗？删除后不可恢复。');
    if (!ok) return;

    setDeletingPracticeId(practiceId);
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
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to History</span>
          </button>

          <button
            onClick={onExport}
            className="px-6 py-2.5 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export MD
          </button>
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
                        deletePractice(practice.id);
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
                    onClick={() => deletePractice(selectedPractice.id)}
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
              <div className="text-zinc-600 leading-relaxed whitespace-pre-wrap text-sm bg-white p-6 rounded-2xl border border-zinc-100">
                {question.answer || '暂无答案解析。'}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

