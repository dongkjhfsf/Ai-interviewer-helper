import React from 'react';
import { motion } from 'motion/react';
import { Download, RotateCcw, FileText } from 'lucide-react';

export default function ReviewPage({ transcript, onRestart }: { transcript: string, onRestart: () => void }) {
  
  const handleDownload = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview_transcript_${new Date().toISOString().split('T')[0]}.txt`;
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
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-7xl font-light tracking-tighter mb-6">
            Session <span className="font-serif italic text-orange-600">Concluded</span>
          </h1>
          <p className="text-zinc-500 font-mono text-sm max-w-xl mx-auto">
            Your interview transcript has been generated. You can download it for further review or to feed into another AI for a detailed performance analysis.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-xl shadow-zinc-200/50 mb-12 relative overflow-hidden"
        >
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3 text-zinc-800 font-medium">
              <FileText className="w-5 h-5 text-orange-500" />
              Raw Transcript
            </div>
            <button 
              onClick={handleDownload}
              className="px-4 py-2 rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download .TXT
            </button>
          </div>

          <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100 h-[400px] overflow-y-auto relative z-10 custom-scrollbar">
            <pre className="font-mono text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed">
              {transcript || "No dialogue recorded during this session."}
            </pre>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center"
        >
          <button 
            onClick={onRestart}
            className="px-8 py-4 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 flex items-center gap-3 font-medium transition-all shadow-xl shadow-zinc-900/20"
          >
            <RotateCcw className="w-5 h-5" />
            Start New Session
          </button>
        </motion.div>
      </div>
    </div>
  );
}
