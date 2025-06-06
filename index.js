import { launch } from 'puppeteer-core';
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
  const { placeUrl } = req.body;
  const executablePath = getChromePath();

  if (!executablePath) {
    return res.status(500).json({ error: '크롬 실행 파일을 찾을 수 없습니다.' });
  }

  try {
    const browser = await launch({
      headless: 'new',
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(placeUrl, { waitUntil: 'networkidle2' });

    const keywords = await page.evaluate(() => {
      const elements = document.querySelectorAll('.zPfVt'); // 필요 시 클래스 수정
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
