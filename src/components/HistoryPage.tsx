import React, { useEffect, useState } from 'react';
import { ArrowLeft, Database, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export default function HistoryPage({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/questions/history', { credentials: 'omit' })
      .then(res => res.json())
      .then(data => {
        setHistory(data.questions || []);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

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
            Review all previously generated questions. The AI uses this history to ensure it doesn't repeat questions in future sessions.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-zinc-400">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 border border-dashed border-zinc-300 rounded-2xl">
            No questions generated yet.
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((q, i) => (
              <motion.div 
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex gap-4"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 font-mono text-sm">
                  #{q.id}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-orange-50 text-orange-600">
                      {q.module_id}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                      q.difficulty === 'Easy' ? 'bg-green-50 text-green-600' :
                      q.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      {q.difficulty}
                    </span>
                  </div>
                  <p className="text-zinc-800 text-sm leading-relaxed">{q.content}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
