import React, { useEffect, useState } from 'react';
import SetupPage from './components/SetupPage';
import QuestionList from './components/QuestionList';
import InterviewRoom from './components/InterviewRoom';
import ReviewPage from './components/ReviewPage';
import HistoryPage from './components/HistoryPage';

const SETUP_INPUTS_STORAGE_KEY = 'setup_prompt_inputs_v1';

interface SetupPersistedInputs {
  githubUrl: string;
  textContext: string;
  file: File | null;
}

export default function App() {
  const [step, setStep] = useState<'setup' | 'questions' | 'interview' | 'review' | 'history'>('setup');
  const [interviewData, setInterviewData] = useState<any>(null);
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [setupInputs, setSetupInputs] = useState<SetupPersistedInputs>(() => {
    try {
      const raw = localStorage.getItem(SETUP_INPUTS_STORAGE_KEY);
      if (!raw) return { githubUrl: '', textContext: '', file: null };
      const parsed = JSON.parse(raw) as Partial<Pick<SetupPersistedInputs, 'githubUrl' | 'textContext'>>;
      return {
        githubUrl: typeof parsed.githubUrl === 'string' ? parsed.githubUrl : '',
        textContext: typeof parsed.textContext === 'string' ? parsed.textContext : '',
        file: null,
      };
    } catch {
      return { githubUrl: '', textContext: '', file: null };
    }
  });

  useEffect(() => {
    localStorage.setItem(
      SETUP_INPUTS_STORAGE_KEY,
      JSON.stringify({
        githubUrl: setupInputs.githubUrl,
        textContext: setupInputs.textContext,
      })
    );
  }, [setupInputs.githubUrl, setupInputs.textContext]);

  const handleSetupComplete = (data: any) => {
    setInterviewData(data);
    setStep('questions');
  };

  const handleSetupInputsChange = (next: Partial<SetupPersistedInputs>) => {
    setSetupInputs((prev) => ({ ...prev, ...next }));
  };

  const handleReuseBatch = (batch: any) => {
    setInterviewData({
      title: batch.title,
      module_id: batch.module_id,
      questions: batch.questions || [],
      batchId: batch.id,
    });
    setStep('questions');
  };

  const handleInterviewEnd = async (transcript: string) => {
    setFinalTranscript(transcript);

    const batchId = interviewData?.batchId;
    if (batchId && typeof transcript === 'string' && transcript.trim()) {
      try {
        await fetch('/api/interviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify({ batchId, transcript }),
        });
      } catch (error) {
        console.error('Failed to save interview transcript:', error);
      }
    }

    setStep('review');
  };

  const handleRestart = () => {
    setInterviewData(null);
    setFinalTranscript('');
    setStep('setup');
  };

  return (
    <div className="w-full min-h-screen bg-[#faf9f6]">
      {step === 'setup' && (
        <SetupPage
          onComplete={handleSetupComplete}
          onReuseBatch={handleReuseBatch}
          onViewHistory={() => setStep('history')}
          persistedInputs={setupInputs}
          onPersistedInputsChange={handleSetupInputsChange}
        />
      )}
      {step === 'history' && (
        <HistoryPage onBack={() => setStep('setup')} />
      )}
      {step === 'questions' && (
        <QuestionList 
          data={interviewData} 
          onStart={() => setStep('interview')} 
        />
      )}
      {step === 'interview' && (
        <InterviewRoom 
          data={interviewData} 
          onEnd={handleInterviewEnd} 
        />
      )}
      {step === 'review' && (
        <ReviewPage 
          transcript={finalTranscript} 
          onRestart={handleRestart} 
        />
      )}
    </div>
  );
}
