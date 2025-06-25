import { CosmosClient, Container, Database } from '@azure/cosmos';
import {
  DefaultAzureCredential,
  ClientSecretCredential,
} from '@azure/identity';
import {
  CosmosDbConfig,
  createCosmosDbConfigFromEnvironment,
} from './CosmosDbClient';

export interface ConversationDocument {
  id: string;
  conversationId: string;
  teamId: string;
  channelId: string;
  serviceUrl: string;
  createdAt: string;
  lastActiveAt: string;
  isActive: boolean;
  partitionKey: string;
}

export class ConversationDbClient {
  private client: CosmosClient;
  private database: Database;
  private container: Container;

  constructor(config: CosmosDbConfig) {
    const databaseId = 'anime-notification-bot';
    const containerId = 'conversations';

    // Use the same authentication logic as CosmosDbClient
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

  async getActiveConversations(): Promise<ConversationDocument[]> {
    try {
      // Query for active conversations
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.isActive = true',
        parameters: [],
      };

      const { resources } = await this.container.items
        .query<ConversationDocument>(querySpec)
        .fetchAll();

      console.log(`Found ${resources.length} active conversations`);
      return resources;
    } catch (error) {
      console.error('Error fetching active conversations:', error);
      throw error;
    }
  }

  async getConversationById(
    conversationId: string
  ): Promise<ConversationDocument | null> {
    try {
      const { resource } = await this.container
        .item(conversationId, 'conversations')
        .read<ConversationDocument>();

      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async upsertConversation(conversation: ConversationDocument): Promise<void> {
    try {
      await this.container.items.upsert(conversation);
    } catch (error) {
      console.error('Error upserting conversation:', error);
      throw error;
    }
  }

  async deactivateConversation(conversationId: string): Promise<void> {
    try {
      const conversation = await this.getConversationById(conversationId);
      if (conversation) {
        conversation.isActive = false;
        conversation.lastActiveAt = new Date().toISOString();
        await this.upsertConversation(conversation);
      }
    } catch (error) {
      console.error('Error deactivating conversation:', error);
      throw error;
    }
  }
}

export function createConversationDbClient(): ConversationDbClient {
  const config = createCosmosDbConfigFromEnvironment();
  return new ConversationDbClient(config);
}
