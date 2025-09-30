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
  X,
  Maximize2,
  Minimize2,
  Send,
  MessageCircle,
  Hammer,
  Check,
  ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";

type Note = {
  id: number;
  content: string;
  explanation?: string | null;
};

type Stage = "idle" | "loading" | "question" | "evaluation";

type ContentBlock = {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: {
    content: string;
  };
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  toolResult?: {
    noteId: number;
    content: string;
  };
  isStreaming?: boolean;
};

export default function ReviewCard() {
  const [answer, setAnswer] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [currentView, setCurrentView] = useState<"review" | "add">("review");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
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

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [currentReviewIdForChat, setCurrentReviewIdForChat] = useState<
    number | null
  >(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

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

  const resetReviewState = useCallback((nextStage: Stage = "idle") => {
    setQuestionText("");
    setReviewId(null);
    setEvaluation(null);
    setStatusMessage(null);
    setStage(nextStage);
    setAnswer("");
    setCurrentReviewIdForChat(null);
    setChatMessages([]);
    setIsSidebarOpen(false);
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
        setCurrentReviewIdForChat(result.reviewId);
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

        // Keep reviewId for potential follow-up questions
        setCurrentReviewIdForChat(reviewId);

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

  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleClearChat = useCallback(() => {
    setChatMessages([]);
    setFollowUpQuestion("");
  }, []);

  const handleToggleExpand = useCallback(() => {
    setIsSidebarExpanded((prev) => !prev);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (
      !followUpQuestion.trim() ||
      !currentReviewIdForChat ||
      isSendingMessage
    ) {
      return;
    }

    const userMessage = followUpQuestion.trim();
    setFollowUpQuestion("");

    // Add user message to chat
    const newUserMessage: ChatMessage = {
      role: "user",
      content: userMessage,
    };
    setChatMessages((prev) => [...prev, newUserMessage]);

    // Add placeholder for streaming assistant message
    const streamingMessageIndex = chatMessages.length + 1;
    const streamingMessage: ChatMessage = {
      role: "assistant",
      content: [],
      isStreaming: true,
    };
    setChatMessages((prev) => [...prev, streamingMessage]);

    setIsSendingMessage(true);
    try {
      const response = await fetch(
        `/api/reviews/${currentReviewIdForChat}/followup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage,
            conversationHistory: chatMessages,
          }),
        }
      );

      if (!response.ok) {
        console.error("Failed to send message");
        setToastMessage("Failed to send message. Please try again.");
        setTimeout(() => setToastMessage(null), 3000);
        setChatMessages((prev) => prev.slice(0, -1)); // Remove streaming message
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let currentTextBlock = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));

              if (data.type === "text_start") {
                currentTextBlock = "";
              } else if (data.type === "text_delta") {
                currentTextBlock += data.text;
                setChatMessages((prev) => {
                  const updated = [...prev];
                  const msg = updated[streamingMessageIndex];
                  const content = Array.isArray(msg.content)
                    ? [...msg.content]
                    : [];

                  // Update or add text block
                  const textBlockIndex = content.findIndex(
                    (b) => b.type === "text"
                  );
                  if (textBlockIndex >= 0) {
                    content[textBlockIndex] = {
                      type: "text",
                      text: currentTextBlock,
                    };
                  } else {
                    content.push({ type: "text", text: currentTextBlock });
                  }

                  updated[streamingMessageIndex] = { ...msg, content };
                  return updated;
                });
              } else if (data.type === "tool_use_start") {
                const toolUseBlock: ContentBlock = {
                  type: "tool_use",
                  name: data.name,
                  id: data.id,
                };
                setChatMessages((prev) => {
                  const updated = [...prev];
                  const msg = updated[streamingMessageIndex];
                  const content = Array.isArray(msg.content)
                    ? [...msg.content]
                    : [];
                  content.push(toolUseBlock);
                  updated[streamingMessageIndex] = { ...msg, content };
                  return updated;
                });
              } else if (data.type === "tool_result") {
                setChatMessages((prev) => {
                  const updated = [...prev];
                  const msg = updated[streamingMessageIndex];
                  updated[streamingMessageIndex] = {
                    ...msg,
                    toolResult: {
                      noteId: data.noteId,
                      content: data.content,
                    },
                  };
                  return updated;
                });
              } else if (data.type === "done") {
                setChatMessages((prev) => {
                  const updated = [...prev];
                  const msg = updated[streamingMessageIndex];
                  updated[streamingMessageIndex] = {
                    ...msg,
                    isStreaming: false,
                  };
                  return updated;
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setToastMessage("Failed to send message. Please try again.");
      setTimeout(() => setToastMessage(null), 3000);
      setChatMessages((prev) => prev.slice(0, -1)); // Remove streaming message
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    followUpQuestion,
    currentReviewIdForChat,
    chatMessages,
    isSendingMessage,
  ]);

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
            <div className="max-w-3xl mx-auto flex justify-center gap-4">
              <button
                onClick={handleOpenSidebar}
                className="group flex items-center gap-2 px-6 py-3 bg-white/15 hover:bg-white/25 rounded-full text-white font-light transition-colors border border-white/20 text-sm uppercase tracking-[0.2em]"
              >
                <MessageCircle className="w-4 h-4" />
                Ask a question
              </button>
              <button
                onClick={handleNextQuestion}
                className="group flex items-center gap-2 px-6 py-3 bg-white/15 hover:bg-white/25 rounded-full text-white font-light transition-colors text-sm uppercase tracking-[0.2em]"
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

      {/* Sidebar */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: isSidebarOpen ? 0 : "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 h-screen z-50 flex"
        style={{
          width: isSidebarExpanded ? "600px" : "400px",
          transition: "width 0.3s ease-in-out",
        }}
      >
        <div
          className="w-full h-full flex flex-col border-l border-white/10 shadow-2xl"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            backdropFilter: "blur(30px) saturate(120%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white/60" />
              <h3 className="text-white font-light text-lg">Assistant</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleExpand}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title={isSidebarExpanded ? "Minimize" : "Expand"}
              >
                {isSidebarExpanded ? (
                  <Minimize2 className="w-4 h-4 text-white/70" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-white/70" />
                )}
              </button>
              <button
                onClick={handleClearChat}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Clear chat"
              >
                <Trash2 className="w-4 h-4 text-white/70" />
              </button>
              <button
                onClick={handleCloseSidebar}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40 text-center">
                <MessageCircle className="w-12 h-12 mb-4" />
                <p className="text-sm">Ask me anything about this review</p>
              </div>
            ) : (
              chatMessages.map((msg, index) => {
                const isUser = msg.role === "user";
                const contentBlocks =
                  typeof msg.content === "string"
                    ? [{ type: "text" as const, text: msg.content }]
                    : msg.content;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex flex-col gap-2 ${
                      isUser ? "items-end" : "items-center"
                    }`}
                  >
                    {contentBlocks.map((block, blockIndex) => {
                      if (block.type === "text" && block.text) {
                        return (
                          <div
                            key={blockIndex}
                            className={`max-w-[80%] rounded-xl p-4 ${
                              isUser
                                ? "bg-white/15 text-white"
                                : "bg-white/5 text-white/90"
                            }`}
                            style={{
                              fontFamily:
                                "var(--font-playfair), Georgia, serif",
                              fontWeight: 300,
                            }}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {block.text}
                              {msg.isStreaming && (
                                <span className="inline-block w-1 h-4 ml-1 bg-white/60 animate-pulse" />
                              )}
                            </p>
                          </div>
                        );
                      }

                      if (
                        block.type === "tool_use" &&
                        block.name === "add_note"
                      ) {
                        const noteId = msg.toolResult?.noteId || index;
                        const isExpanded = expandedNotes.has(noteId);

                        return (
                          <div
                            key={blockIndex}
                            className="w-[80%] bg-white/8 rounded-lg border border-white/10 overflow-hidden"
                          >
                            <div className="flex items-center justify-between px-3 py-2 text-white/70 text-xs">
                              <div className="flex items-center gap-2">
                                <Hammer className="w-3.5 h-3.5" />
                                <span className="font-medium">
                                  Used add_note
                                </span>
                                <div className="w-px h-4 bg-white/20 mx-1" />
                                <Check className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-white/50">
                                  Note saved
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  setExpandedNotes((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(noteId)) {
                                      next.delete(noteId);
                                    } else {
                                      next.add(noteId);
                                    }
                                    return next;
                                  });
                                }}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                              >
                                <ChevronDown
                                  className={`w-4 h-4 text-white/50 transition-transform ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                            </div>

                            <motion.div
                              initial={false}
                              animate={{
                                height: isExpanded ? "auto" : 0,
                                opacity: isExpanded ? 1 : 0,
                              }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 pt-1 border-t border-white/10">
                                <div className="text-xs text-white/60 mb-1">
                                  Note:
                                </div>
                                <div className="text-sm text-white/90 leading-relaxed">
                                  {msg.toolResult?.content ||
                                    block.input?.content}
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </motion.div>
                );
              })
            )}
            {isSendingMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="max-w-[80%] rounded-xl p-4 bg-white/5">
                  <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="relative">
              <input
                type="text"
                value={followUpQuestion}
                onChange={(e) => setFollowUpQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask a question..."
                disabled={isSendingMessage}
                className="w-full bg-white/5 text-white rounded-xl px-4 py-3 pr-12 placeholder:text-white/40 text-sm border border-white/10 focus:outline-none focus:border-white/20 transition-colors"
                style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  fontWeight: 300,
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!followUpQuestion.trim() || isSendingMessage}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
