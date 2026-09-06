export type MessageRole = "system" | "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export interface CompleteRequest {
  messages: Message[];
  /** Wins over the provider's default when set. */
  model?: string;
}

export interface CompleteResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Provider {
  complete(request: CompleteRequest): Promise<CompleteResult>;
}
