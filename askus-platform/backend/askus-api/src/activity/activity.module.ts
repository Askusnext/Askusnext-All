import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../identity/identity.entities';
import { ActivityController } from './activity.controller';
import { ActivityLog } from './activity.entities';
import { ActivityService } from './activity.service';

// Global so loans, insurance, tickets, timesheet and login can all record what staff do.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog, User])],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
