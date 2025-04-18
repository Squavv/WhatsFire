'use client';

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useState } from "react";
import { doc, updateDoc, arrayUnion, deleteField } from "firebase/firestore";
import {
    Smile,
    Trash2,
    Reply,
    MoreHorizontal,
    Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageOptionsProps {
    messageId: string;
    conversationId: string;
    senderId: string;
    timestamp: any;
}

export default function MessageOptions({
    messageId,
    conversationId,
    senderId,
    timestamp
}: MessageOptionsProps) {
    const { currentUser } = useAuth();
    const [showReactions, setShowReactions] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    // Check if current user is the message sender
    const isMessageSender = currentUser?.uid === senderId;

    // Check if message is recent (less than 1 hour) for deletion
    const isRecent = () => {
        if (!timestamp) return false;

        try {
            const messageTime = timestamp.toDate();
            const oneHourAgo = new Date();
            oneHourAgo.setHours(oneHourAgo.getHours() - 1);

            return messageTime > oneHourAgo;
        } catch (e) {
            return false;
        }
    };

    const canDelete = isMessageSender && isRecent();

    // Available reactions
    const reactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

    // Add reaction to message
    const addReaction = async (emoji: string) => {
        if (!currentUser) return;

        try {
            const messageRef = doc(db, "conversations", conversationId, "messages", messageId);

            // Update reactions map with the user's choice
            await updateDoc(messageRef, {
                [`reactions.${currentUser.uid}`]: emoji
            });

            // Hide reactions panel
            setShowReactions(false);
        } catch (error) {
            console.error("Error adding reaction:", error);
        }
    };

    // Remove reaction
    const removeReaction = async () => {
        if (!currentUser) return;

        try {
            const messageRef = doc(db, "conversations", conversationId, "messages", messageId);

            // Remove the user's reaction
            await updateDoc(messageRef, {
                [`reactions.${currentUser.uid}`]: deleteField()
            });
        } catch (error) {
            console.error("Error removing reaction:", error);
        }
    };

    // Delete message (mark as deleted)
    const deleteMessage = async () => {
        if (!canDelete) return;

        try {
            const messageRef = doc(db, "conversations", conversationId, "messages", messageId);

            // Mark message as deleted instead of actually deleting
            // This maintains the conversation flow
            await updateDoc(messageRef, {
                deleted: true,
                text: "",
                mediaUrl: null,
                reactions: {}
            });

            // Hide options
            setShowOptions(false);
        } catch (error) {
            console.error("Error deleting message:", error);
        }
    };

    // Copy message text (would implement in real app)
    const copyMessageText = () => {
        // In a real app, this would copy the message text to clipboard
        console.log("Copying message text...");
        setShowOptions(false);
    };

    // Reply to message (would implement in real app)
    const replyToMessage = () => {
        // In a real app, this would setup the message input for a reply
        console.log("Reply to message...");
        setShowOptions(false);
    };

    return (
        <div className="relative">
            {/* Main options button */}
            <Button
                variant="secondary"
                size="icon"
                className="h-6 w-6 rounded-full bg-white shadow-md"
                onClick={() => setShowOptions(!showOptions)}
            >
                <MoreHorizontal className="h-3 w-3" />
            </Button>

            {/* Options dropdown */}
            {showOptions && (
                <div className="absolute z-10 bg-white rounded-md shadow-lg p-1 w-36 -translate-y-full mb-2">
                    <ul className="text-sm">
                        <li>
                            <button
                                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-100 rounded-md"
                                onClick={() => {
                                    setShowReactions(!showReactions);
                                }}
                            >
                                <Smile className="h-4 w-4" />
                                <span>React</span>
                            </button>
                        </li>
                        <li>
                            <button
                                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-100 rounded-md"
                                onClick={replyToMessage}
                            >
                                <Reply className="h-4 w-4" />
                                <span>Reply</span>
                            </button>
                        </li>
                        <li>
                            <button
                                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-100 rounded-md"
                                onClick={copyMessageText}
                            >
                                <Copy className="h-4 w-4" />
                                <span>Copy</span>
                            </button>
                        </li>
                        {canDelete && (
                            <li>
                                <button
                                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-100 rounded-md text-red-600"
                                    onClick={deleteMessage}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Delete</span>
                                </button>
                            </li>
                        )}
                    </ul>
                </div>
            )}

            {/* Reactions panel */}
            {showReactions && (
                <div className="absolute z-10 bg-white rounded-full shadow-lg p-2 -translate-y-full mb-2">
                    <div className="flex space-x-2">
                        {reactions.map((emoji) => (
                            <button
                                key={emoji}
                                onClick={() => addReaction(emoji)}
                                className="hover:bg-gray-100 p-1 rounded-full transition-colors"
                            >
                                <span className="text-xl">{emoji}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}