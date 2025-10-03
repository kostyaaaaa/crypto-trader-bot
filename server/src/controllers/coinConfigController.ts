import { CoinConfigModel, ICoinConfig } from 'crypto-trader-db';
import { Request, Response } from 'express';
import logger from '../utils/Logger.js';
import { ApiErrorResponse } from './common.type.js';

// Response interfaces
interface CoinConfigResponse {
  success: boolean;
  message: string;
  data: ICoinConfig;
  timestamp: string;
}

interface CoinConfigListResponse {
  success: boolean;
  message: string;
  data: ICoinConfig[];
  count: number;
  timestamp: string;
}

interface CoinConfigDeleteResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

// Create a new coin configuration
const createCoinConfig = async (
  req: Request,
  res: Response<CoinConfigResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const coinConfigData: Omit<ICoinConfig, 'createdAt' | 'updatedAt'> =
      req.body;

    // Check if config already exists
    const existingConfig = await CoinConfigModel.findBySymbol(
      coinConfigData.symbol,
    );
    if (existingConfig) {
      res.status(409).json({
        error: 'Configuration already exists',
        message: `Configuration for symbol ${coinConfigData.symbol} already exists. Use PUT to update.`,
      });
      return;
    }

    const newConfig = new CoinConfigModel(coinConfigData);
    const savedConfig = await newConfig.save();

    logger.success(
      `Successfully created coin configuration for symbol: ${coinConfigData.symbol}`,
    );

    res.status(201).json({
      success: true,
      message: 'Coin configuration created successfully',
      data: savedConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error creating coin configuration', {
      message: error.message,
      stack: error.stack,
    });

    if (error.name === 'ValidationError') {
      res.status(400).json({
        error: 'Validation failed',
        message: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Failed to create coin configuration',
        message: error.message,
      });
    }
  }
};

// Get all coin configurations
const getAllCoinConfigs = async (
  req: Request,
  res: Response<CoinConfigListResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const configs = await CoinConfigModel.find({}).sort({ symbol: 1 });

    logger.success(
      `Successfully fetched ${configs.length} coin configurations`,
    );

    res.json({
      success: true,
      message: 'Coin configurations retrieved successfully',
      data: configs,
      count: configs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error fetching coin configurations', {
      message: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Failed to fetch coin configurations',
      message: error.message,
    });
  }
};

// Get a specific coin configuration by symbol
const getCoinConfigBySymbol = async (
  req: Request,
  res: Response<CoinConfigResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol } = req.params;

    const config = await CoinConfigModel.findBySymbol(symbol);

    if (!config) {
      res.status(404).json({
        error: 'Configuration not found',
        message: `No configuration found for symbol: ${symbol}`,
      });
      return;
    }

    logger.success(
      `Successfully fetched coin configuration for symbol: ${symbol}`,
    );

    res.json({
      success: true,
      message: 'Coin configuration retrieved successfully',
      data: config,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(
      `Error fetching coin configuration for symbol: ${req.params.symbol}`,
      {
        message: error.message,
        stack: error.stack,
      },
    );

    res.status(500).json({
      error: 'Failed to fetch coin configuration',
      message: error.message,
    });
  }
};

// Update a coin configuration
const updateCoinConfig = async (
  req: Request,
  res: Response<CoinConfigResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol } = req.params;
    const updateData: Partial<ICoinConfig> = req.body;

    // Ensure symbol in body matches URL parameter
    if (updateData.symbol && updateData.symbol !== symbol) {
      res.status(400).json({
        error: 'Symbol mismatch',
        message: 'Symbol in request body must match URL parameter',
      });
      return;
    }

    const updatedConfig = await CoinConfigModel.findOneAndUpdate(
      { symbol },
      updateData,
      {
        new: true,
        runValidators: true,
        upsert: false, // Don't create if doesn't exist
      },
    );

    if (!updatedConfig) {
      res.status(404).json({
        error: 'Configuration not found',
        message: `No configuration found for symbol: ${symbol}`,
      });
      return;
    }

    logger.success(
      `Successfully updated coin configuration for symbol: ${symbol}`,
    );

    res.json({
      success: true,
      message: 'Coin configuration updated successfully',
      data: updatedConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(
      `Error updating coin configuration for symbol: ${req.params.symbol}`,
      {
        message: error.message,
        stack: error.stack,
      },
    );

    if (error.name === 'ValidationError') {
      res.status(400).json({
        error: 'Validation failed',
        message: error.message,
      });
    } else {
      res.status(500).json({
        error: 'Failed to update coin configuration',
        message: error.message,
      });
    }
  }
};

// Delete a coin configuration
const deleteCoinConfig = async (
  req: Request,
  res: Response<CoinConfigDeleteResponse | ApiErrorResponse>,
): Promise<void> => {
  try {
    const { symbol } = req.params;

    const deletedConfig = await CoinConfigModel.findOneAndDelete({ symbol });

    if (!deletedConfig) {
      res.status(404).json({
        error: 'Configuration not found',
        message: `No configuration found for symbol: ${symbol}`,
      });
      return;
    }

    logger.success(
      `Successfully deleted coin configuration for symbol: ${symbol}`,
    );

    res.json({
      success: true,
      message: `Coin configuration for ${symbol} deleted successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(
      `Error deleting coin configuration for symbol: ${req.params.symbol}`,
      {
        message: error.message,
        stack: error.stack,
      },
    );

    res.status(500).json({
      error: 'Failed to delete coin configuration',
      message: error.message,
    });
  }
};

export {
  createCoinConfig,
  deleteCoinConfig,
  getAllCoinConfigs,
  getCoinConfigBySymbol,
  updateCoinConfig,
};
