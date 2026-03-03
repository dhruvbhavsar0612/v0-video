/**
 * Home Page
 *
 * Landing page. If the user is logged in, redirect to /dashboard.
 * Otherwise show the marketing hero.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sparkles, Video, Zap } from "lucide-react";
import Link from "next/link";

import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && session) {
      router.replace("/dashboard");
    }
  }, [session, isPending, router]);

  // While checking session, show nothing
  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If logged in, this will redirect (show loading briefly)
  if (session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xl font-bold">ReelForge</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-2xl mx-auto px-6">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            AI-Powered Video Editor
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Create stunning Instagram Reels with AI. Just describe what you want,
            and our AI agent will search for stock footage, generate images,
            add transitions, text overlays, and music -- all automatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                <Video className="h-4 w-4" />
                Get Started Free
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="p-4 rounded-lg border">
              <Sparkles className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-semibold mb-1">AI-Driven Editing</h3>
              <p className="text-sm text-muted-foreground">
                Describe your video idea in natural language. The AI handles the rest.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <Video className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Real-Time Preview</h3>
              <p className="text-sm text-muted-foreground">
                See your video come together in real-time as the AI makes changes.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <Zap className="h-5 w-5 text-primary mb-2" />
              <h3 className="font-semibold mb-1">Smart Transitions</h3>
              <p className="text-sm text-muted-foreground">
                Trendy transitions, text animations, and effects applied automatically.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
