import fs from "fs";
import path from "path";
import prisma from "../config/prismaClient.js";
import { publisher } from "../utils/redisClient.js";
import { updateCandles } from "./ohlc.js";
import "./flusher.js";

// Prefix maps for Yahoo Finance scrape
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

const SECTOR_IDS = ["Technology", "Banking", "Energy", "Steel", "Telecom", "Healthcare", "Consumer"];
const SECTOR_MAP = {
  "TATACONSSE": "Technology", "TECHMAHILT": "Technology", "INFOLTD": "Technology", "HCLTECHLTD": "Technology", "WIPRLTD": "Technology",
  "STATBANKOF": "Banking", "KOTAMAHIBA": "Banking", "ICICBANKLT": "Banking", "HDFCBANKLT": "Banking", "BAJAFINALT": "Banking",
  "OILNATUGAS": "Energy", "NTPCLTD": "Energy", "RELIINDULT": "Energy", "POWEGRIDCO": "Energy",
  "TATASTEELT": "Steel", "JSWSTEELTD": "Steel",
  "BHARAIRTLT": "Telecom",
  "DRREDDLABO": "Healthcare", "SUNPHARIND": "Healthcare", "CIPLLTD": "Healthcare",
  "NESTINDILT": "Consumer", "ASIAPAINLT": "Consumer", "MARUSUZUIN": "Consumer", "HINDUNILLT": "Consumer", "GRASINDULT": "Consumer", "ITCLTD": "Consumer"
};

function getYahooSymbol(mockSymbol) {
  const prefix = mockSymbol.replace(/[0-9]/g, "");
  return PREFIX_MAP[prefix] || "RELIANCE.NS";
}

let stocks = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "stocks.json")));
let stockMap = {};
let commodityMap = {};
let stockDailyOpens = {};
let commodityDailyOpens = {};

async function loadAssets() {
  const dbStocks = await prisma.stock.findMany({ select: { id: true, symbol: true, currentPrice: true } });
  stockMap = Object.fromEntries(dbStocks.map((s) => [s.symbol, s.id]));
  dbStocks.forEach(s => {
    if (!stockDailyOpens[s.symbol]) stockDailyOpens[s.symbol] = s.currentPrice;
  });

  const dbCommodities = await prisma.commodity.findMany({ select: { id: true, symbol: true, currentPrice: true } });
  commodityMap = Object.fromEntries(dbCommodities.map((c) => [c.symbol, c.id]));
  dbCommodities.forEach(c => {
    if (!commodityDailyOpens[c.symbol]) commodityDailyOpens[c.symbol] = c.currentPrice;
  });
}

// Scrape Yahoo Finance Nifty prices
async function scrapeRealPrices() {
  const simPaused = (await publisher.get("sim:paused")) === "true";
  if (simPaused) return;

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
          // ignore
        }
      })
    );

    const updates = [];
    for (let stock of stocks) {
      const yahooSym = getYahooSymbol(stock.symbol);
      const realPrice = scrapedData[yahooSym];
      if (realPrice) {
        stock.currentPrice = realPrice;
        const stockId = stockMap[stock.symbol];
        if (stockId) {
          updates.push({ id: stockId, currentPrice: realPrice });
        }
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((up) =>
          prisma.stock.update({
            where: { id: up.id },
            data: { currentPrice: up.currentPrice },
          })
        )
      );
    }
  } catch (err) {
    console.error("Failed to run real-world scraper:", err.message);
  }
}

// Check market trading hours
function isMarketOpen() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 6 = Sat
  if (day === 0 || day === 6) return false; // closed on weekends

  const hours = now.getHours();
  const mins = now.getMinutes();
  const totalMins = hours * 60 + mins;

  const openMins = 9 * 60 + 15; // 9:15 AM
  const closeMins = 15 * 60 + 30; // 3:30 PM

  return totalMins >= openMins && totalMins <= closeMins;
}

