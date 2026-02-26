import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, Eye, EyeOff, ExternalLink, Trash2, FlaskConical, ShieldCheck, ShieldX, KeyRound } from 'lucide-react';
import { PROVIDER_DEFS, getProviderColorClasses } from '../providers';

// Provider icon components
function ProviderIcon({ providerId, className }: { providerId: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    google: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
    openai: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
      </svg>
    ),
    deepseek: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" fill="currentColor" opacity="0.6" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
    anthropic: (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M13.827 3.52h3.603L24 20.48h-3.603L13.827 3.52zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm1.04 4.27L5.29 13.898h4.638L7.61 7.789z" />
      </svg>
    ),
  };

  return <>{icons[providerId] || <KeyRound className={className} />}</>;
}

interface ProviderStatus {
  id: string;
  name: string;
  configured: boolean;
  isActive: boolean;
  maskedKey: string | null;
  source: string | null;
  models: { id: string; name: string; desc: string; badge: string }[];
  color: string;
  description: string;
  placeholder: string;
  helpUrl: string;
  capabilities: readonly string[];
  baseUrl: string | null;
}

export default function ApiSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/providers', { credentials: 'omit' });
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (e) {
      console.error('Failed to fetch providers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchProviders();
      setEditingId(null);
      setTestResult(null);
    }
  }, [open]);

  const handleSave = async (providerId: string) => {
    if (!editKey.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ id: providerId, apiKey: editKey.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      setEditingId(null);
      setEditKey('');
      setShowKey(false);
      await fetchProviders();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (providerId: string) => {
    setTestingId(providerId);
    setTestResult(null);
    try {
      const keyToTest = editingId === providerId && editKey.trim() ? editKey.trim() : undefined;
      const res = await fetch(`/api/providers/${providerId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ apiKey: keyToTest }),
      });
      const data = await res.json();
      setTestResult({ id: providerId, success: data.success, message: data.message || data.error });
    } catch (e: any) {
      setTestResult({ id: providerId, success: false, message: e.message });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (providerId: string) => {
    setDeletingId(providerId);
    try {
      await fetch(`/api/providers/${providerId}`, {
        method: 'DELETE',
        credentials: 'omit',
      });
      await fetchProviders();
    } catch (e) {
      console.error('Failed to delete provider:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (provider: ProviderStatus) => {
    setEditingId(provider.id);
    setEditKey('');
    setShowKey(false);
    setTestResult(null);
  };

  if (!open) return null;

  const configuredCount = providers.filter(p => p.configured).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-zinc-100 overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-6 md:p-8 pb-4 border-b border-zinc-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-orange-500" />
                  API 密钥管理
                </h3>
                <p className="text-zinc-400 text-sm mt-1">
                  已配置 {configuredCount}/{providers.length} 个服务商 · 实时语音仅支持 Google Gemini
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Provider List */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-4 space-y-4">
            {loading ? (
              <div className="py-12 text-center text-zinc-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                加载中...
              </div>
            ) : (
              providers.map((provider) => {
                const colors = getProviderColorClasses(provider.color);
                const isEditing = editingId === provider.id;
                const isTesting = testingId === provider.id;
                const isDeleting = deletingId === provider.id;
                const hasTestResult = testResult?.id === provider.id;

                return (
                  <motion.div
                    key={provider.id}
                    layout
                    className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                      provider.configured
                        ? `${colors.border} ${colors.bg}`
                        : 'border-zinc-100 bg-white'
                    }`}
                  >
                    {/* Provider Header */}
                    <div className="p-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        provider.configured ? colors.badge : 'bg-zinc-100 text-zinc-400'
                      }`}>
                        <ProviderIcon providerId={provider.id} className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-800 text-sm">{provider.name}</span>
                          {provider.capabilities.includes('voice') && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-600 font-medium">
                              语音
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500 font-medium">
                            题单
                          </span>
                        </div>
                        <div className="text-zinc-400 text-xs mt-0.5">{provider.description}</div>
                        {provider.configured && provider.maskedKey && !isEditing && (
                          <div className="text-xs text-zinc-500 mt-1 font-mono flex items-center gap-1">
                            {provider.maskedKey}
                            {provider.source === 'env' && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-200 text-zinc-500 font-sans">ENV</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {provider.configured && !isEditing && (
                          <>
                            <button
                              onClick={() => handleTest(provider.id)}
                              disabled={isTesting}
                              className="p-2 rounded-xl hover:bg-white/60 text-zinc-400 hover:text-zinc-700 transition-colors disabled:opacity-50"
                              title="测试连接"
                            >
                              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                            </button>
                            {provider.source === 'db' && (
                              <button
                                onClick={() => handleDelete(provider.id)}
                                disabled={isDeleting}
                                className="p-2 rounded-xl hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                title="删除密钥"
                              >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            )}
                          </>
                        )}
                        {provider.configured && !isEditing ? (
                          <button
                            onClick={() => startEditing(provider)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${colors.border} ${colors.text} hover:opacity-80`}
                          >
                            修改
                          </button>
                        ) : !isEditing ? (
                          <button
                            onClick={() => startEditing(provider)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium border border-orange-300 text-orange-600 hover:bg-orange-50 transition-all"
                          >
                            配置
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Test Result */}
                    {hasTestResult && !isEditing && (
                      <div className={`mx-4 mb-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${
                        testResult.success
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {testResult.success ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldX className="w-3.5 h-3.5" />}
                        {testResult.message}
                      </div>
                    )}

                    {/* Edit Form */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3 border-t border-zinc-100/60 pt-3">
                            <div className="relative">
                              <input
                                type={showKey ? 'text' : 'password'}
                                value={editKey}
                                onChange={(e) => setEditKey(e.target.value)}
                                placeholder={provider.placeholder}
                                className="w-full px-4 py-3 pr-20 rounded-xl border border-zinc-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 transition-all"
                                autoFocus
                              />
                              <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"
                              >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>

                            {/* Test result inside edit form */}
                            {hasTestResult && (
                              <div className={`px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${
                                testResult.success
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                {testResult.success ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldX className="w-3.5 h-3.5" />}
                                {testResult.message}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSave(provider.id)}
                                disabled={!editKey.trim() || saving}
                                className="px-4 py-2 rounded-xl text-xs font-medium bg-orange-600 text-white hover:bg-orange-700 disabled:bg-zinc-200 disabled:text-zinc-400 transition-all flex items-center gap-1.5"
                              >
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                保存
                              </button>
                              <button
                                onClick={() => handleTest(provider.id)}
                                disabled={isTesting || (!editKey.trim() && !provider.configured)}
                                className="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 text-zinc-600 hover:border-zinc-400 disabled:opacity-40 transition-all flex items-center gap-1.5"
                              >
                                {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
                                测试
                              </button>
                              <button
                                onClick={() => { setEditingId(null); setEditKey(''); setShowKey(false); setTestResult(null); }}
                                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
                              >
                                取消
                              </button>
                              <a
                                href={provider.helpUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto text-xs text-zinc-400 hover:text-orange-500 flex items-center gap-1 transition-colors"
                              >
                                获取密钥 <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            {/* Available models */}
                            <div className="pt-2 border-t border-zinc-100">
                              <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest mb-2">可用模型</div>
                              <div className="flex flex-wrap gap-1.5">
                                {provider.models.map(m => (
                                  <span key={m.id} className="text-[11px] px-2 py-1 rounded-lg bg-zinc-50 text-zinc-600 border border-zinc-100">
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-6 md:px-8 py-4 border-t border-zinc-100 bg-zinc-50/50">
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              API 密钥安全存储在本地数据库中，不会上传到任何第三方服务。
              实时语音面试使用 Google Gemini Live API，需要配置 Google API Key。
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
