"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Keyboard, Mic, PauseCircle, Play, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

interface SavedMessage {
  role: "user" | "assistant";
  content: string;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognitionEventResult {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionEventResult;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

async function requestMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      granted: false,
      message: "This browser cannot request microphone access. You can continue with typed answers.",
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true, message: "" };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    const message =
      name === "NotAllowedError"
        ? "Microphone is blocked by the browser or operating system. Allow microphone access for this site, then try again."
        : "Microphone is unavailable right now. You can continue with typed answers.";

    return { granted: false, message };
  }
}

const VoiceInterview = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  questions,
}: {
  userName: string;
  userId?: string;
  interviewId?: string;
  feedbackId?: string;
  questions?: string[];
}) => {
  const router = useRouter();

  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking" | "finished">("idle");
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [lastMessage, setLastMessage] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isTextFallback, setIsTextFallback] = useState(false);
  const [answerMode, setAnswerMode] = useState<"voice" | "type">("voice");
  const [micMessage, setMicMessage] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isVoiceTyping, setIsVoiceTyping] = useState(false);
  const [isVapiActive, setIsVapiActive] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const messagesRef = useRef<SavedMessage[]>([]);
  const transcriptLogRef = useRef<HTMLDivElement | null>(null);
  const questionIndexRef = useRef(0);
  const isProcessingRef = useRef(false);
  const shouldListenRef = useRef(false);
  const isTextFallbackRef = useRef(false);
  const handleUserResponseRef = useRef<(userText: string) => void>(() => {});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    questionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    const transcriptLog = transcriptLogRef.current;
    if (!transcriptLog) return;

    transcriptLog.scrollTop = transcriptLog.scrollHeight;
  }, [messages, liveTranscript]);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(text);
      synthRef.current = utterance;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) =>
          v.name.includes("Google") && v.name.includes("Female") ||
          v.name.includes("Samantha") ||
          v.name.includes("Microsoft Zira") ||
          v.name.includes("Google UK English Female")
      ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];

      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      const fallbackTimer = window.setTimeout(() => {
        setIsSpeaking(false);
        resolve();
      }, Math.max(6000, text.length * 80));

      utterance.onend = () => {
        window.clearTimeout(fallbackTimer);
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        window.clearTimeout(fallbackTimer);
        setIsSpeaking(false);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const startListening = useCallback(() => {
    if (!shouldListenRef.current) return;

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      shouldListenRef.current = false;
      isTextFallbackRef.current = true;
      setIsTextFallback(true);
      setAnswerMode("type");
      setMicMessage("Voice input is not available in this browser. Typing is ready.");
      return;
    }

    recognitionRef.current?.stop();
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    let finalTranscript = "";
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    recognition.onresult = (event) => {
      let interim = "";
      finalTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += `${transcript.trim()} `;
        } else {
          interim += transcript;
        }
      }

      const dictatedText = `${finalTranscript}${interim}`.trim();
      setLiveTranscript(dictatedText);
      setTypedAnswer(dictatedText);

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (finalTranscript.trim().length > 0 && !isProcessingRef.current) {
          recognition.stop();
        }
      }, 2500);
    };

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      const userText = finalTranscript.trim();
      setLiveTranscript("");
      setIsVoiceTyping(false);

      if (userText.length > 0 && !isProcessingRef.current) {
        isProcessingRef.current = true;
        handleUserResponseRef.current(userText);
      } else if (shouldListenRef.current && !isProcessingRef.current) {
        window.setTimeout(startListening, 300);
      }
    };

    recognition.onerror = (event) => {
      const fallbackMessages: Record<string, string> = {
        "not-allowed":
          "Microphone access is blocked. Allow it in browser or system settings, then try voice again.",
        network: "",
        "service-not-allowed":
          "Voice input is blocked by this browser right now. Typing is ready.",
      };

      const message =
        fallbackMessages[event.error] ||
        "";

      shouldListenRef.current = false;
      isTextFallbackRef.current = true;
      setIsTextFallback(true);
      setAnswerMode("type");
      setMicMessage(message);
      setStatus("listening");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsVoiceTyping(true);
      setStatus("listening");
    } catch (error) {
      shouldListenRef.current = false;
      isTextFallbackRef.current = true;
      setIsTextFallback(true);
      setAnswerMode("type");
      setMicMessage("Voice input could not start. Typing is ready.");
      setIsVoiceTyping(false);
    }
  }, []);

  const handleFinish = useCallback(async (finalMessages: SavedMessage[]) => {
    if (!interviewId || !userId) {
      router.push("/");
      return;
    }

    toast.info("Generating your feedback...");

    try {
      const { success, feedbackId: id } = await createFeedback({
        interviewId,
        userId,
        transcript: finalMessages,
        feedbackId,
      });

      if (success && id) {
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        toast.error("Could not generate feedback.");
        router.push("/");
      }
    } catch (error) {
      console.error("Feedback error:", error);
      router.push("/");
    }
  }, [feedbackId, interviewId, router, userId]);

  useEffect(() => {
    const onCallStart = () => {
      setIsVapiActive(true);
      setIsStarted(true);
      setAnswerMode("voice");
      setMicMessage("");
      setCurrentQuestionIndex(1);
      questionIndexRef.current = 1;
      setStatus("listening");
    };

    const onCallEnd = () => {
      setIsVapiActive(false);
      setIsSpeaking(false);
      shouldListenRef.current = false;
      setStatus("finished");
      handleFinish(messagesRef.current);
    };

    const onMessage = (message: Message) => {
      if (message.type !== "transcript") return;

      const transcript = message.transcript.trim();
      if (!transcript) return;

      if (message.transcriptType === "partial" && message.role === "user") {
        setTypedAnswer(transcript);
        setLiveTranscript(transcript);
        setIsVoiceTyping(true);
        return;
      }

      if (message.transcriptType === "final") {
        const savedMessage: SavedMessage = {
          role: message.role === "assistant" ? "assistant" : "user",
          content: transcript,
        };

        setMessages((prev) => {
          const nextMessages = [...prev, savedMessage];
          messagesRef.current = nextMessages;
          return nextMessages;
        });
        setLastMessage(transcript);

        if (message.role === "user") {
          setTypedAnswer(transcript);
          setLiveTranscript("");
          setIsVoiceTyping(false);
        }
      }
    };

    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);
    const onError = () => {
      setIsVapiActive(false);
      setIsSpeaking(false);
      setIsVoiceTyping(false);
      shouldListenRef.current = false;
      setMicMessage("Voice could not start. Check microphone permission, then press Start voice again.");
      setStatus("listening");
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, [handleFinish, questions?.length]);

  const speakWithoutBlocking = useCallback((text: string) => {
    void speak(text).catch((error) => {
      console.error("Speech playback error:", error);
    });
  }, [speak]);

  const startVapiInterview = useCallback(async () => {
    if (isVapiActive || status === "thinking" || status === "speaking") return;

    setIsStarted(true);
    setAnswerMode("voice");
    setIsTextFallback(false);
    isTextFallbackRef.current = false;
    shouldListenRef.current = false;
    setMicMessage("");
    setTypedAnswer("");
    setLiveTranscript("");
    setIsVoiceTyping(false);
    setStatus("speaking");

    try {
      const formattedQuestions = (questions || [])
        .map((question, index) => `${index + 1}. ${question}`)
        .join("\n");

      await vapi.start(interviewer, {
        variableValues: {
          username: userName,
          questions: formattedQuestions,
        },
      });
    } catch (error) {
      console.error("Vapi start error:", error);
      setIsVapiActive(false);
      setIsVoiceTyping(false);
      setStatus("listening");
      setMicMessage("Voice could not start. Allow microphone access and press Start voice again.");
    }
  }, [isVapiActive, questions, status, userName]);

  const handleUserResponse = useCallback(async (userText: string) => {
    const userMessage: SavedMessage = { role: "user", content: userText };
    const updatedMessages = [...messagesRef.current, userMessage];
    setMessages(updatedMessages);
    setLastMessage(userText);
    setStatus("thinking");

    const currentIdx = questionIndexRef.current;
    const totalQuestions = questions?.length || 0;
    const nextQuestion = questions?.[currentIdx];
    const isLastQuestion = currentIdx >= totalQuestions;
    const fallbackAiText = isLastQuestion
      ? "This concludes our interview. Thank you for your time!"
      : `Thank you for sharing that. ${nextQuestion || "Let's move to the next question."}`;

    try {
      const conversationHistory = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/interview/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          conversationHistory,
          role: "the candidate",
          company: "",
          nextQuestion,
          isLastQuestion,
        }),
      });

      const data = await response.json();
      const aiText = data.success && data.message ? data.message : fallbackAiText;

      const aiMessage: SavedMessage = { role: "assistant", content: aiText };
      const newMessages = [...updatedMessages, aiMessage];
      setMessages(newMessages);
      setLastMessage(aiText);

      if (isTextFallbackRef.current) {
        setStatus("listening");
        speakWithoutBlocking(aiText);
      } else {
        setStatus("speaking");
        await speak(aiText);
      }

      const concludeKeywords = ["concludes our interview", "end of the interview", "thank you for your time", "that wraps up"];
      const isConclusion = concludeKeywords.some((kw) => aiText.toLowerCase().includes(kw));

      if (isConclusion || isLastQuestion) {
        setStatus("finished");
        isProcessingRef.current = false;
        handleFinish(newMessages);
        return;
      }

      setCurrentQuestionIndex((prev) => {
        const nextIndex = prev + 1;
        questionIndexRef.current = nextIndex;
        return nextIndex;
      });
      isProcessingRef.current = false;
      if (isTextFallbackRef.current) {
        setStatus("listening");
      } else {
        startListening();
      }
    } catch (error) {
      console.error("Error:", error);
      const aiMessage: SavedMessage = { role: "assistant", content: fallbackAiText };
      const newMessages = [...updatedMessages, aiMessage];
      setMessages(newMessages);
      setLastMessage(fallbackAiText);

      if (isLastQuestion) {
        setStatus("finished");
        isProcessingRef.current = false;
        handleFinish(newMessages);
        return;
      }

      if (isTextFallbackRef.current) {
        setStatus("listening");
        speakWithoutBlocking(fallbackAiText);
      } else {
        setStatus("speaking");
        await speak(fallbackAiText);
      }

      setCurrentQuestionIndex((prev) => {
        const nextIndex = prev + 1;
        questionIndexRef.current = nextIndex;
        return nextIndex;
      });
      isProcessingRef.current = false;
      if (isTextFallbackRef.current) {
        setStatus("listening");
      } else {
        startListening();
      }
    }
  }, [handleFinish, questions, speak, speakWithoutBlocking, startListening]);

  useEffect(() => {
    handleUserResponseRef.current = handleUserResponse;
  }, [handleUserResponse]);

  const handleStart = async () => {
    if (isStarted) return;

    if (answerMode === "voice") {
      await startVapiInterview();
      return;
    }

    setIsStarted(true);
    setMicMessage("");

    const greeting = `Hello ${userName}! Thank you for joining this interview today. I'll be asking you a series of questions to learn about your experience and skills. Let's get started. ${questions?.[0] || "Tell me about yourself."}`;

    const aiMessage: SavedMessage = { role: "assistant", content: greeting };
    setMessages([aiMessage]);
    setLastMessage(greeting);

    questionIndexRef.current = 1;
    setCurrentQuestionIndex(1);
    setStatus("listening");
    setIsTextFallback(true);
    isTextFallbackRef.current = true;
    speakWithoutBlocking(greeting);
  };

  const handleRetryMicrophone = async () => {
    if (!isStarted || status === "thinking" || status === "speaking") return;

    await startVapiInterview();
  };

  const switchToTypeMode = () => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setIsVoiceTyping(false);
    setAnswerMode("type");
    setIsTextFallback(true);
    isTextFallbackRef.current = true;
    setMicMessage("");
    setStatus("listening");
  };

  const switchToVoiceMode = () => {
    setAnswerMode("voice");
    setMicMessage("");
    if (isStarted && !isVapiActive) {
      void startVapiInterview();
    }
  };

  const handleEnd = () => {
    shouldListenRef.current = false;
    isTextFallbackRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (isVapiActive) {
      vapi.stop();
      setIsVapiActive(false);
      setStatus("finished");
      return;
    }
    window.speechSynthesis?.cancel();
    setStatus("finished");
    handleFinish(messagesRef.current);
  };

  const handleTypedSubmit = () => {
    const answer = typedAnswer.trim();
    if (!answer || isProcessingRef.current || status === "thinking" || status === "speaking") return;

    setTypedAnswer("");
    setLiveTranscript("");
    isProcessingRef.current = true;
    handleUserResponseRef.current(answer);
  };

  const handleReplay = () => {
    if (lastMessage) speakWithoutBlocking(lastMessage);
  };

  const statusText = {
    idle: "Click Start to begin your interview",
    listening: answerMode === "type" ? "Type your answer below" : "Listening... Speak your answer",
    thinking: "Processing your response...",
    speaking: "Interviewer is speaking...",
    finished: "Interview complete. Generating feedback...",
  };

  return (
    <>
      <div className="call-view">
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="AI Interviewer"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>

          {isStarted && (
            <div className="voice-status-badge">
              <span className={`status-dot ${status === "listening" ? "status-dot-listening" : status === "speaking" ? "status-dot-speaking" : status === "thinking" ? "status-dot-thinking" : ""}`} />
              <span className="text-xs text-light-100">{statusText[status]}</span>
            </div>
          )}
        </div>

        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="User"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>

            {status === "listening" && liveTranscript && (
              <div className="live-transcript">
                <p className="text-sm text-primary-200 italic">{liveTranscript}</p>
              </div>
            )}

          </div>
        </div>
      </div>

      {lastMessage && (
        <div className="conversation-panel">
          <div className="conversation-header">
            <span>Conversation transcript</span>
            <small>{messages.length} {messages.length === 1 ? "line" : "lines"}</small>
          </div>

          <div className="conversation-log" ref={transcriptLogRef}>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
                className={cn(
                  "conversation-message",
                  message.role === "user"
                    ? "conversation-message-user"
                    : "conversation-message-assistant"
                )}
              >
                <span>{message.role === "user" ? "You" : "Interviewer"}</span>
                <p>{message.content}</p>
              </div>
            ))}

            {liveTranscript && (
              <div className="conversation-message conversation-message-user conversation-message-live">
                <span>You</span>
                <p>{liveTranscript}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isStarted && lastMessage && status !== "finished" && (
        <div className="w-full flex justify-center">
          <button type="button" className="btn-secondary" onClick={handleReplay}>
            <RotateCcw className="size-4" />
            Replay Voice
          </button>
        </div>
      )}

      {isStarted && questions && answerMode === "type" && (
        <div className="question-progress-bar">
          <div className="question-progress-track">
            <div
              className="question-progress-fill"
              style={{ width: `${Math.min((currentQuestionIndex / questions.length) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-light-400 mt-1">
            Question {Math.min(currentQuestionIndex, questions.length)} of {questions.length}
          </p>
        </div>
      )}

      {isStarted && status !== "finished" && (
        <div className="text-answer-box">
          <div className="answer-mode-tabs" role="tablist" aria-label="Answer mode">
            <button
              type="button"
              className={answerMode === "voice" ? "answer-mode-active" : ""}
              onClick={switchToVoiceMode}
              disabled={status === "thinking" || status === "speaking"}
            >
              <Mic className="size-4" />
              Voice
            </button>
            <button
              type="button"
              className={answerMode === "type" ? "answer-mode-active" : ""}
              onClick={switchToTypeMode}
              disabled={status === "thinking" || status === "speaking"}
            >
              <Keyboard className="size-4" />
              Type
            </button>
          </div>

          {answerMode === "type" && micMessage && (
            <div className="mic-help">
              <p>{micMessage}</p>
              <button type="button" onClick={handleRetryMicrophone}>
                <Mic className="size-4" />
                Try microphone again
              </button>
            </div>
          )}

          {answerMode === "voice" && liveTranscript && (
            <div className="live-transcript input-transcript">
              <p className="text-sm text-primary-200 italic">Voice is typing into the answer box.</p>
            </div>
          )}

          <div className="answer-composer">
            <div className="composer-topline">
              <span>
                {answerMode === "voice"
                  ? isVoiceTyping
                    ? "Listening and typing"
                    : "Voice mode ready"
                  : "Type mode"}
              </span>
              <small>{typedAnswer.trim().split(/\s+/).filter(Boolean).length} words</small>
            </div>
          <textarea
            className="text-answer-input"
            value={typedAnswer}
            onChange={(event) => setTypedAnswer(event.target.value)}
            placeholder={
              answerMode === "voice"
                ? "Speak now. Your words will appear here, and you can edit before sending..."
                : "Type your answer..."
            }
            disabled={status === "thinking" || status === "speaking"}
          />
          </div>
          <button
            type="button"
            className="btn-primary text-answer-submit"
            onClick={handleTypedSubmit}
            disabled={!typedAnswer.trim() || status === "thinking" || status === "speaking"}
          >
            <Keyboard className="size-4" />
            Send Answer
          </button>
        </div>
      )}

      <div className="w-full flex justify-center">
        {!isStarted ? (
          <button className="btn-call" onClick={handleStart}>
            <Play className="size-4" />
            Start Interview
          </button>
        ) : status !== "finished" ? (
          <button className="btn-disconnect" onClick={handleEnd}>
            {status === "listening" ? <Mic className="size-4" /> : <PauseCircle className="size-4" />}
            End Interview
          </button>
        ) : (
          <div className="flex items-center gap-2 text-primary-200">
            <span className="loading-spinner" />
            Generating feedback...
          </div>
        )}
      </div>
    </>
  );
};

export default VoiceInterview;
