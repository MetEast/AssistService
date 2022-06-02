import { Injectable, Logger } from '@nestjs/common';
import {
  ContractOrderInfo,
  ContractTokenInfo,
  ContractUserInfo,
  IPFSTokenInfo,
  OrderState,
} from './interfaces';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { getTokenInfoModel } from '../common/models/TokenInfoModel';
import axios from 'axios';
import { getOrderInfoModel } from '../common/models/OrderInfoModel';
import { DbService } from '../database/db.service';
import { UpdateOrderParams } from '../database/interfaces';

@Injectable()
export class SubTasksService {
  private readonly logger = new Logger('SubTasksService');

  constructor(
    private configService: ConfigService,
    private dbService: DbService,
    @InjectConnection() private readonly connection: Connection,
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

  async dealWithNewToken(tokenInfo: ContractTokenInfo) {
    const ipfsTokenInfo = await this.getInfoByIpfsUri(tokenInfo.tokenUri);

    const TokenInfoModel = getTokenInfoModel(this.connection);
    const tokenInfoDoc = new TokenInfoModel({
      tokenIdHex: '0x' + BigInt(tokenInfo.tokenId).toString(16),
      ...tokenInfo,
      ...ipfsTokenInfo,
    });
    await tokenInfoDoc.save();
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
      const ipfsUserInfo = await this.getInfoByIpfsUri(params.buyerUri);
      params.buyerInfo = ipfsUserInfo as ContractUserInfo;
    }

    await this.dbService.updateOrder(orderId, params);
  }
}
