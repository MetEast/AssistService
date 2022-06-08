import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { UpdateOrderParams } from '../database/interfaces';
import { SubTasksService } from './sub-tasks.service';

@Processor('order-data-queue')
export class OrderDataConsumer {
  private readonly logger = new Logger('OrderDataConsumer');

  constructor(
    @InjectQueue('order-data-queue') private orderDataQueue: Queue,
    private subTasksService: SubTasksService,
  ) {}

  @Process('update-order')
  async tokenSale(job: Job<{ orderId: number; params: UpdateOrderParams }>) {
    this.logger.log(`Processing job ['token-on-off-sale'] data: ${JSON.stringify(job.data)}`);
    await this.subTasksService.updateOrder(job.data.orderId, job.data.params);
  }
}
