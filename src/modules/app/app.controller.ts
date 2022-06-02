import { Controller, Get, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

interface Res {
  test: string;
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/hello')
  test(@Req() req: Request): Res {
    console.log(this.configService.get('MONGO_DB_HOST'));
    return { test: 'test' };
  }
}
