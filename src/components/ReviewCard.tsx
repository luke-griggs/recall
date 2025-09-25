"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

type Note = {
  id: number;
  content: string;
  explanation?: string | null;
};

export default function ReviewCard() {
  const [answer, setAnswer] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [currentView, setCurrentView] = useState<"review" | "add">("review");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionAnimationKey, setQuestionAnimationKey] = useState(0);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Restore persisted state on mount
  useEffect(() => {
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
      // Storage unavailable – ignore
    }
  }, []);

  // Persist state when it changes
  useEffect(() => {
    try {
      localStorage.setItem("reviewCard.currentView", currentView);
    } catch {}
  }, [currentView]);

  useEffect(() => {
    try {
      localStorage.setItem("reviewCard.answer", answer);
    } catch {}
  }, [answer]);

  useEffect(() => {
    try {
      localStorage.setItem("reviewCard.noteContent", noteContent);
    } catch {}
  }, [noteContent]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const resetReviewState = useCallback(() => {
    setQuestionText("");
    setReviewId(null);
    setFlashMessage(null);
    setAnswer("");
  }, []);

  const fetchDueNote = useCallback(async () => {
    if (currentView !== "review") return;
    try {
      const response = await fetch("/api/reviews/due");
      if (!response.ok) {
        console.error("Failed to fetch due note");
        setCurrentNote(null);
        resetReviewState();
        return;
      }

      const result = await response.json();
      setCurrentNote(result.note);
      resetReviewState();
    } catch (error) {
      console.error("Error fetching due note:", error);
      setCurrentNote(null);
      resetReviewState();
    }
  }, [currentView, resetReviewState]);

  useEffect(() => {
    fetchDueNote();
  }, [currentView, fetchDueNote]);

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
        await response.json();
        setNoteContent("");
        setCurrentView("review");
        setToastMessage("Note added successfully!");
        setTimeout(() => setToastMessage(null), 3000);
        await fetchDueNote();
      } else {
        console.error("Failed to create note");
      }
    } catch (error) {
      console.error("Error submitting note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startReviewSession = useCallback(async () => {
    if (!currentNote || isLoadingQuestion) return;

    setIsLoadingQuestion(true);
    setQuestionText("");
    setReviewId(null);
    setFlashMessage(null);
    setAnswer("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ noteId: currentNote.id }),
      });

      if (!response.ok) {
        console.error("Failed to start review session");
        setFlashMessage("We couldn't generate a question. Please try again.");
        return;
      }

      const result = await response.json();
      if (!result?.question || !result?.reviewId) {
        setFlashMessage("We couldn't generate a question. Please try again.");
        return;
      }

      setQuestionText(result.question);
      setReviewId(result.reviewId);
      setQuestionAnimationKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error retrieving question:", error);
      setFlashMessage("Something went wrong while generating the question.");
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [currentNote, isLoadingQuestion]);

  const finalizeReview = useCallback(
    async (
      userAnswer: string,
      options?: { suppressFeedback?: boolean }
    ) => {
      if (!reviewId) return;
      setIsEvaluating(true);
      try {
        const response = await fetch(`/api/reviews/${reviewId}/answer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ answer: userAnswer }),
        });

        if (!response.ok) {
          console.error("Failed to evaluate answer");
          setFlashMessage("We couldn't grade that answer. Please try again.");
          return;
        }

        const result = await response.json();
        setReviewId(null);

        if (!options?.suppressFeedback) {
          const feedback = result?.evaluation?.feedback;
          if (feedback) {
            setFlashMessage(feedback);
          }
        }
      } catch (error) {
        console.error("Error finalizing review:", error);
        setFlashMessage("We couldn't grade that answer. Please try again.");
      } finally {
        setIsEvaluating(false);
      }
    },
    [reviewId]
  );

  const handleSubmitAnswer = async () => {
    if (!reviewId || !answer.trim()) return;
    await finalizeReview(answer.trim());
    setAnswer("");
  };

  const handleGotIt = async () => {
    setFlashMessage(null);
    resetReviewState();
    await fetchDueNote();
  };

  const reviewStatusLabel = useMemo(() => {
    if (flashMessage) return "Review update";
    if (isLoadingQuestion) return "Generating your next question...";
    if (questionText) return "Current question";
    if (currentNote) return "Ready to review";
    return "Nothing due right now";
  }, [flashMessage, isLoadingQuestion, questionText, currentNote]);

  const showStartReviewButton = Boolean(
    currentView === "review" && currentNote && !questionText && !isLoadingQuestion && !flashMessage
  );

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
            {currentTime.toLocaleDateString()} • {currentTime.toLocaleTimeString()}
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
          <div className="flex flex-col items-center gap-2 mt-12">
            <span className="text-sm uppercase tracking-[0.3em] text-white/60">{reviewStatusLabel}</span>
            {currentView === "review" ? (
              <motion.h2
                key={questionAnimationKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="text-2xl font-light text-white text-center"
                style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  fontWeight: 300,
                }}
              >
                {questionText
                  ? questionText
                  : currentNote
                  ? isLoadingQuestion
                    ? "Generating your next question..."
                    : "Press Start Review when you're ready"
                  : "No notes are due for review"}
              </motion.h2>
            ) : (
              <h2
                className="text-2xl font-light text-white text-center"
                style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  fontWeight: 300,
                }}
              >
                What would you like to remember?
              </h2>
            )}
          </div>

          {/* Start Review Button */}
          {showStartReviewButton && (
            <div className="flex justify-center">
              <button
                onClick={startReviewSession}
                className="flex items-center gap-3 px-6 py-3 bg-white/15 hover:bg-white/25 rounded-full text-white font-light transition-colors border border-white/20"
              >
                <Sparkles className="w-4 h-4" />
                Start Review
              </button>
            </div>
          )}

          {/* Textarea for add mode, or for active question */}
          {(currentView === "add" ||
            (currentView === "review" && questionText && !flashMessage)) && (
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
                    ? "Write your answer here..."
                    : "Add your note here..."
                }
                disabled={
                  currentView === "review" &&
                  (!!flashMessage || isLoadingQuestion || !questionText)
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

          {/* Empty state button */}
          {currentView === "review" &&
            !currentNote &&
            !questionText &&
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

          {currentView === "review" && questionText && !flashMessage && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex justify-center gap-4">
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
