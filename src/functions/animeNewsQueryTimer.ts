import { app, InvocationContext, Timer } from '@azure/functions';
import { QueueServiceClient } from '@azure/storage-queue';
import { UserClient } from '../api/UserClient';
import { HttpContext } from '../api/HttpContext';
import { CosmosDbClient } from '../api/CosmosDbClient';
import {
  getLatestAnimeNews,
  getNewsContent,
} from '../utils/animateTimesAccess';
import { ChatClient } from '../api/ChatClient';
import {
  ChatMessageContentType,
  ChatRole,
} from '../api/interface/data/common/Chat';
import { PROMPT_PROCESS_NEWS } from '../utils/AIPrompts';

export async function animeNewsQueryTimer(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  // Initialize Cosmos DB client with Entra ID authentication
  const cosmosEndpoint = process.env.COSMOS_DB_ENDPOINT;
  if (!cosmosEndpoint) {
    context.error('COSMOS_DB_ENDPOINT environment variable is not set');
    return;
  }

  const cosmosClient = new CosmosDbClient({
    endpoint: cosmosEndpoint,
    useEntraId: true,
    // Optional: For local development with service principal
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  });

  // Initialize Azure Storage Queue client
  const storageConnectionString = process.env.AzureWebJobsStorage;
  if (!storageConnectionString) {
    context.error('AzureWebJobsStorage environment variable is not set');
    return;
  }

  const queueServiceClient = QueueServiceClient.fromConnectionString(
    storageConnectionString
  );
  const queueName = 'anime-news-recommendations';
  const queueClient = queueServiceClient.getQueueClient(queueName);

  // Ensure queue exists
  await queueClient.createIfNotExists();

  try {
    // Initialize database and container if they don't exist
    // Get the last access time
    const lastAccessTime = await getLastAccessTime(cosmosClient, context);
    context.log('Last access time:', lastAccessTime);
    context.log('Logged in successfully, fetching anime news...');
    const result = await getLatestAnimeNews();
    context.log('Fetched latest anime news:', result.length, 'items');
    // filter out news items that are older than the last access time
    const filteredResult = result.filter(news => news.time > lastAccessTime);
    context.log('Filtered news items:', filteredResult.length, 'items');

    for (const news of filteredResult) {
      try {
        context.log(`Title: ${news.title}, Link: ${news.link}`);
        const content = await getNewsContent(news.link);
        const actionItem = await getActionItemWithRetry(
          context,
          content,
          news.title
        );
        if (actionItem.shouldRecommend) {
          // Push to queue in animefunctionstorage storage account
          const queueMessage = {
            title: news.title,
            link: news.link,
            content: actionItem.content || content,
            processedAt: new Date().toISOString(),
            recommendation: actionItem,
          };

          try {
            const messageText = Buffer.from(
              JSON.stringify(queueMessage)
            ).toString('base64');
            await queueClient.sendMessage(messageText);
            context.log(
              `Successfully pushed recommendation to queue: ${news.title}`
            );
          } catch (queueError) {
            context.error(
              `Failed to push message to queue for "${news.title}":`,
              queueError
            );
          }
        }
        context.log('Action item:', actionItem);
      } catch (error) {
        context.error(`Error processing news item "${news.title}":`, error);
      }
    }
    // Update the last access time to now
    const latestNews = filteredResult.sort(
      (a, b) => b.time.getTime() - a.time.getTime()
    )[0];
    if (latestNews) {
      await updateLastAccessTime(cosmosClient, context, latestNews.time);
    }
    context.log('Updated last access time');
  } catch (error) {
    context.error('Error in animeNewsQueryTimer:', error);
  }
}

async function getLastAccessTime(
  cosmosClient: CosmosDbClient,
  context: InvocationContext
): Promise<Date> {
  try {
    const lastAccessTime = await cosmosClient.getLastAccessTime();
    if (lastAccessTime) {
      return lastAccessTime;
    } else {
      context.log('No previous access time found, using current time');
      return new Date();
    }
  } catch (error) {
    context.error('Error getting last access time:', error);
    return new Date();
  }
}

async function updateLastAccessTime(
  cosmosClient: CosmosDbClient,
  context: InvocationContext,
  time: Date
): Promise<void> {
  try {
    await cosmosClient.updateLastAccessTime(time);
    context.log('Successfully updated last access time');
  } catch (error) {
    context.error('Error updating last access time:', error);
    throw error;
  }
}

app.timer('animeNewsQueryTimer', {
  schedule: '0 */10 * * * *',
  handler: animeNewsQueryTimer,
});
type ActionResult = {
  shouldRecommend: boolean;
  title?: string;
  content?: string;
};

async function getActionItemWithRetry(
  context: InvocationContext,
  news: string,
  title: string,
  retries: number = 3
): Promise<ActionResult> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await getActionItem(context, news, title);
    } catch (error) {
      context.warn(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === retries - 1) {
        throw error; // Re-throw on last attempt
      }
    }
  }
}

async function getActionItem(
  context: InvocationContext,
  news: string,
  title: string
): Promise<ActionResult> {
  const httpContext = new HttpContext(process.env.AI_HOST_NAME);
  const userClient = new UserClient(httpContext);
  const chatClient = new ChatClient(httpContext);
  // This function is a placeholder for any action item extraction logic
  // For now, it just returns the news string as is
  context.log('Trying to log in...');
  await userClient.auth({
    userName: process.env.AI_USERNAME,
    password: process.env.AI_PASSWORD,
  });
  const result = chatClient.requestCompletionStream({
    model: 'automation-default',
    request: {
      messages: [
        {
          role: ChatRole.System,
          content: [
            {
              type: ChatMessageContentType.Text,
              text: PROMPT_PROCESS_NEWS,
            },
          ],
        },
        {
          role: ChatRole.User,
          content: [
            {
              type: ChatMessageContentType.Text,
              text: `TITLE: ${title} \nCONTENT: \n ${news}`,
            },
          ],
        },
      ],
    },
  });
  let responeText = '';
  for await (const chunk of result) {
    responeText += chunk.data;
  }

  return JSON.parse(responeText);
}
