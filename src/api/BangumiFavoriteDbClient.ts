import { CosmosClient, Container, Database } from '@azure/cosmos';
import {
  DefaultAzureCredential,
  ClientSecretCredential,
} from '@azure/identity';
import {
  CosmosDbConfig,
  createCosmosDbConfigFromEnvironment,
} from './CosmosDbClient';

export interface BangumiFavoriteDocument {
  id: string;
  bgmId: number;
  title_chinese?: string;
  title_japanese: string;
  link: string;
  description: string;
  partitionKey: string;
}

export class BangumiFavoriteDbClient {
  private client: CosmosClient;
  private database: Database;
  private container: Container;

  constructor(config: CosmosDbConfig) {
    const databaseId = 'bangumi';
    const containerId = 'favorite';

    // Use the same authentication logic as ConversationDbClient
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

  async getBangumiFavoriteById(
    id: string
  ): Promise<BangumiFavoriteDocument | null> {
    try {
      const { resource } = await this.container
        .item(id, 'anime') // Using "anime" as partition key to match existing schema
        .read<BangumiFavoriteDocument>();

      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async getAllBangumiFavorites(): Promise<BangumiFavoriteDocument[]> {
    try {
      const { resources } = await this.container.items
        .query<BangumiFavoriteDocument>({
          query: 'SELECT * FROM c WHERE c.partitionKey = @partitionKey',
          parameters: [
            {
              name: '@partitionKey',
              value: 'anime',
            },
          ],
        })
        .fetchAll();

      return resources || [];
    } catch (error) {
      console.error('Error fetching all bangumi favorites:', error);
      throw error;
    }
  }

  async upsertBangumiFavorite(
    favorite: BangumiFavoriteDocument
  ): Promise<void> {
    try {
      await this.container.items.upsert(favorite);
    } catch (error) {
      console.error('Error upserting bangumi favorite:', error);
      throw error;
    }
  }

  async insertBangumiFavoriteIfNotExists(bangumiItem: {
    id: string;
    bgmId: number;
    title_chinese?: string;
    title_japanese: string;
    link: string;
    description: string;
  }): Promise<boolean> {
    try {
      // Check if the item already exists
      const existingItem = await this.getBangumiFavoriteById(bangumiItem.id);

      if (existingItem) {
        console.log(
          `Bangumi favorite with ID ${bangumiItem.id} already exists`
        );
        return false; // Item already exists, not inserted
      }

      // Create the document to insert (matching existing schema)
      const favoriteDocument: BangumiFavoriteDocument = {
        ...bangumiItem,
        partitionKey: 'anime', // Using "anime" as partition key to match existing schema
      };

      // Insert the new item
      await this.upsertBangumiFavorite(favoriteDocument);
      console.log(
        `Successfully inserted bangumi favorite with ID ${bangumiItem.id}`
      );
      return true; // Item was inserted
    } catch (error) {
      console.error('Error checking/inserting bangumi favorite:', error);
      throw error;
    }
  }
}

export function createBangumiFavoriteDbClient(): BangumiFavoriteDbClient {
  const config = createCosmosDbConfigFromEnvironment();
  return new BangumiFavoriteDbClient(config);
}
