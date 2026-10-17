import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Mic, MicOff, Volume2, MessageSquareText, AudioLines,
  Loader2, Paperclip, Camera, Download, Trash2, Link2, X, ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { Button } from '@/components/ui/button';
import OtpRequest, { chatError } from './OtpRequest';

interface Attachment {
  name: string;
  type: string;
  dataUrl: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment?: Attachment;
}

const SERVICE_LINKS = [
  { key: "azabot.serviceMain", url: "https://alazab.com", emoji: "🏢" },
  { key: "azabot.serviceUber", url: "https://uberfix.shop", emoji: "🔧" },
  { key: "azabot.serviceErp", url: "https://erp.alazab.com", emoji: "📊" },
];

const STORAGE_KEY = "azabot.history";

const AzaBotChat = () => {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<"text" | "voice">("text");
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-38) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showServices, setShowServices] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingOtp, setPendingOtp] = useState<{ kind: "email" | "whatsapp"; target: string } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState("");

  const verifyCode = async () => {
    if (otpBusy) return;
    if (!pendingOtp || !/^\d{6,8}$/.test(otpCode.trim())) {
      setOtpError(lang === "ar" ? "أدخل الرمز المكوّن من 6 إلى 8 أرقام" : "Enter the 6–8 digit code");
      return;
    }
    setOtpBusy(true);
    setOtpError("");
    const token = otpCode.trim();
    try {
    const { data, error } = pendingOtp.kind === "email"
      ? await supabase.auth.verifyOtp({ email: pendingOtp.target, token, type: "email" })
      : await supabase.auth.verifyOtp({ phone: pendingOtp.target, token, type: "sms" });
    if (error || !data.session || !data.user) {
      setOtpError(lang === "ar" ? "الرمز غير صحيح أو منتهي. حاول مرة أخرى." : "Invalid or expired code. Try again.");
      return;
    }
    setPendingOtp(null);
    setOtpCode("");
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      role: "assistant",
      content: lang === "ar"
        ? "✅ تم التحقق من هويتك بنجاح. اشرح لي مشكلتك وسأساعدك في حلها خطوة بخطوة."
        : "✅ You're verified. Tell me about your issue and I'll help you solve it step by step.",
    }]);
    } catch {
      setOtpError(lang === 'ar' ? 'تعذّر التحقق. حاول لاحقًا.' : 'Verification failed. Try later.');
    } finally { setOtpBusy(false); }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const quickActions = [
    { key: "azabot.q1", label: t("azabot.q1") },
    { key: "azabot.q2", label: t("azabot.q2") },
    { key: "azabot.q3", label: t("azabot.q3") },
    { key: "azabot.q4", label: t("azabot.q4") },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-38).map(({ id, role, content }) => ({ id, role, content }))));
    } catch {}
  }, [messages]);

  const sendMessage = useCallback(async (text: string, attachment?: Attachment) => {
    if ((!text.trim() && !attachment) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim() || (attachment ? `[${attachment.type.startsWith("image") ? t("azabot.photoAttached") : t("azabot.fileAttached")}: ${attachment.name}]` : ""),
      attachment,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingAttachment(null);
    setIsLoading(true);

    try {
      const chatMessages = [...messages, userMsg].slice(-39).map((m) => ({
        role: m.role,
        content: m.attachment ? `${m.content}\n[المستخدم أرفق ${m.attachment.type.startsWith("image") ? "صورة" : "ملف"}: ${m.attachment.name}]` : m.content,
      }));

      const { data, error } = await supabase.functions.invoke("azabot-chat", {
        body: { messages: chatMessages },
      });

      if (error) {
        const detail = await chatError(error);
        throw new Error(detail ?? t('azabot.error'));
      }
      if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error(t('azabot.error'));

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || t("azabot.error"),
      };
      setMessages((prev) => [...prev, botMsg]);
      if (data.otp?.target) { setPendingOtp(data.otp); setOtpCode(""); setOtpError(""); }

      if (activeTab === "voice") playTTS(botMsg.content, botMsg.id);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: err instanceof Error ? err.message : t('azabot.error') },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, activeTab, t]);

  const playTTS = async (text: string, msgId: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingId(msgId);
    setIsSpeaking(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceId: "EXAVITQu4vr4xnSDxMaL" }),
        }
      );
      if (!response.ok) throw new Error("TTS failed");
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingId(null);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      await audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setPlayingId(null);
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert(t("azabot.noSpeech")); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = lang === "ar" ? "ar-SA" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      sendMessage(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingAttachment({
        name: file.name,
        type: file.type,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 50);
    } catch {
      alert(t("azabot.cameraError"));
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPendingAttachment({
      name: `issue-${Date.now()}.jpg`,
      type: "image/jpeg",
      dataUrl,
    });
    closeCamera();
  };

  const downloadChat = () => {
    const lines = messages.map((m) => {
      const role = m.role === "user" ? "👤 المستخدم" : "🤖 عزبوت";
      const att = m.attachment ? `\n[مرفق: ${m.attachment.name}]` : "";
      return `${role}:\n${m.content}${att}\n`;
    }).join("\n---\n\n");
    const header = `محادثة عزبوت AzaBot\n${new Date().toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}\n\n===\n\n`;
    const blob = new Blob([header + lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `azabot-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearChat = () => {
    setMessages([]);
    setPendingOtp(null); setOtpCode(''); setOtpError('');
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, pendingAttachment ?? undefined);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border bg-muted/30">
        <button
          onClick={() => setActiveTab("text")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "text" ? "text-amber-600 border-b-2 border-amber-500 bg-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquareText className="w-4 h-4" />
          {t("azabot.textTab")}
        </button>
        <button
          onClick={() => setActiveTab("voice")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "voice" ? "text-amber-600 border-b-2 border-amber-500 bg-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <AudioLines className="w-4 h-4" />
          {t("azabot.voiceTab")}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/20">
        <button
          onClick={() => setShowServices((v) => !v)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
            showServices ? "bg-amber-500/15 text-amber-600" : "hover:bg-muted text-muted-foreground"
          }`}
          title={t("azabot.services")}
        >
          <Link2 className="w-3.5 h-3.5" />
          {t("azabot.services")}
        </button>
        <div className="flex-1" />
        <button
          onClick={downloadChat}
          disabled={messages.length === 0}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          title={t("azabot.downloadChat")}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={clearChat}
          disabled={messages.length === 0}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          title={t("azabot.clearChat")}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Service links panel */}
      <AnimatePresence>
        {showServices && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border bg-amber-50/50 dark:bg-amber-950/10"
          >
            <div className="p-2 grid grid-cols-3 gap-1.5">
              {SERVICE_LINKS.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-2 rounded-lg bg-background hover:bg-amber-100 dark:hover:bg-amber-900/20 border border-border/50 transition-colors text-center"
                >
                  <span className="text-lg">{s.emoji}</span>
                  <span className="text-[10px] font-medium text-foreground leading-tight">{t(s.key)}</span>
                  <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-3xl">💬</div>
            <h4 className="font-bold text-foreground mb-1">{t("azabot.welcome")} 👋</h4>
            <p className="text-sm text-muted-foreground mb-4">{t("azabot.welcomeSub")}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickActions.map((action) => (
                <button
                  key={action.key}
                  onClick={() => sendMessage(action.label)}
                  className="text-xs px-3 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  msg.role === "user" ? "bg-amber-500 text-white rounded-ee-md" : "bg-muted text-foreground rounded-es-md"
                }`}
              >
                {msg.attachment && msg.attachment.type.startsWith("image") && (
                  <img src={msg.attachment.dataUrl} alt={msg.attachment.name} className="rounded-lg mb-2 max-h-48 object-cover" />
                )}
                {msg.attachment && !msg.attachment.type.startsWith("image") && (
                  <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-black/10">
                    <Paperclip className="w-4 h-4 shrink-0" />
                    <span className="text-xs truncate">{msg.attachment.name}</span>
                  </div>
                )}
                {msg.role === "assistant" ? (
                  <div className="flex items-start gap-2">
                    <div className="flex-1 prose prose-sm dark:prose-invert max-w-none [&>p]:m-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <button
                      onClick={() => playTTS(msg.content, msg.id)}
                      className="shrink-0 mt-0.5 text-muted-foreground hover:text-amber-500 transition-colors"
                      title={t("azabot.listen")}
                    >
                      {playingId === msg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-es-md px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {!pendingOtp && <OtpRequest lang={lang} onSent={(otp, reply) => {
        setPendingOtp(otp); setOtpCode(''); setOtpError('');
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: reply }]);
      }} />}
      {pendingOtp && (
        <div className="px-3 py-2 border-t border-border bg-amber-50/50 dark:bg-amber-950/10">
          <p className="text-xs text-muted-foreground mb-1.5">
            {lang === "ar" ? `أدخل الرمز المرسل عبر ${pendingOtp.kind === "email" ? "البريد" : "واتساب"} إلى ${pendingOtp.target}` : `Enter the code sent via ${pendingOtp.kind === "email" ? "email" : "WhatsApp"} to ${pendingOtp.target}`}
          </p>
          <div className="flex items-center gap-1.5">
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              className="flex-1 min-w-0 bg-background rounded-full px-3.5 py-1.5 text-sm tracking-[0.4em] text-center outline-none focus:ring-2 focus:ring-amber-500/50"
              placeholder="••••••"
              aria-label="Verification code"
            />
            <Button size="sm" onClick={verifyCode} disabled={otpBusy}>
              {otpBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "ar" ? "تحقق" : "Verify"}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => { setPendingOtp(null); setOtpCode(''); }} disabled={otpBusy} aria-label="Cancel">
              <X className="w-4 h-4" />
            </Button>
          </div>
          {otpError && <p className="text-xs text-destructive mt-1">{otpError}</p>}
        </div>
      )}

      {/* Pending Attachment Preview */}
      {pendingAttachment && (
        <div className="px-3 py-2 border-t border-border bg-amber-50/50 dark:bg-amber-950/10 flex items-center gap-2">
          {pendingAttachment.type.startsWith("image") ? (
            <img src={pendingAttachment.dataUrl} alt="preview" className="w-10 h-10 rounded object-cover" />
          ) : (
            <Paperclip className="w-5 h-5 text-amber-600" />
          )}
          <span className="text-xs flex-1 truncate text-foreground">{pendingAttachment.name}</span>
          <button onClick={() => setPendingAttachment(null)} className="text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Voice Mode Mic */}
      {activeTab === "voice" && (
        <div className="flex flex-col items-center gap-3 py-4 border-t border-border">
          <button
            onClick={toggleListening}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isListening ? "bg-red-500 text-white animate-pulse-ring shadow-lg shadow-red-500/30" : "bg-amber-500 text-white hover:bg-amber-600 shadow-lg"
            }`}
          >
            {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>
          <p className="text-xs text-muted-foreground">
            {isListening ? t("azabot.listening") : isSpeaking ? t("azabot.speaking") : t("azabot.tapToSpeak")}
          </p>
        </div>
      )}

      {/* Text Input */}
      {activeTab === "text" && (
        <form onSubmit={handleSubmit} className="p-2.5 border-t border-border flex items-center gap-1.5">
          <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.txt" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:bg-muted transition-colors"
            title={t("azabot.attachFile")}
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={openCamera}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:bg-muted transition-colors"
            title={t("azabot.takePhoto")}
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleListening}
            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isListening ? "bg-red-500 text-white" : "text-muted-foreground hover:text-amber-500 hover:bg-muted"
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("azabot.placeholder")}
            className="flex-1 min-w-0 bg-muted rounded-full px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={(!input.trim() && !pendingAttachment) || isLoading}
            className="shrink-0 w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Camera Modal */}
      <AnimatePresence>
        {cameraOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          >
            <video ref={videoRef} autoPlay playsInline className="max-w-full max-h-[70%] rounded-lg" />
            <div className="flex items-center gap-4 mt-4">
              <button onClick={closeCamera} className="px-4 py-2 rounded-full bg-white/10 text-white hover:bg-white/20 text-sm">
                {t("azabot.cancel")}
              </button>
              <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center text-white shadow-lg">
                <Camera className="w-7 h-7" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="text-center py-1.5 text-[10px] text-muted-foreground border-t border-border">
        {t("azabot.powered")}
      </div>
    </div>
  );
};

export default AzaBotChat;
