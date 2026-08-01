/**
 * CodeFixViewer — Tabbed code fix display with syntax highlighting.
 */

import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Sparkles, Code } from 'lucide-react';
import { generateFix } from '../api/client';

const languages = [
  { key: 'python', label: 'Python' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'java', label: 'Java' },
];

export default function CodeFixViewer({ vulnId, existingFixes = {} }) {
  const [activeLang, setActiveLang] = useState('python');
  const [fixes, setFixes] = useState(existingFixes);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);

  const currentFix = fixes[activeLang];

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateFix(vulnId, activeLang);
      setFixes((prev) => ({ ...prev, [activeLang]: data.code }));
    } catch (e) {
      setError('Failed to generate fix. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, section) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(section);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard not available */ }
  };

  // Parse fix into vulnerable and secure sections
  const parseFix = (fixText) => {
    if (!fixText) return { vulnerable: '', secure: '', explanation: '' };
    
    const parts = fixText.split(/===\s*(VULNERABLE CODE|SECURE CODE|EXPLANATION)\s*===/);
    let vulnerable = '', secure = '', explanation = '';
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].includes('VULNERABLE CODE') && parts[i + 1]) vulnerable = parts[i + 1].trim();
      else if (parts[i].includes('SECURE CODE') && parts[i + 1]) secure = parts[i + 1].trim();
      else if (parts[i].includes('EXPLANATION') && parts[i + 1]) explanation = parts[i + 1].trim();
    }
    
    if (!vulnerable && !secure) {
      return { vulnerable: '', secure: fixText, explanation: '' };
    }
    
    return { vulnerable, secure, explanation };
  };

  const { vulnerable, secure, explanation } = parseFix(currentFix);

  return (
    <div className="glass-card">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-vanguard-border">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-accent-cyan" />
          <h3 className="text-sm font-semibold text-text-primary">Code Fix</h3>
        </div>
        <div className="flex gap-1">
          {languages.map((lang) => (
            <button
              key={lang.key}
              onClick={() => setActiveLang(lang.key)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeLang === lang.key
                  ? 'bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {!currentFix && !loading && (
          <div className="text-center py-6">
            <Code className="w-8 h-8 text-accent-cyan/50 mx-auto mb-3" />
            <p className="text-sm text-text-muted mb-4">
              Generate a secure code fix in {languages.find(l => l.key === activeLang)?.label}
            </p>
            <button
              onClick={generate}
              className="px-4 py-2 rounded-lg bg-accent-cyan/15 text-accent-cyan text-sm font-medium hover:bg-accent-cyan/25 transition-colors border border-accent-cyan/30"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Generate Fix
              </span>
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
            <span className="text-text-muted text-sm">Generating secure code...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <p className="text-accent-critical text-sm mb-3">{error}</p>
            <button onClick={generate} className="text-accent-cyan text-sm hover:underline">Try Again</button>
          </div>
        )}

        {currentFix && (
          <div className="space-y-4">
            {/* Vulnerable Code */}
            {vulnerable && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-accent-critical flex items-center gap-1">
                    ❌ Vulnerable Code
                  </span>
                  <button
                    onClick={() => copyToClipboard(vulnerable, 'vuln')}
                    className="text-text-dim hover:text-text-muted transition-colors"
                  >
                    {copied === 'vuln' ? <Check className="w-3.5 h-3.5 text-accent-low" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="rounded-lg overflow-hidden border border-accent-critical/20" style={{ background: 'rgba(255, 51, 102, 0.05)' }}>
                  <SyntaxHighlighter
                    language={activeLang}
                    style={atomDark}
                    customStyle={{ margin: 0, padding: '12px', fontSize: '12px', background: 'transparent' }}
                  >
                    {vulnerable}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            {/* Secure Code */}
            {secure && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-accent-low flex items-center gap-1">
                    ✅ Secure Code
                  </span>
                  <button
                    onClick={() => copyToClipboard(secure, 'safe')}
                    className="text-text-dim hover:text-text-muted transition-colors"
                  >
                    {copied === 'safe' ? <Check className="w-3.5 h-3.5 text-accent-low" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="rounded-lg overflow-hidden border border-accent-low/20" style={{ background: 'rgba(0, 255, 136, 0.05)' }}>
                  <SyntaxHighlighter
                    language={activeLang}
                    style={atomDark}
                    customStyle={{ margin: 0, padding: '12px', fontSize: '12px', background: 'transparent' }}
                  >
                    {secure}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            {/* Explanation */}
            {explanation && (
              <p className="text-xs text-text-muted leading-relaxed border-t border-vanguard-border pt-3">
                {explanation}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
