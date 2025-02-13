import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Send, Key, AlertCircle } from 'lucide-react';
import Groq from 'groq-sdk';
import { Message, ChatState, ErrorResponse } from '../types';

export default function Terminal() {
  const [state, setState] = useState<ChatState>({
    messages: [],
    isLoading: false,
    apiKey: '',
    error: null,
  });
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  useEffect(() => {
    return () => {
      // Cleanup: abort any ongoing request when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleError = (error: unknown) => {
    console.error('Chat error:', error);
    let errorMessage = 'An unexpected error occurred.';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      const errorResponse = error as ErrorResponse;
      if (errorResponse.error?.message) {
        errorMessage = errorResponse.error.message;
      }
    }

    setState(prev => ({
      ...prev,
      error: errorMessage,
      isLoading: false,
      messages: [...prev.messages, { role: 'error', content: `Error: ${errorMessage}` }],
    }));
  };

  const validateApiKey = (key: string): boolean => {
    if (!key.trim()) {
      setState(prev => ({ ...prev, error: 'API key is required' }));
      return false;
    }
    if (!key.startsWith('gsk_')) {
      setState(prev => ({ ...prev, error: 'Invalid API key format. Groq API keys should start with "gsk_"' }));
      return false;
    }
    return true;
  };

  const handleApiKeySubmit = (key: string) => {
    if (validateApiKey(key)) {
      setState(prev => ({ ...prev, apiKey: key, error: null }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !state.apiKey) return;

    // Abort previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      error: null,
      messages: [...prev.messages, { role: 'user', content: input }],
      isLoading: true,
    }));
    setInput('');

    try {
      const groq = new Groq({ 
        apiKey: state.apiKey,
        dangerouslyAllowBrowser: true // Enable browser usage
      });
      
      const messages = state.messages.map(msg => ({
        role: msg.role === 'error' ? 'assistant' : msg.role,
        content: msg.content
      }));

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          ...messages,
          { role: 'user', content: input }
        ],
        model: "llama3-70b-8192",
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 1,
        stream: true,
        stop: null
      });

      let responseContent = '';
      
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'assistant', content: '' }],
      }));

      for await (const chunk of chatCompletion) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Request aborted');
        }

        const content = chunk.choices[0]?.delta?.content || '';
        responseContent += content;
        
        setState(prev => ({
          ...prev,
          messages: prev.messages.map((msg, index) => 
            index === prev.messages.length - 1
              ? { ...msg, content: responseContent }
              : msg
          ),
        }));
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    } catch (error) {
      if (error instanceof Error && error.message === 'Request aborted') {
        // Clean up the UI for aborted request
        setState(prev => ({
          ...prev,
          isLoading: false,
          messages: prev.messages.slice(0, -2), // Remove the last user message and empty assistant message
        }));
        return;
      }
      handleError(error);
    } finally {
      abortControllerRef.current = null;
    }
  };

  if (!state.apiKey) {
    return (
      <div className="min-h-screen bg-black text-green-400 p-4 font-mono">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <TerminalIcon className="w-6 h-6" />
            <h1 className="text-xl">Groq Terminal</h1>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4" />
              <span>Enter your Groq API key to continue:</span>
            </div>
            {state.error && (
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span>{state.error}</span>
              </div>
            )}
            <input
              type="password"
              className="w-full bg-black border border-green-400 text-green-400 p-2 rounded focus:outline-none focus:border-green-500"
              onChange={(e) => setState(prev => ({ ...prev, error: null }))}
              onBlur={(e) => handleApiKeySubmit(e.target.value)}
              placeholder="gsk_xxxxxx"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 font-mono">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <TerminalIcon className="w-6 h-6" />
          <h1 className="text-xl">Groq Terminal</h1>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4 mb-4 h-[calc(100vh-200px)] overflow-y-auto">
          {state.messages.map((message, index) => (
            <div key={index} className="mb-4">
              <div className="flex items-start gap-2">
                <span className={message.role === 'error' ? 'text-red-400' : 'text-green-400'}>
                  {message.role === 'user' ? '>' : message.role === 'error' ? '!' : '#'}
                </span>
                <div className="flex-1">
                  <pre className={`whitespace-pre-wrap break-words ${message.role === 'error' ? 'text-red-400' : ''}`}>
                    {message.content}
                  </pre>
                </div>
              </div>
            </div>
          ))}
          {state.isLoading && (
            <div className="flex items-center gap-2">
              <span className="text-green-400">#</span>
              <div className="animate-pulse">Processing...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-gray-900 border border-green-400 text-green-400 p-2 rounded focus:outline-none focus:border-green-500"
            placeholder="Type your message..."
          />
          <button
            type="submit"
            disabled={state.isLoading || !input.trim()}
            className="bg-green-400 text-black px-4 py-2 rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}