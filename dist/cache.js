"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCache = getCache;
exports.updateCache = updateCache;
exports.checkCache = checkCache;
const node_fetch_1 = __importDefault(require("node-fetch"));
const promises_1 = __importDefault(require("node:fs/promises"));
const config_1 = require("./config");
const util_1 = require("./util");
const cacheMap = new Map();
const logger = config_1.globalConfig.logger;
const fileList = [
    "characters",
    "loc",
    "weapons",
    "reliquaries",
    "reliquary-set",
    "reliquaries-loc",
];
let loadingPromise = null;
const getCacheFilePath = (fileName) => `${config_1.globalConfig.cacheDir}/${fileName}.json`;
function getCache(fileName) {
    return cacheMap.get(fileName);
}
async function setCache(fileName, value) {
    const doWriteFile = () => promises_1.default.writeFile(getCacheFilePath(fileName), typeof value === "string" ? value : JSON.stringify(value), { flag: "w" });
    try {
        await doWriteFile();
    }
    catch (e) {
        if (e.code === "ENOENT") {
            logger.info(`create cache dir: ${config_1.globalConfig.cacheDir}`);
            await promises_1.default.mkdir(config_1.globalConfig.cacheDir, { recursive: true });
            await doWriteFile();
        }
        else {
            throw e;
        }
    }
    cacheMap.set(fileName, typeof value === "string" ? JSON.parse(value) : value);
}
// 更新缓存，默认为从远端刷新所有
// checkCache 模式下只会获取本地缓存没有的
async function updateCache(updateRemote = true) {
    const tasks = fileList.map((name) => (async () => {
        if (!updateRemote && (await (0, util_1.fileExists)(getCacheFilePath(name)))) {
            const jsonString = await promises_1.default.readFile(getCacheFilePath(name), "utf-8");
            logger.info(`reading cache ${name}.json`);
            await setCache(name, jsonString);
        }
        else {
            const meta = await (0, node_fetch_1.default)(`https://raw.githubusercontent.com/zcWSR/taffy-pvp-card-ds/master/data/${name}.json`);
            logger.info(`fetching ${name}.json`);
            await setCache(name, (await meta.json()));
        }
    })());
    loadingPromise = Promise.all(tasks);
    await loadingPromise;
    loadingPromise = null;
}
// 每次 generateCard 都会执行，如果此时正在 updateCache 则会等待
async function checkCache() {
    if (loadingPromise)
        return loadingPromise;
    if (cacheMap.size !== fileList.length) {
        await updateCache(false);
    }
}
