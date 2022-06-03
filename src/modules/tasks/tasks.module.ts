import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ScheduleModule } from '@nestjs/schedule';
import { DbModule } from '../database/db.module';
import { UtilsModule } from '../utils/utils.module';
import { SubTasksService } from './sub-tasks.service';
import { DataCheckService } from './data-check.service';

@Module({
  imports: [ScheduleModule.forRoot(), DbModule, UtilsModule],
  providers: [TasksService, SubTasksService, DataCheckService],
})
export class TasksModule {}
