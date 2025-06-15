import { ChatMessage } from '../../common/Chat';

export type ChatCompletionRequest = {
  model: string;
  request: ChatCompletionRequestBody;
};

type ChatCompletionRequestBody = {
  messages: ChatMessage[];
};
