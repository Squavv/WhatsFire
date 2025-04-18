'use client';

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { formatConversationDate } from "@/lib/utils";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy, getDoc, doc } from "firebase/firestore";
import Link from "next/link";
import Image from "next/image";
import { User, MessageSquare, Phone, Video, Image as ImageIcon, Settings, Users2, Search, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import NewChatModal from "@/components/chat/NewChatModal"; // Import the NewChatModal component

interface Conversation {
    id: string;
    participants: string[];
    participantDetails?: any[];
    lastMessage?: {
        text: string;
        timestamp: any;
        senderId: string;
    };
    isGroup?: boolean;
    groupName?: string;
    groupImage?: string;
    updatedAt?: any;
    createdAt?: any;
}

interface SidebarProps {
    activeConversationId?: string;
}

export default function Sidebar({ activeConversationId }: SidebarProps) {
    const { currentUser } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'calls'>('chats');
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false); // Add state for the modal

    // Fetch user's conversations
    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "conversations"),
            where("participants", "array-contains", currentUser.uid),
            orderBy("updatedAt", "desc")
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const conversationsData: Conversation[] = [];

            snapshot.forEach(doc => {
                const data = doc.data() as Conversation;
                conversationsData.push({
                    id: doc.id,
                    ...data
                });
            });

            // Fetch additional details for each participant
            const conversationsWithDetails = await Promise.all(
                conversationsData.map(async (conversation) => {
                    if (conversation.isGroup) return conversation;

                    // For direct conversations, get the other participant's details
                    const otherParticipantId = conversation.participants.find(
                        id => id !== currentUser.uid
                    );

                    if (!otherParticipantId) return conversation;

                    try {
                        // This would be more efficient with a single batch get in a real app
                        const userDoc = await getDoc(doc(db, "users", otherParticipantId));

                        if (userDoc.exists()) {
                            return {
                                ...conversation,
                                participantDetails: [userDoc.data()]
                            };
                        }
                    } catch (error) {
                        console.error("Error fetching participant details:", error);
                    }

                    return conversation;
                })
            );

            setConversations(conversationsWithDetails);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Filter conversations based on search query
    const filteredConversations = conversations.filter(conversation => {
        if (!searchQuery.trim()) return true;

        const query = searchQuery.toLowerCase();

        if (conversation.isGroup && conversation.groupName) {
            return conversation.groupName.toLowerCase().includes(query);
        }

        // Check participant names
        if (conversation.participantDetails && conversation.participantDetails.length > 0) {
            return conversation.participantDetails.some(
                user => user?.displayName?.toLowerCase().includes(query)
            );
        }

        // If no participant details yet, fallback to checking last message
        return conversation.lastMessage?.text?.toLowerCase().includes(query) || false;
    });

    // Get conversation display name
    const getConversationName = (conversation: Conversation): string => {
        if (conversation.isGroup) {
            return conversation.groupName || "Group Chat";
        }

        // For direct messages, show the other participant's name
        if (conversation.participantDetails && conversation.participantDetails.length > 0) {
            const otherParticipant = conversation.participantDetails.find(
                user => user?.uid !== currentUser?.uid
            );
            return otherParticipant?.displayName || "Unknown User";
        }

        return "Chat";
    };

    // Get conversation avatar
    const getConversationAvatar = (conversation: Conversation): string => {
        if (conversation.isGroup) {
            return conversation.groupImage || "/group-placeholder.png";
        }

        // For direct messages, show the other participant's avatar
        if (conversation.participantDetails && conversation.participantDetails.length > 0) {
            const otherParticipant = conversation.participantDetails.find(
                user => user?.uid !== currentUser?.uid
            );
            return otherParticipant?.photoURL || "/user-placeholder.png";
        }

        return "/user-placeholder.png";
    };

    // Render based on active tab
    const renderContent = () => {
        switch (activeTab) {
            case 'chats':
                return (
                    <div className="flex-1 overflow-y-auto">
                        {filteredConversations.length > 0 ? (
                            filteredConversations.map(conversation => (
                                <Link
                                    key={conversation.id}
                                    href={`/chats/${conversation.id}`}
                                    className={`flex items-center p-3 hover:bg-gray-100 ${activeConversationId === conversation.id ? "bg-gray-100" : ""
                                        }`}
                                >
                                    <div className="relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
                                        <Image
                                            src={getConversationAvatar(conversation)}
                                            alt={getConversationName(conversation)}
                                            fill
                                            className="object-cover"
                                            onError={(e) => {
                                                // Fallback if image fails to load
                                                e.currentTarget.src = conversation.isGroup
                                                    ? "/group-placeholder.png"
                                                    : "/user-placeholder.png";
                                            }}
                                        />
                                    </div>

                                    <div className="ml-3 flex-1 overflow-hidden">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-medium text-gray-900 truncate">
                                                {getConversationName(conversation)}
                                            </h3>
                                            <span className="text-xs text-gray-500">
                                                {formatConversationDate(conversation.updatedAt)}
                                            </span>
                                        </div>

                                        <div className="text-sm text-gray-500 truncate">
                                            {conversation.lastMessage?.senderId === currentUser?.uid && (
                                                <span className="inline-block mr-1">You:</span>
                                            )}
                                            {conversation.lastMessage?.text || "No messages yet"}
                                        </div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-16 text-gray-500">
                                <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
                                <p>{searchQuery ? "No matching chats found" : "No conversations yet"}</p>
                                <p className="text-sm mt-2">Start a new chat to begin messaging</p>
                            </div>
                        )}
                    </div>
                );

            case 'status':
                return (
                    <div className="flex-1 overflow-y-auto">
                        <div className="flex flex-col items-center justify-center h-full py-16 text-gray-500">
                            <ImageIcon className="h-16 w-16 mb-4 opacity-30" />
                            <p>Status updates coming soon</p>
                            <Link
                                href="/stories/create"
                                className="mt-4 px-4 py-2 bg-green-500 text-white rounded-md"
                            >
                                Create Status
                            </Link>
                        </div>
                    </div>
                );

            case 'calls':
                return (
                    <div className="flex-1 overflow-y-auto">
                        <div className="flex flex-col items-center justify-center h-full py-16 text-gray-500">
                            <Phone className="h-16 w-16 mb-4 opacity-30" />
                            <p>Call history coming soon</p>
                            <Button
                                variant="outline"
                                className="mt-4"
                                onClick={() => console.log("Start new call")}
                            >
                                Start New Call
                            </Button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="h-full flex flex-col border-r bg-white">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                {currentUser ? (
                    <div className="flex items-center">
                        <div className="relative h-10 w-10 rounded-full overflow-hidden">
                            <Image
                                src={currentUser.photoURL || "/user-placeholder.png"}
                                alt="Profile"
                                fill
                                className="object-cover"
                                onError={(e) => {
                                    e.currentTarget.src = "/user-placeholder.png";
                                }}
                            />
                        </div>
                        <span className="ml-2 font-medium">
                            {currentUser.displayName || "User"}
                        </span>
                    </div>
                ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200" />
                )}

                <div className="flex space-x-1">
                    {/* New Chat Button - Updated to open modal */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        onClick={() => setIsNewChatModalOpen(true)}
                    >
                        <MessageSquarePlus className="h-5 w-5 text-gray-700" />
                    </Button>
                    <Link href="/chats/group/create">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <Users2 className="h-5 w-5 text-gray-700" />
                        </Button>
                    </Link>
                    <Link href="/settings">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <Settings className="h-5 w-5 text-gray-700" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Search */}
            <div className="p-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search or start new chat"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-2 pl-10 rounded-lg bg-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                </div>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b">
                <button
                    onClick={() => setActiveTab('chats')}
                    className={`flex-1 py-3 text-center font-medium ${activeTab === 'chats'
                        ? 'text-green-500 border-b-2 border-green-500'
                        : 'text-gray-600'
                        }`}
                >
                    Chats
                </button>
                <button
                    onClick={() => setActiveTab('status')}
                    className={`flex-1 py-3 text-center font-medium ${activeTab === 'status'
                        ? 'text-green-500 border-b-2 border-green-500'
                        : 'text-gray-600'
                        }`}
                >
                    Status
                </button>
                <button
                    onClick={() => setActiveTab('calls')}
                    className={`flex-1 py-3 text-center font-medium ${activeTab === 'calls'
                        ? 'text-green-500 border-b-2 border-green-500'
                        : 'text-gray-600'
                        }`}
                >
                    Calls
                </button>
            </div>

            {/* Tab content */}
            {renderContent()}

            {/* New Chat Modal */}
            <NewChatModal
                isOpen={isNewChatModalOpen}
                onClose={() => setIsNewChatModalOpen(false)}
            />
        </div>
    );
}