'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, isAuthenticated } from '@/lib/api';
import {
    Bot,
    Key,
    Calendar,
    HardDrive,
    BookOpen,
    Link2,
    Unlink,
    ArrowLeft,
    Save,
    Trash2,
    Check,
    AlertCircle,
    Loader2,
} from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface OAuthConnection {
    provider: string;
    connected: boolean;
    scope?: string;
    connectedAt?: string;
}

interface AIKeyInfo {
    provider: string;
    maskedKey: string;
    createdAt: string;
}

const PROVIDER_CONFIG = {
    google: {
        name: 'Google',
        description: 'Calendar & Drive',
        icon: Calendar,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
    },
    notion: {
        name: 'Notion',
        description: 'Pages & Databases',
        icon: BookOpen,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/20',
    },
};

export default function SettingsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [aiProvider, setAiProvider] = useState<'openai' | 'anthropic'>('openai');
    const [apiKey, setApiKey] = useState('');
    const [keyInfo, setKeyInfo] = useState<AIKeyInfo | null>(null);
    const [connections, setConnections] = useState<OAuthConnection[]>([]);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push('/login');
            return;
        }
        loadSettings();
    }, [router]);

    // Handle OAuth callback params
    useEffect(() => {
        const connected = searchParams.get('connected');
        const err = searchParams.get('error');
        if (connected) {
            setSuccess(`${connected} connected successfully!`);
            loadSettings();
        }
        if (err) {
            setError(decodeURIComponent(err));
        }
    }, [searchParams]);

    const loadSettings = useCallback(async () => {
        setLoading(true);
        try {
            const [keyRes, connRes] = await Promise.all([
                apiFetch<AIKeyInfo>('/settings/ai-key').catch(() => null),
                apiFetch<{ connections: OAuthConnection[] }>('/settings/connections'),
            ]);
            setKeyInfo(keyRes);
            setConnections(connRes.connections);
            if (keyRes) {
                setAiProvider(keyRes.provider as 'openai' | 'anthropic');
            }
        } catch {
            setError('Failed to load settings');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSaveKey = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await apiFetch('/settings/ai-key', {
                method: 'POST',
                body: JSON.stringify({ provider: aiProvider, apiKey }),
            });
            setApiKey('');
            setSuccess('AI API key saved successfully');
            await loadSettings();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save key');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteKey = async () => {
        try {
            await apiFetch('/settings/ai-key', { method: 'DELETE' });
            setKeyInfo(null);
            setSuccess('AI API key removed');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to remove key');
        }
    };

    const handleConnect = (provider: string) => {
        const token = localStorage.getItem('token');
        window.location.href = `${BACKEND_URL}/oauth/${provider}/authorize?token=${token}`;
    };

    const handleDisconnect = async (provider: string) => {
        try {
            await apiFetch(`/oauth/${provider}`, { method: 'DELETE' });
            setSuccess(`${provider} disconnected`);
            await loadSettings();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to disconnect');
        }
    };

    // Auto-clear notifications
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess('');
                setError('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-surface-900">
            <div className="max-w-2xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="flex items-center gap-4 mb-10">
                    <button
                        onClick={() => router.push('/chat')}
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white/50" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Settings</h1>
                        <p className="text-white/30 text-sm">Manage your AI key and integrations</p>
                    </div>
                </div>

                {/* Notifications */}
                {success && (
                    <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-3 animate-slide-up">
                        <Check className="w-5 h-5 flex-shrink-0" />
                        {success}
                    </div>
                )}
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3 animate-slide-up">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* AI API Key */}
                <section className="glass p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                            <Key className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">AI API Key</h2>
                            <p className="text-sm text-white/30">Bring your own OpenAI or Anthropic key</p>
                        </div>
                    </div>

                    {keyInfo && (
                        <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-white capitalize">{keyInfo.provider}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs">Active</span>
                                </div>
                                <p className="text-white/30 text-sm mt-1 font-mono">{keyInfo.maskedKey}</p>
                            </div>
                            <button onClick={handleDeleteKey} className="btn-danger flex items-center gap-2 px-4 py-2 text-sm">
                                <Trash2 className="w-4 h-4" />
                                Remove
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSaveKey} className="space-y-4">
                        <div>
                            <label className="label">Provider</label>
                            <div className="flex gap-3">
                                {(['openai', 'anthropic'] as const).map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setAiProvider(p)}
                                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all border ${aiProvider === p
                                                ? 'bg-primary-600/20 border-primary-500/40 text-primary-300'
                                                : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                                            }`}
                                    >
                                        {p === 'openai' ? 'OpenAI' : 'Anthropic'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="label" htmlFor="api-key">API Key</label>
                            <input
                                id="api-key"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="input-field font-mono"
                                placeholder={aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={saving || !apiKey}
                            className="btn-primary flex items-center gap-2"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {keyInfo ? 'Update Key' : 'Save Key'}
                        </button>
                    </form>
                </section>

                {/* OAuth Connections */}
                <section className="glass p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                            <Link2 className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Integrations</h2>
                            <p className="text-sm text-white/30">Connect your productivity tools</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {connections.map((conn) => {
                            const config = PROVIDER_CONFIG[conn.provider as keyof typeof PROVIDER_CONFIG];
                            if (!config) return null;
                            const Icon = config.icon;

                            return (
                                <div
                                    key={conn.provider}
                                    className={`p-4 rounded-xl border transition-all ${conn.connected
                                            ? `${config.bgColor} ${config.borderColor}`
                                            : 'bg-white/5 border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Icon className={`w-5 h-5 ${conn.connected ? config.color : 'text-white/30'}`} />
                                            <div>
                                                <span className="text-sm font-medium text-white">{config.name}</span>
                                                <p className="text-xs text-white/30">{config.description}</p>
                                            </div>
                                        </div>

                                        {conn.connected ? (
                                            <button
                                                onClick={() => handleDisconnect(conn.provider)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl
                                   bg-white/5 border border-white/10 text-white/40
                                   hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20
                                   transition-all text-sm"
                                            >
                                                <Unlink className="w-4 h-4" />
                                                Disconnect
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleConnect(conn.provider)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl
                                   bg-primary-600/20 border border-primary-500/30
                                   text-primary-300 hover:bg-primary-600/30
                                   transition-all text-sm"
                                            >
                                                <Link2 className="w-4 h-4" />
                                                Connect
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </main>
    );
}
