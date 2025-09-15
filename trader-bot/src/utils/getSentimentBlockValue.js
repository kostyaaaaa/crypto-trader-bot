export function getSentimentBlock(lastCandle) {
  let sentLONG = 0,
    sentSHORT = 0;

  if (lastCandle.fundingRate > 0.05) {
    sentSHORT += 100;
  } else if (lastCandle.fundingRate < -0.05) {
    sentLONG += 100;
  } else {
    sentLONG += 50;
    sentSHORT += 50;
  }

  return { sentLONG, sentSHORT };
}
