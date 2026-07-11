import fs from "fs";
import prisma from "../config/prismaClient.js";
import { publisher } from "../utils/redisClient.js";
import { updateCandles } from "./ohlc.js";
import "./flusher.js";

// Mapping mock prefixes to real Yahoo Finance Nifty 50 NSE symbols
const PREFIX_MAP = {
  "ULTRCEMELT": "ULTRACEMCO.NS",
  "TATASTEELT": "TATASTEEL.NS",
  "DRREDDLABO": "DRREDDY.NS",
  "TATACONSSE": "TCS.NS",
  "STATBANKOF": "SBIN.NS",
  "JSWSTEELTD": "JSWSTEEL.NS",
  "TECHMAHILT": "TECHM.NS",
  "OILNATUGAS": "ONGC.NS",
  "NESTINDILT": "NESTLEIND.NS",
  "INFOLTD": "INFY.NS",
  "ASIAPAINLT": "ASIANPAINT.NS",
  "MARUSUZUIN": "MARUTI.NS",
  "HINDUNILLT": "HINDUNILVR.NS",
  "SUNPHARIND": "SUNPHARMA.NS",
  "LARSTOUBLT": "LT.NS",
  "HCLTECHLTD": "HCLTECH.NS",
  "ADANENTELT": "ADANIENT.NS",
  "NTPCLTD": "NTPC.NS",
  "BHARAIRTLT": "BHARTIARTL.NS",
  "RELIINDULT": "RELIANCE.NS",
  "GRASINDULT": "GRASIM.NS",
  "CIPLLTD": "CIPLA.NS",
  "POWEGRIDCO": "POWERGRID.NS",
  "BAJAFINALT": "BAJFINANCE.NS",
  "KOTAMAHIBA": "KOTAKBANK.NS",
  "ICICBANKLT": "ICICIBANK.NS",
  "MAHIMAHILT": "M&M.NS",
  "ITCLTD": "ITC.NS",
  "HDFCBANKLT": "HDFCBANK.NS",
  "WIPRLTD": "WIPRO.NS"
};

function getYahooSymbol(mockSymbol) {
  const prefix = mockSymbol.replace(/[0-9]/g, "");
  return PREFIX_MAP[prefix] || "RELIANCE.NS";
}

// Low-volatility random walk for realistic real-time tick updates (0.01% - 0.05% per tick)
function getVolatility(price) {
  return 0.0005; // 0.05% max change per 3 seconds
}

function getNewPrice(currentPrice) {
  const volatility = getVolatility(currentPrice);
  const percentChange = (Math.random() - 0.5) * (2 * volatility);
  const change = currentPrice * percentChange;
  return +(currentPrice + change).toFixed(2);
}

let stocks = JSON.parse(fs.readFileSync("stocks.json"));
let stockMap = {};

async function loadStocks() {
  const dbStocks = await prisma.stock.findMany({
    select: { id: true, symbol: true },
  });
  stockMap = Object.fromEntries(dbStocks.map((s) => [s.symbol, s.id]));
}

async function publishInBatches(channel, updates, batchSize = 100) {
  const pipeline = publisher.pipeline();

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    pipeline.publish(channel, JSON.stringify(batch));
  }

  await pipeline.exec();
}

// Scrape Yahoo Finance for real-world prices and sync them to memory and database
async function scrapeRealPrices() {
  console.log("Scraping real-world prices from Yahoo Finance...");
  try {
    const yahooSymbols = Array.from(new Set(Object.values(PREFIX_MAP)));
    const scrapedData = {};

    await Promise.all(
      yahooSymbols.map(async (sym) => {
        try {
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          const json = await res.json();
          const price = json.chart?.result?.[0]?.meta?.regularMarketPrice;
          if (price) {
            scrapedData[sym] = price;
          }
        } catch (err) {
          console.error(`Error scraping ${sym}:`, err.message);
        }
      })
    );

    console.log(`Scraped prices for ${Object.keys(scrapedData).length} Nifty stocks successfully.`);

    const updates = [];
    for (let stock of stocks) {
      const yahooSym = getYahooSymbol(stock.symbol);
      const realPrice = scrapedData[yahooSym];
      if (realPrice) {
        stock.currentPrice = realPrice;
        
        const stockId = stockMap[stock.symbol];
        if (stockId) {
          updates.push({
            id: stockId,
            currentPrice: realPrice,
          });
        }
      }
    }

    if (updates.length > 0) {
      console.log(`Syncing ${updates.length} stock prices to database...`);
      await prisma.$transaction(
        updates.map((up) =>
          prisma.stock.update({
            where: { id: up.id },
            data: { currentPrice: up.currentPrice },
          })
        )
      );
      console.log("Database stock prices synchronized successfully.");
    }
  } catch (err) {
    console.error("Failed to run real-world price scraper:", err);
  }
}

async function updateMockPricesDB() {
  const redisUpdates = [];

  for (let stock of stocks) {
    stock.currentPrice = getNewPrice(stock.currentPrice);

    const stockId = stockMap[stock.symbol];
    if (!stockId) {
      console.error(`Stock ${stock.symbol} not found in DB`);
      continue;
    }

    const update = {
      stockId,
      symbol: stock.symbol,
      price: stock.currentPrice,
      timeStamp: new Date().toISOString(),
    };

    redisUpdates.push(update);

    updateCandles(update);
  }

  // Publish in smaller JSON batches (100 per message)
  if (redisUpdates.length > 0) {
    await publishInBatches("stock-prices", redisUpdates, 100);
  }

  console.log("New simulated prices published at", new Date().toLocaleTimeString());
}

export default async function updateStock() {
  await loadStocks();
  
  // Scrape immediately on startup
  await scrapeRealPrices();

  // Run real scraper every 60 seconds
  setInterval(scrapeRealPrices, 60000);

  // Run mock price tick updater every 3 seconds for WebSocket feed
  setInterval(updateMockPricesDB, 3000);
}
