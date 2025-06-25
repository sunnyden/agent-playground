import { app, InvocationContext, Timer } from '@azure/functions';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { CosmosDbClient } from '../api/CosmosDbClient';
import { BangumiFavoriteDbClient } from '../api/BangumiFavoriteDbClient';
import { getBangumiDescription } from '../utils/bangumiAccess';

interface RSSItem {
  title: string;
  link: string;
  pubDate: Date;
}

export async function bangumiFavoriteSync(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const cosmosClient = new CosmosDbClient({
    endpoint: process.env.COSMOS_DB_ENDPOINT,
    useEntraId: true,
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  });

  const bangumiDbClient = new BangumiFavoriteDbClient({
    endpoint: process.env.COSMOS_DB_ENDPOINT,
    useEntraId: true,
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  });

  const url = process.env.BANGUMI_RSS;

  if (!url) {
    context.error('BANGUMI_RSS environment variable is not set');
    return;
  }

  try {
    context.log(`Fetching RSS feed from: ${url}`);

    // Fetch the RSS feed
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BangumiFavoriteFetcher/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
      timeout: 30000, // 30 seconds timeout
      validateStatus: status => status < 400, // Accept any status less than 400
    });

    if (!response.data) {
      throw new Error('RSS feed returned empty response');
    }

    // Parse the RSS XML
    const $ = cheerio.load(response.data, { xmlMode: true });

    let items: RSSItem[] = [];

    // Extract all <item> elements
    $('item').each((index, element) => {
      const $item = $(element);

      const item: RSSItem = {
        title: $item.find('title').text().trim(),
        link: $item.find('link').text().trim(),
        pubDate: parseRSSDate($item.find('pubDate').text().trim()),
      };
      if (item.link) {
        items.push(item);
      }
    });

    context.log(`Successfully parsed ${items.length} RSS items`);
    const lastAccessTime = await getLastAccessTime(cosmosClient, context);
    if (lastAccessTime) {
      context.log('Last access time:', lastAccessTime);
      items = items.filter(item => {
        const pubDate = item.pubDate;
        return pubDate && pubDate > lastAccessTime;
      });
    }
    context.log(`Filtered items to ${items.length} based on last access time`);
    let latestPubDate: Date | null = null;
    // Process each item
    for (const item of items) {
      context.log(`Processing item: ${item.title}`);
      // Add your processing logic here
      await processRSSItem(item, context, bangumiDbClient);
      if (!latestPubDate || (item.pubDate && item.pubDate > latestPubDate)) {
        latestPubDate = item.pubDate;
      }
    }
    if (latestPubDate) {
      updateLastAccessTime(cosmosClient, context, latestPubDate);
    }
    context.log('RSS feed processing completed successfully');
  } catch (error) {
    context.error('Error fetching or parsing RSS feed:', error);
    throw error;
  }
}

async function processRSSItem(
  item: RSSItem,
  context: InvocationContext,
  bangumiDbClient: BangumiFavoriteDbClient
): Promise<void> {
  try {
    // Parse the publication date
    // Log the item details
    context.log('Item details:', {
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
    });
    const bangumiDescription = await getBangumiDescription(item.link);
    context.log(`Fetched Bangumi description for item:`, bangumiDescription);

    // Check if the item exists in Cosmos DB and insert if not
    const wasInserted =
      await bangumiDbClient.insertBangumiFavoriteIfNotExists(
        bangumiDescription
      );

    if (wasInserted) {
      context.log(
        `Successfully inserted new bangumi favorite: ${bangumiDescription.title_japanese} (ID: ${bangumiDescription.id})`
      );
    } else {
      context.log(
        `Bangumi favorite already exists: ${bangumiDescription.title_japanese} (ID: ${bangumiDescription.id})`
      );
    }
  } catch (error) {
    context.error(`Error processing RSS item: ${item.title}`, error);
    // Don't throw here to continue processing other items
  }
}

// Helper function to parse dates from RSS pubDate
function parseRSSDate(pubDateString: string): Date | null {
  try {
    if (!pubDateString) return null;

    // RSS dates are typically in RFC 822 format
    // e.g., "Tue, 19 Dec 2023 16:39:57 GMT"
    const date = new Date(pubDateString);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

async function getLastAccessTime(
  cosmosClient: CosmosDbClient,
  context: InvocationContext
): Promise<Date | null> {
  try {
    const lastAccessTime =
      await cosmosClient.getLastAccessTime('bgm-last-access');
    if (lastAccessTime) {
      return lastAccessTime;
    } else {
      context.log('No previous access time found, using current time');
      return null;
    }
  } catch (error) {
    context.error('Error getting last access time:', error);
    return null;
  }
}

async function updateLastAccessTime(
  cosmosClient: CosmosDbClient,
  context: InvocationContext,
  time: Date
): Promise<void> {
  try {
    await cosmosClient.updateLastAccessTime(time, 'bgm-last-access');
    context.log('Successfully updated last access time');
  } catch (error) {
    context.error('Error updating last access time:', error);
    throw error;
  }
}

app.timer('bangumiFavoriteSync', {
  schedule: '0 0 * * * *',
  handler: bangumiFavoriteSync,
});
