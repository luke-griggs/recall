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
  ChevronRight,
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

type Stage = "idle" | "loading" | "question" | "evaluation";

export default function ReviewCard() {
  const [answer, setAnswer] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [currentView, setCurrentView] = useState<"review" | "add">("review");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionAnimationKey, setQuestionAnimationKey] = useState(0);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<{
    message: string;
    isCorrect: boolean;
  } | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [evaluationAnimationKey, setEvaluationAnimationKey] = useState(0);

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

  const resetReviewState = useCallback((nextStage: Stage = "idle") => {
    setQuestionText("");
    setReviewId(null);
    setEvaluation(null);
    setStatusMessage(null);
    setStage(nextStage);
    setAnswer("");
  }, []);

  const fetchDueNote = useCallback(async () => {
    if (currentView !== "review") return null;
    try {
      const response = await fetch("/api/reviews/due");
      if (!response.ok) {
        console.error("Failed to fetch due note");
        setCurrentNote(null);
        setStatusMessage("We couldn't fetch the next note. Please try again.");
        setStage("idle");
        return null;
      }

      const result = await response.json();
      const note: Note | null = result.note ?? null;
      setCurrentNote(note);
      if (!note) {
        setStatusMessage("Nothing due right now");
        setStage("idle");
      } else {
        setStatusMessage(null);
      }
      return note;
    } catch (error) {
      console.error("Error fetching due note:", error);
      setCurrentNote(null);
      setStatusMessage("We couldn't fetch the next note. Please try again.");
      setStage("idle");
      return null;
    }
  }, [currentView]);

  useEffect(() => {
    fetchDueNote();
  }, [currentView, fetchDueNote]);

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

  const startReviewSession = useCallback(
    async (noteOverride?: Note | null) => {
      const targetNote = noteOverride ?? currentNote;
      if (!targetNote || isLoadingQuestion) return;

      setIsLoadingQuestion(true);
      setStage("loading");
      setEvaluation(null);
      setStatusMessage(null);
      setQuestionText("");
      setReviewId(null);
      setAnswer("");

      try {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ noteId: targetNote.id }),
        });

        if (!response.ok) {
          console.error("Failed to start review session");
          setStatusMessage(
            "We couldn't generate a question. Please try again."
          );
          return;
        }

        const result = await response.json();
        if (!result?.question || !result?.reviewId) {
          setStatusMessage(
            "We couldn't generate a question. Please try again."
          );
          return;
        }

        setCurrentNote(targetNote);
        setQuestionText(result.question);
        setReviewId(result.reviewId);
        setQuestionAnimationKey((prev) => prev + 1);
        setStage("question");
        setStatusMessage(null);
      } catch (error) {
        console.error("Error retrieving question:", error);
        setStatusMessage("Something went wrong while generating the question.");
      } finally {
        setIsLoadingQuestion(false);
      }
    },
    [
      currentNote,
      isLoadingQuestion,
      setCurrentNote,
      setQuestionText,
      setReviewId,
      setQuestionAnimationKey,
      setStage,
      setStatusMessage,
      setEvaluation,
      setAnswer,
    ]
  );

  const finalizeReview = useCallback(
    async (userAnswer: string, options?: { suppressFeedback?: boolean }) => {
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
          setStatusMessage("We couldn't grade that answer. Please try again.");
          return;
        }

        const result = await response.json();
        setReviewId(null);

        if (!options?.suppressFeedback) {
          const feedback = result?.evaluation?.feedback;
          const isCorrect = Boolean(result?.evaluation?.isCorrect);
          if (feedback) {
            setEvaluation({
              message: feedback,
              isCorrect,
            });
            setEvaluationAnimationKey((prev) => prev + 1);
            setStage("evaluation");
            setStatusMessage(null);
          } else {
            setStatusMessage(
              "We couldn't read the feedback. Please try again."
            );
          }
        }
      } catch (error) {
        console.error("Error finalizing review:", error);
        setStatusMessage("We couldn't grade that answer. Please try again.");
      } finally {
        setIsEvaluating(false);
      }
    },
    [
      reviewId,
      setStatusMessage,
      setEvaluation,
      setStage,
      setEvaluationAnimationKey,
    ]
  );

  const handleSubmitAnswer = async () => {
    if (!reviewId || !answer.trim()) return;
    await finalizeReview(answer.trim());
    setAnswer("");
  };

  const goToNextQuestion = useCallback(async () => {
    resetReviewState("loading");
    setIsLoadingQuestion(true);
    const nextNote = await fetchDueNote();
    if (nextNote) {
      await startReviewSession(nextNote);
    } else {
      setIsLoadingQuestion(false);
    }
  }, [
    fetchDueNote,
    resetReviewState,
    setIsLoadingQuestion,
    startReviewSession,
  ]);

  const handleNextQuestion = useCallback(async () => {
    await goToNextQuestion();
  }, [goToNextQuestion]);

  const handleForgetNote = useCallback(async () => {
    if (!currentNote || isDeletingNote || isLoadingQuestion) return;

    setIsDeletingNote(true);
    try {
      const response = await fetch(`/api/notes/${currentNote.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        console.error("Failed to delete note");
        setToastMessage("Failed to delete note. Please try again.");
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }

      setCurrentNote(null);
      setToastMessage("Note deleted successfully!");
      setTimeout(() => setToastMessage(null), 3000);
      await goToNextQuestion();
    } catch (error) {
      console.error("Error deleting note:", error);
      setToastMessage("Failed to delete note. Please try again.");
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsDeletingNote(false);
    }
  }, [currentNote, goToNextQuestion, isDeletingNote, isLoadingQuestion]);

  const primaryLabel = useMemo(() => {
    if (currentView === "add") {
      return "What would you like to remember?";
    }

    if (stage === "evaluation" && evaluation) {
      return evaluation.isCorrect ? "Great job" : "Review update";
    }
    if (stage === "loading" || isLoadingQuestion)
      return "Generating your next question...";
    if (stage === "question" && questionText) return "question";
    if (currentNote) return "Ready to review?";
    return statusMessage ?? "Nothing due right now";
  }, [
    currentView,
    stage,
    evaluation,
    isLoadingQuestion,
    questionText,
    currentNote,
    statusMessage,
  ]);

  const showStartReviewButton = Boolean(
    currentView === "review" &&
      currentNote &&
      stage === "idle" &&
      !isLoadingQuestion &&
      !evaluation
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
            <span className="text-md uppercase tracking-[0.2em] text-white/60">
              {primaryLabel}
            </span>
            {currentView === "review" ? (
              stage === "evaluation" && evaluation ? (
                <motion.div
                  key={`evaluation-${evaluationAnimationKey}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="text-white/90 text-lg leading-relaxed text-center max-w-3xl"
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontWeight: 300,
                  }}
                >
                  {evaluation.message}
                </motion.div>
              ) : (
                <motion.h2
                  key={`question-${questionAnimationKey}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="text-2xl font-light text-white text-center"
                  style={{
                    fontFamily: "var(--font-playfair), Georgia, serif",
                    fontWeight: 300,
                  }}
                >
                  {stage === "question" && questionText
                    ? questionText
                    : statusMessage
                    ? statusMessage
                    : currentNote
                    ? stage === "loading" || isLoadingQuestion
                      ? null
                      : null
                    : "No notes are due for review"}
                </motion.h2>
              )
            ) : null}
          </div>

          {/* Begin Review Button */}
          {showStartReviewButton && (
            <div className="flex justify-center">
              <button
                onClick={() => startReviewSession()}
                className="group flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/8 rounded-full tracking-[0.1em] text-white/60 transition-colors border border-white/20"
              >
                Click here
                <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 mt-0.5" />
              </button>
            </div>
          )}

          {/* Textarea for add mode, or for active question */}
          {(currentView === "add" ||
            (currentView === "review" &&
              stage === "question" &&
              questionText)) && (
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
                  (stage !== "question" || isLoadingQuestion || !questionText)
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
            !isLoadingQuestion &&
            stage === "idle" && (
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

          {currentView === "review" && questionText && stage === "question" && (
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

          {currentView === "review" && stage === "evaluation" && evaluation && (
            <div className="max-w-3xl mx-auto flex justify-center">
              <button
                onClick={handleNextQuestion}
                className="group flex items-center gap-2 px-6 py-3 bg-white/15 hover:bg-white/25 rounded-full text-white font-light transition-colors border border-white/20 text-sm uppercase tracking-[0.2em]"
              >
                Next question
                <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
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
