export type Transaction = {
  id: number;
  time: string;
  userId: number;
  transactionId: string;
  requestedService: string;
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
  cost: number;
};
