'use client';

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Login from "./Login";

interface RouteGuardProps {
    children: React.ReactNode;
}

export default function RouteGuard({ children }: RouteGuardProps) {
    const { currentUser, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const publicPaths = ['/'];
    const isPublicPath = publicPaths.includes(pathname);

    useEffect(() => {
        // Auth logic
        if (!loading) {
            if (!currentUser && !isPublicPath) {
                // Redirect to login if trying to access a protected route without auth
                router.push('/');
            } else if (currentUser && isPublicPath) {
                // Redirect to chats if already authenticated and trying to access login
                router.push('/chats');
            }
        }
    }, [currentUser, loading, isPublicPath, router]);

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    // If trying to access protected route without auth, show login page
    if (!currentUser && !isPublicPath) {
        return <Login />;
    }

    // If trying to access login when already authenticated, redirect handled in effect
    // If correctly authenticated or accessing public path, show the requested page
    return <>{children}</>;
}