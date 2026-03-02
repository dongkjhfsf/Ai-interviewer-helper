import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Play, ChevronDown, ArrowLeft, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';

export default function QuestionList({ data, onStart, onBack }: { data: any, onStart: () => void, onBack: () => void }) {
  const [questions, setQuestions] = useState(data?.questions || []);
  const title = data?.title || "Interview Question Set";
  const batchId = data?.batchId || data?.id;
  const moduleId = data?.module_id || "unknown";

  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ content: '', answer: '', difficulty: 'Medium' });

  const handleExportMd = () => {
    const mdContent = `# ${title}\n\nGenerated at: ${new Date().toLocaleString()}\n\n` +
      questions.map((q: any, i: number) =>
        `### ${i + 1}. [${q.difficulty}] \n${q.content}\n\n**Answer:**\n${q.answer || 'No answer provided.'}\n`
      ).join('\n---\n');

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '-')}-${new Date().getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("确定要删除这道题吗？")) return;
    try {
      const res = await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setQuestions(questions.filter((q: any) => q.id !== id));
      } else {
        alert("删除失败");
      }
    } catch (e) {
      console.error(e);
      alert("删除时发生错误");
    }
  };

  const handleUpdate = async (id: number, updatedItem: any) => {
    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem)
      });
      if (res.ok) {
        setQuestions(questions.map((q: any) => q.id === id ? { ...q, ...updatedItem } : q));
      } else {
        alert("更新失败");
      }
    } catch (e) {
      console.error(e);
      alert("更新时发生错误");
    }
  };

  const handleAddSubmit = async () => {
    if (!addForm.content.trim()) {
      alert("题目内容不能为空");
      return;
    }
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          moduleId,
          ...addForm
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const newQuestion = { ...addForm, id: data.id };
        setQuestions([...questions, newQuestion]);
        setIsAdding(false);
        setAddForm({ content: '', answer: '', difficulty: 'Medium' });
      } else {
        alert("添加失败: " + (data.error || "未知原因"));
      }
    } catch (e) {
      console.error(e);
      alert("添加时发生错误");
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-zinc-900 p-8 md:p-16">
      <div className="max-w-4xl mx-auto">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 text-sm font-medium mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          返回主页
        </motion.button>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2 block">
              Generated Successfully
            </span>
            <h1 className="text-5xl font-light tracking-tighter mb-4 capitalize">
              {title.split(' ').map((word: string, i: number) =>
                i === 1 ? <span key={i} className="font-serif italic text-orange-600"> {word} </span> : word + " "
              )}
            </h1>
            <p className="text-zinc-500 font-mono text-sm max-w-lg">
              Below are the questions tailored for you. You can review the answers now, edit them, or start the session.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExportMd}
              className="px-6 py-3 rounded-full border border-zinc-200 hover:border-zinc-300 bg-white flex items-center gap-2 text-sm font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              Export MD
            </button>
            <button
              onClick={onStart}
              className="px-6 py-3 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 flex items-center gap-2 text-sm font-medium transition-all shadow-xl shadow-zinc-900/20"
            >
              <Play className="w-4 h-4" />
              Start Session
            </button>
          </div>
        </motion.div>

        <div className="space-y-6">
          <AnimatePresence>
            {questions.map((q: any, idx: number) => (
              q && (<QuestionCard
                key={q.id || `q-${idx}`}
                question={q}
                index={idx}
                onDelete={() => handleDelete(q.id)}
                onUpdate={(upd) => handleUpdate(q.id, upd)}
                isLegacyBatch={typeof batchId === 'string' && batchId.startsWith('legacy-')}
              />)
            ))}
          </AnimatePresence>

          {!(typeof batchId === 'string' && batchId.startsWith('legacy-')) && (
            <AnimatePresence>
              {isAdding ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-8 bg-white rounded-3xl border border-orange-200 shadow-sm"
                >
                  <h3 className="text-lg font-medium text-zinc-800 mb-4">添加新问题</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">题目难度</label>
                      <select
                        value={addForm.difficulty}
                        onChange={(e) => setAddForm({ ...addForm, difficulty: e.target.value })}
                        className="w-full md:w-48 px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">题目内容</label>
                      <textarea
                        value={addForm.content}
                        onChange={(e) => setAddForm({ ...addForm, content: e.target.value })}
                        className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-h-[80px]"
                        placeholder="输入问题内容..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">参考答案 (Markdown)</label>
                      <textarea
                        value={addForm.answer}
                        onChange={(e) => setAddForm({ ...addForm, answer: e.target.value })}
                        className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-h-[150px] font-mono text-sm"
                        placeholder="输入参考答案..."
                      />
                    </div>
                    <div className="flex gap-3 justify-end pt-2">
                      <button
                        onClick={() => setIsAdding(false)}
                        className="px-4 py-2 border border-zinc-200 rounded-lg text-xs font-medium hover:bg-zinc-50 flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> 取消
                      </button>
                      <button
                        onClick={handleAddSubmit}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 flex items-center gap-1 transition-colors relative"
                      >
                        <Check className="w-3.5 h-3.5" /> 保存
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setIsAdding(true)}
                  className="w-full py-6 rounded-3xl border border-dashed border-zinc-300 text-zinc-500 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/50 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-sm font-medium">添加题目</span>
                </motion.button>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

interface QuestionCardProps {
  question: any;
  index: number;
  onDelete?: () => void;
  onUpdate?: (updatedItem: any) => void;
  isLegacyBatch?: boolean;
}

function QuestionCard({ question, index, onDelete, onUpdate, isLegacyBatch }: QuestionCardProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ content: question.content, answer: question.answer || '', difficulty: question.difficulty || 'Medium' });

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(editForm);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm({ content: question.content, answer: question.answer || '', difficulty: question.difficulty || 'Medium' });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-8 bg-[#fdfaf6] rounded-3xl border border-orange-200 shadow-sm"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="text-xl font-serif italic text-orange-400">
            {(index + 1).toString().padStart(2, '0')} (编辑中)
          </div>
          <div className="flex gap-2">
            <button onClick={handleCancel} className="p-2 text-zinc-400 hover:text-zinc-600 bg-white rounded-full border border-zinc-200 hover:border-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
            <button onClick={handleSave} className="p-2 text-green-600 hover:text-green-700 bg-green-50 rounded-full border border-green-200 hover:border-green-300 transition-colors">
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">难度</label>
            <select
              value={editForm.difficulty}
              onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
              className="w-full md:w-48 px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">题目内容</label>
            <textarea
              value={editForm.content}
              onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-h-[80px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">参考答案 (Markdown)</label>
            <textarea
              value={editForm.answer}
              onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-h-[200px] font-mono text-sm"
            />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="p-8 bg-white rounded-3xl border border-zinc-100 shadow-sm group hover:border-orange-200 transition-all relative overflow-hidden"
    >
      {!isLegacyBatch && (
        <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 text-zinc-400 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors"
            title="编辑"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-6">
        <div className="text-3xl font-serif italic text-zinc-200 group-hover:text-orange-200 transition-colors">
          {(index + 1).toString().padStart(2, '0')}
        </div>
        <div className="flex-1 pr-16 bg-transparent">
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md ${question.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
              question.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
              {question.difficulty}
            </span>
            <span className="text-xs text-zinc-400 font-mono">{question.category || 'Focus Area'}</span>
          </div>
          <p className="text-xl text-zinc-800 leading-relaxed mb-6 font-medium whitespace-pre-wrap">{question.content}</p>

          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
          >
            {showAnswer ? '隐藏参考答案' : '查看参考答案'}
            <ChevronDown className={`w-4 h-4 transition-transform ${showAnswer ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showAnswer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <div className="prose prose-sm prose-zinc max-w-none
                    [&_code]:font-mono [&_code]:text-[13px]
                    [&_:not(pre)>code]:text-orange-700 [&_:not(pre)>code]:bg-orange-100/70 [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded-md
                    [&_h1]:text-zinc-800 [&_h2]:text-zinc-700 [&_h3]:text-zinc-700
                    [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_p]:my-3
                    [&_table]:text-xs [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-zinc-100 [&_th]:text-zinc-600
                    [&_td]:px-3 [&_td]:py-1.5 [&_td]:border-t [&_td]:border-zinc-200
                    [&_blockquote]:border-l-4 [&_blockquote]:border-orange-400/60 [&_blockquote]:pl-4 [&_blockquote]:text-zinc-500 [&_blockquote]:italic
                    [&_a]:text-orange-600 [&_a]:no-underline hover:[&_a]:underline
                    [&_strong]:text-zinc-800 [&_strong]:font-semibold
                    [&_pre_code.hljs]:!bg-transparent [&_pre_code.hljs]:!p-0
                  ">
                    {question.answer ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
                        components={{
                          pre: ({ node, ...props }) => (
                            <div className="my-4 rounded-xl overflow-hidden border border-zinc-200 shadow-sm">
                              <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-100 border-b border-zinc-200">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-400/80"></div>
                              </div>
                              <pre {...props} className="p-4 overflow-x-auto bg-[#f6f3ee] custom-scrollbar" />
                            </div>
                          )
                        }}
                      >
                        {question.answer}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-zinc-500 italic">暂无答案解析。</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
