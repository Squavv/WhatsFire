'use client';

import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/sidebar/Sidebar";

export default function ChatsLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { currentUser } = useAuth();

    if (!currentUser) {
        return null; // RouteGuard will handle redirecting if not authenticated
    }

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Left sidebar - contacts and conversations list */}
            <aside className="w-1/4 min-w-[300px] max-w-[400px] bg-white border-r border-gray-200">
                <Sidebar />
            </aside>

            {/* Main chat area */}
            <main className="flex-1 flex flex-col">
                {children}
            </main>
        </div>
    );
}