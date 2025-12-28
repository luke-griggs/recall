"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Brain, RefreshCw, ChevronLeft, Edit3, Check, X } from "lucide-react";

interface Memory {
  id: string;
  content: string;
  lastUpdatedAt: string;
  lastProcessedAt: string | null;
}

export default function MemoryPage() {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    fetchMemory();
  }, []);

  const fetchMemory = async () => {
    try {
      const res = await fetch("/api/memory");
      const data = await res.json();
      setMemory(data);
      if (data?.content) {
        setEditContent(data.content);
      }
    } catch (error) {
      console.error("Failed to fetch memory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMemory = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/memory/generate", { method: "POST" });
      const data = await res.json();
      if (data.memory) {
        setMemory(data.memory);
        setEditContent(data.memory.content);
      }
    } catch (error) {
      console.error("Failed to generate memory:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveMemory = async () => {
    try {
      const res = await fetch("/api/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      const updated = await res.json();
      setMemory(updated);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save memory:", error);
    }
  };

  const cancelEdit = () => {
    setEditContent(memory?.content || "");
    setIsEditing(false);
  };

  // Parse memory content into sections for display
  const renderMemory = (content: string) => {
    // Split by bold headers like **Work context**
    const sections = content.split(/(?=\*\*[^*]+\*\*)/);

    return sections.map((section, index) => {
      if (!section.trim()) return null;

      // Extract header and content
      const headerMatch = section.match(/^\*\*([^*]+)\*\*/);
      const header = headerMatch ? headerMatch[1] : null;
      const sectionContent = header
        ? section.replace(/^\*\*[^*]+\*\*\n?/, "").trim()
        : section.trim();

      if (!sectionContent && !header) return null;

      return (
        <div key={index} className="mb-8 last:mb-0">
          {header && (
            <h3 className="text-lg font-semibold text-white/90 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              {header}
            </h3>
          )}
          <div className="text-white/70 leading-relaxed whitespace-pre-wrap pl-4">
            {sectionContent.split(/(\*[^*]+\*)/).map((part, i) => {
              // Handle italic text like *Recent months*
              if (part.startsWith("*") && part.endsWith("*")) {
                return (
                  <span key={i} className="text-white/90 font-medium">
                    {part.slice(1, -1)}
                  </span>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </div>
        </div>
      );
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/brain"
              className="p-2 hover:bg-white/5 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white/60" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-blue-500 rounded-2xl blur-lg opacity-50" />
                <div className="relative p-3 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-2xl border border-white/10">
                  <Brain className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Memory</h1>
                <p className="text-white/50 text-sm">
                  {memory
                    ? `Last updated ${formatDate(memory.lastUpdatedAt)}`
                    : "No memory yet"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && memory && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 border border-white/10 rounded-xl transition-all text-white/70 hover:text-white"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateMemory}
              disabled={isGenerating || isEditing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500/20 to-blue-500/20 hover:from-violet-500/30 hover:to-blue-500/30 border border-white/10 rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`}
              />
              <span>{isGenerating ? "Updating..." : "Update"}</span>
            </motion.button>
          </div>
        </div>

        {/* Description */}
        <p className="text-white/50 text-sm mb-8">
          Here&apos;s what Brain remembers about you. This summary is
          regenerated each night based on your conversations.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        ) : isEditing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-[600px] p-6 bg-[#141414] border border-white/10 rounded-2xl text-white/90 leading-relaxed resize-none focus:outline-none focus:border-white/20 font-mono text-sm"
              placeholder="Enter your memory content using markdown format...

**Work context**
Your professional background...

**Personal context**
Your interests and personality...

**Top of mind**
What you're currently focused on...

**Brief history**
*Recent months* - What you've been doing...
*Earlier context* - Previous activities...

**Long-term background**
Your enduring traits and learning style..."
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelEdit}
                className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 border border-white/10 rounded-xl transition-colors text-white/70"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={saveMemory}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-xl transition-colors"
              >
                <Check className="w-4 h-4" />
                Save
              </button>
            </div>
          </motion.div>
        ) : memory?.content ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-gradient-to-br from-[#141414] to-[#0f0f0f] rounded-2xl border border-white/5"
          >
            {renderMemory(memory.content)}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <Brain className="w-16 h-16 mx-auto mb-6 text-white/20" />
            <h2 className="text-xl font-medium text-white/80 mb-2">
              No memory yet
            </h2>
            <p className="text-white/50 mb-6 max-w-md mx-auto">
              Have some conversations first, then click &quot;Update&quot; to
              generate your memory, or write it manually.
            </p>
            <button
              onClick={() => setIsEditing(true)}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
            >
              Write manually
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
