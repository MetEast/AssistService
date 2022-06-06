import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from '../database/db.module';
import { UtilsModule } from '../utils/utils.module';
import { SubTasksService } from './sub-tasks.service';
import { DataCheckService } from './data-check.service';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DbModule,
    UtilsModule,
    BullModule.registerQueue({
      name: 'tokenOnOffSaleQueue',
    }),
    BullModule.registerQueue({
      name: 'tokenCreateQueue',
    }),
  ],
  providers: [TasksService, SubTasksService, DataCheckService],
})
export class TasksModule {}
