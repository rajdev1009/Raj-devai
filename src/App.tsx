import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, User, Sparkles, Heart, MessageCircle, Trash2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { RajChatService, Message } from './services/geminiService';
import { cn } from './lib/utils';
import { AudioRecorder, AudioStreamer } from './lib/audio-utils';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [chatService, setChatService] = useState<RajChatService | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const audioRecorderRef = useRef<AudioRecorder>(new AudioRecorder());
  const audioStreamerRef = useRef<AudioStreamer>(new AudioStreamer());
  const liveSessionRef = useRef<any>(null);

  useEffect(() => {
    const initChat = async () => {
      try {
        // Try to get key from process.env (Vite define) first
        let apiKey = process.env.GEMINI_API_KEY;
        
        // If not found (common in production Docker/Koyeb), fetch from server
        if (!apiKey || apiKey === "undefined" || apiKey === "") {
          const res = await fetch('/api/config');
          const config = await res.json();
          apiKey = config.GEMINI_API_KEY;
        }

        if (apiKey) {
          setChatService(new RajChatService(apiKey));
          setConfigError(null);
        } else {
          setConfigError("Arree yaar, API Key nahi mil rahi! Koyeb mein GEMINI_API_KEY set karo na baby.");
        }
      } catch (err) {
        console.error('Failed to init chat:', err);
        setConfigError("Kuch toh gadbad hai... Server se connect nahi ho paa raha.");
      } finally {
        setIsInitializing(false);
      }
    };

    initChat();
    
    return () => {
      stopLive();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, liveTranscript]);

  const stopLive = useCallback(() => {
    setIsLive(false);
    audioRecorderRef.current.stop();
    audioStreamerRef.current.stop();
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    setLiveTranscript('');
  }, []);

  const startLive = async () => {
    if (!chatService) return;
    
    try {
      setIsLive(true);
      const sessionPromise = chatService.connectLive({
        onopen: () => {
          console.log('Live session opened');
          audioRecorderRef.current.start((base64Data) => {
            sessionPromise.then(session => {
              session.sendRealtimeInput({
                audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
              });
            });
          });
        },
        onmessage: (message) => {
          // Handle audio output
          const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            audioStreamerRef.current.play(audioData);
          }

          // Handle transcriptions
          const modelTranscript = message.serverContent?.modelTurn?.parts?.[0]?.text;
          if (modelTranscript) {
            setLiveTranscript(prev => prev + modelTranscript);
          }

          // When a turn is complete, add to messages
          if (message.serverContent?.turnComplete) {
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'model' && liveTranscript) {
                // Update last message if it was a model message
                return [...prev.slice(0, -1), { role: 'model', text: liveTranscript }];
              } else if (liveTranscript) {
                return [...prev, { role: 'model', text: liveTranscript }];
              }
              return prev;
            });
            setLiveTranscript('');
          }
        },
        onerror: (err) => {
          console.error('Live error:', err);
          stopLive();
        },
        onclose: () => {
          console.log('Live session closed');
          stopLive();
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start live:', err);
      stopLive();
    }
  };

  const toggleLive = async () => {
    if (isLive) {
      stopLive();
    } else {
      // Resume audio context on user gesture
      await audioStreamerRef.current.resume();
      startLive();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !chatService || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      let fullResponse = '';
      const stream = chatService.sendMessageStream(userMessage);
      
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = fullResponse;
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { role: 'model', text: "Arree yaar, kuch gadbad ho gayi. Lagta hai network nakhre kar raha hai. Phir se try karo na baby!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    if (apiKey) {
      setChatService(new RajChatService(apiKey));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-white font-sans selection:bg-pink-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#1e293b]/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-orange-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <span className="text-xl font-bold">R</span>
            </div>
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#0f172a] rounded-full"></div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              Raj <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            </h1>
            <p className="text-xs text-gray-400 font-medium">Guwahati ka sabse naughty munda 😉</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleLive}
            disabled={isInitializing || !!configError}
            className={cn(
              "p-3 rounded-full transition-all flex items-center gap-2 font-bold text-sm",
              isLive 
                ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30" 
                : "bg-pink-600/20 text-pink-400 hover:bg-pink-600/30 border border-pink-500/30",
              (isInitializing || !!configError) && "opacity-50 cursor-not-allowed"
            )}
            title={isLive ? "Stop Voice Chat" : "Start Voice Chat"}
          >
            {isInitializing ? (
              <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            ) : isLive ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
            <span className="hidden md:inline">
              {isInitializing ? "Connecting..." : isLive ? "Live" : "Voice Chat"}
            </span>
          </button>
          <button 
            onClick={clearChat}
            disabled={isInitializing}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-red-400 disabled:opacity-30"
            title="Clear Chat"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth custom-scrollbar"
      >
        {isInitializing && (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-pink-400 font-medium animate-pulse">Raj ready ho raha hai...</p>
          </div>
        )}

        {configError && (
          <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-xl text-red-200 text-sm mb-4">
            <p className="font-bold flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Oho ho, Error!
            </p>
            <p className="mt-1">{configError}</p>
          </div>
        )}

        {messages.length === 0 && !isLive && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-pink-500/20 to-orange-500/20 flex items-center justify-center border border-white/10"
            >
              <Heart className="w-12 h-12 text-pink-500 fill-pink-500 animate-pulse" />
            </motion.div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-orange-300">
                Oho ho, tum aa gayi!
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Main kab se tumhara intezaar kar raha tha jaan. Guwahati ki thandi hawaon mein tumhari kami thi. Chalo, kuch naughty baatein karte hain?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              {['Kaise ho Raj?', 'Guwahati ghumao na', 'Kuch naughty bolo', 'Flirt karo mere saath'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="p-3 text-sm bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left hover:border-pink-500/50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex w-full gap-3",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-orange-400 flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-md">
                  R
                </div>
              )}
              <div className={cn(
                "max-w-[85%] md:max-w-[70%] p-4 rounded-2xl shadow-sm",
                msg.role === 'user' 
                  ? "bg-pink-600 text-white rounded-tr-none" 
                  : "bg-[#1e293b] text-gray-100 rounded-tl-none border border-white/5"
              )}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-xs shadow-md">
                  <User className="w-4 h-4" />
                </div>
              )}
            </motion.div>
          ))}
          
          {isLive && liveTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex w-full gap-3 justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-orange-400 flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-md">
                R
              </div>
              <div className="max-w-[85%] md:max-w-[70%] p-4 rounded-2xl rounded-tl-none bg-[#1e293b] text-gray-100 border border-pink-500/30 shadow-lg shadow-pink-500/5">
                <div className="prose prose-invert prose-sm max-w-none italic">
                  <ReactMarkdown>{liveTranscript}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {isLoading && !isLive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-orange-400 flex items-center justify-center text-xs font-bold animate-pulse">
              R
            </div>
            <div className="bg-[#1e293b] p-4 rounded-2xl rounded-tl-none border border-white/5 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce"></span>
            </div>
          </motion.div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-4 md:p-6 bg-[#0f172a]">
        {isLive && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                  <motion.div
                    key={i}
                    animate={{ height: [8, 20, 8] }}
                    transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                    className="w-1 bg-red-500 rounded-full"
                  />
                ))}
              </div>
              <span className="text-sm font-bold text-red-400">Raj is listening...</span>
            </div>
            <button 
              onClick={stopLive}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all"
            >
              End Voice Chat
            </button>
          </motion.div>
        )}
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-2 bg-[#1e293b] border border-white/10 rounded-2xl p-2 focus-within:border-pink-500/50 transition-all shadow-xl">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Raj se kuch naughty pucho..."
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 text-sm placeholder:text-gray-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isInitializing || !!configError}
              className={cn(
                "p-3 rounded-xl transition-all",
                input.trim() && !isLoading && !isInitializing && !configError
                  ? "bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-500/20" 
                  : "bg-gray-700 text-gray-400 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-center mt-3 text-gray-500 uppercase tracking-widest font-bold">
            Made with <Heart className="w-2 h-2 inline text-pink-500 fill-pink-500" /> for Guwahati
          </p>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
