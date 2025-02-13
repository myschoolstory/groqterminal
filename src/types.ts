export interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  apiKey: string;
  error: string | null;
}

export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}