'use client';

import {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode
} from 'react';
import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    User
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const auth = getAuth(app);

    // Handle user state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);

                // Create or update user document in Firestore
                try {
                    const userRef = doc(db, 'users', user.uid);
                    const userSnap = await getDoc(userRef);

                    if (!userSnap.exists()) {
                        // Create new user document if it doesn't exist
                        await setDoc(userRef, {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            phoneNumber: user.phoneNumber,
                            lastActive: serverTimestamp(),
                            createdAt: serverTimestamp(),
                            status: 'Available',
                            about: 'Hey there! I am using WhatsApp'
                        });
                    } else {
                        // Update last active timestamp
                        await setDoc(userRef, {
                            lastActive: serverTimestamp()
                        }, { merge: true });
                    }
                } catch (error) {
                    console.error("Error creating/updating user document:", error);
                }
            } else {
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [auth]);

    // Sign in with Google
    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google:", error);
            throw error;
        }
    };

    // Sign out
    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
            throw error;
        }
    };

    const value = {
        currentUser,
        loading,
        signInWithGoogle,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}