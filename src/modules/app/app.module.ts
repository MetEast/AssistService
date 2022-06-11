import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UtilsModule } from '../utils/utils.module';
import { DbModule } from '../database/db.module';

@Module({
  imports: [ConfigModule, UtilsModule, DbModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
