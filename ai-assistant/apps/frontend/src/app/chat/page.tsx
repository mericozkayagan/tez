'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from 'ai/react';
import { useRouter } from 'next/navigation';
import { getToken, isAuthenticated } from '@/lib/api';
import {
    Bot,
    Send,
    Sparkles,
    Loader2,
    Menu,
    Mic,
    MicOff,
    X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChatSidebar from '@/components/ChatSidebar';
import ToolResult from '@/components/ToolResult';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function ChatPage() {
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [conversationId, setConversationId] = useState<string | undefined>(undefined);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [inlineError, setInlineError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push('/login');
        }
    }, [router]);

    const { messages, setMessages, input, handleInputChange, handleSubmit, isLoading, error, append } = useChat({
        api: `${BACKEND_URL}/api/chat`,
        headers: {
            Authorization: `Bearer ${getToken()}`,
        },
        body: {
            conversationId,
        },
        onResponse: (response) => {
            const newId = response.headers.get('X-Conversation-ID');
            if (newId && newId !== conversationId) {
                setConversationId(newId);
            }
        },
        onError: (err) => {
            console.error('Chat error', err);
        }
    });

    // Fetch messages when conversation selected
    useEffect(() => {
        if (!conversationId) {
            setMessages([]);
            return;
        }

        const fetchHistory = async () => {
            setIsLoadingHistory(true);
            try {
                const token = getToken();
                const res = await fetch(`${BACKEND_URL}/api/conversations/${conversationId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    const mapped = data.messages.map((m: any) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        toolInvocations: m.tool_calls ? m.tool_calls.map((tc: any) => ({
                            toolCallId: tc.toolCallId || 'unknown',
                            toolName: tc.toolName,
                            args: tc.args,
                            result: m.tool_results?.find((tr: any) => tr.toolCallId === tc.toolCallId)?.result
                        })) : undefined
                    }));
                    setMessages(mapped);
                }
            } catch (err) {
                console.error('Failed to load history', err);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchHistory();
    }, [conversationId]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            setInlineError('File too large. Max 1MB allowed.');
            setTimeout(() => setInlineError(null), 4000);
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target?.result as string;
            setAttachment({ name: file.name, content });
        };
        reader.readAsText(file);
    };

    const handleCustomSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!input.trim() && !attachment) || isLoading) return;

        if (attachment) {
            const finalMessage = `${input}\n\n--- Attached File: ${attachment.name} ---\n${attachment.content}\n--- End of File ---`;
            await append({
                role: 'user',
                content: finalMessage,
            });
            setAttachment(null);
        } else {
            handleSubmit(e as React.FormEvent<HTMLFormElement>);
        }
    };

    const toggleListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            setInlineError('Speech recognition is not supported in this browser.');
            setTimeout(() => setInlineError(null), 4000);
            return;
        }

        if (isListening) {
            setIsListening(false);
            return;
        }

        setIsListening(true);
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            handleInputChange({ target: { value: input + (input ? ' ' : '') + transcript } } as any);
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setInlineError('Voice input error: ' + event.error);
            setTimeout(() => setInlineError(null), 4000);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div className="flex h-screen bg-surface-900 overflow-hidden relative">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 md:relative transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                }`}>
                <ChatSidebar
                    currentConversationId={conversationId}
                    onSelectConversation={(id) => {
                        setConversationId(id);
                        setIsSidebarOpen(false);
                    }}
                />
            </div>

            {/* Chat area */}
            <main className="flex-1 flex flex-col w-full">
                {/* Header (Mobile) */}
                <div className="md:hidden flex items-center p-4 border-b border-white/5 bg-surface-900/95 backdrop-blur z-30">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 text-white/70 hover:text-white"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="ml-2 font-semibold text-white">AI Assistant</span>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-8">
                    {/* Conversation loading skeleton */}
                    {isLoadingHistory && (
                        <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`flex gap-4 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`h-12 rounded-2xl bg-white/5 ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoadingHistory && messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="w-16 h-16 rounded-2xl bg-primary-600/10 border border-primary-500/20 flex items-center justify-center mb-6">
                                <Sparkles className="w-8 h-8 text-primary-400" />
                            </div>
                            <h2 className="text-2xl font-semibold text-white mb-2">How can I help you?</h2>
                            <p className="text-white/30 max-w-md px-4">
                                Ask me to check your calendar, search your files, or find notes. I'll use the right tools automatically.
                            </p>

                            {/* Quick actions */}
                            <div className="flex flex-wrap justify-center gap-3 mt-8 px-4">
                                {[
                                    'What meetings do I have today?',
                                    'Search my Drive for invoices',
                                    'Find my project notes in Notion',
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => {
                                            const fakeEvent = {
                                                target: { value: suggestion },
                                            } as React.ChangeEvent<HTMLInputElement>;
                                            handleInputChange(fakeEvent);
                                        }}
                                        className="px-4 py-2 rounded-xl glass text-sm text-white/50 hover:text-white/80 hover:bg-white/10 transition-all text-left"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isLoadingHistory && (
                        <div className="max-w-3xl mx-auto space-y-6">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-4 animate-slide-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                                        }`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0 mt-1 hidden md:flex">
                                            <Bot className="w-4 h-4 text-primary-400" />
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-[85%] md:max-w-[75%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                            ? 'bg-primary-600 text-white rounded-br-md'
                                            : 'glass text-white/90 rounded-bl-md'
                                            }`}
                                    >
                                        <div className="prose prose-invert prose-sm max-w-none break-words">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary-300 hover:text-primary-200 underline" />,
                                                    ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4 space-y-1" />,
                                                    ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-4 space-y-1" />,
                                                    li: ({ node, ...props }) => <li {...props} className="marker:text-white/50" />,
                                                    p: ({ node, ...props }) => <p {...props} className="mb-2 last:mb-0" />,
                                                    code: ({ node, className, children, ...props }: any) => {
                                                        const match = /language-(\w+)/.exec(className || '')
                                                        return match ? (
                                                            <div className="relative group my-3">
                                                                <div className="absolute -top-3 right-2 text-[10px] text-white/40 uppercase bg-black/50 px-2 py-0.5 rounded">
                                                                    {match[1]}
                                                                </div>
                                                                <code className={`${className} block bg-black/30 p-3 rounded-lg overflow-x-auto`} {...props}>
                                                                    {children}
                                                                </code>
                                                            </div>
                                                        ) : (
                                                            <code className="bg-white/10 px-1 py-0.5 rounded text-primary-200 font-mono text-xs" {...props}>
                                                                {children}
                                                            </code>
                                                        )
                                                    }
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>

                                        {/* Rich Tool Results */}
                                        {msg.toolInvocations && msg.toolInvocations.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {msg.toolInvocations.map((t: any, i: number) => (
                                                    <ToolResult
                                                        key={i}
                                                        toolName={t.toolName}
                                                        result={t.result}
                                                        args={t.args}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex gap-4 animate-fade-in">
                                    <div className="w-8 h-8 rounded-lg bg-primary-600/20 border border-primary-500/30 flex items-center justify-center flex-shrink-0 hidden md:flex">
                                        <Bot className="w-4 h-4 text-primary-400" />
                                    </div>
                                    <div className="glass px-5 py-3.5 rounded-2xl rounded-bl-md">
                                        <div className="flex items-center gap-2 text-white/40 text-sm">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Thinking...
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Inline error / chat error */}
                {(inlineError || error) && (
                    <div className="px-6">
                        <div className="max-w-3xl mx-auto p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4 flex items-center justify-between">
                            <span>{inlineError || error?.message || 'An error occurred. Please check your API key in Settings.'}</span>
                            <button onClick={() => setInlineError(null)} className="ml-3 hover:text-red-300 flex-shrink-0">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Input */}
                <div className="border-t border-white/5 p-4 md:p-6 bg-surface-900">
                    <div className="max-w-3xl mx-auto relative">
                        {attachment && (
                            <div className="absolute -top-12 left-0 right-0 glass px-4 py-2 rounded-xl flex items-center justify-between animate-fade-in mx-1 border border-white/10">
                                <span className="text-xs text-primary-300 font-medium truncate flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
                                    {attachment.name}
                                </span>
                                <button
                                    onClick={() => setAttachment(null)}
                                    className="text-white/40 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                            accept=".txt,.md,.json,.js,.ts,.tsx,.csv,.py,.java,.c,.cpp,.h,.css,.html,.xml,.yml,.yaml"
                        />

                        <form
                            onSubmit={handleCustomSubmit}
                            className="relative flex items-end gap-2"
                        >
                            <div className="relative flex-1">
                                <input
                                    value={input}
                                    onChange={handleInputChange}
                                    placeholder="Ask me anything..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 py-4
                                 text-white placeholder-white/20 focus:outline-none focus:ring-2
                                 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
                                />

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg
                                    hover:bg-white/5 text-white/40 hover:text-white transition-all flex items-center justify-center"
                                    title="Attach file"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                </button>

                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg
                                    transition-all flex items-center justify-center ${isListening
                                            ? 'text-red-400 bg-red-400/10 animate-pulse'
                                            : 'text-white/40 hover:text-white hover:bg-white/5'
                                        }`}
                                    title="Voice Input"
                                >
                                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading || (!input.trim() && !attachment)}
                                className="w-14 h-[58px] rounded-xl
                             bg-primary-600 hover:bg-primary-500 disabled:opacity-30 disabled:hover:bg-primary-600
                             flex items-center justify-center transition-all flex-shrink-0"
                            >
                                <Send className="w-5 h-5 text-white" />
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}
