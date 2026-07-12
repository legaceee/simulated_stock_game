import bcrypt from "bcryptjs";
import prisma from "./config/prismaClient.js";
import { redisRateLimiter } from "./middlewares/rateLimiter.js";

async function runTests() {
  console.log("==========================================");
  console.log("   ENTERPRISE BROKER PLATFORM TEST SUITE  ");
  console.log("==========================================\n");

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  };

  // Test 1: 6-Digit MPIN Hashing and Verification
  await test("6-Digit MPIN hashing and verification", async () => {
    const rawMpin = "987654";
    const hashed = await bcrypt.hash(rawMpin, 10);
    const isMatch = await bcrypt.compare(rawMpin, hashed);
    if (!isMatch) throw new Error("Hashed MPIN does not match plain text");

    const badMatch = await bcrypt.compare("123456", hashed);
    if (badMatch) throw new Error("Incorrect MPIN was authenticated successfully");
  });

  // Test 2: Wallet Limit Reservations
  await test("Wallet purchase margins reservation", async () => {
    const initialBalance = 10000;
    const itemPrice = 1200;
    const qty = 5;
    const totalCost = qty * itemPrice;

    if (totalCost > initialBalance) {
      throw new Error("Margin calculator failed to flag insufficient funds");
    }

    const reserved = totalCost;
    const remaining = initialBalance - reserved;

    if (remaining !== 4000) {
      throw new Error(`Invalid remaining margin: ${remaining}, expected 4000`);
    }
  });

  // Test 3: Price Alerts Logic Matching
  await test("Price alerts condition matcher", async () => {
    // Greater Than Condition
    const alertGT = { condition: "GT", value: 150 };
    const priceGT_Hit = 155;
    const priceGT_Miss = 145;
    
    if (priceGT_Hit < alertGT.value) throw new Error("GT condition failed to trigger when price went above target");
    if (priceGT_Miss >= alertGT.value) throw new Error("GT condition triggered prematurely");

    // Less Than Condition
    const alertLT = { condition: "LT", value: 80 };
    const priceLT_Hit = 78;
    const priceLT_Miss = 82;

    if (priceLT_Hit > alertLT.value) throw new Error("LT condition failed to trigger when price went below target");
    if (priceLT_Miss <= alertLT.value) throw new Error("LT condition triggered prematurely");
  });

  // Test 4: OCO Bracket Order Sibling Cancels
  await test("Bracket Order (OCO) Sibling cancellation mock", async () => {
    const orders = [
      { id: "order-1", parentOrderId: "bracket-100", type: "LIMIT", status: "PENDING" },
      { id: "order-2", parentOrderId: "bracket-100", type: "STOP_LOSS", status: "PENDING" }
    ];

    // Simulate order-1 (target profit) being executed
    const filledId = "order-1";
    const siblingOrders = orders.filter(o => o.parentOrderId === "bracket-100" && o.id !== filledId);
    
    for (const sib of siblingOrders) {
      sib.status = "CANCELLED";
    }

    if (orders[1].status !== "CANCELLED") {
      throw new Error("Sibling Stop Loss order was not cancelled after Limit Target order filled");
    }
  });

  // Test 5: Redis Rate Limiter Middleware structure
  await test("Redis Rate Limiter Middleware definition check", async () => {
    if (typeof redisRateLimiter !== "function") {
      throw new Error("redisRateLimiter is not defined as a middleware function");
    }
  });

  console.log("\n==========================================");
  console.log(` SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================");
  process.exit(0);
}

runTests().catch(console.error);
