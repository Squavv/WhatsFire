'use client';

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useEffect, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from "firebase/firestore";
import Image from "next/image";
import { Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import MessageOptions from "./MessageOptions";

interface Message {
    id: string;
    text: string;
    senderId: string;
    timestamp: any;
    delivered: boolean;    // New field to track if message was delivered
    read: boolean;
    deleted: boolean;
    mediaUrl?: string;
    mediaType?: 'image' | 'file' | 'voice';
    reactions?: {
        [userId: string]: string; // emoji
    };
}

interface ChatMessagesProps {
    conversationId: string;
    recipientId?: string;
}

export default function ChatMessages({ conversationId, recipientId }: ChatMessagesProps) {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [recipient, setRecipient] = useState<any>(null);
    const [typing, setTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isTabVisible, setIsTabVisible] = useState(true);

    // Track tab visibility
    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsTabVisible(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Fetch recipient user data
    useEffect(() => {
        if (!recipientId) return;

        const fetchRecipient = async () => {
            try {
                const userDoc = await getDoc(doc(db, "users", recipientId));
                if (userDoc.exists()) {
                    setRecipient(userDoc.data());
                }
            } catch (error) {
                console.error("Error fetching recipient:", error);
            }
        };

        fetchRecipient();
    }, [recipientId]);

    // Fetch messages for this conversation
    useEffect(() => {
        if (!conversationId || !currentUser) return;

        const q = query(
            collection(db, "conversations", conversationId, "messages"),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages: Message[] = [];
            let unreadMessagesToUpdate: string[] = [];
            let undeliveredMessagesToUpdate: string[] = [];

            snapshot.forEach((doc) => {
                const messageData = doc.data();
                fetchedMessages.push({ id: doc.id, ...messageData } as Message);

                // If message is from the other user and not marked as delivered, mark it as delivered
                if (
                    messageData.senderId !== currentUser.uid &&
                    !messageData.delivered
                ) {
                    undeliveredMessagesToUpdate.push(doc.id);
                }

                // Mark messages as read only if the tab is active and the user is viewing the conversation
                if (
                    messageData.senderId !== currentUser.uid &&
                    !messageData.read &&
                    isTabVisible
                ) {
                    unreadMessagesToUpdate.push(doc.id);
                }
            });

            setMessages(fetchedMessages);

            // Batch update delivered status
            if (undeliveredMessagesToUpdate.length > 0) {
                const batch = writeBatch(db);
                undeliveredMessagesToUpdate.forEach(messageId => {
                    batch.update(doc(db, "conversations", conversationId, "messages", messageId), {
                        delivered: true
                    });
                });
                batch.commit().catch(err => console.error("Error marking messages as delivered:", err));
            }

            // Batch update read status if tab is visible
            if (isTabVisible && unreadMessagesToUpdate.length > 0) {
                const batch = writeBatch(db);
                unreadMessagesToUpdate.forEach(messageId => {
                    batch.update(doc(db, "conversations", conversationId, "messages", messageId), {
                        read: true
                    });
                });
                batch.commit().catch(err => console.error("Error marking messages as read:", err));
            }

            scrollToBottom();
        });

        return () => unsubscribe();
    }, [conversationId, currentUser, isTabVisible]);

    // Mark messages as read when tab becomes visible
    useEffect(() => {
        if (!isTabVisible || !conversationId || !currentUser) return;

        const markMessagesAsRead = async () => {
            try {
                const q = query(
                    collection(db, "conversations", conversationId, "messages"),
                    where("senderId", "!=", currentUser.uid),
                    where("read", "==", false),
                    where("delivered", "==", true)
                );

                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const batch = writeBatch(db);
                    snapshot.forEach(doc => {
                        batch.update(doc.ref, { read: true });
                    });
                    await batch.commit();
                }
            } catch (error) {
                console.error("Error marking messages as read:", error);
            }
        };

        markMessagesAsRead();
    }, [isTabVisible, conversationId, currentUser]);

    // Listen for typing indicator
    useEffect(() => {
        if (!conversationId || !recipientId) return;

        const typingRef = doc(db, "conversations", conversationId, "typing", recipientId);

        const unsubscribe = onSnapshot(typingRef, (doc) => {
            if (doc.exists()) {
                setTyping(doc.data().isTyping || false);
            } else {
                setTyping(false);
            }
        });

        return () => unsubscribe();
    }, [conversationId, recipientId]);

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Format timestamp to readable format
    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return "";

        try {
            const date = timestamp.toDate();
            return format(date, "h:mm a");
        } catch (e) {
            return "";
        }
    };

    // Get message status indicator
    const getMessageStatus = (message: Message) => {
        if (message.senderId !== currentUser?.uid) return null;

        if (message.read) {
            return <CheckCheck className="h-4 w-4 text-blue-500" title="Seen" />;
        } else if (message.delivered) {
            return <CheckCheck className="h-4 w-4 text-gray-500" title="Delivered" />;
        } else {
            return <Check className="h-4 w-4 text-gray-500" title="Sent" />;
        }
    };

    // Get reactions for a message
    const getReactions = (message: Message) => {
        if (!message.reactions) return null;

        const reactionsList = Object.entries(message.reactions);
        if (reactionsList.length === 0) return null;

        return (
            <div className="flex space-x-1 mt-1">
                {reactionsList.map(([userId, emoji]) => (
                    <span
                        key={userId}
                        className="text-xs bg-gray-200 rounded-full px-2 py-1"
                    >
                        {emoji}
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            {messages.length > 0 ? (
                messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex flex-col mb-4 max-w-[70%] group ${message.senderId === currentUser?.uid
                            ? "self-end"
                            : "self-start"
                            }`}
                    >
                        <div
                            className={`rounded-lg px-4 py-2 relative ${message.senderId === currentUser?.uid
                                ? "bg-green-100 text-gray-800"
                                : "bg-white border border-gray-200"
                                }`}
                        >
                            {message.deleted ? (
                                <span className="italic text-gray-500">This message was deleted</span>
                            ) : (
                                <>
                                    {message.mediaUrl && message.mediaType === "image" && (
                                        <div className="mb-2">
                                            <Image
                                                src={message.mediaUrl}
                                                alt="Shared image"
                                                width={200}
                                                height={150}
                                                className="rounded-md object-cover"
                                            />
                                        </div>
                                    )}

                                    {message.mediaUrl && message.mediaType === "file" && (
                                        <div className="flex items-center mb-2 text-blue-500 underline">
                                            <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
                                                View attached file
                                            </a>
                                        </div>
                                    )}

                                    <p>{message.text}</p>
                                </>
                            )}

                            {getReactions(message)}

                            {/* Message options (visible on hover) */}
                            <div
                                className={`absolute ${message.senderId === currentUser?.uid ? "left-0" : "right-0"
                                    } top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity`}
                            >
                                <MessageOptions
                                    messageId={message.id}
                                    conversationId={conversationId}
                                    senderId={message.senderId}
                                    timestamp={message.timestamp}
                                />
                            </div>
                        </div>

                        <div className={`flex items-center mt-1 text-xs text-gray-500 ${message.senderId === currentUser?.uid ? "justify-end" : "justify-start"
                            }`}>
                            <span>{formatTimestamp(message.timestamp)}</span>
                            {message.senderId === currentUser?.uid && (
                                <span className="ml-1">{getMessageStatus(message)}</span>
                            )}
                        </div>
                    </div>
                ))
            ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                    <p>No messages yet. Say hello!</p>
                </div>
            )}

            {typing && (
                <div className="self-start max-w-[70%] mb-4">
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                        <div className="flex space-x-1">
                            <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0s" }} />
                            <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.2s" }} />
                            <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.4s" }} />
                        </div>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
}