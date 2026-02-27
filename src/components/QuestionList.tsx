import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Download, Play, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function QuestionList({ data, onStart }: { data: any, onStart: () => void }) {
  const questions = data?.questions || [];
  const title = data?.title || "Interview Question Set";

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

  return (
    <div className="min-h-screen bg-[#faf9f6] text-zinc-900 p-8 md:p-16">
      <div className="max-w-4xl mx-auto">
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
              {title.split(' ').map((word, i) =>
                i === 1 ? <span key={i} className="font-serif italic text-orange-600"> {word} </span> : word
              )}
            </h1>
            <p className="text-zinc-500 font-mono text-sm max-w-lg">
              Below are the 15 questions tailored for you. You can review the answers now or start the session.
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
          {questions.map((q: any, idx: number) => (
            <QuestionCard key={idx} question={q} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface QuestionCardProps {
  question: any;
  index: number;
  key?: React.Key;
}

function QuestionCard({ question, index }: QuestionCardProps) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-8 bg-white rounded-3xl border border-zinc-100 shadow-sm group hover:border-orange-200 transition-all"
    >
      <div className="flex gap-6">
        <div className="text-3xl font-serif italic text-zinc-200 group-hover:text-orange-200 transition-colors">
          {(index + 1).toString().padStart(2, '0')}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md ${question.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
              question.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
              {question.difficulty}
            </span>
            <span className="text-xs text-zinc-400 font-mono">{question.category || 'Focus Area'}</span>
          </div>
          <p className="text-xl text-zinc-800 leading-relaxed mb-6 font-medium">{question.content}</p>

          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
          >
            {showAnswer ? '隐藏参考答案' : '查看参考答案'}
            <ChevronDown className={`w-4 h-4 transition-transform ${showAnswer ? 'rotate-180' : ''}`} />
          </button>

          {showAnswer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-6 pt-6 border-t border-zinc-100"
            >
              <div className="prose prose-sm prose-zinc max-w-none bg-[#fcfbf9] p-6 rounded-2xl border border-orange-50 [&_pre]:bg-zinc-50 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_code]:text-orange-600 [&_code]:text-xs [&_pre_code]:text-zinc-700 [&_pre_code]:text-xs [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_p]:my-2 [&_table]:text-xs [&_th]:px-3 [&_th]:py-1.5 [&_td]:px-3 [&_td]:py-1.5 [&_blockquote]:border-orange-300 [&_blockquote]:text-zinc-500 [&_a]:text-orange-600">
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
    </motion.div>
  );
}
