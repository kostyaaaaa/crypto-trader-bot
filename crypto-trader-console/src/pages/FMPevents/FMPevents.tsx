'use client';
import { useEffect, useRef, useState } from 'react';

type ImpactKey = 'high' | 'mediumHigh' | 'all';
type DateRangeKey = 'today' | 'this_week' | 'next_week' | 'this_month';
type TabKey = 'calendar' | 'guide';

const IMPACT_TO_FILTER: Record<ImpactKey, string> = {
  // TradingView: 0=low, 1=medium, 2=high
  high: '2',
  mediumHigh: '1,2',
  all: '0,1,2',
};

const RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This week' },
  { key: 'next_week', label: 'Next week' },
  { key: 'this_month', label: 'This month' },
];

const EconomicCalendar: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  // tabs: Calendar (widget) | Guide (instructions)
  const [tab, setTab] = useState<TabKey>('calendar');

  const [impact, setImpact] = useState<ImpactKey>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(
        'tv_impact',
      ) as ImpactKey | null;
      if (saved && IMPACT_TO_FILTER[saved]) return saved;
    }
    return 'high';
  });

  const [range, setRange] = useState<DateRangeKey>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(
        'tv_range',
      ) as DateRangeKey | null;
      if (saved && RANGE_OPTIONS.find((r) => r.key === saved)) return saved;
    }
    return 'this_week';
  });

  // render / re-render widget when filters change (only on Calendar tab)
  useEffect(() => {
    if (tab !== 'calendar') return; // don't touch DOM if on Guide
    if (!ref.current) return;

    // clean re-mount container
    ref.current.innerHTML = `
      <div class="tradingview-widget-container__widget"></div>
      <div class="tradingview-widget-copyright">
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener nofollow">
          Track all markets on TradingView
        </a>
      </div>
    `;

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
    script.async = true;
    script.setAttribute('data-tv', '1');

    // TradingView widget config
    script.innerHTML = JSON.stringify({
      width: '100%',
      height: 760,
      colorTheme: 'dark',
      isTransparent: false,
      locale: 'uk',
      dateRange: range, // today | this_week | next_week | this_month
      importanceFilter: IMPACT_TO_FILTER[impact],
      timeZone: 'Etc/UTC',
    });

    ref.current.appendChild(script);

    // persist selection
    try {
      window.localStorage.setItem('tv_impact', impact);
      window.localStorage.setItem('tv_range', range);
    } catch {
      console.log('persist selection error');
    }
  }, [impact, range, tab]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      {/* Header with tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            Economic Calendar
          </h1>
          <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
            <button
              type="button"
              onClick={() => setTab('calendar')}
              style={{
                background: tab === 'calendar' ? '#222' : '#111',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setTab('guide')}
              style={{
                background: tab === 'guide' ? '#222' : '#111',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              Guide
            </button>
          </div>
        </div>

        {tab === 'calendar' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* Date range dropdown */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ opacity: 0.8, fontSize: 14 }}>Range:</span>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as DateRangeKey)}
                style={{
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: '6px 10px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {RANGE_OPTIONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Impact dropdown */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ opacity: 0.8, fontSize: 14 }}>Impact:</span>
              <select
                value={impact}
                onChange={(e) => setImpact(e.target.value as ImpactKey)}
                style={{
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: '6px 10px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="high">High only</option>
                <option value="mediumHigh">Medium + High</option>
                <option value="all">All (Low + Medium + High)</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {tab === 'calendar' ? (
        <div
          className="tradingview-widget-container"
          ref={ref}
          style={{ height: 560 }}
        />
      ) : (
        <div style={{ lineHeight: 1.6, fontSize: 14 }}>
          <h2 style={{ marginTop: 8 }}>Як користуватись календарем</h2>
          <ul>
            <li>
              <b>Range</b> — вибір періоду:{' '}
              <i>Today / This week / Next week / This month</i>.
            </li>
            <li>
              <b>Impact</b> — рівень важливості подій. Почни з <i>High only</i>,
              якщо потрібно — додай <i>Medium</i>.
            </li>
            <li>
              Кнопка <b>FOMC preset</b> швидко відкриває ширший період для ловлі
              засідань і заяв ФРС.
            </li>
          </ul>

          <h3>Рівні Impact</h3>
          <ul>
            <li>
              <b>High</b> — здатні різко рухати ринки (ставки, CPI, NFP, FOMC
              тощо).
            </li>
            <li>
              <b>Medium</b> — важливі, але зазвичай слабші рухи (PMI,
              промвиробництво, виступи).
            </li>
            <li>
              <b>Low</b> — локальні/другорядні індикатори.
            </li>
          </ul>

          <h3>Ключові типи подій та вплив</h3>
          <ul>
            <li>
              <b>FOMC / Центральні банки</b>: рішення по ставці, заява,
              пресконференція, протоколи. Яструбиний тон =&gt; сильніший USD,
              тиск на ризикові активи (крипто/акції). Голубиний — навпаки.
            </li>
            <li>
              <b>CPI / PCE (інфляція)</b>: вища за прогноз =&gt; очікування
              жорсткішої політики, ризики вниз; нижча — полегшення, ризики
              вгору.
            </li>
            <li>
              <b>NFP / безробіття</b>: сильний ринок праці =&gt; інфляційний
              тиск, ймовірність жорсткості ФРС; слабкий — підтримка ризикових.
            </li>
            <li>
              <b>GDP, Retail Sales, ISM/PMI</b>: макроактивність; сильні дані
              часто підсилюють USD і прибутковості, приглушують ризики.
            </li>
            <li>
              <b>Виступи членів ФРС/ЄЦБ/BoE</b>: можуть різко змінювати
              очікування, особливо за відсутності інших подій.
            </li>
            <li>
              <b>Запаси нафти</b>: більш релевантно для енергетики/інфляційного
              наративу; вторинний вплив на крипто.
            </li>
          </ul>

          <h3>Практичний підхід</h3>
          <ol>
            <li>
              Перед торговим днем переглянь <i>High</i> події на тиждень уперед.
            </li>
            <li>
              У день публікації — познач ключовий час (UTC) і зменшуй ризик біля
              релізу.
            </li>
            <li>
              Реакція ринку важливіша за саме число: перевір перші 5–15 хв
              свічки.
            </li>
            <li>
              Синхронізуйся з <i>сесіями</i>: Європа (08–16 UTC), США (13–21
              UTC), їх перетин (13–16 UTC) — найліквідніший.
            </li>
          </ol>

          <h3>Поради для крипто</h3>
          <ul>
            <li>
              Стеж за <b>DXY</b>, прибутковостями UST та S&amp;P 500: вони
              задають фон ризиковим активам.
            </li>
            <li>
              На <b>FOMC</b>/CPI ринок часто робить перший імпульс і швидкий
              відкат. Чекай підтвердження тренду.
            </li>
            <li>Працюй із зменшеним плечем/обсягом навколо релізів.</li>
          </ul>

          <h3>Шпаргалка подій та скорочень</h3>
          <p style={{ opacity: 0.9 }}>
            Найчастіші абревіатури у календарі та як вони зазвичай впливають на
            ринок.
          </p>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'max-content 1fr',
              gap: '8px 16px',
            }}
          >
            <dt>
              <b>CPI</b> / <b>Core CPI</b>
            </dt>
            <dd>
              Індекс споживчих цін / базовий (без енергії та їжі). Вище прогнозу
              =&gt; ризики вниз, сильніший USD; нижче =&gt; підтримка ризикових
              активів.
            </dd>

            <dt>
              <b>PCE</b> / <b>Core PCE</b>
            </dt>
            <dd>«Улюблена» інфляція ФРС. Логіка впливу аналогічна CPI.</dd>

            <dt>
              <b>NFP</b>
            </dt>
            <dd>
              Нефермерська зайнятість. Сильні дані можуть підвищувати очікування
              жорсткішої політики ФРС.
            </dd>

            <dt>
              <b>Unemployment Rate</b>
            </dt>
            <dd>
              Рівень безробіття. Нижче =&gt; сильніший ринок праці (частіше
              «яструбиний» сигнал).
            </dd>

            <dt>
              <b>Average Hourly Earnings</b>
            </dt>
            <dd>Зарплатна інфляція. Вища =&gt; інфляційний тиск.</dd>

            <dt>
              <b>FOMC</b> / <b>Fed Funds Rate</b>
            </dt>
            <dd>
              Рішення ФРС по ставці, заява, пресконференція, протоколи
              (minutes). Яструбиний тон тисне на ризикові активи; голубиний
              підтримує.
            </dd>

            <dt>
              <b>GDP</b> (QoQ / YoY / SAAR)
            </dt>
            <dd>
              Валовий продукт (квартал/рік/річний темп). Сильніші дані можуть
              зміцнювати USD і знижувати апетит до ризику.
            </dd>

            <dt>
              <b>Retail Sales</b> (MM / Ex-Auto)
            </dt>
            <dd>
              Роздрібні продажі (м/м; без авто). Відображають споживчу
              активність.
            </dd>

            <dt>
              <b>ISM Manufacturing / Services PMI</b> /{' '}
              <b>S&amp;P Global PMI</b>
            </dt>
            <dd>
              Індикатори ділової активності (50 — нейтрально). Вище 50 =&gt;
              розширення економіки.
            </dd>

            <dt>
              <b>Durable Goods</b> / <b>Core Capital Goods</b>
            </dt>
            <dd>
              Замовлення на товари тривалого користування / інвесттовари.
              Впливають на настрої щодо зростання.
            </dd>

            <dt>
              <b>JOLTS</b>
            </dt>
            <dd>Вакансії у США. Високі значення =&gt; тугий ринок праці.</dd>

            <dt>
              <b>Initial / Continuing Claims</b>
            </dt>
            <dd>
              Первинні/повторні заявки на допомогу з безробіття. Зростання =&gt;
              охолодження ринку праці.
            </dd>

            <dt>
              <b>Consumer Confidence</b> / <b>Michigan Sentiment</b>
            </dt>
            <dd>Споживчі настрої — впливають на очікуваний попит.</dd>

            <dt>
              <b>Housing Starts</b> / <b>Building Permits</b>
            </dt>
            <dd>
              Будівництво/дозволи — чутливі до ставок; індикатор раннього циклу.
            </dd>

            <dt>
              <b>Existing / New Home Sales</b>
            </dt>
            <dd>
              Продажі житла — відображають здоров’я споживача та кредитного
              ринку.
            </dd>

            <dt>
              <b>Industrial Production</b>
            </dt>
            <dd>
              Випуск у промисловості; слабкість часто б’є по ризикових активах.
            </dd>

            <dt>
              <b>Trade Balance</b>
            </dt>
            <dd>Торговий баланс; великі дефіцити інколи тиснуть на валюту.</dd>

            <dt>
              <b>Crude Oil Inventories</b>
            </dt>
            <dd>
              Запаси нафти — вплив через енергоінфляцію та risk sentiment.
            </dd>

            <dt>
              <b>ECB / BoE / BoJ</b>
            </dt>
            <dd>
              Рішення інших ЦБ — важливо для долара через крос-курси й загальний
              risk-on/off.
            </dd>

            <dt>
              <b>China LPR</b>
            </dt>
            <dd>
              Китайська базова ставка за кредитами (Loan Prime Rate). Зміни
              впливають на апетит до ризику в Азії.
            </dd>

            <dt>
              <b>UK Rightmove House Price</b>
            </dt>
            <dd>Провідний індикатор ринку житла Великої Британії.</dd>
          </dl>

          <p style={{ opacity: 0.8, marginTop: 8 }}>
            У віджеті висота «стовпчиків» ліворуч від назви події — умовна
            важливість (чим більше, тим сильніший потенційний вплив).
          </p>
        </div>
      )}
    </div>
  );
};

export default EconomicCalendar;
