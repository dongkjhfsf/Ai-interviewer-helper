import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, Github, Briefcase, BookOpen, Layers, Target, ArrowRight, Loader2 } from 'lucide-react';

const MODULES = [
  { id: 'full_simulation', name: 'Full Simulation', icon: Briefcase, desc: 'End-to-end interview experience' },
  { id: 'knowledge', name: 'Knowledge', icon: BookOpen, desc: 'Technical concepts & deep dives' },
  { id: 'project', name: 'Project', icon: Layers, desc: 'Architecture & past experience' },
  { id: 'scenario', name: 'Scenario', icon: Target, desc: 'Situational & behavioral' },
];

export default function SetupPage({ onComplete }: { onComplete: (data: any) => void }) {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [textContext, setTextContext] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!selectedModule) return;
    setIsGenerating(true);
    
    try {
      const formData = new FormData();
      formData.append('moduleId', selectedModule);
      if (githubUrl) formData.append('githubUrl', githubUrl);
      if (textContext) formData.append('textContext', textContext);
      if (file) formData.append('file', file);

      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        body: formData,
        credentials: 'omit',
      });
      
      let data;
      const textResponse = await res.text();
      
      // Check if the response is the AI Studio cookie check page
      if (textResponse.includes('Cookie check') || textResponse.includes('Action required to load your app')) {
        throw new Error("AUTH_REQUIRED");
      }

      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        console.error("Failed to parse JSON response:", textResponse);
        throw new Error("Server returned an invalid response. Please check the server logs.");
      }
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate questions');
      }
      
      setIsGenerating(false);
      onComplete(data);
    } catch (error: any) {
      console.error(error);
      setIsGenerating(false);
      
      if (error.message === "AUTH_REQUIRED") {
        alert("Your browser is blocking a required security cookie (common in Safari/Incognito). Please click 'OK', then refresh the page or open the app in a new window to authenticate.");
        // Optionally, we could automatically open a new window, but browsers might block it if not directly tied to a click event.
      } else {
        alert(error.message || "An error occurred while generating questions. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-zinc-900 overflow-hidden flex flex-col md:flex-row">
      {/* Left Asymmetric Typography Section */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full md:w-[55%] p-12 md:p-24 flex flex-col justify-center relative"
      >
        {/* Decorative animated element */}
        <motion.div 
          animate={{ 
            rotate: 360,
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-40 -left-40 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl mix-blend-multiply"
        />
        <motion.div 
          animate={{ 
            rotate: -360,
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-10 right-10 w-80 h-80 bg-blue-200/40 rounded-full blur-3xl mix-blend-multiply"
        />

        <h1 className="text-6xl md:text-8xl font-light tracking-tighter leading-[0.85] z-10 relative">
          Craft <br />
          <span className="font-serif italic text-orange-600">Your</span> <br />
          Interview.
        </h1>
        <p className="mt-8 text-lg text-zinc-500 max-w-md z-10 font-mono text-sm tracking-tight">
          Upload your context. Select a module. We'll generate a tailored, rigorous question set to test your limits.
        </p>
      </motion.div>

      {/* Right Interactive Section */}
      <div className="w-full md:w-[45%] p-8 md:p-16 flex flex-col justify-center z-10 bg-white/50 backdrop-blur-xl border-l border-white/20 shadow-2xl shadow-zinc-200/50">
        <div className="max-w-md mx-auto w-full space-y-12">
          
          {/* Step 1: Module Selection */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">01. Select Module</h2>
            <div className="grid grid-cols-2 gap-3">
              {MODULES.map((mod, idx) => (
                <motion.button
                  key={mod.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedModule(mod.id)}
                  className={`p-4 rounded-2xl text-left transition-all duration-300 border ${
                    selectedModule === mod.id 
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-900/20' 
                      : 'bg-white text-zinc-600 border-zinc-100 hover:border-zinc-300'
                  }`}
                >
                  <mod.icon className={`w-5 h-5 mb-3 ${selectedModule === mod.id ? 'text-orange-400' : 'text-zinc-400'}`} />
                  <div className="font-medium text-sm">{mod.name}</div>
                  <div className={`text-[10px] mt-1 ${selectedModule === mod.id ? 'text-zinc-400' : 'text-zinc-400'}`}>
                    {mod.desc}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Step 2: Context Upload */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">02. Provide Context</h2>
            <div className="space-y-3">
              {/* File Upload */}
              <div className="relative group">
                <input 
                  type="file" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept=".pdf,.txt,.md,.html"
                />
                <div className={`p-4 rounded-2xl border border-dashed transition-all duration-300 flex items-center gap-4 ${
                  file ? 'border-orange-500 bg-orange-50/50' : 'border-zinc-200 bg-white group-hover:border-zinc-400'
                }`}>
                  <div className={`p-2 rounded-full ${file ? 'bg-orange-100 text-orange-600' : 'bg-zinc-100 text-zinc-500'}`}>
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-medium text-zinc-700 truncate">
                      {file ? file.name : 'Upload Resume / Docs'}
                    </div>
                    <div className="text-[10px] text-zinc-400">PDF, TXT, MD, HTML up to 5MB</div>
                  </div>
                </div>
              </div>

              {/* GitHub URL */}
              <div className="relative flex items-center">
                <div className="absolute left-4 text-zinc-400">
                  <Github className="w-4 h-4" />
                </div>
                <input 
                  type="url"
                  placeholder="GitHub Repository URL (Optional)"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-zinc-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition-all"
                />
              </div>

              {/* Text Context Input */}
              <div className="relative">
                <textarea
                  placeholder="Paste job description, specific topics, or any other context here..."
                  value={textContext}
                  onChange={(e) => setTextContext(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-zinc-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition-all min-h-[100px] resize-none"
                />
              </div>
            </div>
          </motion.div>

          {/* Step 3: Generate */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="pt-4"
          >
            <motion.button
              whileHover={{ scale: selectedModule ? 1.02 : 1 }}
              whileTap={{ scale: selectedModule ? 0.98 : 1 }}
              onClick={handleGenerate}
              disabled={!selectedModule || isGenerating}
              className={`w-full py-4 rounded-full flex items-center justify-center gap-2 text-sm font-medium transition-all duration-300 ${
                selectedModule && !isGenerating
                  ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/20 hover:bg-orange-700' 
                  : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Question Set...
                </>
              ) : (
                <>
                  Initialize Interview
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
