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
import {
  MoreVertical,
  Trash2,
  Eye,
  ArrowUp,
  Plus,
  Brain,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

interface Question {
  id: number;
  questionText: string;
  expectedAnswer?: string;
  noteId?: number;
}

export default function ReviewCard() {
  const [answer, setAnswer] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [currentView, setCurrentView] = useState<"review" | "add">("review");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Update time every second
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch questions when component mounts or when switching to review view
  React.useEffect(() => {
    if (currentView === "review") {
      fetchDueQuestion();
    }
  }, [currentView]);

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

  const fetchDueQuestion = async () => {
    setIsLoadingQuestion(true);
    try {
      const response = await fetch("/api/questions/due");
      if (response.ok) {
        const result = await response.json();
        setCurrentQuestion(result.question);
      } else {
        console.error("Failed to fetch due questions");
        setCurrentQuestion(null);
      }
    } catch (error) {
      console.error("Error fetching due questions:", error);
      setCurrentQuestion(null);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const handleSubmitNote = async () => {
    if (!noteContent.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: noteContent,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Note and question created:", result);
        setNoteContent("");
        setCurrentView("review");
        setToastMessage("Note added successfully!");
        // Clear toast after 3 seconds
        setTimeout(() => setToastMessage(null), 3000);
        // Refresh questions after adding a new note
        await fetchDueQuestion();
      } else {
        console.error("Failed to create note");
      }
    } catch (error) {
      console.error("Error submitting note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGetExplanation = async () => {
    if (!currentQuestion) return;

    setIsLoadingExplanation(true);
    try {
      const response = await fetch("/api/questions/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setFlashMessage(result.explanation);

        // Submit review with low quality score (1) since user wasn't sure
        await handleSubmitReview(1);
      } else {
        console.error("Failed to get explanation");
      }
    } catch (error) {
      console.error("Error getting explanation:", error);
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !answer.trim()) return;

    setIsEvaluating(true);
    try {
      const response = await fetch("/api/questions/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          userAnswer: answer,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Show feedback message
        const feedbackMessage = result.isCorrect
          ? `${result.feedback} We'll ask again in a bit to check your understanding.`
          : `${result.feedback} We'll ask again in a bit to check your understanding.`;

        setFlashMessage(feedbackMessage);

        // Submit review with AI-suggested quality
        await handleSubmitReview(result.suggestedQuality);
      } else {
        console.error("Failed to evaluate answer");
      }
    } catch (error) {
      console.error("Error evaluating answer:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitReview = async (quality: number) => {
    if (!currentQuestion) return;

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          userResponse: answer,
          quality,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Review submitted:", result);
        setAnswer("");
      } else {
        console.error("Failed to submit review");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
    }
  };

  const handleGotIt = () => {
    setFlashMessage(null);
    setAnswer("");
    fetchDueQuestion();
  };

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center p-4"
      style={{
        backgroundImage: "url(/table.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-black/5 pointer-events-none" />

      {/* Flash Message */}
      {flashMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 max-w-2xl mx-4"
        >
          <div className="px-6 py-4 bg-white/15 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl">
            <p
              className="text-white text-center leading-relaxed mb-4"
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontWeight: 300,
              }}
            >
              {flashMessage}
            </p>
            <div className="flex justify-center">
              <button
                onClick={handleGotIt}
                className="px-6 py-3 bg-white/15 hover:bg-white/25 rounded-full text-white font-light transition-colors border border-white/20"
              >
                Got it!
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm border border-white/10">
          <span className="text-white font-medium text-base">
            {currentTime.toLocaleDateString()} •{" "}
            {currentTime.toLocaleTimeString()}
          </span>
        </div>
      </div>

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
            <DropdownMenuContent
              align="start"
              className="w-48 border border-white/10 rounded-xl"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.04)",
                backdropFilter: "blur(30px) saturate(120%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
              }}
            >
              {currentView === "review" ? (
                <>
                  <DropdownMenuItem
                    onClick={handleForgetNote}
                    className="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10 focus:text-white focus:rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 mr-2 text-white" />
                    Forget Note
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleViewNote}
                    className="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10 focus:text-white focus:rounded-lg"
                  >
                    <Eye className="w-4 h-4 mr-2 text-white" />
                    View Note
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={handleReview}
                  className="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10 focus:text-white focus:rounded-lg"
                >
                  <Trash2 className="w-4 h-4 mr-2 text-white" />
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
          className="space-y-8"
        >
          <h2
            className="text-2xl font-light text-white text-center mt-16"
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              fontWeight: 300,
            }}
          >
            {currentView === "review"
              ? flashMessage
                ? "Reviewing your answer..."
                : isLoadingQuestion
                ? "Loading question..."
                : currentQuestion?.questionText || "No more questions for now"
              : "What's on your mind?"}
          </h2>

          {/* Show textarea for add mode, or for review mode when there are questions and no flash message */}
          {(currentView === "add" ||
            (currentView === "review" && currentQuestion && !flashMessage)) && (
            <div className="relative max-w-3xl mx-auto">
              <Textarea
                value={currentView === "review" ? answer : noteContent}
                onChange={(e) =>
                  currentView === "review"
                    ? setAnswer(e.target.value)
                    : setNoteContent(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (currentView === "review") {
                      handleSubmitAnswer();
                    } else {
                      handleSubmitNote();
                    }
                  }
                }}
                placeholder={
                  currentView === "review"
                    ? "What should your answer be?"
                    : "Add your note here..."
                }
                className={`resize-none bg-white/4 text-white rounded-xl placeholder:text-white/70 text-lg ${
                  currentView === "review" ? "min-h-[150px]" : "min-h-[250px]"
                }`}
                style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  fontWeight: 300,
                  fontSize: "1.25rem",
                  border: "1px solid rgba(156, 163, 175, 0.15)",
                  outline: "none",
                  boxShadow: "none",
                  backgroundColor: "rgba(213, 213, 213, 0.10)",
                  backdropFilter: "blur(30px) saturate(100%)",
                  WebkitBackdropFilter: "blur(20px) saturate(180%)",
                }}
                onFocus={(e) => {
                  e.target.style.border = "1px solid rgba(156, 163, 175, 0.15)";
                  e.target.style.outline = "none";
                  e.target.style.boxShadow = "none";
                }}
              />
              {currentView === "add" && (
                <button
                  onClick={handleSubmitNote}
                  disabled={isSubmitting || !noteContent.trim()}
                  className="absolute bottom-3 right-3 p-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-all group"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <ArrowUp className="w-5 h-5 text-white group-hover:text-white transition-colors" />
                  )}
                </button>
              )}
            </div>
          )}

          {/* Show Add Note button when no questions are available */}
          {currentView === "review" &&
            !currentQuestion &&
            !isLoadingQuestion && (
              <div className="text-center">
                <button
                  onClick={handleAddNote}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white font-light mx-auto"
                >
                  <span>Add Note</span>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

          {currentView === "review" && currentQuestion && !flashMessage && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Action Buttons */}
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleGetExplanation}
                  disabled={isLoadingExplanation}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-white font-light transition-colors"
                >
                  {isLoadingExplanation ? "Loading..." : "I'm not sure"}
                </button>

                <button
                  onClick={handleSubmitAnswer}
                  disabled={!answer.trim() || isEvaluating}
                  className="px-6 py-3 bg-white/15 hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-white font-light transition-colors border border-white/20"
                >
                  {isEvaluating ? "Checking..." : "Submit Answer"}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </Card>

      {/* Toast Notification */}
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div
            className="px-6 py-4 rounded-xl border border-white/20 shadow-2xl backdrop-blur-md"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              backdropFilter: "blur(30px) saturate(120%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            <p
              className="text-white text-center leading-relaxed"
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontWeight: 300,
              }}
            >
              {toastMessage}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
