import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import {
  createBangumiFavoriteDbClient,
  BangumiFavoriteDocument,
} from '../api/BangumiFavoriteDbClient';

export async function getAllBangumiFavouriteAnime(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(
    'HTTP trigger function processed a request to get all bangumi favorites.'
  );

  try {
    // Initialize the Bangumi Favorite DB client
    const bangumiDbClient = createBangumiFavoriteDbClient();

    // Get all favorite anime from the database
    const favorites: BangumiFavoriteDocument[] =
      await bangumiDbClient.getAllBangumiFavorites();

    // Transform the data to a cleaner format for the response
    const animeList = favorites.map(favorite => ({
      id: favorite.id,
      bgmId: favorite.bgmId,
      titleChinese: favorite.title_chinese,
      titleJapanese: favorite.title_japanese,
      link: favorite.link,
      description: favorite.description,
    }));

    context.log(`Successfully retrieved ${animeList.length} favorite anime.`);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      jsonBody: {
        success: true,
        count: animeList.length,
        data: animeList,
      },
    };
  } catch (error: any) {
    context.error('Error getting bangumi favorites:', error);

    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      jsonBody: {
        success: false,
        error: 'Failed to retrieve favorite anime',
        message: error.message || 'Unknown error occurred',
      },
    };
  }
}

app.http('getAllBangumiFavouriteAnime', {
  methods: ['GET'],
  authLevel: 'function',
  handler: getAllBangumiFavouriteAnime,
});
