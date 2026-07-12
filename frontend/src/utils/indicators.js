// Client-side calculations for advanced trading technical indicators

// 1. Simple Moving Average (SMA)
export const calculateSMA = (data, period = 14) => {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    sma.push(+(sum / period).toFixed(2));
  }
  return sma;
};

// 2. Exponential Moving Average (EMA)
export const calculateEMA = (data, period = 14) => {
  const ema = [];
  if (data.length === 0) return [];
  
  let k = 2 / (period + 1);
  let prevEma = data[0].close;
  ema.push(prevEma);

  for (let i = 1; i < data.length; i++) {
    const curEma = data[i].close * k + prevEma * (1 - k);
    ema.push(+curEma.toFixed(2));
    prevEma = curEma;
  }
  
  // Fill first indices with null to make it look clean
  for (let i = 0; i < Math.min(period - 1, ema.length); i++) {
    ema[i] = null;
  }
  
  return ema;
};

// 3. Volume Weighted Average Price (VWAP)
export const calculateVWAP = (data) => {
  const vwap = [];
  let cumulativeTypicalPriceVolume = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume || 100; // fallback volume

    cumulativeTypicalPriceVolume += typicalPrice * volume;
    cumulativeVolume += volume;

    vwap.push(+(cumulativeTypicalPriceVolume / cumulativeVolume).toFixed(2));
  }
  return vwap;
};

// 4. Bollinger Bands (BB)
export const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
  const upper = [];
  const middle = [];
  const lower = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
      continue;
    }

    // Calc SMA (Middle Band)
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const avg = sum / period;
    middle.push(+avg.toFixed(2));

    // Calc Standard Deviation
    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(data[i - j].close - avg, 2);
    }
    const std = Math.sqrt(variance / period);

    upper.push(+(avg + stdDev * std).toFixed(2));
    lower.push(+(avg - stdDev * std).toFixed(2));
  }

  return { upper, middle, lower };
};

// 5. Relative Strength Index (RSI)
export const calculateRSI = (data, period = 14) => {
  const rsi = [];
  if (data.length < period) return Array(data.length).fill(null);

  let gains = 0;
  let losses = 0;

  // First RSI value
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = 0; i < period; i++) {
    rsi.push(null);
  }
  rsi.push(+(100 - 100 / (1 + avgGain / (avgLoss || 1))).toFixed(2));

  // Rest of values smoothed
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgGain / (avgLoss || 0.00001);
    rsi.push(+(100 - 100 / (1 + rs)).toFixed(2));
  }

  return rsi;
};

// 6. MACD (Moving Average Convergence Divergence)
export const calculateMACD = (data, fast = 12, slow = 26, signal = 9) => {
  const fastEma = calculateEMA(data, fast);
  const slowEma = calculateEMA(data, slow);
  
  const macdLine = [];
  const signalLine = [];
  const histogram = [];

  for (let i = 0; i < data.length; i++) {
    if (fastEma[i] === null || slowEma[i] === null) {
      macdLine.push(null);
      continue;
    }
    macdLine.push(+(fastEma[i] - slowEma[i]).toFixed(2));
  }

  // Calculate Signal Line (EMA of MACD Line)
  // Construct a temp array for EMA helper
  const macdData = macdLine.map((val) => ({ close: val || 0 }));
  const tempSignal = calculateEMA(macdData, signal);

  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null || tempSignal[i] === null || i < slow + signal) {
      signalLine.push(null);
      histogram.push(null);
      continue;
    }
    signalLine.push(tempSignal[i]);
    histogram.push(+(macdLine[i] - tempSignal[i]).toFixed(2));
  }

  return { macdLine, signalLine, histogram };
};
