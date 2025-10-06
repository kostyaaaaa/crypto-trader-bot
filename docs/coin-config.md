# ⚙️ Trading Bot Configuration Guide

Цей документ пояснює **всі параметри конфіга**, які використовує бот.  
Мета: дати змогу налаштовувати систему навіть людині без досвіду трейдингу.

---

## 📌 Основна структура

Конфіг складається з двох великих блоків:

1. **`analysisConfig`** — налаштування аналізу ринку (свічки, ваги, пороги).
2. **`strategy`** — торгові правила (вхід, ризик, тейки, стопи, трейлінг).

---

## 🔍 1. `analysisConfig`

### `candleTimeframe`

- ⏱️ Таймфрейм свічок, які аналізуються.
- Приклади: `'1m'`, `'3m'`, `'5m'`, `'15m'`, `'1h'`.
- **Рекомендації**:
  - Скальпінг: `1m–3m`
  - Інтрадей: `5m–15m`
  - Свінг: `1h+`

---

### Вікна історії

Визначають, **скільки даних беремо для аналізу**:

- `oiWindow` → Open Interest (наприклад, `20` = 20 хв історії).
- `liqWindow` → Ліквідність у стакані.
- `liqSentWindow` → Скільки хвилин дивимося ліквідації.
- `fundingWindow` → Скільки часу усереднюємо funding rate.
- `volWindow` → ATR (волатильність).
- `corrWindow` → Період для кореляції з BTC.
- `longShortWindow` → Період для long/short ratio.

**Рекомендації**:

- Скальпінг: `2–10` (швидка реакція).
- Інтрадей: `10–30`.
- Свінг: `50+`.

---

### `weights` (ваги модулів)

Визначають, **наскільки важливий кожен фактор у фінальному скорі**.  
Сума не обов’язково = 1 (нормалізація робиться автоматично).

- `trend` → EMA/RSI сигнали.
- `trendRegime` → ADX/DI (чи є тренд).
- `liquidity` → Ордербук (де гроші).
- `funding` → Фандінг.
- `liquidations` → Ліквідації.
- `openInterest` → OI зміни.
- `longShort` → Співвідношення лонгів/шортів.

**Рекомендації**:

- Скальпінг: робимо акцент на `liquidity`, `liquidations`, `trend`.
- Інтрадей: баланс між `trend`, `openInterest`, `funding`.
- Свінг: більше значення для `trend`, `trendRegime`, `OI`.

---

### `moduleThresholds`

Мінімальні пороги для кожного модуля. Якщо значення нижче → модуль **не зараховується**.

**Рекомендації**:

- Скальпінг: низькі пороги (`3–15`).
- Інтрадей: середні (`15–30`).
- Свінг: високі (`30–50`).

---

## 🎯 2. `strategy`

### `entry` (правила входу)

- `minScore` → мінімальний сумарний скор для LONG/SHORT.
- `minModules` → мінімальна кількість модулів, що пройшли поріг.
- `requiredModules` → обов’язкові модулі (наприклад, `['trend']`).
- `maxSpreadPct` → максимальний спред (%) у стакані для входу.
- `cooldownMin` → мінімальний час у хвилинах між угодами по одній монеті.
- `avoidWhen`:
  - `volatility: 'DEAD'` → не торгувати у флеті.
  - `fundingExtreme.absOver` → не торгувати, якщо funding > X.
- `sideBiasTolerance` → мінімальна різниця між LONG і SHORT, щоб брати сторону.

**Рекомендації**:

- Скальпінг: `minScore` 30–40, `minModules` 2, `sideBiasTolerance` 0.5–1.5.
- Інтрадей: `minScore` 45–55, `minModules` 3+, `sideBiasTolerance` 3–5.
- Свінг: `minScore` 55+, `minModules` 4+, `sideBiasTolerance` 5–10.

---

### `volatilityFilter`

- `deadBelow` → якщо ATR% < X → ринок вважається "мертвим".
- `extremeAbove` → якщо ATR% > Y → ринок "занадто гарячий".

**Рекомендації**:

