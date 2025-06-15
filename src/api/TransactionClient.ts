import { ITransactionClient } from './interface/ApiClient.interface';
import { IHttpContext } from './interface/HttpContext.interface';
import { Transaction } from './interface/data/common/Transaction';

export class TransactionClient implements ITransactionClient {
  constructor(private readonly context: IHttpContext) {}
  public async my(): Promise<Transaction[]> {
    const response = await this.context.get<Transaction[]>('/transaction/list');
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to fetch transactions');
    }
    return response.data;
  }
  public async all(): Promise<Transaction[]> {
    const response = await this.context.get<Transaction[]>('/transaction/all');
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to fetch transactions');
    }
    return response.data;
  }
}
