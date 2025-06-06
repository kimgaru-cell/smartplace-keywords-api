import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
app.use(cors());
app.use(express.json());

// CORS 설정
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.options('*', (req, res) => {
  res.sendStatus(200);
});

app.post('/api/get-keywords', async (req, res) => {
  const { placeUrl } = req.body;

  if (!placeUrl || !placeUrl.includes('naver.')) {
    return res.status(400).json({ error: '유효한 네이버 URL을 입력해주세요.' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(placeUrl, { waitUntil: 'networkidle2' });

    // ✅ 이 부분이 실제로 키워드를 추출하는 코드입니다.
    // 추출 대상 클래스를 웹페이지에서 확인 후 수정해야 할 수 있습니다.
    const keywords = await page.evaluate(() => {
      const elements = document.querySelectorAll('.zPfVt'); // 필요 시 클래스명을 바꾸세요
      return Array.from(elements).map(el => el.textContent.trim());
    });

    await browser.close();

    if (!keywords || keywords.length === 0) {
      return res.status(404).json({ error: '대표 키워드를 찾을 수 없습니다.' });
    }

    res.json({ keywords });
  } catch (err) {
    res.status(500).json({ error: '크롤링 실패: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ 서버 실행 중 (PORT ${PORT})`));
