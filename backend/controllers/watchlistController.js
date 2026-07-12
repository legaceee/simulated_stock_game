import prisma from "../config/prismaClient.js";
import AppError from "../utils/appError.js";
import { CatchAsync } from "../utils/catchAsync.js";

// 1. Get all watchlists with items
export const getWatchlists = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;

  let watchlists = await prisma.watchlist.findMany({
    where: { userId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          stock: true,
          commodity: true,
          fund: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // If user has no watchlist, automatically create a default one
  if (watchlists.length === 0) {
    const defaultList = await prisma.watchlist.create({
      data: {
        name: "My Watchlist",
        userId,
      },
      include: {
        items: {
          include: {
            stock: true,
            commodity: true,
            fund: true,
          },
        },
      },
    });
    watchlists = [defaultList];
  }

  res.status(200).json({
    status: "success",
    data: { watchlists },
  });
});

// 2. Create a new watchlist
export const createWatchlist = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return next(new AppError("Watchlist name is required.", 400));
  }

  const existing = await prisma.watchlist.findUnique({
    where: {
      userId_name: { userId, name: name.trim() },
    },
  });

  if (existing) {
    return next(new AppError("A watchlist with this name already exists.", 400));
  }

  const watchlist = await prisma.watchlist.create({
    data: {
      name: name.trim(),
      userId,
    },
    include: { items: true },
  });

  res.status(201).json({
    status: "success",
    data: { watchlist },
  });
});

// 3. Rename a watchlist
export const renameWatchlist = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return next(new AppError("Watchlist name is required.", 400));
  }

  const watchlist = await prisma.watchlist.findFirst({
    where: { id, userId },
  });

  if (!watchlist) {
    return next(new AppError("Watchlist not found.", 404));
  }

  const updated = await prisma.watchlist.update({
    where: { id },
    data: { name: name.trim() },
  });

  res.status(200).json({
    status: "success",
    data: { watchlist: updated },
  });
});

// 4. Delete a watchlist
export const deleteWatchlist = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  const watchlist = await prisma.watchlist.findFirst({
    where: { id, userId },
  });

  if (!watchlist) {
    return next(new AppError("Watchlist not found.", 404));
  }

  await prisma.watchlist.delete({
    where: { id },
  });

  res.status(200).json({
    status: "success",
    message: "Watchlist deleted successfully.",
  });
});

// 5. Add item to watchlist (can be Stock, Mutual Fund, or Commodity)
export const addWatchlistItem = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { watchlistId, stockId, commodityId, fundId } = req.body;

  const watchlist = await prisma.watchlist.findFirst({
    where: { id: watchlistId, userId },
  });

  if (!watchlist) {
    return next(new AppError("Watchlist not found.", 404));
  }

  // Check if item already exists in this watchlist
  const existing = await prisma.watchlistItem.findFirst({
    where: {
      watchlistId,
      stockId: stockId || null,
      commodityId: commodityId || null,
      fundId: fundId || null,
    },
  });

  if (existing) {
    return next(new AppError("Item is already in this watchlist.", 400));
  }

  // Find max sortOrder to place at end
  const maxOrder = await prisma.watchlistItem.aggregate({
    where: { watchlistId },
    _max: { sortOrder: true },
  });
  const nextOrder = (maxOrder._max.sortOrder || 0) + 1;

  const item = await prisma.watchlistItem.create({
    data: {
      watchlistId,
      stockId: stockId || null,
      commodityId: commodityId || null,
      fundId: fundId || null,
      sortOrder: nextOrder,
    },
    include: {
      stock: true,
      commodity: true,
      fund: true,
    },
  });

  res.status(201).json({
    status: "success",
    data: { item },
  });
});

// 6. Remove item from watchlist
export const removeWatchlistItem = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { itemId } = req.params;

  const item = await prisma.watchlistItem.findUnique({
    where: { id: itemId },
    include: { watchlist: true },
  });

  if (!item || item.watchlist.userId !== userId) {
    return next(new AppError("Watchlist item not found.", 404));
  }

  await prisma.watchlistItem.delete({
    where: { id: itemId },
  });

  res.status(200).json({
    status: "success",
    message: "Item removed from watchlist successfully.",
  });
});

// 7. Update items sorting order (drag and drop)
export const updateItemsOrder = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { watchlistId, itemIds } = req.body; // Array of item IDs in new order

  const watchlist = await prisma.watchlist.findFirst({
    where: { id: watchlistId, userId },
  });

  if (!watchlist) {
    return next(new AppError("Watchlist not found.", 404));
  }

  // Update in a transaction
  await prisma.$transaction(
    itemIds.map((id, index) =>
      prisma.watchlistItem.updateMany({
        where: { id, watchlistId },
        data: { sortOrder: index },
      })
    )
  );

  res.status(200).json({
    status: "success",
    message: "Watchlist ordering updated.",
  });
});

// Backward compatibility (legacy add watchList method)
export const watchList = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { stockId } = req.body;

  let defaultWatchlist = await prisma.watchlist.findFirst({
    where: { userId, name: "My Watchlist" },
  });

  if (!defaultWatchlist) {
    defaultWatchlist = await prisma.watchlist.create({
      data: { name: "My Watchlist", userId },
    });
  }

  // Upsert item
  const existing = await prisma.watchlistItem.findFirst({
    where: { watchlistId: defaultWatchlist.id, stockId },
  });

  if (!existing) {
    await prisma.watchlistItem.create({
      data: { watchlistId: defaultWatchlist.id, stockId, sortOrder: 0 },
    });
  }

  res.status(201).json({
    status: "success",
    message: "Added to default watchlist.",
  });
});
