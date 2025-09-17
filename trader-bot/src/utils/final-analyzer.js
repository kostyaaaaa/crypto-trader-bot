// final-analyzer.js
import { analyzeCandles } from "../modules/candles/analyze-сandles.js";
import { analyzeLiquidity } from "../modules/orderbook/analyze-liquidity.js";
import { analyzeLiquidations } from "../modules/liquidations/analyze-liquidations.js";
import { analyzeOpenInterest } from "../modules/openinterest/analyze-openinterest.js";
import { analyzeVolatility } from "../modules/volatility/analyze-volatility.js";
import { analyzeFunding } from "../modules/funding/analyze-funding.js";
import { analyzeCorrelation } from "../modules/correlation/analyze-correlation.js";
import { saveDoc } from "../storage/storage.js";

export async function finalAnalyzer({
                                        symbol = "ETHUSDT",
                                        analysisConfig = {}
                                    } = {}) {
    const {
        oiWindow = 10,
        liqWindow = 20,
        liqSentWindow = 5,
        fundingWindow = 60,
        volWindow = 14,
        corrWindow = 5,
        weights = {},              // беремо з analysisConfig
        moduleThresholds = {}      // теж з analysisConfig
    } = analysisConfig;

    const modules = {};

    // --- Trend (EMA/RSI) ---
    modules.trend = await analyzeCandles(symbol);

    // --- Liquidity ---
    modules.liquidity = await analyzeLiquidity(symbol, liqWindow);

    // --- Funding ---
    modules.funding = await analyzeFunding(symbol, fundingWindow);

    // --- Liquidations ---
    modules.liquidations = await analyzeLiquidations(symbol, liqSentWindow);

    // --- Open Interest ---
    modules.openInterest = await analyzeOpenInterest(symbol, oiWindow);

    // --- Volatility ---
    modules.volatility = await analyzeVolatility(symbol, volWindow);

    // --- Correlation ---
    modules.correlation = await analyzeCorrelation(symbol, corrWindow);

    // --- Weighted scoring ---
    function weightedScore(side) {
        return Object.entries(modules).reduce((acc, [k, v]) => {
            if (!v) return acc;
            const strength = v[side] || 0;
            const threshold = moduleThresholds[k] || 0;

            // Якщо сила сигналу нижча за поріг — ігноруємо
            if (strength < threshold) return acc;

            return acc + strength * (weights[k] || 0);
        }, 0);
    }

    const scoreLONG = weightedScore("LONG");
    const scoreSHORT = weightedScore("SHORT");

    let decision = "NO TRADE";
    if (scoreLONG > 65) decision = "STRONG LONG";
    else if (scoreLONG > 50) decision = "WEAK LONG";
    else if (scoreSHORT > 65) decision = "STRONG SHORT";
    else if (scoreSHORT > 50) decision = "WEAK SHORT";

    const bias =
        scoreLONG > scoreSHORT ? "LONG" : scoreSHORT > scoreLONG ? "SHORT" : "NEUTRAL";

    const filledModules = Object.values(modules).filter(
        (m) => (m?.LONG || 0) + (m?.SHORT || 0) > 0
    ).length;

    const result = {
        time: new Date().toISOString(),
        symbol,
        modules,
        scores: {
            LONG: scoreLONG.toFixed(1),
            SHORT: scoreSHORT.toFixed(1)
        },
        coverage: `${filledModules}/${Object.keys(modules).length}`,
        bias,
        decision
    };

    await saveDoc("analysis", result);
    return result;
}