import { privateDecrypt } from 'crypto';
import { IUserClient } from './interface/ApiClient.interface';
import { IHttpContext } from './interface/HttpContext.interface';
import { User } from './interface/data/common/User';
import {
  LoginRequest,
  RemoveUserRequest,
} from './interface/data/requests/login/UserRequests';

export class UserClient implements IUserClient {
  public isAdmin: boolean = false;
  public userName: string = '';
  private userCredentials: LoginRequest | null = null;
  constructor(private context: IHttpContext) {}

  public async auth(credentials: LoginRequest): Promise<void> {
    const response = await this.context.post<LoginRequest, string>(
      '/user/auth',
      credentials
    );
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to authenticate');
    }
    this.context.setAuth(response.data);
    const jwtData = response.data.split('.')[1];
    const decodedJwtJsonData = atob(jwtData);
    const decodedJwtData = JSON.parse(decodedJwtJsonData);
    const role = decodedJwtData.role;
    this.isAdmin = role == 'ADMIN';
    this.userName = decodedJwtData.username;
    this.userCredentials = credentials;
  }
  public async create(newUser: User): Promise<User> {
    const response = await this.context.post<User, User>(
      '/user/create',
      newUser
    );
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to create user');
    }
    return response.data;
  }
  public async modify(modifiedUser: User): Promise<void> {
    const response = await this.context.post<User, void>(
      '/user/modify',
      modifiedUser
    );
    if (!response.isSuccess) {
      throw Error('Failed to modify user');
    }
  }
  public async remove(userId: number): Promise<void> {
    const response = await this.context.post<RemoveUserRequest, void>(
      '/user/delete',
      { userId: userId }
    );
    if (!response.isSuccess) {
      throw Error('Failed to remove user');
    }
  }
  public async list(): Promise<User[]> {
    const response = await this.context.get<User[]>('/user/list');
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to fetch users');
    }
    return response.data;
  }
  public async getMyInfo(): Promise<User> {
    const response = await this.context.get<User>('/user/me');
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to fetch user info');
    }
    return response.data;
  }
  public logout(): void {
    this.context.setAuth('');
  }
}
