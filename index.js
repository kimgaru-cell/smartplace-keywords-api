import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/get-keywords', async (req, res) => {
  let { placeUrl } = req.body;

  try {
    if (placeUrl.includes('naver.me')) {
      const r = await fetch(placeUrl, { redirect: 'follow' });
      placeUrl = r.url;
    }

    if (placeUrl.includes('map.naver.com') && placeUrl.includes('place/')) {
      const m = placeUrl.match(/place\/(\d+)/);
      if (m?.[1]) placeUrl = `https://pcmap.place.naver.com/restaurant/${m[1]}/home`;
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'
    );
    await page.goto(placeUrl, { waitUntil: 'networkidle2' });

    // ── keywordList 로딩 대기 (최대 15초) ──
    try {
      await page.waitForFunction(
        () =>
          window.__APOLLO_STATE__ &&
          Object.values(window.__APOLLO_STATE__).some(
            x => Array.isArray(x.keywordList) && x.keywordList.length > 0
          ),
        { timeout: 15000 }
      );
    } catch {
      // 첫 시도 실패 → 1초 뒤 재시도
      await page.waitForTimeout(1000);
    }

    // ── keywordList 추출 ──
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
    console.error('❌ 크롤링 실패:', err);
    res.status(500).json({ error: '크롤링 실패: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ 서버 실행 중 (PORT ${PORT})`));
