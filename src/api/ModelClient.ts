import { IModelClient } from './interface/ApiClient.interface';
import { IHttpContext } from './interface/HttpContext.interface';
import { Model } from './interface/data/common/Model';
import {
  ModelAssignRequest,
  ModelDeleteRequest,
} from './interface/data/requests/model/ModelRequests';

export class ModelClient implements IModelClient {
  constructor(private context: IHttpContext) {}
  public async allModels(): Promise<Model[]> {
    const response = await this.context.get<Model[]>('/model/all');
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to fetch models');
    }
    return response.data;
  }
  public async myModels(): Promise<Model[]> {
    const response = await this.context.get<Model[]>('/model/list');
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to fetch models');
    }
    return response.data;
  }
  public async add(newModel: Model): Promise<Model> {
    const response = await this.context.post<Model, Model>(
      '/model/add',
      newModel
    );
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to add model');
    }
    return response.data;
  }
  public async update(newModel: Model): Promise<Model> {
    const response = await this.context.post<Model, Model>(
      '/model/update',
      newModel
    );
    if (!response.isSuccess || !response.data) {
      throw Error('Failed to update model');
    }
    return response.data;
  }
  public async remove(modelId: string): Promise<void> {
    const response = await this.context.post<ModelDeleteRequest, void>(
      '/model/delete',
      { model: modelId }
    );
    if (!response.isSuccess) {
      throw Error('Failed to remove model');
    }
    return response.data;
  }
  public async assign(request: ModelAssignRequest): Promise<void> {
    const response = await this.context.post<ModelAssignRequest, void>(
      '/model/assign',
      request
    );
    if (!response.isSuccess) {
      throw Error('Failed to assign model');
    }
    return response.data;
  }
  public async unassign(request: ModelAssignRequest): Promise<void> {
    const response = await this.context.post<ModelAssignRequest, void>(
      '/model/unassign',
      request
    );
    if (!response.isSuccess) {
      throw Error('Failed to assign model');
    }
    return response.data;
  }
}
