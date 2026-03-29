"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Markdown } from "@/components/markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setStreaming(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...updatedMessages, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: current };
          return copy;
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Error: ${errorMsg}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="-mx-2 -my-6 flex h-[calc(100dvh-49px)] min-h-0 flex-col">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Chat with Bort
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Ask about games, get recommendations, compare rankings
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Ask Bort anything about your board game collection
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {msg.role === "assistant" ? (
                msg.content ? (
                  <Markdown content={msg.content} />
                ) : (
                  <ThinkingIndicator />
                )
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
      >
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about games..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="relative h-6 w-6">
        {/* Outer orbiting ring */}
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-blue-500 [animation-duration:1.5s]" />
        {/* Inner orbiting ring — opposite direction */}
        <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-b-violet-500 [animation-direction:reverse] [animation-duration:1s]" />
        {/* Center glow dot */}
        <div className="absolute inset-[7px] animate-pulse rounded-full bg-blue-500 shadow-[0_0_8px_2px_rgba(59,130,246,0.6)] [animation-duration:1.2s]" />
      </div>
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        <span className="inline-flex items-baseline">
          Bort is thinking
          <span className="ml-0.5 inline-flex w-4">
            <span className="animate-[dotPulse_1.4s_infinite_both] text-zinc-400 dark:text-zinc-500">.</span>
            <span className="animate-[dotPulse_1.4s_0.2s_infinite_both] text-zinc-400 dark:text-zinc-500">.</span>
            <span className="animate-[dotPulse_1.4s_0.4s_infinite_both] text-zinc-400 dark:text-zinc-500">.</span>
          </span>
        </span>
      </span>
    </div>
  );
}

const SUGGESTIONS = [
  "What kind of games do I like?",
  "Which games do I rate higher than the group?",
  "What is a game that I haven't tried that I might like?",
  "Recommend something under 60 minutes",
];
