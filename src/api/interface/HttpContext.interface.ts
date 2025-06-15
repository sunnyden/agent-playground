import { ApiResponse } from './data/common/ApiResponse';

export interface IHttpContext {
  setAuth(auth: string): void;
  get<T>(url: string): Promise<ApiResponse<T>>;
  post<P, T>(url: string, payload: P): Promise<ApiResponse<T>>;
  postStream<P, T>(url: string, payload: P): AsyncGenerator<T>;
}
