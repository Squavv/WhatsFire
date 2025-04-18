'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'; // Assuming shadcn/ui dialog
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { User } from 'lucide-react'; // Placeholder icon

interface UserData {
    uid: string;
    displayName: string;
    photoURL: string;
    email?: string; // Optional
}

interface NewChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
    const { currentUser } = useAuth();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            if (searchQuery.trim().length > 1 && currentUser) { // Search only if query is long enough
                performSearch();
            } else {
                setSearchResults([]); // Clear results if query is short
            }
        }, 500); // 500ms debounce

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery, currentUser]);

    const performSearch = async () => {
        if (!currentUser || !searchQuery.trim()) return;
        setIsLoading(true);
        setError(null);
        setSearchResults([]);

        try {
            const usersRef = collection(db, 'users');
            // Simple prefix search on displayName (case-insensitive might require more complex setup or backend function)
            // For now, let's do a basic >= and < query which works for prefixes
            const q = query(
                usersRef,
                where('displayName', '>=', searchQuery),
                where('displayName', '<=', searchQuery + '\uf8ff'), // Firestore trick for prefix search
                limit(10) // Limit results
            );

            const querySnapshot = await getDocs(q);
            const users: UserData[] = [];
            querySnapshot.forEach((doc) => {
                // Exclude the current user from search results
                if (doc.id !== currentUser.uid) {
                    users.push({ uid: doc.id, ...doc.data() } as UserData);
                }
            });
            setSearchResults(users);
        } catch (err) {
            console.error("Error searching users:", err);
            setError("Failed to search users. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectUser = async (selectedUser: UserData) => {
        if (!currentUser) return;
        setIsLoading(true);
        setError(null);

        try {
            // 1. Check if a direct conversation already exists
            const conversationsRef = collection(db, 'conversations');
            const q = query(
                conversationsRef,
                where('isGroup', '==', false), // Ensure it's a direct chat
                where('participants', 'array-contains', currentUser.uid)
                // We need a composite index for this query (participants + participants)
                // Firestore doesn't directly support querying for two specific elements in an array.
                // A common workaround is to store participants sorted or in a map.
                // For simplicity here, we'll query for one participant and filter client-side,
                // OR create a new chat and rely on Firestore rules/logic to prevent duplicates if possible.
                // Let's try creating first and handle potential duplicates later or assume it's okay for now.
            );

            const existingChatsSnapshot = await getDocs(q);
            let existingChatId: string | null = null;

            existingChatsSnapshot.forEach(doc => {
                const participants = doc.data().participants as string[];
                if (participants.includes(selectedUser.uid)) {
                    existingChatId = doc.id;
                }
            });


            if (existingChatId) {
                // Conversation exists, navigate to it
                router.push(`/chats/${existingChatId}`);
                onClose(); // Close the modal
            } else {
                // 2. Create a new conversation
                const newConversationRef = await addDoc(conversationsRef, {
                    participants: [currentUser.uid, selectedUser.uid],
                    isGroup: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastMessage: null, // No messages yet
                });
                router.push(`/chats/${newConversationRef.id}`);
                onClose(); // Close the modal
            }

        } catch (err) {
            console.error("Error starting chat:", err);
            setError("Failed to start chat. Please try again.");
            setIsLoading(false); // Keep modal open on error
        }
        // Don't set isLoading to false here if navigation occurs
    };


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Start New Chat</DialogTitle>
                    <DialogDescription>
                        Search for users to start a one-on-one conversation.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Input
                        id="search-user"
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={isLoading}
                    />
                    {isLoading && <p className="text-sm text-gray-500">Searching...</p>}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {searchResults.length > 0 ? (
                            searchResults.map((user) => (
                                <div
                                    key={user.uid}
                                    className="flex items-center p-2 hover:bg-gray-100 rounded-md cursor-pointer"
                                    onClick={() => handleSelectUser(user)}
                                >
                                    <div className="relative h-10 w-10 rounded-full overflow-hidden mr-3">
                                        <Image
                                            src={user.photoURL || '/user-placeholder.png'}
                                            alt={user.displayName}
                                            fill
                                            className="object-cover"
                                            onError={(e) => { e.currentTarget.src = '/user-placeholder.png'; }}
                                        />
                                    </div>
                                    <div>
                                        <p className="font-medium">{user.displayName}</p>
                                        {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
                                    </div>
                                </div>
                            ))
                        ) : (
                            searchQuery.trim().length > 1 && !isLoading && (
                                <p className="text-sm text-gray-500 text-center py-4">No users found matching "{searchQuery}".</p>
                            )
                        )}
                        {searchQuery.trim().length <= 1 && !isLoading && (
                            <p className="text-sm text-gray-500 text-center py-4">Enter at least 2 characters to search.</p>
                        )}
                    </div>
                </div>
                {/* Footer might not be needed if selection happens in the list */}
                {/* <DialogFooter>
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                </DialogFooter> */}
            </DialogContent>
        </Dialog>
    );
}
