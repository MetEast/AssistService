import { NestFactory } from '@nestjs/core';
import { MainModule } from './modules/main.module';
import { ConfigService } from '@nestjs/config';
import { AppService } from './modules/app/app.service';

async function bootstrap() {
  const app = await NestFactory.create(MainModule);

  //for testing
  const appService = app.get(AppService);
  await appService.test();

  const configService = app.get(ConfigService);
  await app.listen(configService.get('LISTEN_PORT'));
}
bootstrap().then(() => console.log('Application start successfully!!!'));
