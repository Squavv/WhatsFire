import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Timestamp } from 'firebase/firestore';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

// Tailwind class name utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format Firebase timestamp for conversations
export function formatConversationDate(timestamp: Timestamp | null | undefined) {
  if (!timestamp) return '';
  
  const date = timestamp.toDate();
  
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MM/dd/yyyy');
  }
}

// Format status timestamp
export function formatStatusTime(timestamp: Timestamp | null | undefined) {
  if (!timestamp) return '';
  
  return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Generate a chat color based on user ID
export function generateChatColor(userId: string): string {
  // Simple hash function to generate a consistent color
  const hash = userId.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  // Predefined WhatsApp-like colors
  const colors = [
    'bg-green-100',
    'bg-blue-100',
    'bg-purple-100',
    'bg-pink-100',
    'bg-yellow-100',
    'bg-indigo-100',
    'bg-red-100',
    'bg-orange-100',
  ];
  
  return colors[hash % colors.length];
}

// Create initials from display name
export function getInitials(displayName: string | null | undefined): string {
  if (!displayName) return '?';
  
  const names = displayName.trim().split(' ');
  if (names.length === 1) return names[0][0].toUpperCase();
  
  return (names[0][0] + names[names.length - 1][0]).toUpperCase();
}

// Check if URL is an image
export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url.toLowerCase());
}
