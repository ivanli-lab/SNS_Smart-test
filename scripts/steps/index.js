/**
 * 測試步驟統一匯出
 * 
 * 這個檔案負責統一匯出所有測試步驟模組
 * 未來添加新的測試步驟時，在此檔案中添加對應的 require 即可
 */

module.exports = {
  checkGVersion: require('./gVersion'),
  checkStreamNSpinDialog: require('./streamNSpinDialog'),
  checkRenameFunction: require('./renameFunction'),
  checkStreamingNowCount: require('./streamingNowCount'),
  checkSortButton: require('./sortButton'),
  checkPromotionImages: require('./promotionImages'),
  checkAllStreamersImages: require('./allStreamersImages'),
  checkAllStreamersSortButton: require('./allStreamersSortButton'),
  checkStreamerCardClick: require('./streamerCardClick'),
  checkLobbyGift: require('./lobbyGift'),
  checkRankingData: require('./rankingData'),
  checkStreamerPhoto: require('./streamerPhoto'),
  checkBackButton: require('./backButton')
};