// Generate new price with sector sentiment, volatility, and circuit breakers
function calculateWalkedPrice(symbol, currentPrice, dailyOpen, isCommodity = false) {
  // Low volatility random walk
  let volatility = isCommodity ? 0.0002 : 0.0004; // commodities slightly less volatile
  
  // Sector sentiment factor for stocks
  let sectorFactor = 0;
  if (!isCommodity) {
    const cleanPrefix = symbol.replace(/[0-9]/g, "");
    const sector = SECTOR_MAP[cleanPrefix];
    if (sector) {
      // Dynamic random walk sector sentiment
      const seed = new Date().getSeconds() + symbol.charCodeAt(0);
      sectorFactor = ((seed % 10) - 5) * 0.00008; // small sector push
    }
  }

  const randomWalk = (Math.random() - 0.5) * (2 * volatility);
  let newPrice = currentPrice * (1 + randomWalk + sectorFactor);

  // Circuit Breaker (+/- 10% of daily open price limit)
  if (dailyOpen) {
    const upperLimit = dailyOpen * 1.10;
    const lowerLimit = dailyOpen * 0.90;

    if (newPrice > upperLimit) {
      newPrice = upperLimit;
    } else if (newPrice < lowerLimit) {
      newPrice = lowerLimit;
    }
  }

  return +newPrice.toFixed(2);
}

// Trigger user price alerts
async function checkPriceAlerts(symbol, currentPrice, assetType) {
  const alerts = await prisma.priceAlert.findMany({
    where: {
      symbol,
      assetType,
      status: "PENDING"
    }
  });

  for (const alert of alerts) {
    let triggered = false;
    if (alert.condition === "GT" && currentPrice >= alert.value) {
      triggered = true;
    } else if (alert.condition === "LT" && currentPrice <= alert.value) {
      triggered = true;
    }

    if (triggered) {
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: { status: "TRIGGERED" }
      });

      // Track audit log
      await prisma.auditLog.create({
        data: {
          userId: alert.userId,
          action: "PRICE_ALERT_HIT",
          details: `Alert hit: ${symbol} is now ₹${currentPrice} (${alert.condition} ${alert.value})`
        }
      });

      // Publish alert to Redis to stream via socket.io
      await publisher.publish(
        "price-alerts",
        JSON.stringify({
          userId: alert.userId,
          alertId: alert.id,
          symbol,
          price: currentPrice,
          condition: alert.condition,
          targetValue: alert.value,
          message: `Alert Triggered! ${symbol} has reached ₹${currentPrice.toFixed(2)}.`
        })
      );
    }
  }
}

// Process pending Limit, Stop Loss, GTT, and OCO Bracket/Cover orders
async function processPendingOrders(symbol, currentPrice, assetType, stockId) {
  const orders = await prisma.order.findMany({
    where: {
      symbol,
      assetType,
      status: "PENDING"
    }
  });

  for (const order of orders) {
    let shouldFill = false;

    // LIMIT
    if (order.type === "LIMIT") {
      if (order.side === "BUY" && currentPrice <= Number(order.limitPrice)) {
        shouldFill = true;
      } else if (order.side === "SELL" && currentPrice >= Number(order.limitPrice)) {
        shouldFill = true;
      }
    }
    // STOP_LOSS
    else if (order.type === "STOP_LOSS" || order.type === "STOP_LIMIT") {
      const trigger = Number(order.triggerPrice || order.limitPrice);
      if (order.side === "BUY" && currentPrice >= trigger) {
        shouldFill = true;
      } else if (order.side === "SELL" && currentPrice <= trigger) {
        shouldFill = true;
      }
    }
    // GTT (Good Till Triggered)
    else if (order.type === "GTT") {
      const target = Number(order.limitPrice || order.triggerPrice);
      if (order.side === "BUY" && currentPrice <= target) {
        shouldFill = true;
      } else if (order.side === "SELL" && currentPrice >= target) {
        shouldFill = true;
      }
    }

    if (shouldFill) {
      await executeOrderFill(order, currentPrice, stockId);
    }
  }
}

