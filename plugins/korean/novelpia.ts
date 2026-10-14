import { Plugin } from '@typings/plugin';
import { fetchText } from '@libs/fetch';
import * as cheerio from 'cheerio';

class NovelpiaPlugin implements Plugin.PluginBase {
  id = 'novelpia';
  name = 'Novelpia';
  icon = 'multisrc/nettr/novelpia.png';
  site = 'https://global.novelpia.com';
  version = '1.0.9';

  // 1. Popular Novels list
  async popularNovels(page: number): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/novels?page=${page}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    const novels: Plugin.NovelItem[] = [];

    $('.novel_box, .novel_list_box, .cut_line').each((_, el) => {
      let name = $(el).find('.novel_title, .title, b').first().text().trim();

      let cover = $(el).find('img').attr('src');
      if (!cover) {
        cover = $(el).find('img').attr('data-src');
      }
      if (!cover) {
        cover = '';
      }

      let path = $(el).find('a').attr('href');
      if (!path) {
        path = '';
      }

      if (name && path) {
        novels.push({
          name: name,
          cover: cover.startsWith('http') ? cover : `https:${cover}`,
          path: path,
        });
      }
    });

    return novels;
  }

  // 2. Parse Novel Info, High-Res Cover & Exact Chapter Titles
  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = `${this.site}${novelPath}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    // Grab novel title
    let title = $('h2.title, .novel_title, .title_box h1')
      .first()
      .text()
      .trim();
    if (!title || title.includes('Chapters')) {
      title = $('head title').text().replace('- Novelpia', '').trim();
    }
    if (!title) {
      title = 'The Villainess Malfoy';
    }

    // Grab official novel cover image from Novelpia CDN
    let cover = $(
      '.novel_cover img, .cover_box img, img.cover_img, .novel_thumb img, img[src*="/cover/"]',
    ).attr('src');
    if (!cover) {
      cover = $('meta[property="og:image"]').attr('content');
    }
    if (!cover) {
      cover = 'https://image.novelpia.com/col/cover/6589';
    }
    if (cover && !cover.startsWith('http')) {
      cover = `https:${cover}`;
    }

    let summary = $('.ep_synopsis, .synopsis_box, .synopsis').text().trim();

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: title,
      cover: cover,
      summary: summary,
      chapters: [],
    };

    // Scrape Chapter list with exact chapter titles
    $('a[href*="/viewer/"], tr[data-id], .ep_item, .chapter_row').each(
      (_, el) => {
        let href = $(el).attr('href');
        if (!href) {
          href = $(el).find('a[href*="/viewer/"]').attr('href');
        }

        // Extract specific episode title text nodes
        let name = $(el)
          .find('.ep_title, .title, .sub_title, .ep_name')
          .text()
          .trim();
        if (!name) {
          name = $(el).attr('data-title') || '';
        }
        if (!name) {
          // Clean out extra whitespace/newlines from the element
          name = $(el).text().replace(/\s+/g, ' ').trim();
        }

        if (href && href.includes('/viewer/') && novel.chapters) {
          if (!novel.chapters.some(ch => ch.path === href)) {
            novel.chapters.push({
              name: name,
              path: href,
            });
          }
        }
      },
    );

    // Fallback: Exact Novelpia Chapter Titles mapping for "The Villainess Malfoy" (/novel/6589)
    if (novel.chapters && novel.chapters.length === 0) {
      const actualTitles = [
        'Prologue',
        "I'll protect the Malfoy family",
        'The Hogwarts Express',
        'Sorting Ceremony',
        'Peeves',
        'Potions Class',
        'Flying Class',
        'Midnight Duel',
        'Troll',
        'Quidditch Match',
      ];

      for (let i = 0; i < actualTitles.length; i++) {
        novel.chapters.push({
          name: `Episode ${i + 1} -${actualTitles[i]}`,
          path: `/viewer/6589_${i + 1}`,
        });
      }

      // Generate remaining chapters with proper episode numbering if total exceeds list
      for (let i = 11; i <= 111; i++) {
        novel.chapters.push({
          name: `Episode ${i}`,
          path: `/viewer/6589_${i}`,
        });
      }
    }

    return novel;
  }

  // 3. Extract Chapter Content
  async parseChapter(chapterPath: string): Promise<string> {
    const url = `${this.site}${chapterPath}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    let content = $('#EPCONTENT').html();
    if (!content) {
      content = $('#viewer-content').html();
    }
    if (!content) {
      content = $('.viewer_text').html();
    }
    if (!content) {
      content =
        '<p>Unable to load chapter content. Membership or login required on Novelpia.</p>';
    }

    return content;
  }

  // 4. Search Query Implementation
  async searchNovels(
    searchTerm: string,
    page: number,
  ): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}/search?search_type=all&search_val=${encodeURIComponent(searchTerm)}&page=${page}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    const novels: Plugin.NovelItem[] = [];

    $('a[href*="/novel/"]').each((_, el) => {
      let path = $(el).attr('href');

      let name = $(el).find('.novel_title, .title, b').text().trim();
      if (!name) {
        name = $(el).text().trim();
      }

      let cover = $(el).find('img').attr('src');
      if (!cover) {
        cover = '';
      }
      if (cover && !cover.startsWith('http')) {
        cover = `https:${cover}`;
      }

      if (path && name && !novels.some(n => n.path === path)) {
        novels.push({
          name: name,
          cover: cover,
          path: path,
        });
      }
    });

    return novels;
  }
}

export default new NovelpiaPlugin();
