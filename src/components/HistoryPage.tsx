import React, { useEffect, useState } from 'react';
import { ArrowLeft, Database, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export default function HistoryPage({ onBack }: { onBack: () => void }) {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/questions/history', { credentials: 'omit' })
      .then(res => res.json())
      .then(data => {
        setBatches(data.batches || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const handleExportMd = (batch: any) => {
    const mdContent = `# Interview Question Set - ${batch.module_id}\n\nGenerated at: ${new Date(batch.created_at).toLocaleString()}\n\n` + 
      batch.questions.map((q: any, i: number) => `### ${i + 1}. [${q.difficulty}] \n${q.content}\n`).join('\n');
    
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-set-${batch.module_id}-${new Date(batch.created_at).getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-zinc-900 p-8 font-sans">
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
            <Database className="w-8 h-8 text-orange-500" />
            Question <span className="font-serif italic text-orange-500">History</span>
          </h1>
          <p className="text-zinc-500 text-sm">
            Review all previously generated question sets. The AI uses this history to ensure it doesn't repeat questions in future sessions.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-zinc-400">Loading history...</div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 border border-dashed border-zinc-300 rounded-2xl">
            No question sets generated yet.
          </div>
        ) : (
          <div className="space-y-8">
            {batches.map((batch, i) => (
              <motion.div 
                key={batch.created_at + batch.module_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100"
              >
                <div className="flex justify-between items-start mb-6 pb-6 border-b border-zinc-100">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-orange-50 text-orange-600">
                        {batch.module_id}
                      </span>
                      <span className="text-zinc-400 text-sm flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(batch.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-medium text-zinc-800">
                      {batch.questions.length} Questions Generated
                    </h2>
                  </div>
                  <button
                    onClick={() => handleExportMd(batch)}
                    className="px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors"
                  >
                    Export to MD
                  </button>
                </div>
                
                <div className="space-y-4">
                  {batch.questions.map((q: any, idx: number) => (
                    <div key={q.id} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 font-mono text-xs">
                        {idx + 1}
                      </div>
                      <div>
                        <span className={`inline-block mb-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          q.difficulty === 'Easy' ? 'bg-green-50 text-green-600' :
                          q.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {q.difficulty}
                        </span>
                        <p className="text-zinc-700 text-sm leading-relaxed">{q.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
