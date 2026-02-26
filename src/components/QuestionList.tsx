import React from 'react';
import { motion } from 'motion/react';
import { Download, Play, CheckCircle2 } from 'lucide-react';

export default function QuestionList({ data, onStart }: { data: any, onStart: () => void }) {
  const questions = data?.questions || [];

  const handleExportMd = () => {
    const mdContent = `# Interview Question Set\n\nGenerated at: ${new Date().toLocaleString()}\n\n` + 
      questions.map((q: any, i: number) => `### ${i + 1}. [${q.difficulty}] \n${q.content}\n`).join('\n');
    
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-set-${new Date().getTime()}.md`;
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
            <h1 className="text-5xl font-light tracking-tighter mb-4">
              Your <span className="font-serif italic text-orange-600">Question Set</span>
            </h1>
            <p className="text-zinc-500 font-mono text-sm">
              Generated based on your context. Review the topics before we begin.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleExportMd}
              className="px-6 py-3 rounded-full border border-zinc-200 hover:border-zinc-300 bg-white flex items-center gap-2 text-sm font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              Export to MD
            </button>
            <button 
              onClick={onStart}
              className="px-6 py-3 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 flex items-center gap-2 text-sm font-medium transition-all shadow-xl shadow-zinc-900/20"
            >
              <Play className="w-4 h-4" />
              Start Interview
            </button>
          </div>
        </motion.div>

        <div className="space-y-4">
          {questions.map((q: any, idx: number) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-6 bg-white rounded-2xl border border-zinc-100 shadow-sm flex gap-6 group hover:border-orange-200 transition-colors"
            >
              <div className="text-2xl font-serif italic text-zinc-300 group-hover:text-orange-300 transition-colors">
                {(idx + 1).toString().padStart(2, '0')}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full ${
                    q.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                    q.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {q.difficulty}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">{q.category || 'General'}</span>
                </div>
                <p className="text-zinc-800 leading-relaxed">{q.content}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
