import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Web3Service } from '../utils/web3.service';
import { ConfigService } from '@nestjs/config';
import { DbService } from '../database/db.service';
import { Constants } from '../../constants';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { OrderState } from '../tasks/interfaces';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private web3Service: Web3Service,
    private configService: ConfigService,
    private dbService: DbService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async check() {
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS };
  }

  async getCollectibleByTokenId(tokenId: string) {
    const data = await this.connection.collection('tokens').findOne({ tokenId });
    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async getTokenOrderByTokenId(tokenId: string) {
    const data = await this.connection
      .collection('tokens')
      .aggregate([
        { $match: { tokenId } },
        {
          $lookup: {
            from: 'orders',
            let: { tokenId: '$tokenId' },
            pipeline: [
              { $sort: { createTime: -1 } },
              { $group: { _id: '$tokenId', doc: { $first: '$$ROOT' } } },
              { $replaceRoot: { newRoot: '$doc' } },
              { $match: { $expr: { $eq: ['$tokenId', '$$tokenId'] } } },
              { $project: { _id: 0, tokenId: 0 } },
            ],
            as: 'order',
          },
        },
        { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: data[0] };
  }

  async getTransHistoryByTokenId(tokenId: string) {
    const data = await this.connection
      .collection('orders')
      .aggregate([
        { $match: { tokenId } },
        { $sort: { updateTime: -1 } },
        {
          $lookup: {
            from: 'order_events',
            localField: 'orderId',
            foreignField: 'orderId',
            as: 'events',
          },
        },
        {
          $project: {
            _id: 0,
            'events._id': 0,
            'events.tokenId': 0,
            tokenId: 0,
            quoteToken: 0,
            royaltyOwner: 0,
            royaltyFee: 0,
            sellerUri: 0,
            buyerUri: 0,
            platformFee: 0,
            platformAddr: 0,
          },
        },
      ])
      .toArray();

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async getEarnedByAddress(address: string, isToday: boolean, isReturnList: boolean) {
    const match = {
      orderState: OrderState.Filled,
      $or: [{ royaltyOwner: address }, { seller: address }],
    };

    if (isToday) {
      match['updateTime'] = { $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
      match['updateTime'] = { $lte: new Date(new Date().setHours(23, 59, 59, 999)) };
    }

    const items = await this.connection
      .collection('orders')
      .aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'tokens',
            localField: 'tokenId',
            foreignField: 'tokenId',
            as: 'token',
          },
        },
        { $unwind: { path: '$token' } },
        {
          $project: {
            _id: 0,
            orderType: 1,
            orderState: 1,
            price: 1,
            sellerAddr: 1,
            filled: 1,
            royaltyOwner: 1,
            royaltyFee: 1,
            platformFee: 1,
            updateTime: 1,
            'token.name': 1,
            'token.data.thumbnail': 1,
          },
        },
      ])
      .toArray();

    if (isReturnList) {
      return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data: items };
    }

    let data = 0;
    items.forEach((item) => {
      if (item.royaltyOwner === address) {
        if (item.sellerAddr === address) {
          data += item.price;
        } else {
          data += item.royaltyFee;
        }
      } else {
        data += item.price - item.platformFee - item.royaltyFee;
      }
    });

    return { status: HttpStatus.OK, message: Constants.MSG_SUCCESS, data };
  }

  async test() {
    // this.web3Service.web3RPC.eth.getBlockNumber().then((number) => {
    //   console.log(number);
    //   console.log(typeof number);
    // });
    // const result = await this.web3Service.web3BatchRequest([
    //   {
    //     method: this.web3Service.metContractRPC.methods.tokenInfo(
    //       '103244789162639796336139546484767475042549830186784659157413781488168484689769',
    //     ).call,
    //     params: {},
    //   },
    // ]);
    // console.log(result);
    // this.web3Service.metMarketContractRPC.methods.getOrderById(196).call({}).then(console.log);
    //   this.web3Service.metMarketContractWS.events
    //     .OrderTakenDown({
    //       fromBlock: 0,
    //     })
    //     .on('data', console.log);
    // this.web3Service.metContractWS
    //   .getPastEvents('Transfer', {
    //     fromBlock: 12388014,
    //     toBlock: 'latest',
    //   })
    //   .then(console.log);
  }
}
