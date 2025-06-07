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
    // ① naver.me 단축 URL 처리
    if (placeUrl.includes('naver.me')) {
      const r = await fetch(placeUrl, { redirect: 'follow' });
      placeUrl = r.url;
    }

    // ② map.naver.com URL → 스마트플레이스 URL로 변환
    if (placeUrl.includes('map.naver.com') && placeUrl.includes('place/')) {
      const match = placeUrl.match(/place\/(\d+)/);
      if (match?.[1]) {
        placeUrl = `https://pcmap.place.naver.com/restaurant/${match[1]}/home`;
      }
    }

    // ③ Puppeteer 브라우저 실행 (내장 Chromium 사용)
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(placeUrl, { waitUntil: 'networkidle2' });

    // ④ 대표 키워드 추출 (__APOLLO_STATE__ 안에서 추출)
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