- Скальпінг: `deadBelow = 0.1–0.2`, `extremeAbove = 3–4`.
- Інтрадей: `deadBelow = 0.25–0.4`, `extremeAbove = 2.5–3`.
- Свінг: `deadBelow = 0.5+`, `extremeAbove = 2`.

---

### `capital`

- `account` → розмір рахунку (USD).
- `riskPerTradePct` → ризик на угоду (% від рахунку).
- `leverage` → плече.
- `maxConcurrentPositions` → максимум одночасних угод.

**Рекомендації**:

- Скальпінг: `riskPerTradePct = 0.5–1%`, `leverage = 5–10`.
- Інтрадей: `0.5–1%`, `leverage = 3–5`.
- Свінг: `0.25–0.5%`, `leverage = 1–3`.

---

### `sizing`

- `maxAdds` → скільки доливів (DCA) можна робити.
- `addOnAdverseMovePct` → доливати при русі проти на X%.
- `addMultiplier` → коефіцієнт розміру наступного доливу.

### `exits`

#### Take-Profit (`tp`)

- `tpGridPct` → відсотки для тейків (наприклад `[1, 2, 3]`).
- `tpGridSizePct` → який % позиції закривається на кожному тейку.

#### Stop-Loss (`sl`)

- `type`:
  - `'hard'` → фіксований %,
  - `'atr'` → стоп від ATR.
- `hardPct` → фіксований стоп (%).
- `atrMult` → множник ATR.
- `signalRules` → умови для flip (зміни LONG ↔ SHORT).

#### Time-stop (`time`)

- `maxHoldMin` → максимальний час утримання угоди.
- `noPnLFallback` → що робити, якщо нема результату (`'close' | 'none'`).

#### Trailing (`trailing`)

- `use` → вкл/викл.
- `startAfterPct` → після якого прибутку вмикається.
- `trailStepPct` → крок підтягування.

**Рекомендації**:

- Скальпінг: `tpGridPct = [0.5, 1]`, `sl: atr ×1.0`, `maxHoldMin = 5–30`.
- Інтрадей: `tpGridPct = [1, 2, 3]`, `sl: atr ×1.5`, `maxHoldMin = 60–120`.
- Свінг: `tpGridPct = [3, 5, 10]`, `sl: atr ×2`, `maxHoldMin = 1–5 днів`.

---

## ✅ Приклад конфіга для скальпінгу (1m)

```json
{
  "analysisConfig": {
    "candleTimeframe": "1m",
    "oiWindow": 5,
    "liqWindow": 5,
    "liqSentWindow": 2,
    "fundingWindow": 10,
    "volWindow": 14,
    "corrWindow": 2,
    "longShortWindow": 2,
    "weights": {
      "trend": 0.25,
      "liquidity": 0.3,
      "liquidations": 0.2,
      "openInterest": 0.15,
      "funding": 0.05
    },
    "moduleThresholds": {
      "trend": 20,
      "liquidity": 15,
      "liquidations": 10,
      "openInterest": 10
    }
  },
  "strategy": {
    "entry": {
      "minScore": { "LONG": 35, "SHORT": 35 },
      "minModules": 2,
      "requiredModules": [],
      "maxSpreadPct": 0.08,
      "cooldownMin": 1,
      "sideBiasTolerance": 1
    },
    "volatilityFilter": {
      "deadBelow": 0.1,
      "extremeAbove": 3.5
    },
    "capital": {
      "account": 200,
      "riskPerTradePct": 0.5,
      "leverage": 5,
      "maxConcurrentPositions": 3
    },
    "sizing": {
      "maxAdds": 2,
      "addOnAdverseMovePct": 0.4,
      "addMultiplier": 1.1
    },
    "exits": {
      "tp": { "use": true, "tpGridPct": [0.5, 1], "tpGridSizePct": [50, 50] },
      "sl": { "type": "atr", "atrMult": 1.0 },
      "time": { "maxHoldMin": 15, "noPnLFallback": "close" },
      "trailing": { "use": true, "startAfterPct": 0.5, "trailStepPct": 0.25 }
    }
  }
}
```
