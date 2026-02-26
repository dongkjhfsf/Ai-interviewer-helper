import React, { useState } from 'react';
import SetupPage from './components/SetupPage';
import QuestionList from './components/QuestionList';
import InterviewRoom from './components/InterviewRoom';
import ReviewPage from './components/ReviewPage';

export default function App() {
  const [step, setStep] = useState<'setup' | 'questions' | 'interview' | 'review'>('setup');
  const [interviewData, setInterviewData] = useState<any>(null);
  const [finalTranscript, setFinalTranscript] = useState<string>('');

  const handleSetupComplete = (data: any) => {
    setInterviewData(data);
    setStep('questions');
  };

  const handleInterviewEnd = (transcript: string) => {
    setFinalTranscript(transcript);
    setStep('review');
  };

  const handleRestart = () => {
    setInterviewData(null);
    setFinalTranscript('');
    setStep('setup');
  };

  return (
    <div className="w-full min-h-screen bg-[#faf9f6]">
      {step === 'setup' && <SetupPage onComplete={handleSetupComplete} />}
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
