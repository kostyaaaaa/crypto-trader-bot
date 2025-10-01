import { useState } from 'react';

type CoinIconProps = {
  symbol: string; // наприклад "SOLUSDT"
  size?: number; // px
  className?: string;
  round?: boolean; // якщо true — робимо коло з літерою як фолбек
};

function baseAsset(symbol: string) {
  // Витягуємо базовий актив: "SOLUSDT" -> "sol", "1000SHIBUSDT" -> "shib"
  const s = symbol.toUpperCase().replace(/[-_/]/g, '');
  const m = s.match(/^(\d{1,5})?([A-Z]+?)(USDT|USDC|USD|BTC|ETH|BUSD|PERP)?$/);
  return (m?.[2] ?? s).toLowerCase();
}

export default function CoinIcon({
  symbol,
  size = 18,
  className,
  round = true,
}: CoinIconProps) {
  const [srcIdx, setSrcIdx] = useState(0);
  const base = baseAsset(symbol);

  // Порядок провайдерів: якщо перший не дав іконку — автоматично впаде на наступний
  const sources = [
    // SVG/PNG CDN з величезним покриттям
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/128/color/${base}.png`,
    // Простий API з авто-скейлом
    `https://cryptoicons.org/api/icon/${base}/${size * 2}`,
  ];

  // Якщо всі провайдери не дали іконку — фолбек з літерою
  if (srcIdx >= sources.length) {
    return (
      <span
        title={symbol}
        className={className}
        style={{
          display: 'inline-flex',
          width: size,
          height: size,
          borderRadius: round ? '50%' : 4,
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.max(10, Math.floor(size * 0.55)),
          background: '#eee',
          color: '#555',
          lineHeight: 1,
        }}
      >
        {base.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={sources[srcIdx]}
      alt={symbol}
      title={symbol}
      className={className}
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
      onError={() => setSrcIdx((i) => i + 1)}
    />
  );
}
