import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from '../database/db.module';
import { UtilsModule } from '../utils/utils.module';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenEventSchema } from '../common/models/TokenEventModel';
import { SubTasksService } from './subTasks.service';
import { DataCheckService } from './dataCheck.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DbModule,
    UtilsModule,
    MongooseModule.forFeature([{ name: 'token_events', schema: TokenEventSchema }]),
  ],
  providers: [TasksService, SubTasksService, DataCheckService],
})
export class TasksModule {}
