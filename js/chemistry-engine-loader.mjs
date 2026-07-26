/** 瀏覽器端唯一引擎載入點：只透過 dist/index.js 匯入 solveChemistry。 */
import { solveChemistry } from '../chemistry-solving-engine/dist/index.js';

globalThis.ChemistryEngine = Object.freeze({ solveChemistry });
globalThis.dispatchEvent(new Event('chemistry-engine-ready'));
