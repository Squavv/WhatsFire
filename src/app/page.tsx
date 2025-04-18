'use client';

import Login from "@/components/auth/Login";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { currentUser } = useAuth();

  // If user is already logged in, they will be redirected by RouteGuard
  // This page only shows the login UI
  return <Login />;
}
