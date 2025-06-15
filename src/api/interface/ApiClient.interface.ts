import { LoginRequest } from './data/requests/login/UserRequests';
import { User } from './data/common/User';
import { Model } from './data/common/Model';
import { ModelAssignRequest } from './data/requests/model/ModelRequests';
import { Transaction } from './data/common/Transaction';
import { ChatCompletionRequest } from './data/requests/chat/ChatRequests';
import { ChatResponse, PartialChatResponse } from './data/common/Chat';

export interface IApiClient {
  get userClient(): IUserClient;
  get modelClient(): IModelClient;
  get transactionClient(): ITransactionClient;
  get chatClient(): IChatClient;
}

export interface IUserClient {
  auth(credentials: LoginRequest): Promise<void>;
  create(newUser: User): Promise<User>;
  modify(modifiedUser: User): Promise<void>;
  remove(userId: number): Promise<void>;
  list(): Promise<User[]>;
  getMyInfo(): Promise<User>;
  get userName(): string;
  get isAdmin(): boolean;
  logout(): void;
}

export interface IModelClient {
  allModels(): Promise<Model[]>;
  myModels(): Promise<Model[]>;
  add(newModel: Model): Promise<Model>;
  update(newModel: Model): Promise<Model>;
  remove(modelId: string): Promise<void>;
  assign(request: ModelAssignRequest): Promise<void>;
  unassign(request: ModelAssignRequest): Promise<void>;
}

export interface ITransactionClient {
  my(): Promise<Transaction[]>;
  all(): Promise<Transaction[]>;
}

export interface IChatClient {
  requestCompletion(request: ChatCompletionRequest): Promise<ChatResponse>;
  requestCompletionStream(
    request: ChatCompletionRequest
  ): AsyncGenerator<PartialChatResponse>;
}