// Settle order fill, update balances & portfolios
async function executeOrderFill(order, fillPrice, stockId) {
  try {
    const totalValue = order.qty * fillPrice;

    await prisma.$transaction(async (tx) => {
      // 1) Handle Buy Side
      if (order.side === "BUY") {
        const orderPrice = Number(order.limitPrice || fillPrice);
        const originalReserve = order.qty * orderPrice;
        const refund = originalReserve - totalValue;

        // Debit reserved cash, credit any refund difference
        await tx.user.update({
          where: { id: order.userId },
          data: {
            reservedCash: { decrement: originalReserve },
            cashBalance: { increment: refund > 0 ? refund : 0 }
          }
        });

        // Add to holdings
        if (order.assetType === "STOCK") {
          let portfolio = await tx.portfolio.findFirst({ where: { userId: order.userId } });
          if (!portfolio) {
            portfolio = await tx.portfolio.create({ data: { userId: order.userId, name: "Default Portfolio" } });
          }

          let holding = await tx.portfolioItem.findFirst({
            where: { portfolioId: portfolio.id, stockId: order.stockId }
          });

          if (holding) {
            const newQty = holding.quantity + order.qty;
            const newAvg = (holding.avgBuyPrice * holding.quantity + totalValue) / newQty;
            await tx.portfolioItem.update({
              where: { id: holding.id },
              data: { quantity: newQty, avgBuyPrice: newAvg }
            });
          } else {
            await tx.portfolioItem.create({
              data: { portfolioId: portfolio.id, stockId: order.stockId, quantity: order.qty, avgBuyPrice: fillPrice }
            });
          }
        } else if (order.assetType === "COMMODITY") {
          const comm = await tx.commodity.findUnique({ where: { symbol: order.symbol } });
          let holding = await tx.commodityPortfolioItem.findFirst({
            where: { userId: order.userId, commodityId: comm.id }
          });

          if (holding) {
            const newQty = holding.quantity + order.qty;
            const newAvg = (holding.avgBuyPrice * holding.quantity + totalValue) / newQty;
            await tx.commodityPortfolioItem.update({
              where: { id: holding.id },
              data: { quantity: newQty, avgBuyPrice: newAvg }
            });
          } else {
            await tx.commodityPortfolioItem.create({
              data: { userId: order.userId, commodityId: comm.id, quantity: order.qty, avgBuyPrice: fillPrice }
            });
          }
        }
      } 
      // 2) Handle Sell Side
      else {
        if (order.assetType === "STOCK") {
          const portfolio = await tx.portfolio.findFirst({ where: { userId: order.userId } });
          const holding = await tx.portfolioItem.findFirst({
            where: { portfolioId: portfolio.id, stockId: order.stockId }
          });

          if (!holding || holding.quantity < order.qty) {
            throw new Error("Insufficient share balance to execute pending sell order.");
          }

          if (holding.quantity === order.qty) {
            await tx.portfolioItem.delete({ where: { id: holding.id } });
          } else {
            await tx.portfolioItem.update({
              where: { id: holding.id },
              data: { quantity: { decrement: order.qty } }
            });
          }
        } else if (order.assetType === "COMMODITY") {
          const comm = await tx.commodity.findUnique({ where: { symbol: order.symbol } });
          const holding = await tx.commodityPortfolioItem.findFirst({
            where: { userId: order.userId, commodityId: comm.id }
          });

          if (!holding || holding.quantity < order.qty) {
            throw new Error("Insufficient commodity balance to execute pending sell order.");
          }

          if (holding.quantity === order.qty) {
            await tx.commodityPortfolioItem.delete({ where: { id: holding.id } });
          } else {
            await tx.commodityPortfolioItem.update({
              where: { id: holding.id },
              data: { quantity: { decrement: order.qty } }
            });
          }
        }

        // Add cash to user wallet balance
        await tx.user.update({
          where: { id: order.userId },
          data: { cashBalance: { increment: totalValue } }
        });
      }

      // Compute brokerage, charges, gst
      const brokerage = Math.min(20, totalValue * 0.0005);
      const charges = totalValue * 0.0002;
      const gst = (brokerage + charges) * 0.18;
      let pnl = 0;
      if (order.side === "SELL") {
        if (order.assetType === "STOCK" && order.stockId) {
          const portfolio = await tx.portfolio.findFirst({ where: { userId: order.userId } });
          if (portfolio) {
            const holding = await tx.portfolioItem.findFirst({
              where: { portfolioId: portfolio.id, stockId: order.stockId }
            });
            if (holding) {
              pnl = (fillPrice - holding.avgBuyPrice) * order.qty;
            }
          }
        } else if (order.assetType === "COMMODITY") {
          const comm = await tx.commodity.findUnique({ where: { symbol: order.symbol } });
          if (comm) {
            const holding = await tx.commodityPortfolioItem.findFirst({
              where: { userId: order.userId, commodityId: comm.id }
            });
            if (holding) {
              pnl = (fillPrice - holding.avgBuyPrice) * order.qty;
            }
          }
        }
      }

      // 3) Record transaction logs
      await tx.transaction.create({
        data: {
          userId: order.userId,
          stockId: order.assetType === "STOCK" ? order.stockId : null,
          type: order.side === "BUY" ? "BUY" : "SELL",
          quantity: order.qty,
          price: fillPrice,
          totalValue,
          assetType: order.assetType || "STOCK",
          symbol: order.symbol,
          brokerage,
          charges,
          gst,
          profitOrLoss: pnl,
          orderId: order.id,
          status: "COMPLETED",
          description: `Execution of pending ${order.side} order for ${order.qty} ${order.symbol}`
        }
      });

      // 4) Update order status to COMPLETED
      await tx.order.update({
        where: { id: order.id },
        data: { status: "COMPLETED", filledQty: order.qty }
      });
      
      // OCO (One Cancels the Other) Bracket Order Handling
      if (order.parentOrderId) {
        // Cancel the sibling order (e.g. if target price is hit, cancel the stop loss)
        await tx.order.updateMany({
          where: {
            parentOrderId: order.parentOrderId,
            id: { not: order.id },
            status: "PENDING"
          },
          data: { status: "CANCELLED" }
        });
      }
    });

    console.log(`[ORDER MATCH ENGINE] Filled pending order ID: ${order.id} for ${order.symbol} at ₹${fillPrice}`);
  } catch (err) {
    console.error(`Failed to execute order fill matching:`, err.message);
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "REJECTED" }
    });
  }
}

