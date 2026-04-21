// 版本資訊
const VERSION = '1.2.0';  // 格式: major.minor.patch

// 測試網站 URL 配置
const TEST_URLS = [
  {
    name: 'Stg',
    url: 'https://lobby.ingmsrv.cc/?isAgentApi&test'
  },
  {
    name: 'Lobby SNS Lab (一般)',
    url: 'http://lobby.sns.lab/'
  },
  {
    name: '開發環境',
    url: 'http://localhost:8080/?isAgentApi'
  },
];

// 預設使用第一個 URL
const DEFAULT_URL = TEST_URLS[0];

// 測試解析度配置
const VIEWPORT_PRESETS = [
  { name: 'Desktop (1366x768)', width: 1366, height: 768 },
  { name: 'iPhone 14 Pro Max (430x932)', width: 430, height: 932 },
  { name: 'iPad Pro (1024x1366)', width: 1024, height: 1366 },
  { name: 'iPhone 13 (390x844)', width: 390, height: 844 },
  { name: 'Samsung S21 (360x800)', width: 360, height: 800 }
];

// 預設使用第一個解析度 (Desktop)
const DEFAULT_VIEWPORT = VIEWPORT_PRESETS[0];

// SAC 後台 URL 配置
const SAC_URLS = [
  {
    name: 'SAC Stg',
    url: 'https://sac.ingmsrv.cc/',
    apiUrl: 'https://an.ingmsrv.cc/setting/get_game_list'
  },
  {
    name: 'SAC Lab',
    url: 'http://sac.sns.lab/',
    apiUrl: 'http://an.sns.lab/setting/get_game_list'
  },
  {
    name: 'SAC Dev',
    url: 'http://sacd.ingmsrv.cc/',
    apiUrl: 'http://and.ingmsrv.cc/setting/get_game_list'
  }
];

const DEFAULT_SAC_URL = SAC_URLS[0];

// 遊戲按鈕座標地圖 (百分比 X, Y)
// 格式: "遊戲ID": { spin: { x: 0.8, y: 0.9 }, auto: { x: 0.8, y: 0.8 } }
const GAME_COORDINATE_MAP = {
  "4400": {
    spin: { x: 0.8060, y: 0.9258 },
    ok: { x: 0.5015, y: 0.8685 }
  },
  "4600": {
    spin: { x: 0.8060, y: 0.9258 },
    ok: { x: 0.5015, y: 0.8685 }
  },
  "default": {
    spin: { x: 0.8060, y: 0.9258 },
    ok: { x: 0.5015, y: 0.8685 }
  }
};
