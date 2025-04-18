export default function ChatsPage() {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-50">
            <div className="text-center max-w-md p-6">
                <div className="w-48 h-48 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-semibold text-gray-800 mb-3">Welcome to WhatsFire</h1>
                <p className="text-gray-600 mb-6">
                    Select a conversation from the sidebar or start a new chat to begin messaging
                </p>
            </div>
        </div>
    );
}