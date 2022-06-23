import { Injectable, Logger } from '@nestjs/common';
import {
  ContractOrderInfo,
  ContractTokenInfo,
  ContractUserInfo,
  IPFSTokenInfo,
} from './interfaces';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { getTokenInfoModel } from '../common/models/TokenInfoModel';
import axios from 'axios';
import { getOrderInfoModel } from '../common/models/OrderInfoModel';
import { DbService } from '../database/db.service';
import { UpdateOrderParams } from '../database/interfaces';
import { Sleep } from '../utils/utils.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class SubTasksService {
  private readonly logger = new Logger('SubTasksService');

  constructor(
    private configService: ConfigService,
    private dbService: DbService,
    @InjectConnection() private readonly connection: Connection,
    @InjectQueue('order-data-queue-local') private orderDataQueueLocal: Queue,
    @InjectQueue('token-data-queue') private tokenDataQueue: Queue,
  ) {}

  private async getInfoByIpfsUri(ipfsUri: string): Promise<IPFSTokenInfo | ContractUserInfo> {
    const tokenCID = ipfsUri.split(':')[2];

    try {
      const response = await axios(this.configService.get('IPFS_GATEWAY') + tokenCID);
      return (await response.data) as IPFSTokenInfo;
    } catch (err) {
      this.logger.error(err);
    }
  }

  async dealWithNewToken(tokenInfo: ContractTokenInfo, blockNumber: number) {
    const ipfsTokenInfo = (await this.getInfoByIpfsUri(tokenInfo.tokenUri)) as IPFSTokenInfo;

    await this.tokenDataQueue.add('token-create', {
      tokenId: tokenInfo.tokenId,
      blockNumber,
      createTime: parseInt(String(tokenInfo.createTime)),
      category: ipfsTokenInfo.category,
      name: ipfsTokenInfo.name,
      description: ipfsTokenInfo.description,
      royaltyOwner: tokenInfo.royaltyOwner,
      royaltyFee: parseInt(String(tokenInfo.royaltyFee)),
      thumbnail: ipfsTokenInfo.data.thumbnail,
    });

    const TokenInfoModel = getTokenInfoModel(this.connection);
    const tokenInfoDoc = new TokenInfoModel({
      tokenIdHex: '0x' + BigInt(tokenInfo.tokenId).toString(16),
      ...tokenInfo,
      ...ipfsTokenInfo,
    });
    await tokenInfoDoc.findOneAndUpdate({ tokenId: tokenInfo.tokenId }, tokenInfoDoc, {
      upsert: true,
    });
  }

  async dealWithNewOrder(orderInfo: ContractOrderInfo) {
    const ipfsUserInfo = await this.getInfoByIpfsUri(orderInfo.sellerUri);

    const OrderInfoModel = getOrderInfoModel(this.connection);
    const orderInfoDoc = new OrderInfoModel({
      ...orderInfo,
      sellerInfo: ipfsUserInfo,
      tokenIdHex: '0x' + BigInt(orderInfo.tokenId).toString(16),
    });

    await orderInfoDoc.save();
  }

  async updateOrder(orderId: number, params: UpdateOrderParams) {
    if (params.buyerUri) {
      params.buyerInfo = (await this.getInfoByIpfsUri(params.buyerUri)) as ContractUserInfo;
    }

    const result = await this.dbService.updateOrder(orderId, params);
    if (result.matchedCount === 0) {
      this.logger.warn(`Order ${orderId} is not exist yet, put the operation into the queue`);
      await Sleep(1000);
      await this.orderDataQueueLocal.add('update-order', { orderId, params });
    }
  }
}
