'use client';

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, updateDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff } from "lucide-react";
import Image from "next/image";

interface CallInterfaceProps {
    recipientId: string;
    conversationId: string;
    callType: 'video' | 'audio';
    isIncoming?: boolean;
    onEndCall: () => void;
}

export default function CallInterface({
    recipientId,
    conversationId,
    callType,
    isIncoming = false,
    onEndCall
}: CallInterfaceProps) {
    const { currentUser } = useAuth();
    const [recipient, setRecipient] = useState<any>(null);
    const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
    const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [callDuration, setCallDuration] = useState(0);
    const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null);

    // WebRTC states
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStream = useRef<MediaStream | null>(null);

    // Call ID
    const callId = isIncoming
        ? `${recipientId}_${currentUser?.uid}`
        : `${currentUser?.uid}_${recipientId}`;

    // Format call duration as MM:SS
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Start call timer
    const startCallTimer = () => {
        if (callTimer) clearInterval(callTimer);

        const timer = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);

        setCallTimer(timer);
    };

    // Set up call and WebRTC connection
    useEffect(() => {
        const setupCall = async () => {
            if (!currentUser) return;

            try {
                // Get recipient info
                const recipientDocRef = doc(db, "users", recipientId);
                const recipientUnsub = onSnapshot(recipientDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setRecipient(docSnap.data());
                    }
                });

                // Create WebRTC peer connection with STUN servers
                peerConnection.current = new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: [
                                'stun:stun1.l.google.com:19302',
                                'stun:stun2.l.google.com:19302',
                            ],
                        },
                    ],
                });
                
                // Add event handlers only after peerConnection is initialized
                if (peerConnection.current) {
                    // Handle incoming tracks (remote user's stream)
                    peerConnection.current.ontrack = (event) => {
                        if (remoteVideoRef.current && event.streams[0]) {
                            remoteVideoRef.current.srcObject = event.streams[0];
                            setCallStatus('connected');
                            startCallTimer();
                        }
                    };

                    // Handle connection state changes
                    peerConnection.current.oniceconnectionstatechange = () => {
                        if (peerConnection.current) {
                            console.log("ICE connection state:", peerConnection.current.iceConnectionState);
                            
                            if (peerConnection.current.iceConnectionState === 'disconnected' ||
                                peerConnection.current.iceConnectionState === 'failed' ||
                                peerConnection.current.iceConnectionState === 'closed') {
                                endCall();
                            }
                        }
                    };

                    // Handle ICE candidates
                    peerConnection.current.onicecandidate = (event) => {
                        if (event.candidate) {
                            // Send ICE candidate to the other peer via Firestore
                            const iceCandidatesRef = doc(
                                db,
                                "calls",
                                callId,
                                "candidates",
                                `${Date.now()}`
                            );

                            setDoc(iceCandidatesRef, {
                                ...event.candidate.toJSON(),
                                sender: currentUser.uid,
                            });
                        }
                    };
                }

                // Get media stream based on call type
                const constraints = {
                    audio: true,
                    video: callType === 'video',
                };

                try {
                    localStream.current = await navigator.mediaDevices.getUserMedia(constraints);
                } catch (error) {
                    console.error("Error accessing media devices:", error);
                    alert("Could not access camera or microphone. Please check permissions.");
                    onEndCall();
                    return;
                }

                // Add local stream tracks to peer connection
                localStream.current.getTracks().forEach((track) => {
                    if (peerConnection.current && localStream.current) {
                        peerConnection.current.addTrack(track, localStream.current);
                    }
                });

                // Display local video if it's a video call
                if (callType === 'video' && localVideoRef.current && localStream.current) {
                    localVideoRef.current.srcObject = localStream.current;
                }

                // If this is an outgoing call, create the offer
                if (!isIncoming) {
                    // Create offer
                    const offer = await peerConnection.current.createOffer();
                    await peerConnection.current.setLocalDescription(offer);

                    // Save call details to Firestore
                    await setDoc(doc(db, "calls", callId), {
                        callType,
                        offer: { sdp: offer.sdp, type: offer.type },
                        caller: currentUser.uid,
                        recipient: recipientId,
                        status: 'ringing',
                        timestamp: serverTimestamp(),
                        conversationId: conversationId
                    });

                    // Also create a notification for the recipient
                    await setDoc(doc(db, "users", recipientId, "notifications", callId), {
                        type: 'call',
                        callId: callId,
                        callType: callType,
                        callerId: currentUser.uid,
                        callerName: currentUser.displayName || "Unknown",
                        callerPhoto: currentUser.photoURL || null,
                        timestamp: serverTimestamp(),
                        status: 'ringing',
                        conversationId: conversationId
                    });
                }

                // If this is an incoming call, listen for the offer and create an answer
                if (isIncoming) {
                    const callDocRef = doc(db, "calls", callId);
                    const callUnsub = onSnapshot(callDocRef, async (docSnap) => {
                        if (docSnap.exists()) {
                            const callData = docSnap.data();

                            // If the call has an offer but no answer yet, create and send answer
                            if (
                                callData.offer &&
                                !callData.answer &&
                                peerConnection.current &&
                                !peerConnection.current.currentRemoteDescription
                            ) {
                                await peerConnection.current.setRemoteDescription(
                                    new RTCSessionDescription(callData.offer)
                                );

                                const answer = await peerConnection.current.createAnswer();
                                await peerConnection.current.setLocalDescription(answer);

                                // Update call document with answer
                                await updateDoc(callDocRef, {
                                    answer: { sdp: answer.sdp, type: answer.type },
                                    status: 'ongoing',
                                });
                            }

                            // Handle call status changes
                            if (callData.status === 'ended') {
                                endCall();
                            }
                        }
                    });

                    // Clean up notification when answering
                    try {
                        await deleteDoc(doc(db, "users", currentUser.uid, "notifications", callId));
                    } catch (error) {
                        console.error("Error removing call notification:", error);
                    }

                    // Cleanup for incoming call
                    return () => {
                        recipientUnsub();
                        callUnsub();
                    };
                }

                // Listen for answer if this is an outgoing call
                if (!isIncoming) {
                    const callDocRef = doc(db, "calls", callId);
                    const callUnsub = onSnapshot(callDocRef, async (docSnap) => {
                        if (docSnap.exists()) {
                            const callData = docSnap.data();

                            // Set remote description when we get an answer
                            if (
                                callData.answer &&
                                peerConnection.current &&
                                !peerConnection.current.currentRemoteDescription
                            ) {
                                await peerConnection.current.setRemoteDescription(
                                    new RTCSessionDescription(callData.answer)
                                );

                                // Update call status to ongoing
                                await updateDoc(callDocRef, {
                                    status: 'ongoing',
                                });

                                setCallStatus('connected');
                                startCallTimer();
                            }

                            // Handle call status changes
                            if (callData.status === 'ended') {
                                endCall();
                            }
                        }
                    });

                    // Cleanup for outgoing call
                    return () => {
                        recipientUnsub();
                        callUnsub();
                    };
                }

                // Listen for ICE candidates
                const candidatesCollectionRef = collection(db, "calls", callId, "candidates");
                const candidatesQuery = query(
                    candidatesCollectionRef,
                    where("sender", "!=", currentUser.uid)
                );

                const candidatesUnsub = onSnapshot(candidatesQuery, (snapshot) => {
                    snapshot.docChanges().forEach(async (change) => {
                        if (change.type === 'added') {
                            const data = change.doc.data();
                            if (data && peerConnection.current) {
                                try {
                                    // Add received ICE candidate
                                    await peerConnection.current.addIceCandidate(
                                        new RTCIceCandidate({
                                            candidate: data.candidate,
                                            sdpMid: data.sdpMid,
                                            sdpMLineIndex: data.sdpMLineIndex,
                                        })
                                    );
                                } catch (error) {
                                    console.error("Error adding ICE candidate:", error);
                                }
                            }
                        }
                    });
                });

                // Cleanup function
                return () => {
                    recipientUnsub();
                    candidatesUnsub();
                    if (callTimer) clearInterval(callTimer);
                };
            } catch (error) {
                console.error("Error setting up call:", error);
                endCall();
            }
        };

        setupCall();

        // Cleanup when component unmounts
        return () => {
            cleanupResources();
        };
    }, [currentUser, recipientId, callId, callType, isIncoming, conversationId]);

    // Clean up resources
    const cleanupResources = () => {
        if (callTimer) {
            clearInterval(callTimer);
        }

        // Clean up WebRTC resources
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
            localStream.current = null;
        }

        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
    };

    // Handle ending the call
    const endCall = async () => {
        try {
            // Update call status in Firestore
            const callDocRef = doc(db, "calls", callId);
            await updateDoc(callDocRef, {
                status: 'ended',
                endedAt: serverTimestamp(),
                duration: callDuration
            });

            // Log call to conversation history
            await addDoc(collection(db, "conversations", conversationId, "calls"), {
                callId: callId,
                callType: callType,
                caller: isIncoming ? recipientId : currentUser?.uid,
                recipient: isIncoming ? currentUser?.uid : recipientId,
                startedAt: new Date(Date.now() - callDuration * 1000),
                endedAt: new Date(),
                duration: callDuration
            });

            // Clean up resources
            cleanupResources();
            setCallStatus('ended');

            // Allow a short delay to see the "call ended" status before closing
            setTimeout(onEndCall, 1500);
        } catch (error) {
            console.error("Error ending call:", error);
            onEndCall();
        }
    };

    // Toggle video
    const toggleVideo = () => {
        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !isVideoEnabled;
                setIsVideoEnabled(!isVideoEnabled);
            }
        }
    };

    // Toggle audio
    const toggleAudio = () => {
        if (localStream.current) {
            const audioTrack = localStream.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !isAudioEnabled;
                setIsAudioEnabled(!isAudioEnabled);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col justify-between z-50">
            {/* Recipient info and call status */}
            <div className="p-6 text-center">
                <h2 className="text-white text-xl font-semibold mb-2">
                    {recipient?.displayName || "Connecting..."}
                </h2>
                <p className="text-gray-300">
                    {callStatus === 'connecting'
                        ? isIncoming ? 'Incoming call...' : 'Calling...'
                        : callStatus === 'connected'
                            ? `Connected · ${formatDuration(callDuration)}`
                            : 'Call ended'}
                </p>
            </div>

            {/* Video area */}
            <div className="flex-1 flex items-center justify-center relative">
                {callType === 'video' && callStatus === 'connected' ? (
                    <>
                        {/* Remote video (full screen) */}
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />

                        {/* Local video (picture-in-picture) */}
                        <div className="absolute bottom-4 right-4 w-1/4 max-w-[120px] aspect-video rounded-lg overflow-hidden border-2 border-white">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </>
                ) : (
                    <div className="text-center">
                        <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-white">
                            {recipient?.photoURL ? (
                                <Image
                                    src={recipient.photoURL}
                                    alt={recipient.displayName || "Contact"}
                                    width={128}
                                    height={128}
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-green-500 flex items-center justify-center text-white text-3xl">
                                    {recipient?.displayName?.charAt(0) || "?"}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Call controls */}
            <div className="p-6 flex justify-center space-x-4">
                {callType === 'video' && (
                    <Button
                        onClick={toggleVideo}
                        className={`rounded-full p-3 ${isVideoEnabled ? 'bg-gray-700' : 'bg-red-500'
                            }`}
                        size="icon"
                    >
                        {isVideoEnabled ? (
                            <Video className="h-6 w-6 text-white" />
                        ) : (
                            <VideoOff className="h-6 w-6 text-white" />
                        )}
                    </Button>
                )}

                <Button
                    onClick={toggleAudio}
                    className={`rounded-full p-3 ${isAudioEnabled ? 'bg-gray-700' : 'bg-red-500'
                        }`}
                    size="icon"
                >
                    {isAudioEnabled ? (
                        <Mic className="h-6 w-6 text-white" />
                    ) : (
                        <MicOff className="h-6 w-6 text-white" />
                    )}
                </Button>

                <Button
                    onClick={endCall}
                    className="rounded-full p-3 bg-red-500"
                    size="icon"
                >
                    <Phone className="h-6 w-6 text-white transform rotate-135" />
                </Button>
            </div>
        </div>
    );
}