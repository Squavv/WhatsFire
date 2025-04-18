'use client';

import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import { useState, useRef, useEffect } from "react";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    serverTimestamp,
    addDoc
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { Button } from "@/components/ui/button";
import { Search, X, Upload, Users, Check } from "lucide-react";
import Image from "next/image";

interface User {
    uid: string;
    displayName: string;
    email: string;
    photoURL: string;
}

interface CreateGroupChatProps {
    onClose: () => void;
    onGroupCreated: (groupId: string) => void;
}

export default function CreateGroupChat({ onClose, onGroupCreated }: CreateGroupChatProps) {
    const { currentUser } = useAuth();
    const [groupName, setGroupName] = useState("");
    const [description, setDescription] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [groupImage, setGroupImage] = useState<File | null>(null);
    const [groupImagePreview, setGroupImagePreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [creating, setCreating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch users for selection
    useEffect(() => {
        const fetchUsers = async () => {
            if (!currentUser) return;

            try {
                const q = query(
                    collection(db, "users"),
                    where("uid", "!=", currentUser.uid)
                );

                const querySnapshot = await getDocs(q);
                const usersList: User[] = [];

                querySnapshot.forEach((doc) => {
                    usersList.push(doc.data() as User);
                });

                setUsers(usersList);
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };

        fetchUsers();
    }, [currentUser]);

    // Handle group image selection
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setGroupImage(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setGroupImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Handle user selection
    const toggleUserSelection = (user: User) => {
        if (selectedUsers.some(u => u.uid === user.uid)) {
            setSelectedUsers(selectedUsers.filter(u => u.uid !== user.uid));
        } else {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    // Filter users based on search query
    const filteredUsers = users.filter(user =>
        user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Create group chat
    const createGroup = async () => {
        if (!currentUser || !groupName || selectedUsers.length === 0) return;

        try {
            setCreating(true);

            // Upload group image if selected
            let groupImageURL = null;
            if (groupImage) {
                setUploading(true);
                const storageRef = ref(storage, `groupImages/${Date.now()}_${groupImage.name}`);
                const uploadTask = uploadBytesResumable(storageRef, groupImage);

                groupImageURL = await new Promise<string>((resolve, reject) => {
                    uploadTask.on(
                        'state_changed',
                        () => { },
                        (error) => {
                            console.error('Error uploading group image:', error);
                            reject(null);
                        },
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(downloadURL);
                        }
                    );
                });

                setUploading(false);
            }

            // Prepare group participants (include current user)
            const participants = [
                currentUser.uid,
                ...selectedUsers.map(user => user.uid)
            ];

            // Create group in Firestore
            const groupRef = await addDoc(collection(db, "groups"), {
                name: groupName,
                description,
                photoURL: groupImageURL,
                createdBy: currentUser.uid,
                participants,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Create a conversation for this group
            const conversationRef = await addDoc(collection(db, "conversations"), {
                type: "group",
                groupId: groupRef.id,
                participants,
                lastMessage: {
                    text: `${currentUser.displayName} created group "${groupName}"`,
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp()
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // Add a system message to the conversation
            await addDoc(collection(db, "conversations", conversationRef.id, "messages"), {
                text: `${currentUser.displayName} created group "${groupName}"`,
                senderId: "system",
                timestamp: serverTimestamp(),
                read: false,
                type: "system"
            });

            setCreating(false);
            onGroupCreated(conversationRef.id);
        } catch (error) {
            console.error("Error creating group:", error);
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Create New Group</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Group details */}
                <div className="p-4 border-b">
                    <div className="flex items-center space-x-4">
                        <div
                            className="h-16 w-16 rounded-full flex items-center justify-center bg-gray-100 cursor-pointer overflow-hidden"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {groupImagePreview ? (
                                <Image
                                    src={groupImagePreview}
                                    alt="Group"
                                    width={64}
                                    height={64}
                                    className="object-cover w-full h-full"
                                />
                            ) : (
                                <Users className="h-8 w-8 text-gray-400" />
                            )}

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageChange}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Group name"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
                            />

                            <input
                                type="text"
                                placeholder="Group description (optional)"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Participants selection */}
                <div className="p-4 border-b">
                    <p className="font-medium mb-2">Add Participants</p>

                    {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {selectedUsers.map(user => (
                                <div
                                    key={user.uid}
                                    className="flex items-center bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full"
                                >
                                    <span>{user.displayName}</span>
                                    <button
                                        onClick={() => toggleUserSelection(user)}
                                        className="ml-1 text-green-600 hover:text-green-900"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search contacts"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>
                </div>

                {/* User list */}
                <div className="flex-1 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                        <div>
                            {filteredUsers.map(user => (
                                <div
                                    key={user.uid}
                                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => toggleUserSelection(user)}
                                >
                                    <div className="flex-shrink-0 mr-3">
                                        {user.photoURL ? (
                                            <Image
                                                src={user.photoURL}
                                                alt={user.displayName}
                                                width={40}
                                                height={40}
                                                className="rounded-full"
                                            />
                                        ) : (
                                            <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center">
                                                {user.displayName?.charAt(0) || 'U'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1">
                                        <h4 className="font-medium">{user.displayName}</h4>
                                        <p className="text-sm text-gray-500">{user.email}</p>
                                    </div>

                                    {selectedUsers.some(u => u.uid === user.uid) && (
                                        <div className="h-6 w-6 bg-green-500 rounded-full flex items-center justify-center">
                                            <Check className="h-4 w-4 text-white" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-4">No contacts found</p>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t">
                    <Button
                        onClick={createGroup}
                        disabled={!groupName || selectedUsers.length === 0 || creating || uploading}
                        className="w-full bg-green-500 hover:bg-green-600 text-white"
                    >
                        {creating ? 'Creating Group...' : 'Create Group'}
                    </Button>
                </div>
            </div>
        </div>
    );
}