// Walk prices for both stocks and commodities
async function updateMockPricesDB() {
  const simPaused = (await publisher.get("sim:paused")) === "true";
  
  // Enforce trading hours in production. We can disable this check in dev mode if needed
  const isTradingOpen = isMarketOpen();
  const forceSimInDev = true; // allow developer testing anytime

  if (simPaused || (!isTradingOpen && !forceSimInDev)) {
    if (simPaused) {
      console.log("Mock updates paused by developer control.");
    } else {
      console.log("Mock updates closed. Outside trading hours (9:15 AM - 3:30 PM Mon-Fri).");
    }
    return;
  }

  const redisUpdates = [];
  const nowStr = new Date().toISOString();

  // 1) Update Stocks
  for (let stock of stocks) {
    const dailyOpen = stockDailyOpens[stock.symbol];
    stock.currentPrice = calculateWalkedPrice(stock.symbol, stock.currentPrice, dailyOpen, false);

    const stockId = stockMap[stock.symbol];
    if (stockId) {
      redisUpdates.push({
        stockId,
        symbol: stock.symbol,
        price: stock.currentPrice,
        timeStamp: nowStr,
        assetType: "STOCK"
      });

      updateCandles({
        stockId,
        symbol: stock.symbol,
        price: stock.currentPrice,
        timeStamp: nowStr
      });

      // Check alerts
      await checkPriceAlerts(stock.symbol, stock.currentPrice, "STOCK");

      // Match orders
      await processPendingOrders(stock.symbol, stock.currentPrice, "STOCK", stockId);
    }
  }

  // 2) Update Commodities
  try {
    const dbCommodities = await prisma.commodity.findMany({ select: { id: true, symbol: true, currentPrice: true } });
    for (const comm of dbCommodities) {
      const dailyOpen = commodityDailyOpens[comm.symbol];
      const newPrice = calculateWalkedPrice(comm.symbol, comm.currentPrice, dailyOpen, true);
      
      // Update in db
      await prisma.commodity.update({
        where: { id: comm.id },
        data: { currentPrice: newPrice }
      });

      redisUpdates.push({
        stockId: comm.id,
        symbol: comm.symbol,
        price: newPrice,
        timeStamp: nowStr,
        assetType: "COMMODITY"
      });

      // Check alerts
      await checkPriceAlerts(comm.symbol, newPrice, "COMMODITY");

      // Match orders
      await processPendingOrders(comm.symbol, newPrice, "COMMODITY", comm.id);
    }
  } catch (err) {
    console.error("Commodities simulation failed:", err.message);
  }

  // 3) Publish updates to Redis
  if (redisUpdates.length > 0) {
    const pipeline = publisher.pipeline();
    // Publish in batches of 100
    for (let i = 0; i < redisUpdates.length; i += 100) {
      const batch = redisUpdates.slice(i, i + 100);
      pipeline.publish("stock-prices", JSON.stringify(batch));
    }
    await pipeline.exec();
  }

  console.log("New walked prices and matched orders computed at", new Date().toLocaleTimeString());
}

export default async function updateStock() {
  await loadAssets();
  
  // Scrape immediately on startup
  await scrapeRealPrices();

  // Run real scraper every 60 seconds
  setInterval(scrapeRealPrices, 60000);

  // Run mock price tick updater every 3 seconds for WebSocket feed
  setInterval(updateMockPricesDB, 3000);
}
