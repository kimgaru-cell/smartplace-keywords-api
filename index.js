const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/get-keywords', async (req, res) => {
  const { placeUrl } = req.body;
  if (!placeUrl || !placeUrl.includes('naver.com')) {
    return res.status(400).json({ error: '유효한 네이버 URL을 입력해주세요.' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(placeUrl, { waitUntil: 'networkidle2' });

    // [!] 스마트플레이스 키워드 영역의 실제 클래스명을 확인 후 수정해야 합니다.
    const keywords = await page.evaluate(() => {
      const elements = document.querySelectorAll('.zPfVt'); // 필요시 수정
      return Array.from(elements).map(el => el.textContent.trim());
    });

    await browser.close();
    res.json({ keywords });
  } catch (err) {
    res.status(500).json({ error: '크롤링 실패: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
