import { app, InvocationContext } from '@azure/functions';

type QueueMessage = {
  title: string;
  link: string;
  content: string;
  processedAt: string;
  recommendation: {
    shouldRecommend: boolean;
    title?: string;
    content?: string;
  };
};

export async function animeNewsQueueProcessor(
  queueItem: unknown,
  context: InvocationContext
): Promise<void> {
  try {
    // Parse the queue message
    const messageData = JSON.parse(queueItem as string) as QueueMessage;

    context.log('Processing anime news recommendation:', {
      title: messageData.title,
      link: messageData.link,
      processedAt: messageData.processedAt,
    });

    // Here you can add your processing logic
    // For example: send notification, update database, etc.

    context.log('Successfully processed recommendation:', messageData.title);

    // Example processing logic (you can customize this):
    if (messageData.recommendation.shouldRecommend) {
      context.log('Recommendation details:', messageData.recommendation);

      // Add your custom processing here:
      // - Send notification to users
      // - Store in database
      // - Send to Teams/Slack
      // - Trigger other functions
    }
  } catch (error) {
    context.error('Error processing queue message:', error);
    throw error; // Re-throw to put message in poison queue
  }
}

// app.storageQueue('animeNewsQueueProcessor', {
//     queueName: 'anime-news-recommendations',
//     connection: 'AzureWebJobsStorage',
//     handler: animeNewsQueueProcessor
// });
