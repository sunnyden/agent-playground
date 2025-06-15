import { ChatClient } from './ChatClient';
import { HttpContext } from './HttpContext';
import { ModelClient } from './ModelClient';
import { TransactionClient } from './TransactionClient';
import { UserClient } from './UserClient';
import {
  IApiClient,
  IChatClient,
  IModelClient,
  ITransactionClient,
  IUserClient,
} from './interface/ApiClient.interface';

export class ApiClient implements IApiClient {
  private readonly modelCli: IModelClient;
  private readonly transactionCli: ITransactionClient;
  private readonly userCli: IUserClient;
  private readonly chatCli: IChatClient;
  constructor(baseUrl: string) {
    const httpContext = new HttpContext(baseUrl);
    this.modelCli = new ModelClient(httpContext);
    this.transactionCli = new TransactionClient(httpContext);
    this.userCli = new UserClient(httpContext);
    this.chatCli = new ChatClient(httpContext);
  }
  public get chatClient(): IChatClient {
    return this.chatCli;
  }
  public get modelClient(): IModelClient {
    return this.modelCli;
  }

  public get transactionClient(): ITransactionClient {
    return this.transactionCli;
  }

  public get userClient(): IUserClient {
    return this.userCli;
  }
}
