import { CosmosClient, Container, Database } from '@azure/cosmos';
import {
  DefaultAzureCredential,
  ManagedIdentityCredential,
  ClientSecretCredential,
} from '@azure/identity';

export interface TimestampDocument {
  id: string;
  lastAccessTime: string;
  _ts?: number;
}

export interface CosmosDbConfig {
  endpoint: string;
  // For connection string authentication (legacy)
  connectionString?: string;
  // For Entra ID authentication
  useEntraId?: boolean;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}

export function createCosmosDbConfigFromEnvironment(): CosmosDbConfig {
  const cosmosEndpoint = process.env.COSMOS_DB_ENDPOINT;
  return {
    endpoint: cosmosEndpoint,
    useEntraId: true,
    // Optional: For local development with service principal
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  };
}

export class CosmosDbClient {
  private client: CosmosClient;
  private database: Database;
  private container: Container;

  constructor(config: CosmosDbConfig) {
    const databaseId = 'anime-news-db';
    const containerId = 'timestamps';

    if (config.connectionString && !config.useEntraId) {
      // Legacy connection string authentication
      this.client = new CosmosClient(config.connectionString);
    } else if (config.useEntraId) {
      // Entra ID authentication
      let credential;

      if (config.tenantId && config.clientId && config.clientSecret) {
        // Service Principal authentication (for local development or specific scenarios)
        credential = new ClientSecretCredential(
          config.tenantId,
          config.clientId,
          config.clientSecret
        );
      } else {
        // Use DefaultAzureCredential for production (supports Managed Identity, Azure CLI, etc.)
        credential = new DefaultAzureCredential();
      }

      this.client = new CosmosClient({
        endpoint: config.endpoint,
        aadCredentials: credential,
      });
    } else {
      throw new Error(
        'Either connectionString or Entra ID configuration (endpoint + useEntraId: true) must be provided'
      );
    }

    this.database = this.client.database(databaseId);
    this.container = this.database.container(containerId);
  }

  async getLastAccessTime(
    documentId: string = 'last-access'
  ): Promise<Date | null> {
    try {
      const { resource } = await this.container
        .item(documentId, documentId)
        .read<TimestampDocument>();
      if (resource && resource.lastAccessTime) {
        return new Date(resource.lastAccessTime);
      }
      return null;
    } catch (error: any) {
      if (error.code === 404) {
        // Document doesn't exist, return null
        return null;
      }
      throw error;
    }
  }

  async updateLastAccessTime(
    timestamp: Date = new Date(),
    documentId: string = 'last-access'
  ): Promise<void> {
    try {
      const document: TimestampDocument = {
        id: documentId,
        lastAccessTime: timestamp.toISOString(),
      };

      await this.container.items.upsert(document);
    } catch (error) {
      console.error('Error updating last access time:', error);
      throw error;
    }
  }
}
