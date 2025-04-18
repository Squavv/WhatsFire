'use client';

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, onSnapshot, query, updateDoc, where, orderBy, limit } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Video, PhoneOff } from "lucide-react";
import Image from "next/image";
import CallInterface from "./CallInterface";

interface IncomingCall {
    callId: string;
    callType: 'audio' | 'video';
    callerId: string;
    callerName: string;
    callerPhoto: string | null;
    conversationId: string;
    timestamp: any;
}

export default function IncomingCallDialog() {
    const { currentUser } = useAuth();
    const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const [audioRingtone, setAudioRingtone] = useState<HTMLAudioElement | null>(null);

    // Set up ringtone
    useEffect(() => {
        // Create audio element for ringtone
        const audio = new Audio('/sounds/ringtone.mp3');
        audio.loop = true;
        setAudioRingtone(audio);

        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, []);

    // Listen for incoming calls
    useEffect(() => {
        if (!currentUser) return;

        // Listen for incoming call notifications
        const notificationsRef = collection(db, "users", currentUser.uid, "notifications");
        const q = query(
            notificationsRef,
            where("type", "==", "call"),
            where("status", "==", "ringing"),
            orderBy("timestamp", "desc"),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const callData = snapshot.docs[0].data() as IncomingCall;
                setIncomingCall(callData);

                // Play ringtone
                if (audioRingtone) {
                    audioRingtone.play().catch(err => console.error("Error playing ringtone:", err));
                }
            } else {
                setIncomingCall(null);
                // Stop ringtone
                if (audioRingtone) {
                    audioRingtone.pause();
                    audioRingtone.currentTime = 0;
                }
            }
        });

        return () => {
            unsubscribe();
            // Stop ringtone
            if (audioRingtone) {
                audioRingtone.pause();
                audioRingtone.currentTime = 0;
            }
        };
    }, [currentUser, audioRingtone]);

    // Accept call
    const acceptCall = async () => {
        if (!incomingCall || !currentUser) return;

        // Stop ringtone
        if (audioRingtone) {
            audioRingtone.pause();
            audioRingtone.currentTime = 0;
        }

        setIsCallActive(true);
    };

    // Reject call
    const rejectCall = async () => {
        if (!incomingCall || !currentUser) return;

        try {
            // Update call status to ended
            await updateDoc(doc(db, "calls", incomingCall.callId), {
                status: 'ended',
                endedAt: new Date(),
                endedBy: currentUser.uid,
                endReason: 'rejected'
            });

            // Remove notification
            await deleteDoc(doc(db, "users", currentUser.uid, "notifications", incomingCall.callId));

            // Stop ringtone
            if (audioRingtone) {
                audioRingtone.pause();
                audioRingtone.currentTime = 0;
            }

            setIncomingCall(null);
        } catch (error) {
            console.error("Error rejecting call:", error);
        }
    };

    // Handle call end
    const handleCallEnded = () => {
        setIsCallActive(false);
        setIncomingCall(null);
    };

    if (isCallActive && incomingCall) {
        return (
            <CallInterface
                recipientId={incomingCall.callerId}
                conversationId={incomingCall.conversationId}
                callType={incomingCall.callType}
                isIncoming={true}
                onEndCall={handleCallEnded}
            />
        );
    }

    return (
        <Dialog open={!!incomingCall} onOpenChange={(open) => {
            if (!open && incomingCall) rejectCall();
        }}>
            <DialogContent className="max-w-sm mx-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl text-center mb-4">
                        {incomingCall?.callType === 'video' ? 'Incoming Video Call' : 'Incoming Call'}
                    </DialogTitle>
                </DialogHeader>

                {incomingCall && (
                    <div className="flex flex-col items-center py-4">
                        <div className="w-24 h-24 mb-4 relative rounded-full overflow-hidden">
                            {incomingCall.callerPhoto ? (
                                <Image
                                    src={incomingCall.callerPhoto}
                                    alt={incomingCall.callerName}
                                    fill
                                    className="object-cover"
                                    onError={(e) => {
                                        e.currentTarget.src = "/user-placeholder.png";
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full bg-green-500 flex items-center justify-center text-white text-3xl">
                                    {incomingCall.callerName?.charAt(0) || "?"}
                                </div>
                            )}

                            {incomingCall.callType === 'video' && (
                                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1">
                                    <Video className="h-4 w-4 text-white" />
                                </div>
                            )}
                        </div>

                        <h3 className="text-lg font-semibold">{incomingCall.callerName}</h3>
                    </div>
                )}

                <DialogFooter className="flex-row justify-center gap-4 mt-4">
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={rejectCall}
                        className="rounded-full h-14 w-14"
                    >
                        <PhoneOff className="h-6 w-6" />
                    </Button>

                    <Button
                        variant="default"
                        size="icon"
                        onClick={acceptCall}
                        className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600"
                    >
                        {incomingCall?.callType === 'video' ? (
                            <Video className="h-6 w-6" />
                        ) : (
                            <Phone className="h-6 w-6" />
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}