import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { OrderEventType } from '../tasks/interfaces';
import { UpdateOrderParams } from './interfaces';
import { Sleep } from '../utils/utils.service';

@Injectable()
export class DbService {
  private logger = new Logger('DbService');

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private configService: ConfigService,
  ) {}

  async getTokenEventLastHeight(): Promise<number> {
    const results = await this.connection
      .collection('token_events')
      .find({})
      .sort({ blockNumber: -1 })
      .limit(1)
      .toArray();
    if (results.length > 0) {
      return results[0].blockNumber;
    } else {
      return parseInt(this.configService.get('CONTRACT_MET_DEPLOY'));
    }
  }

  async getOrderEventLastHeight(orderEventType: OrderEventType): Promise<number> {
    const results = await this.connection
      .collection('order_events')
      .find({ eventType: orderEventType })
      .sort({ blockNumber: -1 })
      .limit(1)
      .toArray();
    if (results.length > 0) {
      return results[0].blockNumber;
    } else {
      return parseInt(this.configService.get('CONTRACT_MARKET_DEPLOY'));
    }
  }

  async getBidOrderEventLastHeight(): Promise<number> {
    const results = await this.connection
      .collection('bid_order_events')
      .find({})
      .sort({ blockNumber: -1 })
      .limit(1)
      .toArray();
    if (results.length > 0) {
      return results[0].blockNumber;
    } else {
      return parseInt(this.configService.get('CONTRACT_MARKET_DEPLOY'));
    }
  }

  async updateTokenOwner(tokenId: string, to: string) {
    return await this.connection
      .collection('tokens')
      .updateOne({ tokenId: tokenId }, { $set: { tokenOwner: to } });
  }

  async updateOrder(orderId: number, params: UpdateOrderParams) {
    const result = await this.connection
      .collection('orders')
      .updateOne({ orderId }, { $set: params });

    if (result.matchedCount === 0) {
      this.logger.warn(`updateOrder: orderId ${orderId} not found, retrying...`);
      await Sleep(2000);
      await this.updateOrder(orderId, params);
    }
  }

  async orderCount() {
    return await this.connection.collection('orders').countDocuments();
  }

  async tokenCount() {
    return await this.connection.collection('tokens').countDocuments();
  }
}
