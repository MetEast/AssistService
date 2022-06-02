import { Injectable, Logger } from '@nestjs/common';
import { Web3Service } from '../utils/web3.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private web3Service: Web3Service, private configService: ConfigService) {}

  getHello(): string {
    this.logger.log('Hello NestJS!');
    return 'Hello World!';
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
