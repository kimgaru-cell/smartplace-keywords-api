import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

const getChromePath = () => {
  try {
    const path = execSync('which chromium-browser || which chromium').toString().trim();
    return path;
  } catch {
    return null;
  }
};

app.post('/api/get-keywords', async (req, res) => {
  let { placeUrl } = req.body;

  try {
    // ① naver.me 공유 링크 처리
    if (placeUrl.includes('naver.me')) {
      const response = await fetch(placeUrl, { redirect: 'follow' });
      placeUrl = response.url; // 자동 리디렉션 추적
    }

    // ② map.naver.com 주소에서 placeId 추출
    if (placeUrl.includes('map.naver.com') && placeUrl.includes('place/')) {
      const match = placeUrl.match(/place\/(\d+)/);
      if (match && match[1]) {
        const placeId = match[1];
        placeUrl = `https://pcmap.place.naver.com/restaurant/${placeId}/home`;
      }
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(placeUrl, { waitUntil: 'networkidle2' });

    // keywordList가 뜰 때까지 최대 5초 기다림
    await page.waitForFunction(() => {
      return window.__place_datum__?.keywordList?.length > 0;
    }, { timeout: 5000 });
    
    const keywords = await page.evaluate(() => {
      return (window.__place_datum__?.keywordList || []).map(k => k.replace(/^#/, ''));
    });

    await browser.close();

    if (!keywords || keywords.length === 0) {
      return res.status(404).json({ error: '대표 키워드를 찾을 수 없습니다.' });
    }

    res.json({ keywords });
  } catch (err) {
    console.error('크롤링 실패:', err);
    res.status(500).json({ error: '크롤링 실패: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ 서버 실행 중 (PORT ${PORT})`));
