'use client';

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useState, useEffect, useRef } from "react";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface Status {
    id: string;
    userId: string;
    userName: string;
    userPhotoURL: string;
    caption: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    timestamp: any;
    expiresAt: any;
    viewedBy: string[];
}

interface StatusViewerProps {
    statusId: string;
    onClose: () => void;
    onNext?: () => void;
    onPrevious?: () => void;
}

export default function StatusViewer({ statusId, onClose, onNext, onPrevious }: StatusViewerProps) {
    const { currentUser } = useAuth();
    const [status, setStatus] = useState<Status | null>(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const statusDuration = 5000; // 5 seconds for image status

    // Fetch status data
    useEffect(() => {
        const fetchStatus = async () => {
            if (!statusId) return;

            try {
                setLoading(true);
                const statusDoc = await getDoc(doc(db, "statuses", statusId));

                if (statusDoc.exists()) {
                    setStatus({ id: statusDoc.id, ...statusDoc.data() } as Status);

                    // Mark as viewed if not already viewed by current user
                    if (currentUser && !statusDoc.data().viewedBy.includes(currentUser.uid)) {
                        await updateDoc(doc(db, "statuses", statusId), {
                            viewedBy: arrayUnion(currentUser.uid)
                        });
                    }
                }
            } catch (error) {
                console.error("Error fetching status:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();

        // Clean up any intervals when component unmounts
        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [statusId, currentUser]);

    // Start progress timer for auto-advancing
    useEffect(() => {
        if (!status || loading) return;

        // Reset progress
        setProgress(0);

        // For image statuses, use timer to advance
        if (status.mediaType === 'image') {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }

            const startTime = Date.now();

            progressIntervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const newProgress = (elapsed / statusDuration) * 100;

                if (newProgress >= 100) {
                    clearInterval(progressIntervalRef.current!);
                    if (onNext) {
                        onNext();
                    }
                } else {
                    setProgress(newProgress);
                }
            }, 100);
        }

        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [status, loading, onNext]);

    // Handle video events for progress
    const handleVideoTimeUpdate = () => {
        if (videoRef.current) {
            const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setProgress(currentProgress);
        }
    };

    const handleVideoEnded = () => {
        if (onNext) {
            onNext();
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    if (!status) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 text-white p-4">
                <p className="text-xl mb-4">Status not found</p>
                <Button onClick={onClose} variant="outline" className="text-white border-white">
                    Close
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black flex flex-col z-50">
            {/* Progress bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gray-700 z-10">
                <div
                    className="h-full bg-white"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>

            {/* Header */}
            <div className="p-4 flex items-center z-10">
                <Button
                    onClick={onClose}
                    variant="ghost"
                    size="icon"
                    className="text-white"
                >
                    <X className="h-6 w-6" />
                </Button>

                <div className="flex items-center ml-2">
                    <div className="h-8 w-8 rounded-full overflow-hidden relative">
                        {status.userPhotoURL ? (
                            <Image
                                src={status.userPhotoURL}
                                alt={status.userName}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="h-full w-full bg-green-500 flex items-center justify-center text-white">
                                {status.userName?.charAt(0) || '?'}
                            </div>
                        )}
                    </div>

                    <div className="ml-2">
                        <p className="text-white font-medium">{status.userName}</p>
                        <p className="text-gray-300 text-xs">
                            {status.timestamp?.toDate().toLocaleTimeString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Media */}
            <div className="flex-1 flex items-center justify-center">
                {status.mediaType === 'image' ? (
                    <div className="relative h-full w-full">
                        <Image
                            src={status.mediaUrl}
                            alt={status.caption || "Status"}
                            fill
                            className="object-contain"
                        />
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        src={status.mediaUrl}
                        className="max-h-full max-w-full"
                        controls={false}
                        autoPlay
                        playsInline
                        onTimeUpdate={handleVideoTimeUpdate}
                        onEnded={handleVideoEnded}
                    />
                )}
            </div>

            {/* Caption */}
            {status.caption && (
                <div className="p-4 bg-black bg-opacity-50 z-10">
                    <p className="text-white text-center">{status.caption}</p>
                </div>
            )}

            {/* Navigation controls */}
            <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
                {onPrevious && (
                    <Button
                        onClick={onPrevious}
                        variant="ghost"
                        size="icon"
                        className="text-white h-full rounded-none pointer-events-auto opacity-0 hover:opacity-100 transition-opacity"
                    >
                        <ChevronLeft className="h-8 w-8" />
                    </Button>
                )}

                {onNext && (
                    <Button
                        onClick={onNext}
                        variant="ghost"
                        size="icon"
                        className="text-white h-full rounded-none pointer-events-auto opacity-0 hover:opacity-100 transition-opacity ml-auto"
                    >
                        <ChevronRight className="h-8 w-8" />
                    </Button>
                )}
            </div>
        </div>
    );
}