'use client';

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useParams } from "next/navigation";
import ChatMessages from "@/components/chat/ChatMessages";
import MessageInput from "@/components/chat/MessageInput";
import CallInterface from "@/components/calls/CallInterface";
import IncomingCallDialog from "@/components/calls/IncomingCallDialog";
import Image from "next/image";
import { ArrowLeft, Phone, Video, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ChatPartner {
    uid: string;
    displayName: string;
    photoURL: string;
    online: boolean;
    lastSeen: any;
    email: string;
}

export default function ChatPage() {
    const { currentUser } = useAuth();
    const params = useParams();
    const chatId = params.chatId as string;

    const [conversationId, setConversationId] = useState<string | null>(null);
    const [chatPartner, setChatPartner] = useState<ChatPartner | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeCall, setActiveCall] = useState<{ type: 'audio' | 'video' } | null>(null);

    // Initialize chat and get or create conversation
    useEffect(() => {
        const initializeChat = async () => {
            if (!currentUser || !chatId) return;

            try {
                setLoading(true);

                // First, check if chatId is a userId or conversationId
                let partnerId = chatId;
                let convoId = chatId;

                // If chatId looks like a userId (not a conversation id)
                if (!chatId.includes('_')) {
                    // Check if this is a valid user ID
                    const userDoc = await getDoc(doc(db, "users", chatId));

                    if (userDoc.exists()) {
                        // This is a user ID, set chat partner
                        setChatPartner(userDoc.data() as ChatPartner);

                        // Try to find existing conversation between these users
                        const potentialConvoId1 = `${currentUser.uid}_${chatId}`;
                        const potentialConvoId2 = `${chatId}_${currentUser.uid}`;

                        const convo1Doc = await getDoc(doc(db, "conversations", potentialConvoId1));
                        const convo2Doc = await getDoc(doc(db, "conversations", potentialConvoId2));

                        if (convo1Doc.exists()) {
                            convoId = potentialConvoId1;
                        } else if (convo2Doc.exists()) {
                            convoId = potentialConvoId2;
                        } else {
                            // Create new conversation
                            convoId = `${currentUser.uid}_${chatId}`;
                            await setDoc(doc(db, "conversations", convoId), {
                                participants: [currentUser.uid, chatId],
                                createdAt: serverTimestamp(),
                                lastMessage: {
                                    text: "",
                                    timestamp: null,
                                    senderId: "",
                                },
                            });
                        }
                    } else {
                        // This is not a valid user ID, try as conversation ID
                        const convoDoc = await getDoc(doc(db, "conversations", chatId));

                        if (convoDoc.exists()) {
                            // This is a conversation ID
                            const participants = convoDoc.data().participants || [];
                            partnerId = participants.find((id: string) => id !== currentUser.uid) || "";

                            // Get chat partner info
                            if (partnerId) {
                                const partnerDoc = await getDoc(doc(db, "users", partnerId));
                                if (partnerDoc.exists()) {
                                    setChatPartner(partnerDoc.data() as ChatPartner);
                                }
                            }
                        }
                    }
                } else {
                    // This is likely a conversation ID in format uid1_uid2
                    const participantIds = chatId.split('_');
                    partnerId = participantIds.find(id => id !== currentUser.uid) || "";

                    // Get chat partner info
                    if (partnerId) {
                        const partnerDoc = await getDoc(doc(db, "users", partnerId));
                        if (partnerDoc.exists()) {
                            setChatPartner(partnerDoc.data() as ChatPartner);
                        }
                    }
                }

                setConversationId(convoId);
            } catch (error) {
                console.error("Error initializing chat:", error);
            } finally {
                setLoading(false);
            }
        };

        initializeChat();
    }, [chatId, currentUser]);

    // Format last seen time
    const formatLastSeen = () => {
        if (!chatPartner?.lastSeen) return "Last seen: Unknown";

        try {
            const lastSeenDate = chatPartner.lastSeen.toDate();
            return `Last seen: ${lastSeenDate.toLocaleString()}`;
        } catch (error) {
            return "Last seen: Recently";
        }
    };

    // Start a call
    const startCall = (callType: 'audio' | 'video') => {
        if (!chatPartner || !conversationId) return;
        setActiveCall({ type: callType });
    };

    // End a call
    const endCall = () => {
        setActiveCall(null);
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    // If there's an active call, show the call interface
    if (activeCall && chatPartner && conversationId) {
        return (
            <CallInterface
                recipientId={chatPartner.uid}
                conversationId={conversationId}
                callType={activeCall.type}
                isIncoming={false}
                onEndCall={endCall}
            />
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Incoming call dialog (always rendered to listen for calls) */}
            <IncomingCallDialog />

            {/* Chat header */}
            <header className="bg-gray-50 p-3 flex items-center border-b">
                <Link href="/chats" className="mr-2">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>

                {chatPartner ? (
                    <>
                        <div className="flex items-center flex-1">
                            <div className="relative">
                                {chatPartner.photoURL ? (
                                    <Image
                                        src={chatPartner.photoURL}
                                        alt={chatPartner.displayName || "User"}
                                        width={40}
                                        height={40}
                                        className="rounded-full"
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                                        {chatPartner.displayName?.charAt(0) || 'U'}
                                    </div>
                                )}
                                <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white ${chatPartner.online ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            </div>

                            <div className="ml-3">
                                <h2 className="font-medium">{chatPartner.displayName}</h2>
                                <p className="text-xs text-gray-500">
                                    {chatPartner.online ? 'Online' : formatLastSeen()}
                                </p>
                            </div>
                        </div>

                        <div className="flex">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startCall('audio')}
                            >
                                <Phone className="h-5 w-5 text-gray-600" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startCall('video')}
                            >
                                <Video className="h-5 w-5 text-gray-600" />
                            </Button>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-5 w-5 text-gray-600" />
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1">
                        <h2 className="font-medium">Chat</h2>
                    </div>
                )}
            </header>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
                {conversationId && (
                    <ChatMessages
                        conversationId={conversationId}
                        recipientId={chatPartner?.uid}
                    />
                )}
            </div>

            {/* Message input */}
            {conversationId && (
                <MessageInput
                    conversationId={conversationId}
                    recipientId={chatPartner?.uid}
                />
            )}
        </div>
    );
}