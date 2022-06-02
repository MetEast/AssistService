import { Module } from '@nestjs/common';
import { AppModule } from './app/app.module';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(`mongodb://54.178.212.109/meteast_assist`),
    AppModule,
    TasksModule,
  ],
  exports: [],
  providers: [],
})
export class MainModule {}
