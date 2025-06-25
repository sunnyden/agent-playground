import { app, InvocationContext } from '@azure/functions';
import { MessageFactory, TurnContext } from 'botbuilder';
import { MicrosoftAppCredentials } from 'botframework-connector';
import { ConnectorClient } from 'botframework-connector';
import {
  createConversationDbClient,
  ConversationDocument,
} from '../api/ConversationDbClient';

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
  messageData: QueueMessage,
  context: InvocationContext
): Promise<void> {
  try {
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

      // Send notification to all active conversations
      const notificationMessage = `**${messageData.recommendation.title}**\n\n${messageData.recommendation.content}\n\n[Read more](${messageData.link})`;

      try {
        await sendToAllActiveConversations(notificationMessage);
        context.log(
          'Notifications sent to all active conversations successfully'
        );
      } catch (error) {
        context.error('Failed to send notifications to conversations:', error);
        // Don't throw here if you want the function to continue processing other logic
      }
    }
  } catch (error) {
    context.error('Error processing queue message:', error);
  }
}

async function SendToUserAsync(
  appId: string,
  appPassword: string,
  serviceUrl: string,
  conversationId: string,
  message: string
): Promise<void> {
  try {
    // Create the activity message
    const activity = MessageFactory.text(message);
    activity.summary = message; // Ensure that the summary text is populated so the toast notifications aren't generic text.

    // For Teams, you can add notification properties
    if (activity.channelData === undefined) {
      activity.channelData = {};
    }

    // Teams-specific: Send the message into the activity feed
    activity.channelData.notification = {
      alert: true,
    };

    // Create credentials
    const credentials = new MicrosoftAppCredentials(appId, appPassword);

    // Create connector client
    const connectorClient = new ConnectorClient(credentials, {
      baseUri: serviceUrl,
    });

    // Send the message
    await connectorClient.conversations.sendToConversation(
      conversationId,
      activity
    );

    console.log(
      `Message sent to user in conversation ${conversationId}: ${message}`
    );
  } catch (error) {
    console.error('Error sending message to user:', error);
    throw error;
  }
}

async function getActiveConversations(): Promise<ConversationDocument[]> {
  try {
    const conversationClient = createConversationDbClient();
    return await conversationClient.getActiveConversations();
  } catch (error) {
    console.error('Error fetching active conversations:', error);
    throw error;
  }
}

async function sendToAllActiveConversations(message: string): Promise<void> {
  try {
    const appId = process.env.BotAppId;
    const appPassword = process.env.BotAppPassword;

    if (!appId || !appPassword) {
      throw new Error(
        'Bot credentials (BotAppId, BotAppPassword) are not configured'
      );
    }

    const conversations = await getActiveConversations();

    console.log(`Sending message to ${conversations.length} conversations`);

    const sendPromises = conversations.map(async conversation => {
      try {
        await SendToUserAsync(
          appId,
          appPassword,
          conversation.serviceUrl,
          conversation.conversationId,
          message
        );
        console.log(
          `Message sent successfully to conversation: ${conversation.conversationId}`
        );
      } catch (error) {
        console.error(
          `Failed to send message to conversation ${conversation.conversationId}:`,
          error
        );
        // Don't throw here, we want to continue sending to other conversations
      }
    });

    await Promise.all(sendPromises);
    console.log('Finished sending messages to all conversations');
  } catch (error) {
    console.error('Error in sendToAllActiveConversations:', error);
    throw error;
  }
}

app.storageQueue('animeNewsQueueProcessor', {
  queueName: 'anime-news-recommendations',
  connection: 'AzureWebJobsStorage',
  handler: animeNewsQueueProcessor,
});
