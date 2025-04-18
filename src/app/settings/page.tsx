'use client';

import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function SettingsPage() {
    const { currentUser } = useAuth();
    const [displayName, setDisplayName] = useState(currentUser?.displayName || "");
    const [about, setAbout] = useState("");
    const [status, setStatus] = useState("Available");
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch user data
    useState(() => {
        const fetchUserData = async () => {
            if (!currentUser) return;

            try {
                const userDocRef = doc(db, "users", currentUser.uid);
                const userDoc = await doc(db, "users", currentUser.uid);
                const userData = (await userDocRef).data();

                if (userData) {
                    setAbout(userData.about || "Hey there! I am using WhatsApp");
                    setStatus(userData.status || "Available");
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };

        fetchUserData();
    });

    // Handle profile picture upload
    const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentUser) return;

        try {
            setUploading(true);
            const storageRef = ref(storage, `profilePictures/${currentUser.uid}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Error uploading profile picture:", error);
                    setUploading(false);
                },
                async () => {
                    // Upload completed
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    // Update photoURL in Firestore
                    const userDocRef = doc(db, "users", currentUser.uid);
                    await updateDoc(userDocRef, {
                        photoURL: downloadURL,
                    });

                    setUploading(false);
                }
            );
        } catch (error) {
            console.error("Error handling profile picture update:", error);
            setUploading(false);
        }
    };

    // Save profile settings
    const saveSettings = async () => {
        if (!currentUser) return;

        try {
            setSaving(true);
            const userDocRef = doc(db, "users", currentUser.uid);

            await updateDoc(userDocRef, {
                displayName,
                about,
                status,
            });

            setSaving(false);
        } catch (error) {
            console.error("Error saving settings:", error);
            setSaving(false);
        }
    };

    if (!currentUser) {
        return null; // Will be handled by RouteGuard
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white p-4 flex items-center border-b">
                <Link href="/chats" className="mr-4">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <h1 className="text-xl font-semibold">Profile Settings</h1>
            </header>

            <div className="flex-1 p-6 flex flex-col items-center max-w-md mx-auto w-full">
                {/* Profile Picture */}
                <div className="relative mb-8 mt-4">
                    <div className="h-24 w-24 rounded-full overflow-hidden relative">
                        {currentUser.photoURL ? (
                            <Image
                                src={currentUser.photoURL}
                                alt="Profile"
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="h-24 w-24 rounded-full bg-green-500 text-white flex items-center justify-center text-2xl">
                                {currentUser.displayName?.charAt(0) || "U"}
                            </div>
                        )}

                        {uploading && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                <div className="h-10 w-10 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 bg-green-500 text-white p-2 rounded-full"
                    >
                        <Camera className="h-4 w-4" />
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleProfilePictureChange}
                        accept="image/*"
                        className="hidden"
                    />
                </div>

                {/* Form Fields */}
                <div className="space-y-6 w-full">
                    <div>
                        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                            Name
                        </label>
                        <input
                            type="text"
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="about" className="block text-sm font-medium text-gray-700 mb-1">
                            About
                        </label>
                        <textarea
                            id="about"
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                            rows={3}
                        />
                    </div>

                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                        </label>
                        <select
                            id="status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="Available">Available</option>
                            <option value="Busy">Busy</option>
                            <option value="At work">At work</option>
                            <option value="In a meeting">In a meeting</option>
                            <option value="At school">At school</option>
                            <option value="Do not disturb">Do not disturb</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                        </label>
                        <p className="text-gray-500">{currentUser.email}</p>
                    </div>

                    <Button
                        onClick={saveSettings}
                        disabled={saving}
                        className="w-full bg-green-500 hover:bg-green-600 text-white"
                    >
                        {saving ? (
                            <>
                                <span className="mr-2">Saving...</span>
                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}