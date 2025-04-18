'use client';

import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import { useState, useRef, useEffect } from "react";
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    serverTimestamp,
    Timestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import {
    Mic,
    PaperclipIcon,
    Send,
    Camera,
    File as FileIcon,
    X,
    Image as ImageIcon,
    Loader2
} from "lucide-react";
import { formatFileSize } from "@/lib/utils";

interface MessageInputProps {
    conversationId: string;
    recipientId?: string;
}

export default function MessageInput({ conversationId, recipientId }: MessageInputProps) {
    const { currentUser } = useAuth();
    const [message, setMessage] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'image' | 'file' | null>(null);
    const [isSending, setIsSending] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Update typing status
    useEffect(() => {
        if (!currentUser || !conversationId) return;

        if (message.trim() && !isTyping) {
            setIsTyping(true);
            updateTypingStatus(true);
        }

        // Clear previous timer
        if (typingTimerRef.current) {
            clearTimeout(typingTimerRef.current);
        }

        // Set timer to clear typing status after user stops typing
        typingTimerRef.current = setTimeout(() => {
            if (isTyping) {
                setIsTyping(false);
                updateTypingStatus(false);
            }
        }, 2000);

        return () => {
            if (typingTimerRef.current) {
                clearTimeout(typingTimerRef.current);
            }
        };
    }, [message, currentUser, conversationId, isTyping]);

    // Cleanup typing status when unmounting
    useEffect(() => {
        return () => {
            if (currentUser && conversationId) {
                updateTypingStatus(false);
            }
        };
    }, [currentUser, conversationId]);

    // Update typing status in Firestore
    const updateTypingStatus = async (typing: boolean) => {
        if (!currentUser || !conversationId) return;

        try {
            await updateDoc(doc(db, "conversations", conversationId, "typing", currentUser.uid), {
                isTyping: typing,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            // If document doesn't exist, create it
            try {
                await addDoc(collection(db, "conversations", conversationId, "typing"), {
                    uid: currentUser.uid,
                    isTyping: typing,
                    timestamp: serverTimestamp()
                });
            } catch (error) {
                console.error("Error updating typing status:", error);
            }
        }
    };

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);

        // Determine if it's an image or other file
        if (file.type.startsWith('image/')) {
            setFileType('image');
            const reader = new FileReader();
            reader.onload = (e) => {
                setFilePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setFileType('file');
            setFilePreview(null);
        }
    };

    // Trigger file input click
    const handleAttachmentClick = () => {
        fileInputRef.current?.click();
    };

    // Clear selected file
    const clearSelectedFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        setFileType(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Send message function
    const sendMessage = async () => {
        if ((!message.trim() && !selectedFile) || !currentUser || !conversationId || isSending) {
            return;
        }

        setIsSending(true);

        try {
            let mediaUrl = null;
            let mediaType = null;

            // Upload file if selected
            if (selectedFile) {
                const storageRef = ref(storage, `messages/${conversationId}/${uuidv4()}-${selectedFile.name}`);
                await uploadBytes(storageRef, selectedFile);
                mediaUrl = await getDownloadURL(storageRef);
                mediaType = fileType;
            }

            // Add message to Firestore
            await addDoc(collection(db, "conversations", conversationId, "messages"), {
                text: message.trim(),
                senderId: currentUser.uid,
                timestamp: serverTimestamp(),
                delivered: false,  // Add delivered field (false by default)
                read: false,
                deleted: false,
                ...(mediaUrl && { mediaUrl, mediaType })
            });

            // Update conversation's last message and timestamp
            await updateDoc(doc(db, "conversations", conversationId), {
                lastMessage: {
                    text: mediaType ? `[${mediaType === 'image' ? 'Image' : 'File'}] ${message.trim() || ''}` : message.trim(),
                    timestamp: Timestamp.now(),
                    senderId: currentUser.uid
                },
                updatedAt: serverTimestamp()
            });

            // Clear message and file
            setMessage("");
            clearSelectedFile();
            setIsTyping(false);
            updateTypingStatus(false);
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    // Handle Enter key press
    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="p-3 bg-gray-50 border-t">
            {/* File preview */}
            {selectedFile && (
                <div className="mb-3 p-2 bg-white rounded-md relative">
                    <button
                        onClick={clearSelectedFile}
                        className="absolute top-1 right-1 bg-gray-200 rounded-full p-1"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    {fileType === 'image' && filePreview && (
                        <div className="relative h-32 mb-1">
                            <img
                                src={filePreview}
                                alt="Selected file"
                                className="h-full max-w-full object-contain mx-auto rounded-md"
                            />
                        </div>
                    )}

                    {fileType === 'file' && (
                        <div className="flex items-center mb-1">
                            <FileIcon className="h-6 w-6 text-blue-500 mr-2" />
                            <div className="text-sm truncate flex-1">
                                {selectedFile.name}
                            </div>
                        </div>
                    )}

                    <div className="text-xs text-gray-500">
                        {formatFileSize(selectedFile.size)}
                    </div>
                </div>
            )}

            <div className="flex items-end space-x-2">
                {/* File input (hidden) */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,video/*,audio/*,application/*"
                />

                {/* Attachment button */}
                <button
                    className="p-2 rounded-full hover:bg-gray-200"
                    onClick={handleAttachmentClick}
                >
                    <PaperclipIcon className="h-5 w-5 text-gray-600" />
                </button>

                {/* Camera button */}
                <button
                    className="p-2 rounded-full hover:bg-gray-200"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Camera className="h-5 w-5 text-gray-600" />
                </button>

                {/* Message input */}
                <div className="flex-1 bg-white rounded-lg flex items-end">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type a message"
                        className="flex-1 p-2 max-h-32 focus:outline-none resize-none"
                        rows={1}
                        style={{
                            height: Math.min(Math.max(message.split('\n').length, 1) * 24, 96) + 'px'
                        }}
                    />
                </div>

                {/* Send or voice record button */}
                {message.trim() || selectedFile ? (
                    <button
                        className="p-2 rounded-full bg-green-500 hover:bg-green-600 text-white"
                        onClick={sendMessage}
                        disabled={isSending}
                    >
                        {isSending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Send className="h-5 w-5" />
                        )}
                    </button>
                ) : (
                    <button
                        className="p-2 rounded-full hover:bg-gray-200"
                        onClick={() => setIsRecording(!isRecording)}
                    >
                        <Mic className="h-5 w-5 text-gray-600" />
                    </button>
                )}
            </div>

            {/* Voice recording indicator (would implement in real app) */}
            {isRecording && (
                <div className="mt-2 text-xs text-red-500 animate-pulse flex items-center justify-center">
                    <span className="h-2 w-2 rounded-full bg-red-500 mr-1" /> Recording...
                </div>
            )}
        </div>
    );
}