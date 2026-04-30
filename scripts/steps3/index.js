const { checkLogin } = require('./login');
const openGameList = require('./openGameList');
const { launchGame } = require('./launchGame');
const { checkGameLoad } = require('./checkGameLoad');
const { checkSpaceSpin } = require('./checkSpaceSpin');
const { gameOperation } = require('./gameOperation');
const { startStreaming } = require('./startStreaming');

module.exports = {
    checkLogin,
    openGameList,
    launchGame,
    checkGameLoad,
    checkSpaceSpin,
    gameOperation,
    startStreaming
};
