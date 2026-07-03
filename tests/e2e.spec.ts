import { test, expect, type Page } from '@playwright/test';

const SHOT_DIR = process.env.SHOT_DIR ?? 'test-results/shots';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

/** Set a range input by aria-label through the native setter so React sees it. */
async function setRange(page: Page, label: string, value: number) {
  await page.getByLabel(label).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.describe('ProArch engineering notebook', () => {
  test('calc view: slider drives kernel recompute and verification flip', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('悬臂梁挠度分析').first()).toBeVisible();

    // initial kernel result: δ = 6.67 mm, verification passes
    const result = page.getByTestId('result-beam-compute');
    await expect(result).toHaveText(/6\.67\s*mm/);
    await expect(page.getByTestId('check-beam-verify')).toContainText('通过');
    await expect(page.getByTestId('aside-beam-compute')).toContainText('8 mm');
    await shot(page, '01-calc-initial');

    // material stress cell passes cleanly by default (no unresolved bug on first load)
    await expect(page.getByTestId('cell-beam-material')).toContainText('应力满足');

    // drag F 10 → 20 kN: δ = 13.33 > 8 → verification fails
    await setRange(page, '端部荷载 F', 20);
    await expect(result).toHaveText(/13\.33\s*mm/);
    await expect(page.getByTestId('check-beam-verify')).toContainText('未通过');
    await shot(page, '02-calc-fail');

    // material select chip: switch to wood (12 GPa) — deflection grows 200/12×
    await setRange(page, '端部荷载 F', 10);
    await page.getByText('木 12GPa').click();
    await expect(result).toHaveText(/111\.11\s*mm/);
    await page.getByText('钢 200GPa').click();
    await expect(result).toHaveText(/6\.67\s*mm/);
  });

  test('view switching: feed and read project the same cards', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Read', { exact: true }).first().click();
    await expect(page.getByText('挠度计算')).toBeVisible();
    await expect(page.getByText('规范校核', { exact: true })).toBeVisible();
    await shot(page, '03-read');

    await page.getByText('Feed', { exact: true }).first().click();
    await expect(page.getByTestId('feed-scroll')).toBeVisible();
    await shot(page, '04-feed');

    // overview grid
    await page.getByTestId('feed-overview-btn').click();
    await expect(page.getByText('全部卡片概览')).toBeVisible();
    await shot(page, '05-feed-overview');
    // jump to the result card (index 3 = 结果)
    await page.getByText('3 · 结果').click();
    await expect(page.getByTestId('feed-result')).toBeVisible();

    await page.getByText('Calc', { exact: true }).first().click();
    await expect(page.getByTestId('action-stack')).toBeVisible();
  });

  test('drawer: project tree opens the RF notebook (multi-domain)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('menu-btn').click();
    await expect(page.getByTestId('drawer')).toBeVisible();
    await expect(page.getByText('结构分析')).toBeVisible();
    await shot(page, '06-drawer');

    await page.getByTestId('nbfile-rf-link-budget.pro.md').click();
    await expect(page.getByText('X 波段链路预算').first()).toBeVisible();
    // rf package function fspl evaluated: Pr ≈ -66.94 dBm
    await expect(page.getByTestId('result-rf-compute')).toHaveText(/-66\.9\d?\s*dBm/);
    await expect(page.getByTestId('check-rf-verify')).toContainText('通过');
    await page.waitForTimeout(400); // let the drawer slide-out finish before capturing
    await shot(page, '07-rf-calc');

    // long distance → link margin fails
    await setRange(page, '链路距离 d', 50);
    await expect(page.getByTestId('check-rf-verify')).toContainText('未通过');
    await page.waitForTimeout(400);
    await shot(page, '08-rf-fail');
  });

  test('drawer sub-views and dark theme', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('menu-btn').click();
    await page.getByTestId('drawer-settings').click();
    await expect(page.getByText('深色主题')).toBeVisible();
    await page.getByTestId('drawer-back').click();
    await page.getByTestId('drawer-account').click();
    await expect(page.getByText('wang@structuremail.com')).toBeVisible();
    await page.getByTestId('drawer-back').click();
    await page.getByTestId('theme-toggle').click();
    await shot(page, '09-dark-drawer');
  });

  test('agents sheet, artifacts sheet, action stack tabs', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('agents-btn').click();
    await expect(page.getByTestId('agents-sheet')).toBeVisible();
    await expect(page.getByText('自动规范校核')).toBeVisible();
    await shot(page, '10-agents');
    await page.getByTestId('agents-settings-btn').click();
    await expect(page.getByText('模型选择')).toBeVisible();
    await page.getByTestId('agents-sheet').getByTestId('sheet-close').click();

    await page.getByTestId('artifacts-chip').click();
    await expect(page.getByText('beam_deflection.m')).toBeVisible();
    await shot(page, '11-artifacts');
    await page.getByTestId('artifacts-sheet').getByTestId('sheet-close').click();

    // insert sub-gallery
    await page.getByText('插入', { exact: true }).click();
    await page.getByTestId('insert-compute').click();
    await expect(page.getByText('选择计算模板')).toBeVisible();
    await shot(page, '12-insert-gallery');
    await page.getByTestId('sub-back').click();
  });

  test('agent chat: verify question answered from live kernel state', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-chat').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    await page.getByTestId('slash-toggle').click();
    await expect(page.getByText('斜杠命令')).toBeVisible();
    await shot(page, '13-chat-slash');
    await page.getByTestId('slash-verify').click();

    // scripted agent reads the check cell and answers with live values
    await expect(page.getByTestId('msg-agent').last()).toContainText('通过', { timeout: 10_000 });
    await expect(page.getByTestId('msg-agent').last()).toContainText('mm');
    await shot(page, '14-chat-verify');
  });

  test('autonomous turn → pending badge → review sheet → accept applies', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-chat').click();
    await page.getByText('自主执行').click();
    await page.getByTestId('chat-send').click();

    // pending badge appears on the agents icon once PendingReady fires
    await expect(page.getByTestId('pending-badge')).toBeVisible({ timeout: 10_000 });
    await shot(page, '15-pending-badge');

    await page.getByTestId('agents-btn').click();
    await expect(page.getByTestId('pending-sheet')).toBeVisible();
    await expect(page.getByTestId('pending-item-0')).toContainText('端部荷载 F');
    await expect(page.getByTestId('pending-item-0')).toContainText('14 kN');
    // shadow-eval impact preview shows the post-change values
    await expect(page.getByText('影响预览(影子求值)')).toBeVisible();
    await shot(page, '16-pending-sheet');

    await page.getByTestId('pending-accept-all').click();
    // param applied through the kernel: δ = 14e3·8/(3·2e11·2e-5) = 9.33mm > 8 → fail
    await page.getByTestId('chat-back').click();
    await expect(page.getByTestId('result-beam-compute')).toHaveText(/9\.33\s*mm/);
    await expect(page.getByTestId('check-beam-verify')).toContainText('未通过');
    await shot(page, '17-pending-accepted');
  });

  test('fix-error flow repairs an inserted error-demo cell via propose mode', async ({ page }) => {
    await page.goto('/');
    // the default notebook loads clean; insert the "错误演示" template to
    // exercise the fix-error agent flow on demand
    await page.getByText('插入', { exact: true }).click();
    await page.getByTestId('insert-compute').click();
    await page.getByText('错误演示').click();

    await expect(page.getByTestId('fix-error-btn')).toBeVisible();
    await page.getByTestId('fix-error-btn').click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();
    await expect(page.getByTestId('pending-badge')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('agents-btn').click();
    await expect(page.getByTestId('pending-item-0')).toContainText('材料应力校核');
    await page.getByTestId('pending-accept-all').click();
    await page.getByTestId('chat-back').click();

    // error card becomes a passing check card; no errored cells remain
    await expect(page.getByTestId('fix-error-btn')).toHaveCount(0, { timeout: 10_000 });
    await shot(page, '18-error-fixed');
  });

  test('symbol chips open the Wolfram-style inspect sheet', async ({ page }) => {
    await page.goto('/');
    // notebook symbol: live value + jump to its defining card
    await page.getByTestId('sym-chip-F').first().click();
    await expect(page.getByTestId('inspect-sheet')).toBeVisible();
    await expect(page.getByTestId('inspect-sheet')).toContainText('当前值');
    await shot(page, '20-inspect-symbol');
    await page.getByTestId('inspect-goto-definer').click();
    await expect(page.getByTestId('inspect-sheet')).not.toBeVisible();

    // package function: docs come from the rf domain package
    await page.getByTestId('menu-btn').click();
    await page.getByTestId('nbfile-rf-link-budget.pro.md').click();
    await page.getByTestId('sym-chip-fspl').first().click();
    await expect(page.getByTestId('inspect-sheet')).toContainText('自由空间路径损耗');
    await shot(page, '21-inspect-pkg-fn');
    await page.getByTestId('inspect-sheet').getByTestId('sheet-close').click();
  });

  test('feed: position badge, swipe hint, and edit-in-calc round trip', async ({ page }) => {
    await page.goto('/');
    // default selection is beam-verify — entering Feed lands on that card's
    // projection (cross-view continuity), so the badge reads its position
    await page.getByText('Feed', { exact: true }).first().click();
    await expect(page.getByTestId('feed-index-badge')).toContainText('/8');
    await expect(page.getByTestId('feed-index-badge')).toContainText('校核');
    await expect(page.getByTestId('feed-file-badge')).toContainText('悬臂梁挠度.pro.md');
    await shot(page, '22-feed-badges');

    // jump to the compute card, then hop to its Calc projection
    await page.getByTestId('feed-overview-btn').click();
    await page.getByText('3 · 结果').click();
    await expect(page.getByTestId('feed-result')).toBeVisible();
    await page.getByTestId('feed-edit-in-calc').first().click();
    await expect(page.getByTestId('action-stack')).toBeVisible();
    await expect(page.getByTestId('result-beam-compute')).toBeVisible();
    await shot(page, '23-feed-to-calc');
  });

  test('feed: first-run swipe hint shows once per session', async ({ page }) => {
    await page.goto('/');
    // open a notebook with no selection so entering Feed doesn't auto-scroll
    await page.getByTestId('menu-btn').click();
    await page.getByTestId('nbfile-rf-link-budget.pro.md').click();
    await page.getByText('Feed', { exact: true }).first().click();
    await expect(page.getByTestId('feed-index-badge')).toContainText('1/');
    await expect(page.getByTestId('feed-swipe-hint')).toBeVisible();
    await shot(page, '25-feed-hint');
    // any scroll consumes the hint for the rest of the session
    await page.getByTestId('feed-scroll').evaluate((el) => { el.scrollTop = el.clientHeight; });
    await expect(page.getByTestId('feed-swipe-hint')).not.toBeVisible();
  });

  test('read: document properties project the frontmatter', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('menu-btn').click();
    await page.getByTestId('nbfile-rf-link-budget.pro.md').click();
    await page.getByText('Read', { exact: true }).first().click();
    await expect(page.getByTestId('read-properties')).toContainText('rf ^1.0');
    await expect(page.getByTestId('read-properties')).toContainText('X波段链路预算.pro.md');
    await shot(page, '24-read-properties');
  });

  test('capability gap self-heals: missing package symbol → one-tap load → green', async ({ page }) => {
    await page.goto('/');
    await page.getByText('插入', { exact: true }).first().click();
    await page.getByTestId('insert-compute').click();
    await page.getByText('弯曲应力 (mech)').click();

    // inserted cell errors on the mech-provided symbol; the registry suggests it
    await expect(page.getByText('未定义变量 W_rect')).toBeVisible();
    await expect(page.getByText('由 mech 域包提供')).toBeVisible();
    await shot(page, '26-gap-suggestion');
    await page.getByTestId('pkg-suggestion-btn').click();

    // package (plus its units dependency) attaches, cell recomputes and passes
    await expect(page.getByText('弯曲应力满足 Q235')).toBeVisible();
    await expect(page.getByTestId('toast')).toContainText('units'); // dependency reported
    await page.getByTestId('menu-btn').click();
    await expect(page.getByTestId('pkg-loader-mech')).toContainText('已加载');
    await expect(page.getByTestId('pkg-loader-units')).toContainText('已加载');
    await shot(page, '27-gap-healed');
  });

  test('self-evolution: promote a closure, reuse it in another notebook', async ({ page }) => {
    await page.goto('/');
    await page.getByText('插入', { exact: true }).first().click();
    await page.getByTestId('insert-compute').click();
    await page.getByText('自定义函数').click();

    // the defining cell surfaces its closure as a promotion candidate
    await page.getByTestId('def-chip-margin_ratio').first().click();
    await expect(page.getByTestId('inspect-sheet')).toBeVisible();
    await page.getByTestId('inspect-promote-btn').click();
    await expect(page.getByTestId('toast')).toContainText('learned v1.0.1');
    await shot(page, '28-promoted');

    // learned library shows it in the drawer, workspace-wide: still listed
    // after switching to the other notebook (cross-session reuse itself is
    // covered by unit tests in evolve.test.ts)
    await page.getByTestId('menu-btn').click();
    await expect(page.getByTestId('learned-fn-margin_ratio')).toBeVisible();
    await page.getByTestId('nbfile-rf-link-budget.pro.md').click();
    await expect(page.getByText('X 波段链路预算').first()).toBeVisible();
    await page.getByTestId('menu-btn').click();
    await expect(page.getByTestId('learned-fn-margin_ratio')).toBeVisible();
    await shot(page, '29-cross-notebook');
  });

  test('home view scopes recents to the active project', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-btn').click();
    await expect(page.getByText('工作台')).toBeVisible();
    // default active notebook is the beam one — its project's recents only
    await expect(page.getByTestId('home-recent-0')).toContainText('悬臂梁挠度.pro.md');
    await expect(page.getByTestId('home-recent-1')).toHaveCount(0);
    await expect(page.getByTestId('home-conversation')).toContainText('规范校核讨论');
    await shot(page, '19-home');

    // switch active project via the drawer, then recents follow it
    await page.getByTestId('menu-btn').click();
    await page.getByTestId('nbfile-rf-link-budget.pro.md').click();
    await page.getByTestId('home-btn').click();
    await expect(page.getByTestId('home-recent-0')).toContainText('X波段链路预算.pro.md');
    await expect(page.getByTestId('home-recent-1')).toHaveCount(0);
    await expect(page.getByTestId('home-conversation')).toContainText('RF 链路余量');

    await page.getByTestId('home-recent-0').click();
    await expect(page.getByText('X 波段链路预算').first()).toBeVisible();
  });
});
