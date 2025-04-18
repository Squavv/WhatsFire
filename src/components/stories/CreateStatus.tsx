'use client';

import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import { useState, useRef } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { X, Camera, Image as ImageIcon, VideoIcon } from "lucide-react";
import Image from "next/image";

interface CreateStatusProps {
    onClose: () => void;
    onStatusCreated: () => void;
}

export default function CreateStatus({ onClose, onStatusCreated }: CreateStatusProps) {
    const { currentUser } = useAuth();
    const [caption, setCaption] = useState("");
    const [media, setMedia] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle media file selection
    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check if file is image or video
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
            alert('Please upload an image or video file.');
            return;
        }

        setMedia(file);
        setMediaType(isImage ? 'image' : 'video');

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setMediaPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Upload status update
    const uploadStatus = async () => {
        if (!currentUser || !media) return;

        try {
            setUploading(true);

            // Upload media file to Firebase Storage
            const storageRef = ref(storage, `status/${currentUser.uid}/${Date.now()}_${media.name}`);
            const uploadTask = uploadBytesResumable(storageRef, media);

            // Listen for upload progress
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Error uploading status:', error);
                    setUploading(false);
                },
                async () => {
                    // Get download URL once upload completes
                    const mediaUrl = await getDownloadURL(uploadTask.snapshot.ref);

                    // Create status document in Firestore
                    await addDoc(collection(db, "statuses"), {
                        userId: currentUser.uid,
                        userName: currentUser.displayName,
                        userPhotoURL: currentUser.photoURL,
                        caption,
                        mediaUrl,
                        mediaType,
                        timestamp: serverTimestamp(),
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
                        viewedBy: [],
                    });

                    setUploading(false);
                    onStatusCreated();
                }
            );
        } catch (error) {
            console.error('Error creating status:', error);
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Create Status</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Media Preview */}
                <div className="aspect-square bg-gray-100 relative">
                    {mediaPreview ? (
                        mediaType === 'image' ? (
                            <Image
                                src={mediaPreview}
                                alt="Status preview"
                                fill
                                className="object-contain"
                            />
                        ) : (
                            <video
                                src={mediaPreview}
                                className="w-full h-full object-contain"
                                controls
                            />
                        )
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center">
                            <div className="mb-4 text-gray-400">
                                <Camera className="h-12 w-12 mx-auto" />
                                <p className="mt-2">Select an image or video for your status</p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex gap-2 items-center"
                                >
                                    <ImageIcon className="h-4 w-4" />
                                    Select Media
                                </Button>
                            </div>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleMediaChange}
                        accept="image/*,video/*"
                        className="hidden"
                    />

                    {/* Upload progress indicator */}
                    {uploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center">
                            <div className="h-16 w-16 rounded-full border-4 border-t-transparent border-white animate-spin mb-4"></div>
                            <p className="text-white font-medium">{Math.round(uploadProgress)}%</p>
                        </div>
                    )}
                </div>

                {/* Caption input */}
                <div className="p-4">
                    <textarea
                        placeholder="Add a caption..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                        rows={3}
                    />
                </div>

                {/* Actions */}
                <div className="p-4 border-t flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={uploading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={uploadStatus}
                        disabled={!media || uploading}
                        className="bg-green-500 hover:bg-green-600 text-white"
                    >
                        {uploading ? 'Uploading...' : 'Share Status'}
                    </Button>
                </div>
            </div>
        </div>
    );
}