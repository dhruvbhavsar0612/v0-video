/**
 * Dashboard Layout
 *
 * Shell layout for the dashboard with a top nav bar,
 * user info, and logout button.
 */

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Video } from "lucide-react";

import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav Bar */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold">ReelForge</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded hidden sm:inline">
              AI Video Editor
            </span>
          </div>

          <div className="flex items-center gap-3">
            {session?.user && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {session.user.name || session.user.email}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
