import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';

interface BangumiItem {
  id: string;
  bgmId: number;
  title_chinese?: string;
  title_japanese: string;
  link: string;
  description: string;
}
async function getBangumiDescription(url: string): Promise<BangumiItem> {
  const userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
  const secChUa =
    '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"';

  const headers = {
    'User-Agent': userAgent,
    'sec-ch-ua': secChUa,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'deflate',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Priority: 'u=0, i',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };

  // Make HTTP request
  const response: AxiosResponse<string> = await axios.get(url, { headers });
  if (response.status !== 200) {
    throw new Error(`Failed to fetch Bangumi description: ${response.status}`);
  }

  // Parse HTML with cheerio
  const $ = cheerio.load(response.data);

  // Extract description from //*[@id='subject_summary']
  const description = $('#subject_summary').text().trim() || '';

  // Extract titles from #headerSubject > h1 > a
  const titleElement = $('#headerSubject > h1 > a');
  const title_chinese = titleElement.attr('title') || '';
  const title_japanese = titleElement.text().trim() || '';

  // Extract ID from URL
  const urlSegments = url.split('/');
  const bgmId = parseInt(urlSegments[urlSegments.length - 1]);

  return {
    id: bgmId.toString(),
    bgmId: bgmId,
    title_chinese: title_chinese,
    title_japanese: title_japanese,
    link: url,
    description: description,
  };
}

export { getBangumiDescription, BangumiItem };
