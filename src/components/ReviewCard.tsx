"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Eye, ArrowUp, Plus, Brain } from "lucide-react";
import { motion } from "framer-motion";

export default function ReviewCard() {
  const [answer, setAnswer] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [currentView, setCurrentView] = useState<"review" | "add">("review");
  const mockQuestion = "What is the average distance from Earth to the Moon?";

  // Restore persisted state on mount
  React.useEffect(() => {
    try {
      const persistedView = localStorage.getItem("reviewCard.currentView");
      const persistedAnswer = localStorage.getItem("reviewCard.answer");
      const persistedNote = localStorage.getItem("reviewCard.noteContent");
      if (persistedView === "review" || persistedView === "add") {
        setCurrentView(persistedView);
      }
      if (typeof persistedAnswer === "string") setAnswer(persistedAnswer);
      if (typeof persistedNote === "string") setNoteContent(persistedNote);
    } catch {
      // no-op if storage is unavailable
    }
  }, []);

  // Persist state when it changes
  React.useEffect(() => {
    try {
      localStorage.setItem("reviewCard.currentView", currentView);
    } catch {}
  }, [currentView]);

  React.useEffect(() => {
    try {
      localStorage.setItem("reviewCard.answer", answer);
    } catch {}
  }, [answer]);

  React.useEffect(() => {
    try {
      localStorage.setItem("reviewCard.noteContent", noteContent);
    } catch {}
  }, [noteContent]);

  const handleForgetNote = () => {
    console.log("Forgetting note...");
  };

  const handleViewNote = () => {
    console.log("Viewing associated note...");
  };

  const handleAddNote = () => {
    setCurrentView("add");
  };

  const handleReview = () => {
    setCurrentView("review");
  };

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center p-4"
      style={{
        backgroundImage: "url(/background_image.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-black/5 pointer-events-none" />
      
      <Card
        className="relative z-10 w-full max-w-5xl rounded-2xl border border-white/10 p-12 shadow-2xl"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          backdropFilter: "blur(30px) saturate(120%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          minHeight: "550px",
        }}
      >
        <div className="absolute top-4 left-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                <MoreVertical className="w-5 h-5 text-gray-300" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {currentView === "review" ? (
                <>
                  <DropdownMenuItem
                    onClick={handleForgetNote}
                    className="cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Forget Note
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleViewNote}
                    className="cursor-pointer"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Note
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={handleReview}
                  className="cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancel
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="absolute top-4 right-4">
          {currentView === "review" ? (
            <button
              onClick={handleAddNote}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <span className="text-white font-light">Add Note</span>
              <Plus className="w-4 h-4 text-white" />
            </button>
          ) : (
            <button
              onClick={handleReview}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            >
              <span className="text-white font-light">Review</span>
              <Brain className="w-4 h-4 text-white" />
            </button>
          )}
        </div>

        <motion.div 
          key={currentView}
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <h2
            className="text-2xl font-light text-white text-center mt-12"
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontWeight: 300,
            }}
          >
            {currentView === "review" ? mockQuestion : "What's on your mind?"}
          </h2>

          <div className="relative max-w-3xl mx-auto">
            <Textarea
              value={currentView === "review" ? answer : noteContent}
              onChange={(e) => currentView === "review" ? setAnswer(e.target.value) : setNoteContent(e.target.value)}
              placeholder={currentView === "review" ? "What should your answer be?" : "Add your note here..."}
              className={`resize-none bg-white/4 text-white rounded-xl placeholder:text-white/70 text-lg ${currentView === "review" ? "min-h-[150px]" : "min-h-[250px]"}`}
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontWeight: 300,
                fontSize: "1.25rem",
                border: "1px solid rgba(156, 163, 175, 0.15)",
                outline: "none",
                boxShadow: "none",
              }}
              onFocus={(e) => {
                e.target.style.border = "1px solid rgba(156, 163, 175, 0.15)";
                e.target.style.outline = "none";
                e.target.style.boxShadow = "none";
              }}
            />
            <button className="absolute bottom-3 right-3 p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all group">
              <ArrowUp className="w-5 h-5 text-white group-hover:text-white transition-colors" />
            </button>
          </div>
        </motion.div>
      </Card>
    </div>
  );
}
