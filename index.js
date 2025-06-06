import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

const getChromePath = () => {
  try {
    // ① 먼저 apt로 설치된 'chromium' 경로를 찾아봅니다.
    const path = execSync('which chromium').toString().trim();
    if (path) return path;
  } catch {}

  try {
    // ② 그래도 못 찾으면 'chromium-browser'도 시도해봅니다.
    const path = execSync('which chromium-browser').toString().trim();
    return path;
  } catch {}

  return null; // 둘 다 없으면 null 반환
};

app.post('/api/get-keywords', async (req, res) => {
  let { placeUrl } = req.body;

  try {
    /* 1) naver.me 단축 URL → 실제 URL 로 변환 */
    if (placeUrl.includes('naver.me')) {
      const r = await fetch(placeUrl, { redirect: 'follow' });
      placeUrl = r.url;
    }

    /* 2) map.naver.com URL → pcmap.place.naver.com 형식으로 통일 */
    if (placeUrl.includes('map.naver.com') && placeUrl.includes('place/')) {
      const m = placeUrl.match(/place\/(\d+)/);
      if (m?.[1]) placeUrl = `https://pcmap.place.naver.com/restaurant/${m[1]}/home`;
    }

    /* 3) 브라우저 실행 */
    const executablePath = getChromePath();
    if (!executablePath) throw new Error('Chromium 실행 파일을 찾을 수 없습니다.');

    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(placeUrl, { waitUntil: 'networkidle2' });

    /* 4) __APOLLO_STATE__ 안에서 keywordList 추출 */
    const keywords = await page.evaluate(() => {
      const state = window.__APOLLO_STATE__ ?? {};
      for (const key in state) {
        const obj = state[key];
        if (obj && Array.isArray(obj.keywordList) && obj.keywordList.length) {
          return obj.keywordList.map(k => k.replace(/^#/, ''));
        }
      }
      return [];
    });

    await browser.close();

    if (!keywords.length) {
      return res.status(404).json({ error: '대표 키워드를 찾을 수 없습니다.' });
    }
    res.json({ keywords });
  } catch (err) {
    console.error('크롤링 실패:', err);
    res.status(500).json({ error: '크롤링 실패: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  서버 실행 중 (PORT ${PORT})`));
