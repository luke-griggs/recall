"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  MessageSquare,
  Send,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { Streamdown } from "streamdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

// Collapsible user message component
function UserMessage({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 300;
  const isLong = content.length > maxLength;

  return (
    <div className="bg-[#2a2a2a] rounded-2xl px-4 py-3 max-w-[85%]">
      <p
        className={`whitespace-pre-wrap leading-relaxed text-white/90 ${
          !isExpanded && isLong ? "line-clamp-4" : ""
        }`}
      >
        {content}
      </p>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-white/50 hover:text-white/70 text-sm mt-2 transition-colors"
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export default function BrainPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setConversations(data);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
    }
  }, []);

  // Fetch single conversation with messages
  const fetchConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      setCurrentConversation(data);
      setMessages(data.messages || []);
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // Create new conversation
  const createConversation = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const newConv = await res.json();
      setConversations((prev) => [newConv, ...prev]);
      setCurrentConversation(newConv);
      setMessages([]);
      inputRef.current?.focus();
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  };

  // Delete conversation
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let convId = currentConversation?.id;

    // Create conversation if none exists
    if (!convId) {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const newConv = await res.json();
        convId = newConv.id;
        setConversations((prev) => [newConv, ...prev]);
        setCurrentConversation(newConv);
      } catch (error) {
        console.error("Failed to create conversation:", error);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingMessage("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          message: input,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullMessage = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                // Add the complete message
                const assistantMessage: Message = {
                  id: Date.now().toString(),
                  role: "assistant",
                  content: fullMessage,
                  createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setStreamingMessage("");
              } else {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.text) {
                    fullMessage += parsed.text;
                    setStreamingMessage(fullMessage);
                  }
                  if (parsed.title) {
                    // Update conversation title
                    setConversations((prev) =>
                      prev.map((c) =>
                        c.id === convId ? { ...c, title: parsed.title } : c
                      )
                    );
                    setCurrentConversation((prev) =>
                      prev ? { ...prev, title: parsed.title } : null
                    );
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-white overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-[280px] bg-[#141414] border-r border-white/5 flex flex-col"
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-white/5">
              <button
                onClick={createConversation}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-200 group"
              >
                <Plus className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
                <span className="text-white/70 group-hover:text-white transition-colors">
                  New Chat
                </span>
              </button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group flex items-center gap-2 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                    currentConversation?.id === conv.id
                      ? "bg-white/10"
                      : "hover:bg-white/5"
                  }`}
                  onClick={() => fetchConversation(conv.id)}
                >
                  <MessageSquare className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <span className="flex-1 truncate text-sm text-white/70">
                    {conv.title}
                  </span>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded-lg transition-all duration-200"
                  >
                    <Trash2 className="w-4 h-4 text-white/40 hover:text-red-400" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            {isSidebarOpen ? (
              <X className="w-5 h-5 text-white/70" />
            ) : (
              <Menu className="w-5 h-5 text-white/70" />
            )}
          </button>
          <h1 className="text-lg font-medium text-white/90">
            {currentConversation?.title || "Brain"}
          </h1>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !streamingMessage ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                {/* Glowing orb */}
                <div className="relative mx-auto w-20 h-20 mb-8">
                  <div className="absolute inset-0 rounded-full bg-white/20 blur-xl animate-pulse" />
                  <div className="absolute inset-2 rounded-full bg-white/30 blur-lg animate-pulse" />
                  <div className="absolute inset-4 rounded-full bg-white/50 blur-md" />
                  <div className="absolute inset-6 rounded-full bg-white/80 blur-sm" />
                  <div className="absolute inset-[30px] rounded-full bg-white" />
                </div>

                <h2 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                  What&apos;s on your mind?
                </h2>
                <p className="text-white/50 text-lg">
                  Start a conversation with your brain
                </p>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-8">
              {messages.map((msg, index) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`${
                    msg.role === "user" ? "flex justify-end mb-6" : "mb-8"
                  }`}
                >
                  {msg.role === "user" ? (
                    <UserMessage content={msg.content} />
                  ) : (
                    <div className="flex gap-4">
                      {/* Assistant icon */}
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center mt-1">
                        <Sparkles className="w-3.5 h-3.5 text-white/70" />
                      </div>
                      {/* Assistant message - no box */}
                      <div className="flex-1 min-w-0 brain-markdown">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Streaming message */}
              {streamingMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8"
                >
                  <div className="flex gap-4">
                    {/* Assistant icon */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center mt-1">
                      <Sparkles className="w-3.5 h-3.5 text-white/70 animate-pulse" />
                    </div>
                    {/* Streaming message - no box */}
                    <div className="flex-1 min-w-0 brain-markdown">
                      <Streamdown>{streamingMessage}</Streamdown>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <div className="relative group">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-white/20 via-white/10 to-white/20 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />

              <div className="relative bg-[#242424] rounded-2xl border border-white/10 focus-within:border-white/20 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message Brain..."
                  rows={1}
                  className="w-full px-4 py-4 pr-14 bg-transparent text-white placeholder-white/40 resize-none focus:outline-none max-h-40"
                  style={{
                    minHeight: "56px",
                    height: "auto",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${Math.min(
                      target.scrollHeight,
                      160
                    )}px`;
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-3 bottom-3 p-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <Send
                    className={`w-5 h-5 ${
                      isLoading ? "text-white/30" : "text-white/80"
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-white/30 mt-3">
              Brain can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
