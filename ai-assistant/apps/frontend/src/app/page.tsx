'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/api';
import { Bot, Calendar, HardDrive, BookOpen, ArrowRight } from 'lucide-react';

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        if (isAuthenticated()) {
            router.push('/chat');
        }
    }, [router]);

    return (
        <main className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-950 via-surface-900 to-surface-900" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-400/5 rounded-full blur-3xl" />

            <div className="relative z-10 text-center px-6 max-w-3xl animate-fade-in">
                {/* Logo */}
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-600/20 border border-primary-500/30 mb-8 animate-pulse-glow">
                    <Bot className="w-10 h-10 text-primary-400" />
                </div>

                <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-white via-white to-primary-300 bg-clip-text text-transparent mb-6">
                    AI Assistant
                </h1>

                <p className="text-xl text-white/50 mb-12 leading-relaxed">
                    Your intelligent productivity hub. Connect Google Calendar, Drive, and Notion
                    — let AI manage your workflow.
                </p>

                {/* Feature badges */}
                <div className="flex flex-wrap justify-center gap-4 mb-12">
                    {[
                        { icon: Calendar, label: 'Google Calendar' },
                        { icon: HardDrive, label: 'Google Drive' },
                        { icon: BookOpen, label: 'Notion' },
                    ].map(({ icon: Icon, label }) => (
                        <div
                            key={label}
                            className="flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-white/60"
                        >
                            <Icon className="w-4 h-4 text-primary-400" />
                            {label}
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={() => router.push('/register')}
                        className="btn-primary flex items-center gap-2 text-lg px-8 py-4"
                    >
                        Get Started
                        <ArrowRight className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => router.push('/login')}
                        className="btn-ghost text-lg px-8 py-4"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        </main>
    );
}
