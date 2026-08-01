/**
 * ChatInterface — Chat message display and input component.
 */

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Send, Bot, User } from 'lucide-react';
import { sendChatMessage } from '../api/client';
import useStore from '../store/useStore';

export default function ChatInterface({ scanId }) {
  const { chatMessages, addChatMessage } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    addChatMessage(userMsg);
    setInput('');

    setLoading(true);
    try {
      const allMessages = [...chatMessages, userMsg].map(m => ({
        role: m.role, content: m.content
      }));
      const data = await sendChatMessage(allMessages, scanId);
      addChatMessage({ role: 'assistant', content: data.response });
    } catch (e) {
      addChatMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "What are the most critical vulnerabilities?",
    "How could an attacker chain these vulnerabilities?",
    "What should I fix first and why?",
    "How do the missing security headers affect our compliance?",
    "What is the business impact of these findings?",
    "Generate a remediation plan for our scan results",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-accent-purple/30 mx-auto mb-4" />
            <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
              AI Security Assistant
            </h3>
            <p className="text-sm text-text-muted mb-6 max-w-md mx-auto">
              Ask questions about your scan results, vulnerabilities, or general security best practices.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {suggestedQuestions.map((q, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -2 }}
                  onClick={() => { setInput(q); textareaRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-full text-[12px] text-[#7BB8FF] bg-[#7BB8FF]/10 border border-[#7BB8FF]/20 hover:bg-[#7BB8FF]/20 transition-colors"
                >
                  {q}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-accent-purple" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent-cyan/15 text-text-primary border border-accent-cyan/20'
                  : 'bg-vanguard-card border border-accent-purple/20 chat-markdown'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    code: ({ node, inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      if (!inline && match) {
                        return (
                          <SyntaxHighlighter
                            style={atomDark}
                            language={match[1]}
                            customStyle={{ margin: '8px 0', borderRadius: '6px', fontSize: '12px' }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        );
                      }
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-accent-cyan/15 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-accent-cyan" />
              </div>
            )}
          </motion.div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-accent-purple" />
            </div>
            <div className="bg-vanguard-card border border-accent-purple/20 rounded-xl px-4 py-3">
              <div className="typing-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-vanguard-border p-4">
        <div className="flex gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your security scan..."
            rows={1}
            className="flex-1 bg-vanguard-card border border-vanguard-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-dim resize-none focus:outline-none focus:border-accent-cyan/50 transition-colors"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-4 py-2 rounded-xl bg-accent-cyan text-vanguard-bg font-medium text-sm hover:bg-accent-cyan/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-text-dim mt-2 text-center">
          Shift+Enter for new line • Vanguard AI has context of your current scan
        </p>
      </div>
    </div>
  );
}
