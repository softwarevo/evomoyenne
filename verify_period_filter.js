const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000');

  // Inject data with multiple periods
  await page.evaluate(async () => {
    const db = await idb.openDB('evoMoyenne', 3);
    await db.put('notes', {
      id: 'note1', subjectId: 'maths', value: 10, max: 20, coef: 1, date: '2023-01-01', codePeriode: 'A001', elementsProgramme: []
    });
    await db.put('notes', {
      id: 'note2', subjectId: 'maths', value: 20, max: 20, coef: 1, date: '2023-05-01', codePeriode: 'A002', elementsProgramme: []
    });
    await db.put('settings', {
      target: 20, theme: 'light', history: {},
      calculation: { generalMode: 'weighted', subjectMode: 'weighted', countCompetencies: 'uniquement_si_vide', period: 'A001' }
    }, 'app');
    window.location.reload();
  });

  await page.waitForLoadState('networkidle');

  // Open Maths subject
  await page.click('.subject-card[data-subject="maths"] .subject-info');

  // Take screenshot
  await page.screenshot({ path: 'verification/period_filter_A001.png' });

  // Change period to A002
  await page.evaluate(async () => {
    data.calculation.period = 'A002';
    updateAll();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verification/period_filter_A002.png' });

  await browser.close();
})();
