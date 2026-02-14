'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';
import {
    Bot,
    MessageSquare,
    Plus,
    Calendar,
    HardDrive,
    BookOpen,
    Settings,
    LogOut,
    Trash2,
} from 'lucide-react';

interface Conversation {
    id: string;
    title: string;
    created_at: string;
}

interface ChatSidebarProps {
    currentConversationId?: string;
    onSelectConversation: (id: string | undefined) => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function ChatSidebar({
    currentConversationId,
    onSelectConversation,
}: ChatSidebarProps) {
    const router = useRouter();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchConversations = async () => {
        try {
            const token = getToken();
            if (!token) return;

            const res = await fetch(`${BACKEND_URL}/api/conversations`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setConversations(data.conversations || []);
            }
        } catch (error) {
            console.error('Failed to fetch conversations', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, [currentConversationId]); // Refetch when ID changes (e.g. new chat created)

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Delete this conversation?')) return;

        try {
            const token = getToken();
            await fetch(`${BACKEND_URL}/api/conversations/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            // remove from list
            setConversations((prev) => prev.filter((c) => c.id !== id));
            if (currentConversationId === id) {
                onSelectConversation(undefined);
            }
        } catch (error) {
            console.error('Failed to delete', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    return (
        <aside className="w-64 border-r border-white/5 flex flex-col bg-surface-900 flex-shrink-0">
            {/* Header / New Chat */}
            <div className="p-4 border-b border-white/5 space-y-4">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-white text-sm">AI Assistant</h1>
                        <p className="text-xs text-white/30">History Enabled</p>
                    </div>
                </div>

                <button
                    onClick={() => onSelectConversation(undefined)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Chat
                </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <p className="px-3 py-2 text-xs font-medium text-white/20 uppercase tracking-wider">
                    Recent Chats
                </p>

                {isLoading ? (
                    <div className="px-3 py-2 text-white/30 text-xs">Loading...</div>
                ) : conversations.length === 0 ? (
                    <div className="px-3 py-2 text-white/30 text-xs">No history yet.</div>
                ) : (
                    conversations.map((conv) => (
                        <div
                            key={conv.id}
                            onClick={() => onSelectConversation(conv.id)}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-colors ${currentConversationId === conv.id
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                                }`}
                        >
                            <MessageSquare className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1 truncate">{conv.title || 'Untitled Chat'}</span>

                            <button
                                onClick={(e) => handleDelete(e, conv.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                                title="Delete"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Tools Info */}
            <div className="p-4 border-t border-white/5 space-y-2">
                <p className="text-xs font-medium text-white/20 uppercase tracking-wider mb-2 px-2">
                    Connected Tools
                </p>
                {[
                    { icon: Calendar, label: 'Calendar', color: 'text-blue-400' },
                    { icon: HardDrive, label: 'Drive', color: 'text-green-400' },
                    { icon: BookOpen, label: 'Notion', color: 'text-orange-400' },
                ].map(({ icon: Icon, label, color }) => (
                    <div
                        key={label}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/40"
                    >
                        <Icon className={`w-3 h-3 ${color}`} />
                        {label}
                    </div>
                ))}
            </div>

            {/* Bottom actions */}
            <div className="p-4 border-t border-white/5 space-y-1">
                <button
                    onClick={() => router.push('/settings')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors w-full"
                >
                    <Settings className="w-4 h-4" />
                    Settings
                </button>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-colors w-full"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
