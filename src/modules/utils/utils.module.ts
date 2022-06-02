import { Web3Service } from './web3.service';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UtilsService } from './utils.service';

@Module({
  imports: [ConfigModule],
  providers: [Web3Service, UtilsService],
  exports: [Web3Service, UtilsService],
})
export class UtilsModule {}
