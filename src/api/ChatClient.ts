import { IChatClient } from './interface/ApiClient.interface';
import { IHttpContext } from './interface/HttpContext.interface';
import {
  ChatResponse,
  PartialChatResponse,
} from './interface/data/common/Chat';
import { ChatCompletionRequest } from './interface/data/requests/chat/ChatRequests';

export class ChatClient implements IChatClient {
  constructor(private readonly context: IHttpContext) {}
  public async requestCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatResponse> {
    const response = await this.context.post<
      ChatCompletionRequest,
      ChatResponse
    >('/chat/completion', request);
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to request completion');
    }
    return response.data;
  }

  public async *requestCompletionStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<PartialChatResponse> {
    console.log('ChatClient: Starting stream request with:', request);
    try {
      const response = this.context.postStream<
        ChatCompletionRequest,
        PartialChatResponse
      >('/chat/streamingCompletion', request);
      for await (const chunk of response) {
        yield chunk;
      }
    } catch (error) {
      console.error('ChatClient: Error in completion stream:', error);
      throw error;
    }
  }
}
